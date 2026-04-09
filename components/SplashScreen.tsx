import React, { useEffect, useRef, useState } from 'react';
import splashVideo from '../assets/z.mp4';

interface SplashScreenProps {
  onStart: () => void;
}

export default function SplashScreen({ onStart }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const startedRef = useRef(false);

  useEffect(() => {
    const handleStart = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setOpacity(0);
      window.setTimeout(() => {
        setVisible(false);
        onStart();
      }, 800);
    };

    window.addEventListener('keydown', handleStart);
    window.addEventListener('mousedown', handleStart);
    window.addEventListener('touchstart', handleStart);

    return () => {
      window.removeEventListener('keydown', handleStart);
      window.removeEventListener('mousedown', handleStart);
      window.removeEventListener('touchstart', handleStart);
    };
  }, [onStart]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center overflow-hidden bg-black transition-opacity duration-800 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ opacity }}
    >
      <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-contain opacity-100">
        <source src={splashVideo} type="video/mp4" />
      </video>

      <div className="absolute top-30 left-1/2 z-10 w-full -translate-x-1/2 text-center text-[30px] font-medium tracking-[0.22em] text-white/60 drop-shadow-lg">
        207 кафедра физики и химии
      </div>

      <div className="absolute inset-0 bg-black/20" />
      <div className="pointer-events-none absolute bottom-35 left-1/2 z-10 -translate-x-1/2 animate-pulse text-xs font-normal uppercase tracking-widest text-white/70 drop-shadow-md">
        Нажмите любую клавишу или кликните мышью
      </div>
    </div>
  );
}
