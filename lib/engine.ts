import { vertexShaderSource, fragmentShaderSource, quadVertexShaderSource, quadFragmentShaderSource } from './shaders';
import { getPrismGeometry, getPolygonGeometry, getFiberGeometry, getLensUIGeometry, getParabolicMirrorGeometry, vadd, vec, vrot, distToSegment } from './math';
import { AppState, OpticElement, Vector2 } from '../types';
import { playSound } from './audio';
import { buildSceneData } from './sceneData';
import { cloneDeep } from './state';

export class OpticsEngine {
    gl: WebGL2RenderingContext;
    ctx: CanvasRenderingContext2D;
    uiCanvas: HTMLCanvasElement;
    program: WebGLProgram;
    quadProgram: WebGLProgram;
    uniformLocs: any;
    quadUniformLocs: any;
    vao: WebGLVertexArrayObject;
    quadVao: WebGLVertexArrayObject;
    quadBuffer: WebGLBuffer;
    segmentsTex: WebGLTexture;
    
    accumFBO: WebGLFramebuffer;
    accumTex: WebGLTexture;
    accumulatedFrames: number = 0;
    
    width: number = 0;
    height: number = 0;
    
    getState: () => AppState;
    onStateChange: (recordHistory?: boolean) => void;
    cleanupFns: Array<() => void> = [];
    frameId: number | null = null;
    disposed = false;
    
    renderRequested = false;
    
    hoveredVertex: { elemIdx: number, vIdx: number } | null = null;
    hoveredEdge: { elemIdx: number, eIdx: number } | null = null;
    draggingVertex: { elemIdx: number, vIdx: number } | null = null;
    draggingElements: number[] = [];
    marqueeStart: Vector2 | null = null;
    marqueeEnd: Vector2 | null = null;
    hoveredHandle: 'rotation' | 'scale' | null = null;
    draggingHandle: 'rotation' | 'scale' | null = null;
    draggingCamera: boolean = false;
    spacePressed: boolean = false;
    dragOffsets: Vector2[] = [];
    cameraDragStart: Vector2 = { x: 0, y: 0 };
    initialCameraPos: Vector2 = { x: 0, y: 0 };
    initialRotation: number = 0;
    initialAngle: number = 0;
    initialDist: number = 0;
    initialSize: number = 0;
    initialSize2: number = 0;
    initialPts: Vector2[] = [];
    initialGroupElements: OpticElement[] = [];
    initialGroupCenter: Vector2 = { x: 0, y: 0 };

