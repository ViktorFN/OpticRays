import React from 'react';
import { AppState } from '../types';
import { Cpu, Zap, Activity } from 'lucide-react';

interface TopBarProps {
  state: AppState;
  updateState: (updater: (s: AppState) => void, render?: boolean, recordHistory?: boolean) => void;
}

export default function TopBar({ state, updateState }: TopBarProps) {
  const rayCounts = [
    { label: 'Базовый', value: 2000, icon: <Cpu size={14} /> },
    { label: 'Средний', value: 6000, icon: <Activity size={14} /> },
    { label: 'Максимум', value: 10000, icon: <Zap size={14} /> },
  ];

  return (
    <div className="fixed top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-[#0f0f14a6] p-1.5 shadow-2xl backdrop-blur-xl">
      <div className="border-r border-white/10 px-3 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Производительность</span>
      </div>
      <div className="flex gap-1">
        {rayCounts.map((rayCount) => (
          <button
            key={rayCount.value}
            onClick={() => updateState((scene) => { scene.globals.rayCount = rayCount.value; })}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all ${
              state.globals.rayCount === rayCount.value
                ? 'border-blue-500/30 bg-blue-500/20 text-blue-300'
                : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {rayCount.icon}
            {rayCount.label}
            <span className="text-[9px] opacity-50">{rayCount.value} лучей</span>
          </button>
        ))}
      </div>
    </div>
  );
}
