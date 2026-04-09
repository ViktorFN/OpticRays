import React from 'react';
import { AppState, OpticElement } from '../types';
import Slider from './Slider';
import { Trash2, Copy } from 'lucide-react';
import { cloneDeep, createId } from '../lib/state';

interface RightPanelProps {
  state: AppState;
  updateState: (updater: (s: AppState) => void, render?: boolean, recordHistory?: boolean) => void;
  onDelete: () => void;
}

export default function RightPanel({ state, updateState, onDelete }: RightPanelProps) {
  const selectedIndices = state.selectedElements || [];
  const firstIndex = selectedIndices[0];
  const selectedElement = typeof firstIndex === 'number' && firstIndex >= 0 && firstIndex < state.elements.length
    ? state.elements[firstIndex]
    : null;

  const updateSelected = (updates: Partial<OpticElement>) => {
    if (selectedIndices.length === 0) return;
    updateState((scene) => {
      scene.selectedElements.forEach((index) => {
        if (index >= 0 && index < scene.elements.length) {
          Object.assign(scene.elements[index], updates);
        }
      });
    }, true, false);
  };

  const isMixed = (prop: keyof OpticElement) => {
    if (selectedIndices.length <= 1) return false;
    const firstValue = state.elements[selectedIndices[0]][prop];
    return !selectedIndices.every((index) => state.elements[index][prop] === firstValue);
  };

  const commitHistory = () => {
    updateState(() => {}, false, true);
  };

  const duplicateSelected = () => {
    if (selectedIndices.length === 0) return;
    updateState((scene) => {
      const newSelection: number[] = [];
      scene.selectedElements.forEach((index) => {
        const newElement = cloneDeep(scene.elements[index]);
        newElement.id = createId();
        newElement.x += 20;
        newElement.y += 20;
        scene.elements.push(newElement);
        newSelection.push(scene.elements.length - 1);
      });
      scene.selectedElements = newSelection;
    });
  };

  if (!selectedElement) return null;

  const typeNames: Record<string, string> = {
    lens: 'Линза',
    mirror: 'Зеркало',
    prism: 'Призма',
    polygon: 'Полигон',
    raindrop: 'Капля',
    fiber: 'Световод',
    parabolicMirror: 'Параболическое зеркало',
  };

  return (
    <div className="fixed top-4 right-4 z-10 flex max-h-[calc(100vh-32px)] w-[280px] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f14a6] p-3 text-white/90 shadow-2xl backdrop-blur-xl scrollbar-thin scrollbar-thumb-white/15">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h2 className="bg-gradient-to-r from-blue-400 to-fuchsia-400 bg-clip-text text-base font-bold capitalize text-transparent">
          {selectedIndices.length > 1 ? `Группа (${selectedIndices.length})` : (typeNames[selectedElement.type] || selectedElement.type)}
        </h2>
        <div className="flex gap-1">
          <button onClick={duplicateSelected} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
            <Copy size={14} />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Slider label="X" value={selectedElement.x} min={-1000} max={1000} onChange={(value) => updateSelected({ x: value })} onCommit={commitHistory} isMixed={isMixed('x')} />
          <Slider label="Y" value={selectedElement.y} min={-1000} max={1000} onChange={(value) => updateSelected({ y: value })} onCommit={commitHistory} isMixed={isMixed('y')} />
        </div>
        <Slider label="Вращение" value={selectedElement.rotation || 0} min={0} max={360} onChange={(value) => updateSelected({ rotation: value })} onCommit={commitHistory} badgeText={isMixed('rotation') ? '...' : `${selectedElement.rotation || 0}°`} isMixed={isMixed('rotation')} />

        <div className="mt-1 border-t border-white/5 pt-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Оптика</h3>
          {selectedElement.type !== 'mirror' && (
            <>
              <Slider label="Показатель (n)" value={(selectedElement.n || 1.5) * 100} min={100} max={300} onChange={(value) => updateSelected({ n: value / 100 })} onCommit={commitHistory} badgeText={isMixed('n') ? '...' : (selectedElement.n || 1.5).toFixed(2)} badgeColor="bg-cyan-400/20 text-cyan-200" labelColor="font-medium text-cyan-300/80" isMixed={isMixed('n')} />
              <Slider label="Градиент (GRIN)" value={(selectedElement.grin || 0) * 10000} min={0} max={100} onChange={(value) => updateSelected({ grin: value / 10000 })} onCommit={commitHistory} badgeText={isMixed('grin') ? '...' : (selectedElement.grin || 0).toFixed(4)} badgeColor="bg-indigo-400/20 text-indigo-200" labelColor="font-medium text-indigo-300/80" isMixed={isMixed('grin')} />
            </>
          )}
          <Slider label="Поглощение" value={(selectedElement.absorption || 0) * 1000} min={0} max={100} onChange={(value) => updateSelected({ absorption: value / 1000 })} onCommit={commitHistory} badgeText={isMixed('absorption') ? '...' : (selectedElement.absorption || 0).toFixed(3)} badgeColor="bg-red-400/20 text-red-200" labelColor="font-medium text-red-300/80" isMixed={isMixed('absorption')} />
          <Slider label="Рассеяние" value={(selectedElement.scattering || 0) * 1000} min={0} max={100} onChange={(value) => updateSelected({ scattering: value / 1000 })} onCommit={commitHistory} badgeText={isMixed('scattering') ? '...' : (selectedElement.scattering || 0).toFixed(3)} badgeColor="bg-orange-400/20 text-orange-200" labelColor="font-medium text-orange-300/80" isMixed={isMixed('scattering')} />
        </div>

        <div className="mt-1 border-t border-white/5 pt-2">
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Геометрия</h3>
          {selectedElement.type === 'prism' && (
            <Slider label="Размер" value={selectedElement.size || 140} min={20} max={400} onChange={(value) => updateSelected({ size: value })} onCommit={commitHistory} isMixed={isMixed('size')} />
          )}
          {selectedElement.type === 'raindrop' && (
            <Slider label="Радиус" value={selectedElement.radius || 100} min={10} max={300} onChange={(value) => updateSelected({ radius: value })} onCommit={commitHistory} isMixed={isMixed('radius')} />
          )}
          {selectedElement.type === 'mirror' && (
            <Slider label="Длина" value={selectedElement.length || 150} min={20} max={600} onChange={(value) => updateSelected({ length: value })} onCommit={commitHistory} isMixed={isMixed('length')} />
          )}
          {selectedElement.type === 'parabolicMirror' && (
            <>
              <Slider label="Размер" value={selectedElement.size || 200} min={20} max={800} onChange={(value) => updateSelected({ size: value })} onCommit={commitHistory} isMixed={isMixed('size')} />
              <Slider label="Кривизна" value={selectedElement.curvatureRadius || 400} min={50} max={2000} onChange={(value) => updateSelected({ curvatureRadius: value })} onCommit={commitHistory} isMixed={isMixed('curvatureRadius')} />
            </>
          )}
          {selectedElement.type === 'lens' && (
            <>
              <Slider label="Кривизна" value={selectedElement.curvatureRadius || 200} min={50} max={1000} onChange={(value) => updateSelected({ curvatureRadius: value })} onCommit={commitHistory} isMixed={isMixed('curvatureRadius')} />
              <Slider label="Высота" value={selectedElement.height || 180} min={20} max={600} onChange={(value) => updateSelected({ height: value })} onCommit={commitHistory} isMixed={isMixed('height')} />
              <Slider label="Толщина" value={selectedElement.thickness || 50} min={10} max={200} onChange={(value) => updateSelected({ thickness: value })} onCommit={commitHistory} isMixed={isMixed('thickness')} />
            </>
          )}
          {selectedElement.type === 'fiber' && (
            <Slider label="Толщина" value={selectedElement.thickness || 40} min={5} max={100} onChange={(value) => updateSelected({ thickness: value })} onCommit={commitHistory} isMixed={isMixed('thickness')} />
          )}
        </div>
      </div>
    </div>
  );
}
