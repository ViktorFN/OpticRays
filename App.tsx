import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpticsEngine } from './lib/engine';
import { AppState } from './types';
import { initAudio, playSound } from './lib/audio';
import { cloneDeep, createEmptyState, createId, normalizeLoadedState, serializeState } from './lib/state';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import SplashScreen from './components/SplashScreen';
import ZoomControls from './components/ZoomControls';
import TopBar from './components/TopBar';

function buildDefaultSceneState(): AppState {
  const state = createEmptyState();
  const width = window.innerWidth;
  const height = window.innerHeight;

  state.elements.push({
    id: createId(),
    type: 'lens',
    lensType: 'convex',
    x: width * 0.5 + 50,
    y: height * 0.5,
    curvatureRadius: 300,
    height: 250,
    thickness: 50,
    rotation: 0,
    n: 1.52,
    absorption: 0,
    scattering: 0,
  });

  state.lightSource = {
    x: width > 800 ? 300 : width * 0.2,
    y: height * 0.5,
    dragging: false,
    initialized: true,
  };

  return state;
}

export default function App() {
  const [started, setStarted] = useState(false);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OpticsEngine | null>(null);

  const stateRef = useRef<AppState>(createEmptyState());
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((tick) => tick + 1), []);

  const [historyState, setHistoryState] = useState({ history: [] as string[], index: -1 });

  const pushHistorySnapshot = useCallback((snapshotState: AppState = stateRef.current) => {
    const snapshot = serializeState(snapshotState);

    setHistoryState((prev) => {
      const nextHistory = prev.history.slice(0, prev.index + 1);
      if (nextHistory[nextHistory.length - 1] === snapshot) {
        return prev;
      }

      nextHistory.push(snapshot);
      if (nextHistory.length > 50) {
        nextHistory.shift();
      }

      return { history: nextHistory, index: nextHistory.length - 1 };
    });
  }, []);

  const applyState = useCallback((nextState: AppState, render = true, recordHistory = true) => {
    stateRef.current = nextState;
    if (recordHistory) pushHistorySnapshot(nextState);
    forceUpdate();
    if (render) engineRef.current?.requestRender();
  }, [forceUpdate, pushHistorySnapshot]);

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index <= 0) return prev;

      const previousState = normalizeLoadedState(JSON.parse(prev.history[prev.index - 1]) as Partial<AppState>);
      previousState.lightSource.dragging = false;
      stateRef.current = previousState;
      forceUpdate();
      engineRef.current?.requestRender();
      return { ...prev, index: prev.index - 1 };
    });
  }, [forceUpdate]);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index >= prev.history.length - 1) return prev;

      const nextState = normalizeLoadedState(JSON.parse(prev.history[prev.index + 1]) as Partial<AppState>);
      nextState.lightSource.dragging = false;
      stateRef.current = nextState;
      forceUpdate();
      engineRef.current?.requestRender();
      return { ...prev, index: prev.index + 1 };
    });
  }, [forceUpdate]);

  const updateState = useCallback(
    (updater: (state: AppState) => void, render = true, recordHistory = true) => {
      const nextState = cloneDeep(stateRef.current);
      updater(nextState);
      applyState(nextState, render, recordHistory);
    },
    [applyState]
  );

  const resetScene = useCallback(() => {
    if (started) playSound('click');
    applyState(buildDefaultSceneState(), true, true);
  }, [applyState, started]);

  const handleStart = useCallback(() => {
    if (started) return;
    initAudio();
    playSound('boot');
    setStarted(true);
    applyState(buildDefaultSceneState(), true, true);
  }, [applyState, started]);

  useEffect(() => {
    if (!glCanvasRef.current || !uiCanvasRef.current) return;

    const engine = new OpticsEngine(
      glCanvasRef.current,
      uiCanvasRef.current,
      () => stateRef.current,
      (recordHistory = true) => {
        if (recordHistory) pushHistorySnapshot(stateRef.current);
        forceUpdate();
      }
    );

    engineRef.current = engine;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      engine.resize(window.innerWidth, window.innerHeight, dpr);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    pushHistorySnapshot(stateRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, [forceUpdate, pushHistorySnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (stateRef.current.selectedElements.length > 0) {
          playSound('delete');
          updateState((state) => {
            const sortedIndices = [...state.selectedElements].sort((a, b) => b - a);
            sortedIndices.forEach((index) => state.elements.splice(index, 1));
            state.selectedElements = [];
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, started, undo, updateState]);

  const handleLoadPreset = useCallback((key: string) => {
    const data = localStorage.getItem(key);
    if (!data) return;

    try {
      const parsed = JSON.parse(data) as Partial<AppState>;
      applyState(normalizeLoadedState(parsed), true, true);
      playSound('boot');
    } catch (error) {
      console.error('Failed to parse preset', error);
    }
  }, [applyState]);

  const handleSavePreset = useCallback((name: string) => {
    localStorage.setItem(`optics_preset_${name}`, serializeState(stateRef.current));
    playSound('click');
    forceUpdate();
  }, [forceUpdate]);

  const handleDeletePreset = useCallback((key: string) => {
    localStorage.removeItem(key);
    playSound('delete');
    forceUpdate();
  }, [forceUpdate]);

  const handleDeleteSelected = useCallback(() => {
    if (stateRef.current.selectedElements.length === 0) return;

    playSound('delete');
    updateState((state) => {
      const sortedIndices = [...state.selectedElements].sort((a, b) => b - a);
      sortedIndices.forEach((index) => state.elements.splice(index, 1));
      state.selectedElements = [];
    });
  }, [updateState]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#030305] select-none touch-none font-sans text-white">
      <SplashScreen onStart={handleStart} />

      <div className="absolute inset-0">
        <canvas
          ref={glCanvasRef}
          className="absolute inset-0 z-[1] h-full w-full"
          style={{ filter: 'blur(1.5px) contrast(1.2) brightness(1.2)', mixBlendMode: 'screen' }}
        />
        <canvas
          ref={uiCanvasRef}
          className="absolute inset-0 z-[2] h-full w-full cursor-default"
        />
      </div>

      {started && (
        <>
          <TopBar state={stateRef.current} updateState={updateState} />
          <LeftPanel
            state={stateRef.current}
            updateState={updateState}
            onReset={resetScene}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onDeletePreset={handleDeletePreset}
            undo={undo}
            redo={redo}
            canUndo={historyState.index > 0}
            canRedo={historyState.index < historyState.history.length - 1}
          />
          <RightPanel
            state={stateRef.current}
            updateState={updateState}
            onDelete={handleDeleteSelected}
          />
          <ZoomControls state={stateRef.current} updateState={updateState} />
        </>
      )}
    </div>
  );
}