    constructor(
        glCanvas: HTMLCanvasElement, 
        uiCanvas: HTMLCanvasElement, 
        getState: () => AppState,
        onStateChange: (recordHistory?: boolean) => void
    ) {
        this.gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false })!;
        this.ctx = uiCanvas.getContext('2d')!;
        this.uiCanvas = uiCanvas;
        this.getState = getState;
        this.onStateChange = onStateChange;
        
        if (!this.gl) throw new Error("WebGL 2.0 not supported");
        
        // Enable floating point textures for accumulation
        this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('EXT_color_buffer_half_float');
        
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.quadProgram = this.createProgram(quadVertexShaderSource, quadFragmentShaderSource);
        
        this.uniformLocs = {
            res: this.gl.getUniformLocation(this.program, "u_resolution"), 
            lPos: this.gl.getUniformLocation(this.program, "u_lightPos"), 
            lDir: this.gl.getUniformLocation(this.program, "u_lightDir"), 
            bWidth: this.gl.getUniformLocation(this.program, "u_beamWidth"),
            disp: this.gl.getUniformLocation(this.program, "u_dispersion"), 
            envN: this.gl.getUniformLocation(this.program, "u_envN"), 
            bAlpha: this.gl.getUniformLocation(this.program, "u_baseAlpha"), 
            cType: this.gl.getUniformLocation(this.program, "u_colorType"), 
            wLen: this.gl.getUniformLocation(this.program, "u_wavelength"),
            totalRays: this.gl.getUniformLocation(this.program, "u_totalRays"), 
            camPos: this.gl.getUniformLocation(this.program, "u_cameraPos"),
            camZoom: this.gl.getUniformLocation(this.program, "u_cameraZoom"),
            seedOffset: this.gl.getUniformLocation(this.program, "u_seedOffset"),
            nSegs: this.gl.getUniformLocation(this.program, "u_numSegments"), 
            segmentsTex: this.gl.getUniformLocation(this.program, "u_segmentsTex"),
            groupBBox: this.gl.getUniformLocation(this.program, "u_groupBBox"),
            nArcs: this.gl.getUniformLocation(this.program, "u_numArcs"), 
            arcs: this.gl.getUniformLocation(this.program, "u_arcs"), 
            arcLimits: this.gl.getUniformLocation(this.program, "u_arcLimits"), 
            arcProps: this.gl.getUniformLocation(this.program, "u_arcProps"),
            nCircs: this.gl.getUniformLocation(this.program, "u_numCircles"), 
            circs: this.gl.getUniformLocation(this.program, "u_circles"), 
            cProps: this.gl.getUniformLocation(this.program, "u_circProps"),
            nParabolas: this.gl.getUniformLocation(this.program, "u_numParabolas"),
            parabolas: this.gl.getUniformLocation(this.program, "u_parabolas"),
            parabolaOrientation: this.gl.getUniformLocation(this.program, "u_parabolaOrientation")
        };
        
        this.quadUniformLocs = {
            accumTex: this.gl.getUniformLocation(this.quadProgram, "u_accumTex"),
            accumFrames: this.gl.getUniformLocation(this.quadProgram, "u_accumFrames")
        };
        
        this.segmentsTex = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.segmentsTex);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, 4096, 2, 0, this.gl.RGBA, this.gl.FLOAT, null);

        this.vao = this.gl.createVertexArray()!;
        
        // Setup Screen Quad
        this.quadVao = this.gl.createVertexArray()!;
        this.gl.bindVertexArray(this.quadVao);
        this.quadBuffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1, 1,  1, 1
        ]), this.gl.STATIC_DRAW);
        const posLoc = this.gl.getAttribLocation(this.quadProgram, "a_pos");
        if (posLoc >= 0) {
            this.gl.enableVertexAttribArray(posLoc);
            this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
        }
        
        // Setup Accumulation FBO
        this.accumTex = this.gl.createTexture()!;
        this.accumFBO = this.gl.createFramebuffer()!;
        
        this.setupEvents();
    }

    createProgram(vsSource: string, fsSource: string) {
        const vs = this.gl.createShader(this.gl.VERTEX_SHADER)!;
        this.gl.shaderSource(vs, vsSource.trim());
        this.gl.compileShader(vs);
        if (!this.gl.getShaderParameter(vs, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(vs));
        }
        
        const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER)!;
        this.gl.shaderSource(fs, fsSource.trim());
        this.gl.compileShader(fs);
        if (!this.gl.getShaderParameter(fs, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(fs));
        }
        
        const prog = this.gl.createProgram()!;
        this.gl.attachShader(prog, vs);
        this.gl.attachShader(prog, fs);
        this.gl.linkProgram(prog);
        this.gl.deleteShader(vs);
        this.gl.deleteShader(fs);
        return prog;
    }

    bindEvent<K extends keyof WindowEventMap>(
        target: Window,
        type: K,
        handler: (event: WindowEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ) {
        target.addEventListener(type, handler as EventListener, options);
        this.cleanupFns.push(() => target.removeEventListener(type, handler as EventListener, options));
    }

    bindCanvasEvent<K extends keyof HTMLElementEventMap>(
        type: K,
        handler: (event: HTMLElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ) {
        this.uiCanvas.addEventListener(type, handler as EventListener, options);
        this.cleanupFns.push(() => this.uiCanvas.removeEventListener(type, handler as EventListener, options));
    }

    resize(w: number, h: number, dpr: number) {
        this.width = w;
        this.height = h;
        this.gl.canvas.width = w * dpr;
        this.gl.canvas.height = h * dpr;
        this.ctx.canvas.width = w * dpr;
        this.ctx.canvas.height = h * dpr;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.gl.viewport(0, 0, w * dpr, h * dpr);
        
        // Resize Accumulation Texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.accumTex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA16F, w * dpr, h * dpr, 0, this.gl.RGBA, this.gl.HALF_FLOAT, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.accumFBO);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.accumTex, 0);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        
        const state = this.getState();
        if (!state.lightSource.initialized) {
            state.lightSource.y = h * 0.5;
            state.lightSource.x = w > 800 ? 300 : w * 0.2;
            state.lightSource.initialized = true;
        }
        this.requestRender();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }

        this.cleanupFns.forEach((cleanup) => cleanup());
        this.cleanupFns = [];

        this.gl.deleteTexture(this.segmentsTex);
        this.gl.deleteTexture(this.accumTex);
        this.gl.deleteFramebuffer(this.accumFBO);
        this.gl.deleteBuffer(this.quadBuffer);
        this.gl.deleteVertexArray(this.vao);
        this.gl.deleteVertexArray(this.quadVao);
        this.gl.deleteProgram(this.program);
        this.gl.deleteProgram(this.quadProgram);
    }

    requestRender() {
        if (this.disposed) return;
        this.accumulatedFrames = 0; // Reset accumulation on any change
        if (!this.renderRequested) {
            this.renderRequested = true;
            this.frameId = requestAnimationFrame(() => this.renderLoop());
        }
    }

    renderLoop() {
        if (this.disposed) return;
        this.renderGPU();
        this.renderUI();
        this.renderRequested = false;
        
        // Continue accumulating if we haven't reached the max frames (e.g., 60 frames * 5000 rays = 300,000 rays)
        if (this.accumulatedFrames < 200) {
            this.renderRequested = true;
            this.frameId = requestAnimationFrame(() => this.renderLoop());
        }
    }

    renderGPU() {
        const state = this.getState();
        
        // 1. Render Rays to Accumulation FBO
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.accumFBO);
        
        if (this.accumulatedFrames === 0) {
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0); 
            this.gl.clear(this.gl.COLOR_BUFFER_BIT); 
            
            // Update scene data only on the first frame of accumulation
            this.updateSceneData(state);
        }
        
        this.gl.enable(this.gl.BLEND); 
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE); 
        this.gl.useProgram(this.program);
        
        this.gl.uniform2f(this.uniformLocs.res, this.width, this.height); 
        this.gl.uniform2f(this.uniformLocs.lPos, state.lightSource.x, state.lightSource.y);
        const rad = state.globals.angle * Math.PI / 180; 
        this.gl.uniform2f(this.uniformLocs.lDir, Math.cos(rad), Math.sin(rad));
        this.gl.uniform1f(this.uniformLocs.bWidth, state.globals.beamWidth); 
        this.gl.uniform1f(this.uniformLocs.disp, state.globals.dispersion);
        this.gl.uniform1f(this.uniformLocs.envN, state.globals.envN); 
        this.gl.uniform1i(this.uniformLocs.cType, state.globals.colorType);
        this.gl.uniform1f(this.uniformLocs.wLen, state.globals.wavelength);
        this.gl.uniform2f(this.uniformLocs.camPos, state.camera.x, state.camera.y);
        this.gl.uniform1f(this.uniformLocs.camZoom, state.camera.zoom);
        this.gl.uniform1f(this.uniformLocs.seedOffset, Math.random());

        const RAYS_PER_FRAME = state.globals.rayCount || 2000; 
        this.gl.uniform1f(this.uniformLocs.totalRays, RAYS_PER_FRAME);
        let density = RAYS_PER_FRAME / Math.max(state.globals.beamWidth, 1.0); 
        let targetAlpha = (12.0 / density) * state.globals.intensity; 
        targetAlpha = Math.max(targetAlpha, 0.005 * state.globals.intensity); 
        this.gl.uniform1f(this.uniformLocs.bAlpha, targetAlpha);

        // Bind segments texture every frame
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.segmentsTex);
        this.gl.uniform1i(this.uniformLocs.segmentsTex, 0);

        this.gl.bindVertexArray(this.vao); 
        this.gl.drawArraysInstanced(this.gl.LINE_STRIP, 0, 400, RAYS_PER_FRAME);
        
        this.accumulatedFrames++;

        // 2. Draw Accumulation Buffer to Screen
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.disable(this.gl.BLEND);
        
        this.gl.useProgram(this.quadProgram);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.accumTex);
        this.gl.uniform1i(this.quadUniformLocs.accumTex, 0);
        this.gl.uniform1f(this.quadUniformLocs.accumFrames, this.accumulatedFrames);
        
        this.gl.bindVertexArray(this.quadVao);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    updateSceneData(state: AppState) {
        const packed = buildSceneData(state);

        this.gl.useProgram(this.program);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.segmentsTex);

        if (packed.segmentCount > 0) {
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, packed.segmentCount, 1, this.gl.RGBA, this.gl.FLOAT, packed.segData.subarray(0, packed.segmentCount * 4));
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 1, packed.segmentCount, 1, this.gl.RGBA, this.gl.FLOAT, packed.segmentProps.subarray(0, packed.segmentCount * 4));
        }

        this.gl.uniform1i(this.uniformLocs.nSegs, packed.segmentCount);
        if (packed.groupCount > 0) {
            this.gl.uniform4fv(this.uniformLocs.groupBBox, packed.groupBBox.subarray(0, packed.groupCount * 4));
        }

        this.gl.uniform1i(this.uniformLocs.nArcs, packed.arcCount);
        if (packed.arcCount > 0) {
            this.gl.uniform4fv(this.uniformLocs.arcs, packed.arcData);
            this.gl.uniform4fv(this.uniformLocs.arcLimits, packed.arcLimitData);
            this.gl.uniform4fv(this.uniformLocs.arcProps, packed.arcPropData);
        }

        this.gl.uniform1i(this.uniformLocs.nCircs, packed.circleCount);
        if (packed.circleCount > 0) {
            this.gl.uniform3fv(this.uniformLocs.circs, packed.circleData);
            this.gl.uniform4fv(this.uniformLocs.cProps, packed.circlePropData);
        }

        this.gl.uniform1i(this.uniformLocs.nParabolas, packed.parabolaCount);
        if (packed.parabolaCount > 0) {
            this.gl.uniform4fv(this.uniformLocs.parabolas, packed.parabolaData);
            this.gl.uniform4fv(this.uniformLocs.parabolaOrientation, packed.parabolaOrientationData);
        }
    }

    getHandlePos(e: OpticElement) {
        let maxDist = 40; 
        if(e.type==='raindrop') maxDist=e.radius || 100; 
        else if(e.type==='lens') maxDist=(e.height || 180)/2; 
        else if(e.type==='prism') maxDist=(e.size || 140)/1.5; 
        else if(e.type==='mirror') maxDist=(e.length || 150)/2; 
        else if(e.type==='polygon' || e.type==='fiber') {
            let pts = e.type === 'fiber' ? (e.pts || []) : (e.vertices || []);
            if (pts.length > 0) {
                maxDist = Math.max(...pts.map(p => Math.hypot(p.x, p.y)));
            }
        }
        return vadd(vec(e.x, e.y), vrot(vec(0, -maxDist - 30), (e.rotation || 0) * Math.PI / 180));
    }

    getScaleHandlePos(e: OpticElement) {
        let maxDist = 40; 
        if(e.type==='raindrop') maxDist=e.radius || 100; 
        else if(e.type==='lens') maxDist=(e.height || 180)/2; 
        else if(e.type==='prism') maxDist=(e.size || 140)/1.5; 
        else if(e.type==='mirror') maxDist=(e.length || 150)/2; 
        else if(e.type==='parabolicMirror') maxDist=(e.size || 200)/2;
        else if(e.type==='polygon' || e.type==='fiber') {
            let pts = e.type === 'fiber' ? (e.pts || []) : (e.vertices || []);
            if (pts.length > 0) {
                maxDist = Math.max(...pts.map(p => Math.hypot(p.x, p.y)));
            }
        }
        return vadd(vec(e.x, e.y), vrot(vec(maxDist + 30, 0), (e.rotation || 0) * Math.PI / 180));
    }

    renderUI() {
        const state = this.getState();
        this.ctx.clearRect(0, 0, this.width, this.height); 
        this.ctx.save();
        this.ctx.translate(state.camera.x, state.camera.y);
        this.ctx.scale(state.camera.zoom, state.camera.zoom);
        
        if (state.globals.snapping) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            const s = state.globals.gridSize;
            const startX = Math.floor(-state.camera.x / state.camera.zoom / s) * s;
            const startY = Math.floor(-state.camera.y / state.camera.zoom / s) * s;
            const endX = startX + this.width / state.camera.zoom + s;
            const endY = startY + this.height / state.camera.zoom + s;
            
            for (let x=startX; x<endX; x+=s) { 
                for (let y=startY; y<endY; y+=s) { 
                    this.ctx.beginPath(); this.ctx.arc(x, y, 1.5 / state.camera.zoom, 0, Math.PI*2); this.ctx.fill(); 
                } 
            }
        }

        state.elements.forEach((elem, index) => { 
            const sel = state.selectedElements.includes(index); 
            if (elem.type === 'prism') this.drawPolygonObj(getPrismGeometry(elem), sel, '#8b5cf6', 'rgba(139, 92, 246, 0.05)', index, elem); 
            else if (elem.type === 'polygon') this.drawPolygonObj(getPolygonGeometry(elem), sel, '#22c55e', 'rgba(34, 197, 94, 0.05)', index, elem); 
            else if (elem.type === 'fiber') this.drawFiberObj(elem, sel, '#10b981', 'rgba(16, 185, 129, 0.05)', index); 
            else if (elem.type === 'lens') this.drawPolygonObj(getLensUIGeometry(elem), sel, '#06b6d4', 'rgba(34, 211, 238, 0.05)', null, elem); 
            else if (elem.type === 'raindrop') this.drawRaindrop(elem, sel); 
            else if (elem.type === 'mirror') this.drawMirror(elem, sel); 
            else if (elem.type === 'parabolicMirror') this.drawParabolicMirror(elem, sel);
            
            // Only show handles for single selection
            if (sel && state.selectedElements.length === 1 && elem.type !== 'raindrop') {
                const handlePos = this.getHandlePos(elem);
                this.ctx.beginPath();
                this.ctx.moveTo(elem.x, elem.y);
                this.ctx.lineTo(handlePos.x, handlePos.y);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                this.ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                this.ctx.beginPath();
                this.ctx.arc(handlePos.x, handlePos.y, 6 / state.camera.zoom, 0, Math.PI*2);
                this.ctx.fillStyle = this.hoveredHandle === 'rotation' ? '#fff' : '#a8a29e';
                this.ctx.fill();
            }
            if (sel && state.selectedElements.length === 1) {
                const scaleHandlePos = this.getScaleHandlePos(elem);
                this.ctx.beginPath();
                this.ctx.moveTo(elem.x, elem.y);
                this.ctx.lineTo(scaleHandlePos.x, scaleHandlePos.y);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                this.ctx.setLineDash([4 / state.camera.zoom, 4 / state.camera.zoom]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                this.ctx.beginPath();
                const sSize = 10 / state.camera.zoom;
                this.ctx.rect(scaleHandlePos.x - sSize/2, scaleHandlePos.y - sSize/2, sSize, sSize);
                this.ctx.fillStyle = this.hoveredHandle === 'scale' ? '#fff' : '#a8a29e';
                this.ctx.fill();
            }
        });

        // Show group handles for multiple selection
        if (state.selectedElements.length > 1) {
            const bbox = this.getGroupBoundingBox(state.selectedElements);
            if (bbox) {
                const zoom = state.camera.zoom;
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.lineWidth = 1 / zoom;
                this.ctx.setLineDash([5 / zoom, 5 / zoom]);
                this.ctx.strokeRect(bbox.x1 - 10, bbox.y1 - 10, (bbox.x2 - bbox.x1) + 20, (bbox.y2 - bbox.y1) + 20);
                this.ctx.setLineDash([]);

                const cx = (bbox.x1 + bbox.x2) / 2;
                const cy = (bbox.y1 + bbox.y2) / 2;

                // Rotation handle
                const rotHandlePos = { x: cx, y: bbox.y1 - 40 };
                this.ctx.beginPath();
                this.ctx.moveTo(cx, bbox.y1 - 10);
                this.ctx.lineTo(rotHandlePos.x, rotHandlePos.y);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.arc(rotHandlePos.x, rotHandlePos.y, 6 / zoom, 0, Math.PI*2);
                this.ctx.fillStyle = this.hoveredHandle === 'rotation' ? '#fff' : '#a8a29e';
                this.ctx.fill();

                // Scale handle
                const scaleHandlePos = { x: bbox.x2 + 20, y: bbox.y2 + 20 };
                this.ctx.beginPath();
                const sSize = 10 / zoom;
                this.ctx.rect(scaleHandlePos.x - sSize/2, scaleHandlePos.y - sSize/2, sSize, sSize);
                this.ctx.fillStyle = this.hoveredHandle === 'scale' ? '#fff' : '#a8a29e';
                this.ctx.fill();
            }
        }

        if (this.marqueeStart && this.marqueeEnd) {
            const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
            const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
            const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
            const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1 / state.camera.zoom;
            this.ctx.setLineDash([5 / state.camera.zoom, 5 / state.camera.zoom]);
            this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            this.ctx.setLineDash([]);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
        this.drawLightSourceUI();
        this.ctx.restore();
    }

    drawLightSourceUI() { 
        const state = this.getState();
        const { x, y } = state.lightSource; 
        const zoom = state.camera.zoom;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; 
        this.ctx.beginPath(); this.ctx.arc(x, y, 40 / zoom, 0, Math.PI*2); this.ctx.fill(); 
        this.ctx.fillStyle = '#fff'; 
        this.ctx.beginPath(); this.ctx.arc(x, y, 6 / zoom, 0, Math.PI*2); this.ctx.fill(); 
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = '#fff'; this.ctx.fill(); this.ctx.shadowBlur = 0; 
    }
    
    applyGlassStyle(selected: boolean, mainColor: string) { 
        const zoom = this.getState().camera.zoom;
        this.ctx.shadowBlur = selected ? 15 / zoom : 0; 
        this.ctx.shadowColor = mainColor; 
        this.ctx.strokeStyle = selected ? '#fff' : mainColor; 
        this.ctx.lineWidth = (selected ? 1.5 : 1) / zoom; 
    }
    
    drawPolygonObj(edges: {p1: Vector2, p2: Vector2}[], selected: boolean, colorLine: string, colorFill: string, elemIndex: number | null, e: OpticElement) { 
        if(edges.length < 2) return; 
        this.ctx.save(); this.ctx.beginPath(); this.ctx.moveTo(edges[0].p1.x, edges[0].p1.y); 
        for(let i=0; i<edges.length; i++) this.ctx.lineTo(edges[i].p2.x, edges[i].p2.y); 
        this.ctx.fillStyle = colorFill; this.ctx.fill(); 
        this.applyGlassStyle(selected, colorLine); this.ctx.stroke(); 
        
        if(selected && elemIndex !== null && e.type === 'polygon') { 
            this.ctx.shadowBlur = 0; 
            let angle = (e.rotation||0)*Math.PI/180;
            const zoom = this.getState().camera.zoom;
            e.vertices!.forEach((v, i) => { 
                let p = vadd(vec(e.x, e.y), vrot(v, angle));
                const hov = this.hoveredVertex && this.hoveredVertex.elemIdx === elemIndex && this.hoveredVertex.vIdx === i; 
                this.ctx.fillStyle = hov ? '#fff' : colorLine; 
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, (hov ? 6 : 4) / zoom, 0, Math.PI*2); this.ctx.fill(); 
            }); 
        } 
        this.ctx.restore(); 
    }

    drawFiberObj(f: OpticElement, selected: boolean, colorLine: string, colorFill: string, elemIndex: number) {
        const edges = getFiberGeometry(f); if(edges.length < 2) return;
        this.ctx.save(); this.ctx.beginPath(); this.ctx.moveTo(edges[0].p1.x, edges[0].p1.y); 
        for(let i=0; i<edges.length; i++) this.ctx.lineTo(edges[i].p2.x, edges[i].p2.y); 
        this.ctx.fillStyle = colorFill; this.ctx.fill(); 
        this.applyGlassStyle(selected, colorLine); this.ctx.stroke(); 
        
        if (selected) {
            this.ctx.shadowBlur = 0; let angle = (f.rotation||0)*Math.PI/180; 
            let pts = f.pts!.map(p => vadd(vec(f.x, f.y), vrot(p, angle)));
            this.ctx.beginPath(); this.ctx.moveTo(pts[0].x, pts[0].y); 
            this.ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y); 
            this.ctx.strokeStyle = 'rgba(255,255,255,0.2)'; this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(pts[0].x, pts[0].y); this.ctx.lineTo(pts[1].x, pts[1].y); 
            this.ctx.moveTo(pts[2].x, pts[2].y); this.ctx.lineTo(pts[3].x, pts[3].y); 
            const zoom = this.getState().camera.zoom;
            this.ctx.setLineDash([2 / zoom, 2 / zoom]); this.ctx.strokeStyle = 'rgba(255,255,255,0.4)'; this.ctx.stroke(); this.ctx.setLineDash([]);
            pts.forEach((p, i) => { 
                const hov = this.hoveredVertex && this.hoveredVertex.elemIdx === elemIndex && this.hoveredVertex.vIdx === i; 
                this.ctx.fillStyle = hov ? '#fff' : colorLine; 
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, (hov ? 6 : 4) / zoom, 0, Math.PI*2); this.ctx.fill(); 
            });
        } 
        this.ctx.restore();
    }

    drawRaindrop(d: OpticElement, s: boolean) { 
        this.ctx.save(); this.ctx.beginPath(); this.ctx.arc(d.x, d.y, d.radius || 100, 0, Math.PI*2); 
        this.ctx.fillStyle = 'rgba(2,132,199,0.05)'; this.ctx.fill(); 
        this.applyGlassStyle(s, '#0ea5e9'); this.ctx.stroke(); this.ctx.restore(); 
    }
    
    drawMirror(m: OpticElement, s: boolean) { 
        this.ctx.save(); this.ctx.translate(m.x, m.y); this.ctx.rotate(m.rotation*Math.PI/180); 
        this.ctx.fillStyle='rgba(148,163,184,0.3)'; 
        const len = m.length || 150;
        this.ctx.fillRect(-len/2, -3, len, 6); 
        this.ctx.beginPath(); this.ctx.moveTo(-len/2,0); this.ctx.lineTo(len/2,0); 
        this.applyGlassStyle(s, '#fff'); this.ctx.stroke(); this.ctx.restore(); 
    }

    drawParabolicMirror(m: OpticElement, s: boolean) {
        const edges = getParabolicMirrorGeometry(m);
        if (edges.length === 0) return;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(edges[0].p1.x, edges[0].p1.y);
        for (let edge of edges) this.ctx.lineTo(edge.p2.x, edge.p2.y);
        this.applyGlassStyle(s, '#fff');
        this.ctx.stroke();
        this.ctx.restore();
    }

    screenToWorld(clientX: number, clientY: number): Vector2 {
        const state = this.getState();
        const rect = this.ctx.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            x: (x - state.camera.x) / state.camera.zoom,
            y: (y - state.camera.y) / state.camera.zoom
        };
    }

    getElementBoundingBox(e: OpticElement): { x1: number, y1: number, x2: number, y2: number } {
        let pts: Vector2[] = [];
        if (e.type === 'prism') pts = getPrismGeometry(e).map(ed => ed.p1);
        else if (e.type === 'polygon') pts = getPolygonGeometry(e).map(ed => ed.p1);
        else if (e.type === 'fiber') pts = getFiberGeometry(e).map(ed => ed.p1);
        else if (e.type === 'parabolicMirror') pts = getParabolicMirrorGeometry(e).map(ed => ed.p1);
        else if (e.type === 'lens') pts = getLensUIGeometry(e).map(ed => ed.p1);
        else if (e.type === 'raindrop') {
            const r = e.radius || 100;
            return { x1: e.x - r, y1: e.y - r, x2: e.x + r, y2: e.y + r };
        } else if (e.type === 'mirror') {
            const len = e.length || 150;
            const angle = (e.rotation || 0) * Math.PI / 180;
            const p1 = vadd(vec(e.x, e.y), vrot(vec(-len / 2, 0), angle));
            const p2 = vadd(vec(e.x, e.y), vrot(vec(len / 2, 0), angle));
            pts = [p1, p2];
        }

        if (pts.length === 0) return { x1: e.x, y1: e.y, x2: e.x, y2: e.y };

        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        pts.forEach(p => {
            x1 = Math.min(x1, p.x);
            y1 = Math.min(y1, p.y);
            x2 = Math.max(x2, p.x);
            y2 = Math.max(y2, p.y);
        });
        return { x1, y1, x2, y2 };
    }

    getGroupBoundingBox(indices: number[]): { x1: number, y1: number, x2: number, y2: number } | null {
        const state = this.getState();
        if (indices.length === 0) return null;
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        indices.forEach(idx => {
            const bbox = this.getElementBoundingBox(state.elements[idx]);
            x1 = Math.min(x1, bbox.x1);
            y1 = Math.min(y1, bbox.y1);
            x2 = Math.max(x2, bbox.x2);
            y2 = Math.max(y2, bbox.y2);
        });
        return { x1, y1, x2, y2 };
    }

    getElementAt(x: number, y: number) { 
        const state = this.getState();
        for(let i=state.elements.length-1; i>=0; i--) { 
            const e = state.elements[i]; 
            if(e.type === 'polygon' || e.type === 'fiber' || e.type === 'prism' || e.type === 'lens' || e.type === 'parabolicMirror') { 
                let inside = false; 
                let edges: {p1: Vector2, p2: Vector2}[] = [];
                if (e.type === 'polygon') edges = getPolygonGeometry(e);
                else if (e.type === 'prism') edges = getPrismGeometry(e);
                else if (e.type === 'fiber') edges = getFiberGeometry(e);
                else if (e.type === 'lens') edges = getLensUIGeometry(e);
                else if (e.type === 'parabolicMirror') edges = getParabolicMirrorGeometry(e);

                let polyPts = edges.map(ed => ed.p1);
                for(let j=0, k=polyPts.length-1; j<polyPts.length; k=j++) { 
                    const pj = polyPts[j], pk = polyPts[k]; 
                    if (((pj.y > y) !== (pk.y > y)) && (x < (pk.x - pj.x) * (y - pj.y) / (pk.y - pj.y) + pj.x)) inside = !inside; 
                } 
                if (inside) return i; 
                for (let edge of edges) {
                    if (distToSegment(vec(x, y), edge.p1, edge.p2) < 30 / state.camera.zoom) return i;
                }
            } else if (e.type === 'mirror') {
                const rRad = (e.rotation || 0) * Math.PI / 180; const len = e.length || 150;
                const p1 = vadd(vec(e.x, e.y), vrot(vec(-len/2, 0), rRad));
                const p2 = vadd(vec(e.x, e.y), vrot(vec(len/2, 0), rRad));
                if (distToSegment(vec(x, y), p1, p2) < 20 / state.camera.zoom) return i;
            } else { 
                const d = Math.hypot(x-e.x, y-e.y); 
                let maxDist = 40; 
                if(e.type==='raindrop') maxDist=e.radius || 100; 
                if(d < maxDist) return i; 
            } 
        } 
        return null; 
    }

    checkVertexHover(x: number, y: number) { 
        this.hoveredVertex = null; 
        this.hoveredEdge = null;
        this.hoveredHandle = null;
        const state = this.getState();
        const hitRadius = 15 / state.camera.zoom;
        const lineHitRadius = 30 / state.camera.zoom;
        
        // First check selected element handles
        if (state.selectedElements.length === 1) { 
            const e = state.elements[state.selectedElements[0]]; 
            if (e.type !== 'raindrop') {
                const handlePos = this.getHandlePos(e);
                if (Math.hypot(x - handlePos.x, y - handlePos.y) < hitRadius) {
                    this.hoveredHandle = 'rotation';
                    return true;
                }
            }
            const scaleHandlePos = this.getScaleHandlePos(e);
            if (Math.hypot(x - scaleHandlePos.x, y - scaleHandlePos.y) < hitRadius) {
                this.hoveredHandle = 'scale';
                return true;
            }
        } else if (state.selectedElements.length > 1) {
            const bbox = this.getGroupBoundingBox(state.selectedElements);
            if (bbox) {
                const cx = (bbox.x1 + bbox.x2) / 2;
                const rotHandlePos = { x: cx, y: bbox.y1 - 40 };
                if (Math.hypot(x - rotHandlePos.x, y - rotHandlePos.y) < hitRadius) {
                    this.hoveredHandle = 'rotation';
                    return true;
                }
                const scaleHandlePos = { x: bbox.x2 + 20, y: bbox.y2 + 20 };
                if (Math.abs(x - scaleHandlePos.x) < hitRadius && Math.abs(y - scaleHandlePos.y) < hitRadius) {
                    this.hoveredHandle = 'scale';
                    return true;
                }
            }
        }

        // Then check all elements for vertices and edges
        for (let i = state.elements.length - 1; i >= 0; i--) {
            const e = state.elements[i];
            if (e.type === 'polygon' || e.type === 'fiber' || e.type === 'parabolicMirror') {
                const angle = (e.rotation||0)*Math.PI/180; 
                let pts: Vector2[] = [];
                if (e.type === 'fiber') pts = (e.pts || []).map(pt => vadd(vec(e.x, e.y), vrot(pt, angle)));
                else if (e.type === 'polygon') pts = (e.vertices || []).map(pt => vadd(vec(e.x, e.y), vrot(pt, angle)));
                else if (e.type === 'parabolicMirror') pts = getParabolicMirrorGeometry(e).map(ed => ed.p1);
                
                for (let j = 0; j < pts.length; j++) { 
                    if (Math.hypot(x - pts[j].x, y - pts[j].y) < hitRadius) { 
                        this.hoveredVertex = { elemIdx: i, vIdx: j }; 
                        return true; 
                    } 
                }
                if (e.type === 'polygon') {
                    const edges = getPolygonGeometry(e);
                    for (let j = 0; j < edges.length; j++) {
                        if (distToSegment(vec(x, y), edges[j].p1, edges[j].p2) < lineHitRadius) {
                            this.hoveredEdge = { elemIdx: i, eIdx: j };
                            return true; // Return true so mousedown knows we clicked an edge
                        }
                    }
                }
            }
        }
        return false; 
    }

    snap(val: number, gridSize: number, snapping: boolean) {
        return snapping ? Math.round(val / gridSize) * gridSize : val;
    }

    setupEvents() {
        const canvas = this.uiCanvas;

        const handleMouseMove = (e: MouseEvent) => { 
            const state = this.getState();
            let needsRender = false;
            const s = state.globals.gridSize;
            const snapOn = state.globals.snapping;
            const worldPos = this.screenToWorld(e.clientX, e.clientY);

            if (state.lightSource.dragging) { 
                state.lightSource.x = this.snap(worldPos.x, s, snapOn); 
                state.lightSource.y = this.snap(worldPos.y, s, snapOn); 
                needsRender = true; 
            }
            else if (this.draggingHandle === 'rotation') { 
                if (state.selectedElements.length === 1) {
                    const el = state.elements[state.selectedElements[0]];
                    const angle = Math.atan2(worldPos.y - el.y, worldPos.x - el.x);
                    let diff = (angle - this.initialAngle) * 180 / Math.PI;
                    if (snapOn) diff = Math.round(diff / 5) * 5;
                    el.rotation = (this.initialRotation + diff + 360) % 360;
                } else {
                    const angle = Math.atan2(worldPos.y - this.initialGroupCenter.y, worldPos.x - this.initialGroupCenter.x);
                    let diff = (angle - this.initialAngle);
                    if (snapOn) diff = Math.round(diff * 180 / Math.PI / 5) * 5 * Math.PI / 180;
                    
                    state.selectedElements.forEach((idx, i) => {
                        const initialEl = this.initialGroupElements[i];
                        const el = state.elements[idx];
                        const relX = initialEl.x - this.initialGroupCenter.x;
                        const relY = initialEl.y - this.initialGroupCenter.y;
                        const rotated = vrot({x: relX, y: relY}, diff);
                        el.x = this.initialGroupCenter.x + rotated.x;
                        el.y = this.initialGroupCenter.y + rotated.y;
                        el.rotation = (initialEl.rotation + diff * 180 / Math.PI + 360) % 360;
                    });
                }
                needsRender = true;
            }
            else if (this.draggingHandle === 'scale') { 
                if (state.selectedElements.length === 1) {
                    const el = state.elements[state.selectedElements[0]];
                    const dist = Math.hypot(worldPos.x - el.x, worldPos.y - el.y);
                    let scaleFactor = dist / this.initialDist;
                    if (snapOn) scaleFactor = Math.round(scaleFactor * 10) / 10;
                    
                    if (el.type === 'raindrop') el.radius = Math.max(10, this.initialSize * scaleFactor);
                    else if (el.type === 'lens') { el.height = Math.max(20, this.initialSize * scaleFactor); el.thickness = Math.max(10, this.initialSize2 * scaleFactor); }
                    else if (el.type === 'prism') el.size = Math.max(20, this.initialSize * scaleFactor);
                    else if (el.type === 'mirror') el.length = Math.max(20, this.initialSize * scaleFactor);
                    else if (el.type === 'polygon' || el.type === 'fiber') {
                        const pts = el.type === 'fiber' ? (el.pts || []) : (el.vertices || []);
                        for (let i = 0; i < pts.length; i++) {
                            pts[i] = { x: this.initialPts[i].x * scaleFactor, y: this.initialPts[i].y * scaleFactor };
                        }
                    }
                } else {
                    const dist = Math.hypot(worldPos.x - this.initialGroupCenter.x, worldPos.y - this.initialGroupCenter.y);
                    let scaleFactor = dist / this.initialDist;
                    if (snapOn) scaleFactor = Math.round(scaleFactor * 10) / 10;
                    
                    state.selectedElements.forEach((idx, i) => {
                        const initialEl = this.initialGroupElements[i];
                        const el = state.elements[idx];
                        el.x = this.initialGroupCenter.x + (initialEl.x - this.initialGroupCenter.x) * scaleFactor;
                        el.y = this.initialGroupCenter.y + (initialEl.y - this.initialGroupCenter.y) * scaleFactor;
                        
                        if (el.type === 'raindrop') el.radius = Math.max(10, (initialEl.radius || 100) * scaleFactor);
                        else if (el.type === 'lens') { el.height = Math.max(20, (initialEl.height || 180) * scaleFactor); el.thickness = Math.max(10, (initialEl.thickness || 50) * scaleFactor); }
                        else if (el.type === 'prism') el.size = Math.max(20, (initialEl.size || 140) * scaleFactor);
                        else if (el.type === 'mirror') el.length = Math.max(20, (initialEl.length || 150) * scaleFactor);
                        else if (el.type === 'polygon' || el.type === 'fiber') {
                            const pts = el.type === 'fiber' ? (el.pts || []) : (el.vertices || []);
                            const initialPts = el.type === 'fiber' ? (initialEl.pts || []) : (initialEl.vertices || []);
                            for (let j = 0; j < pts.length; j++) {
                                pts[j] = { x: initialPts[j].x * scaleFactor, y: initialPts[j].y * scaleFactor };
                            }
                        }
                    });
                }
                needsRender = true;
            }
            else if (this.draggingVertex !== null) { 
                let el = state.elements[this.draggingVertex.elemIdx];
                let snappedX = this.snap(worldPos.x, s, snapOn);
                let snappedY = this.snap(worldPos.y, s, snapOn);
                let newPt = vrot(vec(snappedX - el.x, snappedY - el.y), -(el.rotation || 0) * Math.PI / 180);
                if(el.type === 'polygon') { (el.vertices || [])[this.draggingVertex.vIdx] = newPt; needsRender = true; }
                else if(el.type === 'fiber') { (el.pts || [])[this.draggingVertex.vIdx] = newPt; needsRender = true; }
            } 
            else if (this.draggingElements.length > 0) { 
                this.draggingElements.forEach((idx, i) => {
                    state.elements[idx].x = this.snap(worldPos.x - this.dragOffsets[i].x, s, snapOn); 
                    state.elements[idx].y = this.snap(worldPos.y - this.dragOffsets[i].y, s, snapOn); 
                });
                needsRender = true; 
            } 
            else if (this.marqueeStart !== null) {
                this.marqueeEnd = worldPos;
                needsRender = true;
            }
            else if (this.draggingCamera) {
                state.camera.x = this.initialCameraPos.x + (e.clientX - this.cameraDragStart.x);
                state.camera.y = this.initialCameraPos.y + (e.clientY - this.cameraDragStart.y);
                needsRender = true;
            }
            else { 
                const oldHover = this.hoveredVertex; 
                const oldHandle = this.hoveredHandle;
                this.checkVertexHover(worldPos.x, worldPos.y); 
                if (oldHover?.elemIdx !== this.hoveredVertex?.elemIdx || oldHover?.vIdx !== this.hoveredVertex?.vIdx || oldHandle !== this.hoveredHandle) needsRender = true; 
            }
            canvas.style.cursor = this.draggingCamera ? 'grabbing' : this.hoveredHandle === 'rotation' ? 'grab' : this.hoveredHandle === 'scale' ? 'nwse-resize' : this.hoveredVertex ? 'crosshair' : this.hoveredEdge ? 'copy' : (this.getElementAt(worldPos.x, worldPos.y) !== null || Math.hypot(worldPos.x-state.lightSource.x, worldPos.y-state.lightSource.y) < 40 / state.camera.zoom) ? 'move' : 'default';
            if (this.draggingHandle === 'rotation') canvas.style.cursor = 'grabbing';
            if (this.draggingHandle === 'scale') canvas.style.cursor = 'nwse-resize';
            if (needsRender) this.requestRender(); 
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const handleMouseDown = (e: MouseEvent) => { 
            const state = this.getState();
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            
            if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spacePressed)) {
                this.draggingCamera = true;
                this.cameraDragStart = { x: e.clientX, y: e.clientY };
                this.initialCameraPos = { x: state.camera.x, y: state.camera.y };
                this.onStateChange(true);
                return;
            }

            if (Math.hypot(worldPos.x-state.lightSource.x, worldPos.y-state.lightSource.y) < 40 / state.camera.zoom) { 
                state.lightSource.dragging = true; 
                playSound('click'); 
                this.onStateChange(true);
                this.requestRender(); 
                return; 
            }
            if (this.checkVertexHover(worldPos.x, worldPos.y)) { 
                if (this.hoveredHandle === 'rotation') {
                    this.draggingHandle = 'rotation';
                    if (state.selectedElements.length === 1) {
                        const el = state.elements[state.selectedElements[0]];
                        this.initialRotation = el.rotation || 0;
                        this.initialAngle = Math.atan2(worldPos.y - el.y, worldPos.x - el.x);
                    } else {
                        const bbox = this.getGroupBoundingBox(state.selectedElements)!;
                        this.initialGroupCenter = { x: (bbox.x1 + bbox.x2) / 2, y: (bbox.y1 + bbox.y2) / 2 };
                        this.initialAngle = Math.atan2(worldPos.y - this.initialGroupCenter.y, worldPos.x - this.initialGroupCenter.x);
                        this.initialGroupElements = state.selectedElements.map(idx => cloneDeep(state.elements[idx]));
                    }
                } else if (this.hoveredHandle === 'scale') {
                    this.draggingHandle = 'scale';
                    if (state.selectedElements.length === 1) {
                        const el = state.elements[state.selectedElements[0]];
                        this.initialDist = Math.hypot(worldPos.x - el.x, worldPos.y - el.y);
                        if (el.type === 'raindrop') this.initialSize = el.radius || 100;
                        else if (el.type === 'lens') { this.initialSize = el.height || 180; this.initialSize2 = el.thickness || 50; }
                        else if (el.type === 'prism') this.initialSize = el.size || 140;
                        else if (el.type === 'mirror') this.initialSize = el.length || 150;
                        else if (el.type === 'polygon' || el.type === 'fiber') {
                            const pts = el.type === 'fiber' ? (el.pts || []) : (el.vertices || []);
                            this.initialPts = pts.map(p => ({...p}));
                        }
                    } else {
                        const bbox = this.getGroupBoundingBox(state.selectedElements)!;
                        this.initialGroupCenter = { x: (bbox.x1 + bbox.x2) / 2, y: (bbox.y1 + bbox.y2) / 2 };
                        this.initialDist = Math.hypot(worldPos.x - this.initialGroupCenter.x, worldPos.y - this.initialGroupCenter.y);
                        this.initialGroupElements = state.selectedElements.map(idx => cloneDeep(state.elements[idx]));
                    }
                } else if (this.hoveredVertex) {
                    this.draggingVertex = this.hoveredVertex; 
                    state.selectedElements = [this.hoveredVertex.elemIdx];
                } else if (this.hoveredEdge) {
                    state.selectedElements = [this.hoveredEdge.elemIdx];
                    // Do not set draggingElements so we can double click to add a point without dragging
                }
                playSound('click'); 
                this.onStateChange(true);
                return; 
            }
            const idx = this.getElementAt(worldPos.x, worldPos.y); 
            if (idx !== null) { 
                if (e.shiftKey) {
                    if (state.selectedElements.includes(idx)) {
                        state.selectedElements = state.selectedElements.filter(i => i !== idx);
                    } else {
                        state.selectedElements.push(idx);
                    }
                } else {
                    if (!state.selectedElements.includes(idx)) {
                        state.selectedElements = [idx];
                    }
                }
                this.draggingElements = [...state.selectedElements]; 
                this.dragOffsets = this.draggingElements.map(i => ({ x: worldPos.x - state.elements[i].x, y: worldPos.y - state.elements[i].y })); 
                playSound('click'); 
                this.onStateChange(true);
            } else { 
                if (!e.shiftKey) state.selectedElements = []; 
                this.marqueeStart = worldPos;
                this.marqueeEnd = worldPos;
                this.onStateChange(true);
            } 
            this.requestRender(); 
        };
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                this.spacePressed = true;
                if (e.target === canvas) e.preventDefault();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') this.spacePressed = false;
        };

        const handleMouseUp = () => { 
            const state = this.getState();
            if (this.marqueeStart && this.marqueeEnd) {
                const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
                const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
                const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
                const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
                
                const newSelection: number[] = [];
                state.elements.forEach((e, i) => {
                    const bbox = this.getElementBoundingBox(e);
                    // Check if element's bounding box intersects with marquee
                    if (!(bbox.x2 < x1 || bbox.x1 > x2 || bbox.y2 < y1 || bbox.y1 > y2)) {
                        newSelection.push(i);
                    }
                });
                state.selectedElements = newSelection;
                this.marqueeStart = null;
                this.marqueeEnd = null;
                this.requestRender();
            }

            if (state.lightSource.dragging || this.draggingElements.length > 0 || this.draggingVertex !== null || this.draggingHandle !== null) {
                this.onStateChange(true);
            }
            state.lightSource.dragging = false; 
            this.draggingElements = []; 
            this.dragOffsets = [];
            this.draggingVertex = null; 
            this.draggingHandle = null;
            this.draggingCamera = false;
        };
        
        const handleWheel = (e: WheelEvent) => { 
            const state = this.getState();
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const idx = this.getElementAt(worldPos.x, worldPos.y); 
            
            if (e.ctrlKey || e.metaKey || idx === null) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.max(0.1, Math.min(state.camera.zoom * zoomFactor, 10));
                
                // Zoom towards mouse position
                state.camera.x = canvasX - ((canvasX - state.camera.x) / state.camera.zoom) * newZoom;
                state.camera.y = canvasY - ((canvasY - state.camera.y) / state.camera.zoom) * newZoom;
                state.camera.zoom = newZoom;
                
                this.requestRender();
            } else if(idx !== null && state.elements[idx].type !== 'raindrop') { 
                e.preventDefault(); 
                state.elements[idx].rotation = (state.elements[idx].rotation + (e.deltaY > 0 ? 5 : -5) + 360) % 360; 
                playSound('slide'); 
                this.onStateChange(true);
                this.requestRender(); 
            } 
        };
        
        const handleDoubleClick = (e: MouseEvent) => {
            const state = this.getState();
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const hitRadius = 15 / state.camera.zoom;
            const lineHitRadius = 30 / state.camera.zoom;
            
            let targetPolyIdx = -1;
            
            // First check if currently selected element is a polygon and we clicked its edge/vertex
            if (state.selectedElements.length === 1 && state.elements[state.selectedElements[0]].type === 'polygon') {
                const poly = state.elements[state.selectedElements[0]];
                const edges = getPolygonGeometry(poly);
                for (let edge of edges) {
                    if (distToSegment(vec(worldPos.x, worldPos.y), edge.p1, edge.p2) < lineHitRadius || 
                        Math.hypot(worldPos.x - edge.p1.x, worldPos.y - edge.p1.y) < hitRadius) {
                        targetPolyIdx = state.selectedElements[0];
                        break;
                    }
                }
            }
            
            // Fallback: check all polygons from top to bottom
            if (targetPolyIdx === -1) {
                for (let i = state.elements.length - 1; i >= 0; i--) {
                    if (state.elements[i].type === 'polygon') {
                        const edges = getPolygonGeometry(state.elements[i]);
                        for (let edge of edges) {
                            if (distToSegment(vec(worldPos.x, worldPos.y), edge.p1, edge.p2) < lineHitRadius ||
                                Math.hypot(worldPos.x - edge.p1.x, worldPos.y - edge.p1.y) < hitRadius) {
                                targetPolyIdx = i;
                                break;
                            }
                        }
                    }
                    if (targetPolyIdx !== -1) break;
                }
            }

            if (targetPolyIdx !== -1) {
                const poly = state.elements[targetPolyIdx]; 
                const edges = getPolygonGeometry(poly);
                
                // 1. Check for vertex deletion
                for (let i = 0; i < edges.length; i++) { 
                    if (Math.hypot(worldPos.x - edges[i].p1.x, worldPos.y - edges[i].p1.y) < hitRadius) { 
                        if (poly.vertices!.length > 3) { 
                            poly.vertices!.splice(i, 1); 
                            playSound('delete'); 
                            state.selectedElements = [targetPolyIdx];
                            this.onStateChange(true);
                            this.checkVertexHover(worldPos.x, worldPos.y); 
                            this.requestRender(); 
                        } 
                        return; 
                    } 
                }
                
                // 2. Check for edge splitting
                const mousePos = vec(worldPos.x, worldPos.y);
                for (let i = 0; i < edges.length; i++) { 
                    if (distToSegment(mousePos, edges[i].p1, edges[i].p2) < lineHitRadius) { 
                        poly.vertices!.splice(i + 1, 0, vrot(vec(worldPos.x - poly.x, worldPos.y - poly.y), -(poly.rotation || 0) * Math.PI / 180)); 
                        playSound('click'); 
                        state.selectedElements = [targetPolyIdx];
                        this.onStateChange(true);
                        this.checkVertexHover(worldPos.x, worldPos.y); 
                        this.requestRender(); 
                        return; 
                    } 
                }
            }
        };

        this.bindCanvasEvent('mousemove', handleMouseMove);
        this.bindCanvasEvent('contextmenu', handleContextMenu);
        this.bindCanvasEvent('mousedown', handleMouseDown);
        this.bindCanvasEvent('wheel', handleWheel, { passive: false });
        this.bindCanvasEvent('dblclick', handleDoubleClick);
        this.bindEvent(window, 'keydown', handleKeyDown);
        this.bindEvent(window, 'keyup', handleKeyUp);
        this.bindEvent(window, 'mouseup', handleMouseUp);
    }
}
