import React, { useEffect, useState } from 'react';
import { AppState, Globals, OpticElement } from '../types';
import Slider from './Slider';
import { Triangle, Droplet, SquareSplitHorizontal, Hexagon, ZoomIn, ZoomOut, CloudFog, Activity, Save, Trash2, Upload, Download, Undo2, Redo2, Grid, BookOpen } from 'lucide-react';
import { PRESETS } from '../constants/presets';
import { cloneDeep, createId, normalizeLoadedState } from '../lib/state';

interface LeftPanelProps {
  state: AppState;
  updateState: (updater: (s: AppState) => void, render?: boolean, recordHistory?: boolean) => void;
  onReset: () => void;
  onLoadPreset: (key: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (key: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function LeftPanel({
  state,
  updateState,
  onReset,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  undo,
  redo,
  canUndo,
  canRedo,
}: LeftPanelProps) {
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('optics_preset_')) {
        keys.push(key);
      }
    }
    setPresets(keys.sort((a, b) => a.localeCompare(b)));
  }, [state]);

  const addElement = (type: OpticElement['type'], extraProps: Partial<OpticElement> = {}) => {
    updateState((scene) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      scene.elements.push({
        id: createId(),
        type,
        x: width / 2 + 50,
        y: height / 2,
        rotation: 0,
        n: 1.52,
        absorption: 0,
        scattering: 0,
        ...extraProps,
      });
      scene.selectedElements = [scene.elements.length - 1];
    });
  };

  const handleColorChange = (colorType: number) => {
    updateState((scene) => {
      scene.globals.colorType = colorType;
    });
  };

  const handleGlobalChange = <K extends keyof Globals>(key: K, value: Globals[K]) => {
    updateState((scene) => {
      scene.globals[key] = value;
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'optics_scene.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as Partial<AppState>;
        const normalized = normalizeLoadedState(data);
        updateState((scene) => {
          Object.assign(scene, normalized);
        });
      } catch {
        alert('Ошибка формата файла.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const wavelengthToColor = (wavelength: number) => {
    const hue = 270 - (270 * (wavelength - 380)) / (750 - 380);
    return `hsl(${hue}, 100%, 65%)`;
  };

  return (
    <div className="fixed top-4 left-4 z-10 flex max-h-[calc(100vh-32px)] w-[280px] flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f14a6] p-3 text-white/90 shadow-2xl backdrop-blur-xl scrollbar-thin scrollbar-thumb-white/15">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center bg-gradient-to-r from-blue-400 to-fuchsia-400 bg-clip-text text-lg font-bold text-transparent">
          Виртуальная<span className="font-light text-white"> оптика</span>
          <span className="ml-1 font-mono text-[9px] tracking-widest text-emerald-400">версия 1.0</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo} className={`rounded-lg p-1 transition-colors ${canUndo ? 'text-white hover:bg-white/10' : 'cursor-not-allowed text-white/20'}`}>
            <Undo2 size={14} />
          </button>
          <button onClick={redo} disabled={!canRedo} className={`rounded-lg p-1 transition-colors ${canRedo ? 'text-white hover:bg-white/10' : 'cursor-not-allowed text-white/20'}`}>
            <Redo2 size={14} />
          </button>
          <button onClick={onReset} className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300">
            Сброс
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
          <BookOpen size={10} /> Библиотека пресетов
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => {
                const preset = PRESETS[name];
                updateState((scene) => {
                  if (preset.elements) scene.elements = cloneDeep(preset.elements);
                  if (preset.lightSource) scene.lightSource = { ...scene.lightSource, ...preset.lightSource };
                  if (preset.globals) scene.globals = { ...scene.globals, ...preset.globals };
                  scene.selectedElements = [];
                }, true, true);
              }}
              className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:border-white/20 hover:bg-white/10"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Добавить элемент</h3>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => addElement('prism', { size: 140 })} className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-white/20 hover:bg-white/10">
            <Triangle size={10} /> Призма
          </button>
          <button onClick={() => addElement('raindrop', { radius: 100, n: 1.33 })} className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-white/20 hover:bg-white/10">
            <Droplet size={10} /> Капля
          </button>
          <button onClick={() => addElement('mirror', { length: 150, rotation: 45, n: 1 })} className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-white/20 hover:bg-white/10">
            <SquareSplitHorizontal size={10} /> Зеркало
          </button>
          <button onClick={() => addElement('parabolicMirror', { size: 200, curvatureRadius: 400, rotation: 0, n: 1 })} className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-white/20 hover:bg-white/10">
            <SquareSplitHorizontal size={10} className="rotate-45" /> Параболич. зеркало
          </button>
          <button onClick={() => addElement('polygon', { vertices: [{ x: -60, y: -60 }, { x: 60, y: -60 }, { x: 60, y: 60 }, { x: -60, y: 60 }] })} className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-white/20 hover:bg-white/10">
            <Hexagon size={10} /> Полигон
          </button>
          <button onClick={() => addElement('lens', { lensType: 'convex', curvatureRadius: 200, height: 180, thickness: 50 })} className="flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-cyan-400 hover:bg-white/10">
            <ZoomIn size={10} className="text-cyan-400" /> Выпуклая
          </button>
          <button onClick={() => addElement('lens', { lensType: 'concave', curvatureRadius: 200, height: 180, thickness: 50 })} className="flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-cyan-400 hover:bg-white/10">
            <ZoomOut size={10} className="text-cyan-400" /> Вогнутая
          </button>
          <button onClick={() => addElement('polygon', { n: 1.33, scattering: 0.015, vertices: [{ x: -150, y: -60 }, { x: 150, y: -60 }, { x: 150, y: 60 }, { x: -150, y: 60 }] })} className="flex items-center gap-1 rounded-lg border border-orange-500/50 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-orange-400 hover:bg-white/10">
            <CloudFog size={10} className="text-orange-400" /> Мутная среда
          </button>
          <button onClick={() => addElement('fiber', { thickness: 40, pts: [{ x: -150, y: 0 }, { x: -50, y: -100 }, { x: 50, y: 100 }, { x: 150, y: 0 }] })} className="flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-white/5 p-1.5 text-[10px] font-medium transition-all hover:-translate-y-px hover:border-emerald-400 hover:bg-white/10">
            <Activity size={10} className="text-emerald-400" /> Световод
          </button>
        </div>
      </div>

      <div className="border-t border-white/5 pt-2">
        <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Свет</h3>
        <div className="mb-2 flex rounded-lg border border-white/5 bg-black/40 p-0.5">
          {[
            { id: 0, label: 'Белый', color: 'text-white' },
            { id: 1, label: 'Красный', color: 'text-red-400' },
            { id: 2, label: 'Зелёный', color: 'text-green-400' },
            { id: 3, label: 'Синий', color: 'text-blue-400' },
            { id: 4, label: 'Своя длина', color: 'text-purple-400' },
          ].map((colorMode) => (
            <button
              key={colorMode.id}
              onClick={() => handleColorChange(colorMode.id)}
              className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition-all ${state.globals.colorType === colorMode.id ? 'bg-white/20 text-white shadow-sm' : `hover:bg-white/5 ${colorMode.color}`}`}
            >
              {colorMode.label}
            </button>
          ))}
        </div>
        {state.globals.colorType === 4 && (
          <Slider
            label="Длина волны"
            value={state.globals.wavelength}
            min={380}
            max={750}
            onChange={(value) => handleGlobalChange('wavelength', value)}
            badgeText={`${state.globals.wavelength} nm`}
            badgeColor="bg-white/10"
            labelColor="font-medium"
            style={{ color: wavelengthToColor(state.globals.wavelength) }}
          />
        )}
        <Slider label="Угол луча" value={state.globals.angle} min={-45} max={45} onChange={(value) => handleGlobalChange('angle', value)} badgeText={`${state.globals.angle}°`} />
        <Slider label="Толщина пучка" value={state.globals.beamWidth} min={1} max={400} onChange={(value) => handleGlobalChange('beamWidth', value)} />
        <Slider label="Яркость" value={state.globals.intensity * 100} min={10} max={500} onChange={(value) => handleGlobalChange('intensity', value / 100)} badgeText={`x${state.globals.intensity.toFixed(1)}`} badgeColor="bg-yellow-400/20 text-yellow-200" labelColor="font-medium text-yellow-300/80" />
      </div>

      <div className="border-t border-white/5 pt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Глобальная среда</h3>
          <button
            onClick={() => handleGlobalChange('snapping', !state.globals.snapping)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${state.globals.snapping ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            <Grid size={10} /> Сетка
          </button>
        </div>
        <Slider label="Дисперсия" value={state.globals.dispersion * 1000} min={0} max={100} onChange={(value) => handleGlobalChange('dispersion', value / 1000)} badgeText={state.globals.dispersion.toFixed(3)} badgeColor="bg-fuchsia-400/20 text-fuchsia-200" labelColor="font-medium text-fuchsia-300/80" />
        <Slider label="Среда (n)" value={state.globals.envN * 100} min={100} max={250} onChange={(value) => handleGlobalChange('envN', value / 100)} badgeText={state.globals.envN.toFixed(2)} badgeColor="bg-cyan-400/20 text-cyan-200" labelColor="font-medium text-cyan-300/80" />
      </div>

      <div className="border-t border-white/5 pt-2">
        <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">Сцены и файлы</h3>
        <div className="mb-1.5 flex gap-1">
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/90 outline-none"
          >
            <option value="">-- Выберите сцену --</option>
            {presets.map((preset) => (
              <option key={preset} value={preset} className="bg-[#111] text-white">
                {preset.replace('optics_preset_', '')}
              </option>
            ))}
          </select>
          <button onClick={() => { if (selectedPreset) onLoadPreset(selectedPreset); }} className="rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[10px] font-medium transition-all hover:bg-white/10">
            Загрузить
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              const name = prompt('Название сцены:');
              if (name) {
                onSavePreset(name);
                setSelectedPreset(`optics_preset_${name}`);
              }
            }}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-white/5 bg-white/5 py-1 text-[10px] font-medium transition-all hover:bg-white/10"
          >
            <Save size={10} /> Сохранить
          </button>
          <button
            onClick={() => {
              if (selectedPreset && confirm('Удалить сцену?')) {
                onDeletePreset(selectedPreset);
                setSelectedPreset('');
              }
            }}
            className="flex items-center justify-center rounded-lg bg-red-500/10 py-1 text-red-400 transition-all hover:bg-red-500/20"
          >
            <Trash2 size={10} />
          </button>
          <button onClick={handleExport} title="Экспорт в файл" className="flex items-center justify-center rounded-lg border border-white/5 bg-white/5 py-1 transition-all hover:bg-white/10">
            <Download size={10} />
          </button>
          <button onClick={() => document.getElementById('importFile')?.click()} title="Импорт из файла" className="flex items-center justify-center rounded-lg border border-white/5 bg-white/5 py-1 transition-all hover:bg-white/10">
            <Upload size={10} />
          </button>
          <input type="file" id="importFile" className="hidden" accept=".json" onChange={handleImport} />
        </div>
      </div>
    </div>
  );
}
