export const vertexShaderSource = `#version 300 es
precision highp float;
uniform vec2 u_resolution; uniform vec2 u_lightPos; uniform vec2 u_lightDir; 
uniform float u_beamWidth; uniform float u_dispersion; uniform float u_envN; 
uniform float u_baseAlpha; uniform int u_colorType; uniform float u_wavelength; uniform float u_totalRays; 
uniform vec2 u_cameraPos; uniform float u_cameraZoom;
uniform float u_seedOffset;

uniform int u_numSegments; 
uniform sampler2D u_segmentsTex;
uniform vec4 u_groupBBox[128];

uniform int u_numArcs; uniform vec4 u_arcs[256]; uniform vec4 u_arcLimits[256]; uniform vec4 u_arcProps[256];   
uniform int u_numCircles; uniform vec3 u_circles[256]; uniform vec4 u_circProps[256];  
uniform int u_numParabolas; uniform vec4 u_parabolas[128]; uniform vec4 u_parabolaOrientation[128];

out vec3 v_color; out float v_alpha;

vec2 seedState;
float rand() { vec3 p3 = fract(vec3(seedState.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); seedState += vec2(0.123, 0.456); return fract((p3.x + p3.y) * p3.z); }

vec3 spectralColor(float x) { float r = exp(-pow((x - 0.8) / 0.25, 2.0)); float g = exp(-pow((x - 0.5) / 0.25, 2.0)); float b = exp(-pow((x - 0.2) / 0.25, 2.0)); return vec3(r, g, b); }
float getIOR(float baseN, float lambda, float C) { if (baseN <= 1.001) return baseN; float invL2 = 1.0 / (lambda * lambda); float invL02 = 1.0 / (0.55 * 0.55); return baseN + C * (invL2 - invL02); }

void checkSegment(vec2 ro, vec2 rd, vec4 seg, vec4 props, inout float minT, inout vec2 bestNormal, inout vec4 bestProps) {
    vec2 a = seg.xy; vec2 b = seg.zw; vec2 v = b - a; vec2 w = ro - a; float denom = rd.x * v.y - rd.y * v.x;
    if(abs(denom) < 1e-6) return; float t = (v.x * w.y - v.y * w.x) / denom; float s = (rd.x * w.y - rd.y * w.x) / denom;
    if(t > 0.05 && t < minT && s >= 0.0 && s <= 1.0) { minT = t; bestNormal = normalize(vec2(v.y, -v.x)); bestProps = props; }
}

void checkArc(vec2 ro, vec2 rd, vec4 arc, vec4 limits, vec4 props, inout float minT, inout vec2 bestNormal, inout vec4 bestProps) {
    vec2 c = arc.xy; float r = arc.z; float normalSign = arc.w;
    vec2 dir = limits.xy; float cosHalfAngle = limits.z;

    vec2 oc = ro - c; float a = dot(rd, rd); float b = 2.0 * dot(oc, rd); float c_val = dot(oc, oc) - r*r; float disc = b*b - 4.0*a*c_val;
    if(disc >= 0.0) {
        float sqrtD = sqrt(disc); float t1 = (-b - sqrtD)/(2.0*a); float t2 = (-b + sqrtD)/(2.0*a);
        if(t1 > 0.05 && t1 < minT) {
            vec2 hitPos = ro + rd * t1; vec2 toHit = normalize(hitPos - c);
            if(dot(toHit, dir) >= cosHalfAngle) { minT = t1; bestNormal = toHit * normalSign; bestProps = props; }
        }
        if(t2 > 0.05 && t2 < minT) {
            vec2 hitPos = ro + rd * t2; vec2 toHit = normalize(hitPos - c);
            if(dot(toHit, dir) >= cosHalfAngle) { minT = t2; bestNormal = toHit * normalSign; bestProps = props; }
        }
    }
}

void checkCircle(vec2 ro, vec2 rd, vec3 circ, vec4 props, inout float minT, inout vec2 bestNormal, inout vec4 bestProps) {
    vec2 c = circ.xy; float r = circ.z; vec2 oc = ro - c; float a = dot(rd, rd); float b = 2.0 * dot(oc, rd); float c_val = dot(oc, oc) - r*r; float disc = b*b - 4.0*a*c_val;
    if(disc >= 0.0) {
        float sqrtD = sqrt(disc); float t1 = (-b - sqrtD)/(2.0*a); float t2 = (-b + sqrtD)/(2.0*a); float t = t1 > 0.05 ? t1 : (t2 > 0.05 ? t2 : -1.0);
        if(t > 0.05 && t < minT) { minT = t; bestNormal = normalize((ro + rd*t) - c); bestProps = props; }
    }
}

void checkParabola(vec2 ro, vec2 rd, vec4 parabola, vec4 orientation, inout float minT, inout vec2 bestNormal, inout vec4 bestProps) {
    vec2 vertex = parabola.xy;
    float radius = parabola.z;
    float halfWidth = parabola.w;
    float cosA = orientation.x;
    float sinA = orientation.y;

    mat2 rot = mat2(cosA, sinA, -sinA, cosA);
    mat2 invRot = mat2(cosA, -sinA, sinA, cosA);

    vec2 localRo = invRot * (ro - vertex);
    vec2 localRd = invRot * rd;

    float a = localRd.x * localRd.x;
    float b = 2.0 * localRo.x * localRd.x - 2.0 * radius * localRd.y;
    float c = localRo.x * localRo.x - 2.0 * radius * localRo.y;

    float candidateT = minT;
    bool foundHit = false;

    if (abs(a) < 1e-6) {
        if (abs(b) > 1e-6) {
            float t = -c / b;
            vec2 hit = localRo + localRd * t;
            if (t > 0.05 && t < candidateT && abs(hit.x) <= halfWidth) {
                candidateT = t;
                foundHit = true;
            }
        }
    } else {
        float disc = b * b - 4.0 * a * c;
        if (disc >= 0.0) {
            float sqrtD = sqrt(disc);
            float t1 = (-b - sqrtD) / (2.0 * a);
            float t2 = (-b + sqrtD) / (2.0 * a);

            vec2 hit1 = localRo + localRd * t1;
            if (t1 > 0.05 && t1 < candidateT && abs(hit1.x) <= halfWidth) {
                candidateT = t1;
                foundHit = true;
            }

            vec2 hit2 = localRo + localRd * t2;
            if (t2 > 0.05 && t2 < candidateT && abs(hit2.x) <= halfWidth) {
                candidateT = t2;
                foundHit = true;
            }
        }
    }

    if (foundHit) {
        vec2 localHit = localRo + localRd * candidateT;
        vec2 localNormal = normalize(vec2(localHit.x / radius, -1.0));
        minT = candidateT;
        bestNormal = normalize(rot * localNormal);
        bestProps = vec4(1.0, 2.0, 0.0, 0.0);
    }
}

bool rayIntersectsAABB(vec2 ro, vec2 invRd, vec4 bbox, out float tmin, out float tmax) {
    vec2 t0 = (bbox.xy - ro) * invRd;
    vec2 t1 = (bbox.zw - ro) * invRd;
    vec2 tmin2 = min(t0, t1);
    vec2 tmax2 = max(t0, t1);
    tmin = max(tmin2.x, tmin2.y);
    tmax = min(tmax2.x, tmax2.y);
    return tmax >= tmin && tmax > 0.0;
}

void main() {
    int id = gl_InstanceID; int step = gl_VertexID;
    seedState = vec2(float(id), 1.337 + u_seedOffset);
    
    float rndY = fract(float(id) / u_totalRays + u_seedOffset); float wl = fract(float(id) * 0.618033988749895 + u_seedOffset); 
    if(u_colorType == 1) wl = 0.8; else if(u_colorType == 2) wl = 0.5; else if(u_colorType == 3) wl = 0.2; 
    else if(u_colorType == 4) wl = 0.2 + 0.6 * clamp((u_wavelength - 380.0) / (750.0 - 380.0), 0.0, 1.0);
    
    float lambda = mix(0.4, 0.7, wl); vec3 color = spectralColor(wl);
    vec2 perp = vec2(-u_lightDir.y, u_lightDir.x); vec2 ro = u_lightPos + perp * (rndY - 0.5) * u_beamWidth; vec2 rd = u_lightDir;
    
    float currentN = u_envN; float currentAbs = 0.0; float currentScat = 0.0; float currentGrin = 0.0; float intensity = 1.0; 

    for(int i = 0; i < 400; i++) {
        if(i >= step) break; 
        if (intensity < 0.001) break;

        float minT = 99999.0; vec2 normal = vec2(0.0); vec4 hitProps = vec4(1.0, 0.0, 0.0, 0.0);
        
        vec2 invRd = 1.0 / rd;
        for (int g = 0; g < 128; g++) {
            int startIdx = g * 32;
            if (startIdx >= u_numSegments) break;
            
            float tminBox, tmaxBox;
            if (rayIntersectsAABB(ro, invRd, u_groupBBox[g], tminBox, tmaxBox)) {
                if (tminBox > minT) continue; 
                
                for (int j = 0; j < 32; j++) {
                    int segIdx = startIdx + j;
                    if (segIdx >= u_numSegments) break;
                    
                    vec4 seg = texelFetch(u_segmentsTex, ivec2(segIdx, 0), 0);
                    vec4 props = texelFetch(u_segmentsTex, ivec2(segIdx, 1), 0);
                    checkSegment(ro, rd, seg, props, minT, normal, hitProps);
                }
            }
        }

        for(int j=0; j<256; j++) { if(j >= u_numArcs) break; checkArc(ro, rd, u_arcs[j], u_arcLimits[j], u_arcProps[j], minT, normal, hitProps); }
        for(int j=0; j<256; j++) { if(j >= u_numCircles) break; checkCircle(ro, rd, u_circles[j], u_circProps[j], minT, normal, hitProps); }
        for(int j=0; j<128; j++) { if(j >= u_numParabolas) break; checkParabola(ro, rd, u_parabolas[j], u_parabolaOrientation[j], minT, normal, hitProps); }

        float mu_s = 0.0;
        if (currentScat > 0.0) { float lambda_ratio = 0.55 / lambda; mu_s = currentScat * pow(lambda_ratio, 4.0); }
        float t_scatter = 99999.0;
        if (mu_s > 0.0) { float xi = clamp(rand(), 1e-7, 0.999999); t_scatter = -log(xi) / mu_s; }

        float mediumStep = minT;
        if (currentGrin != 0.0) {
            mediumStep = min(minT, 10.0);
        }

        if (t_scatter < mediumStep) {
            ro += rd * t_scatter;
            if (currentAbs > 0.0) intensity *= exp(-t_scatter * currentAbs);
            float angle = rand() * 6.28318530718;
            rd = vec2(cos(angle), sin(angle));
            continue;
        }

        if (currentGrin != 0.0 && mediumStep < minT) {
            ro += rd * mediumStep;
            vec2 gradN = vec2(0.0, -currentGrin);
            rd = normalize(rd * currentN + gradN * mediumStep);
            if (currentAbs > 0.0) intensity *= exp(-mediumStep * currentAbs);
            continue;
        }

        if (t_scatter < minT) {
            minT = t_scatter; ro = ro + rd * minT;
            if (currentAbs > 0.0) intensity *= exp(-minT * currentAbs);
            float angle = rand() * 6.28318530718; rd = vec2(cos(angle), sin(angle));
            continue; 
        }

        if(minT > 9999.0) { ro = ro + rd * 2500.0; if (currentN > 1.0) intensity *= exp(-2500.0 * currentAbs); break; }
        
        vec2 hitPos = ro + rd * minT;
        if (currentAbs > 0.0) { intensity *= exp(-minT * currentAbs); }

        if(hitProps.y == 2.0) { 
            if(dot(rd, normal) > 0.0) normal = -normal; rd = reflect(rd, normal); intensity *= 0.98; 
        } else { 
            bool entering = dot(rd, normal) < 0.0; if(!entering) normal = -normal;
            float n1 = getIOR(currentN, lambda, u_dispersion); float n2 = getIOR(entering ? hitProps.x : u_envN, lambda, u_dispersion);
            float ratio = n1 / n2; float cosI = -dot(rd, normal); float sinT2 = ratio * ratio * (1.0 - cosI * cosI);
            
            if(sinT2 > 1.0) { rd = reflect(rd, normal); } else {
                float cosT = sqrt(1.0 - sinT2); float r0 = pow((n1 - n2) / (n1 + n2), 2.0); float R = r0 + (1.0 - r0) * pow(1.0 - cosI, 5.0);

                seedState += hitPos * 0.01 + vec2(float(i*13), float(i*97));
                if(rand() < R) { rd = reflect(rd, normal); } 
                else { 
                    rd = normalize(ratio * rd + (ratio * cosI - cosT) * normal); 
                    currentN = entering ? hitProps.x : u_envN; 
                    currentAbs = entering ? (hitProps.y == 3.0 ? 0.0 : hitProps.z) : 0.0; 
                    currentGrin = entering ? (hitProps.y == 3.0 ? hitProps.z : 0.0) : 0.0;
                    currentScat = entering ? hitProps.w : 0.0;
                }
            }
        } ro = hitPos;
    }
    vec2 screenPos = ro * u_cameraZoom + u_cameraPos;
    vec2 clipPos = (screenPos / u_resolution) * 2.0 - 1.0; clipPos.y = -clipPos.y; gl_Position = vec4(clipPos, 0.0, 1.0);
    v_color = color; v_alpha = intensity * u_baseAlpha; 
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float; in vec3 v_color; in float v_alpha; out vec4 fragColor;
void main() { fragColor = vec4(v_color * v_alpha, 1.0); }
`;

export const quadVertexShaderSource = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const quadFragmentShaderSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_accumTex;
uniform float u_accumFrames;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_accumTex, v_uv).rgb;
    color /= u_accumFrames;
    
    // Tone mapping to prevent overexposure (ACES-like or simple exposure)
    // We use a simple exposure curve to keep it smooth and prevent blowouts
    color = 1.0 - exp(-color * 1.5);
    
    fragColor = vec4(color, 1.0);
}
`;
