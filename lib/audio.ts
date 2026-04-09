let audioCtx: AudioContext | null = null;
let lastSlideTime = 0;

export function initAudio() { 
    if (!audioCtx) { 
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); 
    } 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
}

export function playSound(type: 'boot' | 'click' | 'slide' | 'delete') {
    if (!audioCtx) return; 
    const now = audioCtx.currentTime;
    if (type === 'slide') { 
        if (now - lastSlideTime < 0.05) return; 
        lastSlideTime = now; 
    }
    const osc = audioCtx.createOscillator(); 
    const gainNode = audioCtx.createGain();
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    osc.connect(filter);
    filter.connect(gainNode); 
    gainNode.connect(audioCtx.destination);
    
    if (type === 'boot') { 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(150, now); 
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.8); 
        gainNode.gain.setValueAtTime(0, now); 
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1); 
        gainNode.gain.setTargetAtTime(0, now + 0.1, 0.3); 
        osc.start(now); 
        osc.stop(now + 1.5); 
    } else if (type === 'click') { 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(300 + Math.random()*20, now); 
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05); 
        gainNode.gain.setValueAtTime(0, now); 
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01); 
        gainNode.gain.setTargetAtTime(0, now + 0.01, 0.03); 
        osc.start(now); 
        osc.stop(now + 0.15); 
    } else if (type === 'slide') { 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(200 + Math.random()*10, now); 
        gainNode.gain.setValueAtTime(0, now); 
        gainNode.gain.linearRampToValueAtTime(0.015, now + 0.005); 
        gainNode.gain.setTargetAtTime(0, now + 0.005, 0.01); 
        osc.start(now); 
        osc.stop(now + 0.05); 
    } else if (type === 'delete') { 
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(200, now); 
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15); 
        gainNode.gain.setValueAtTime(0, now); 
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01); 
        gainNode.gain.setTargetAtTime(0, now + 0.01, 0.05); 
        osc.start(now); 
        osc.stop(now + 0.2); 
    }
}
