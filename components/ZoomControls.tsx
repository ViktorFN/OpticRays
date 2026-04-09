import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { AppState } from '../types';

interface ZoomControlsProps {
  state: AppState;
  updateState: (updater: (state: AppState) => void, render?: boolean, recordHistory?: boolean) => void;
}

export default function ZoomControls({ state, updateState }: ZoomControlsProps) {
  const handleZoomIn = () => {
    updateState((scene) => {
      const zoomFactor = 1.2;
      const newZoom = scene.camera.zoom * zoomFactor;
      const width = window.innerWidth;
      const height = window.innerHeight;
      scene.camera.x = width / 2 - ((width / 2 - scene.camera.x) / scene.camera.zoom) * newZoom;
      scene.camera.y = height / 2 - ((height / 2 - scene.camera.y) / scene.camera.zoom) * newZoom;
      scene.camera.zoom = newZoom;
    }, true, false);
  };

  const handleZoomOut = () => {
    updateState((scene) => {
      const zoomFactor = 1.2;
      const newZoom = scene.camera.zoom / zoomFactor;
      const width = window.innerWidth;
      const height = window.innerHeight;
      scene.camera.x = width / 2 - ((width / 2 - scene.camera.x) / scene.camera.zoom) * newZoom;
      scene.camera.y = height / 2 - ((height / 2 - scene.camera.y) / scene.camera.zoom) * newZoom;
      scene.camera.zoom = newZoom;
    }, true, false);
  };

  const handleReset = () => {
    updateState((scene) => {
      scene.camera.x = 0;
      scene.camera.y = 0;
      scene.camera.zoom = 1;
    }, true, false);
  };

  return (
    <div className="absolute right-6 bottom-6 z-10 flex flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#1a1a1a]/90 p-1 shadow-2xl backdrop-blur-md">
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={handleZoomIn}
          title="Увеличить (Ctrl + колесо)"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={handleReset}
          title="Сбросить вид"
        >
          <Maximize size={16} />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={handleZoomOut}
          title="Уменьшить (Ctrl + колесо)"
        >
          <ZoomOut size={16} />
        </button>
      </div>
      <div className="text-center font-mono text-[10px] text-white/40">
        {Math.round(state.camera.zoom * 100)}%
      </div>
    </div>
  );
}
