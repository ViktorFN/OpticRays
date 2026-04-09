import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  onCommit?: () => void;
  badgeText?: string;
  badgeColor?: string;
  labelColor?: string;
  style?: React.CSSProperties;
  isMixed?: boolean;
}

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  badgeText,
  badgeColor = 'bg-white/10 text-white/90',
  labelColor = 'text-gray-300',
  style,
  isMixed = false,
}: SliderProps) {
  return (
    <div className="mb-2.5 last:mb-0" style={style}>
      <div className="mb-1 flex items-end justify-between">
        <span className={`flex items-center gap-1 text-[11px] ${labelColor}`}>{label}</span>
        <span className={`rounded px-1 py-0.5 font-mono text-[9px] tracking-wider ${isMixed ? 'bg-amber-400/20 text-amber-200' : badgeColor}`}>
          {isMixed ? 'Смешано' : badgeText || value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        className={`w-full cursor-pointer appearance-none rounded-full bg-white/15 transition-all hover:bg-white/25 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md ${isMixed ? 'opacity-50' : ''}`}
      />
    </div>
  );
}
