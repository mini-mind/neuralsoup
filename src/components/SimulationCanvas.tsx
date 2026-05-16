import React, { useRef, useEffect, useState } from 'react';
import * as PIXI from '../engine/pixi';
import type { BrainGraph } from '../domain/brain';
import { SimulationEngine, type SimulationLifecycleState } from '../engine/SimulationEngine';
import type { SimulationControlMode } from '../domain/world';
import type { SimulationState } from '../types/simulation';
import type { BrainGraphRuntimeStatus } from '../types/brainGraphRuntime';
import type { AgentParameters } from './editor/types';

interface SimulationCanvasProps {
  onStatsUpdate: (stats: SimulationState['stats']) => void;
  onLifecycleChange: (state: SimulationLifecycleState) => void;
  onAgentParametersChange: (params: AgentParameters) => void;
  onBrainGraphStatusChange: (status: BrainGraphRuntimeStatus) => void;
  controlMode: Extract<SimulationControlMode, 'keyboard' | 'snn'>;
  brainGraph: BrainGraph;
  agentParameters: AgentParameters;
  requestedLifecycleState: SimulationLifecycleState;
  resetToken: number;
  width: number;
  height: number;
}

const KEYBOARD_CONTROL_KEYS = ['w', 'a', 'd', 'arrowup', 'arrowleft', 'arrowright'] as const;

const areAgentParametersEqual = (left: AgentParameters, right: AgentParameters): boolean => {
  return (
    left.visionCells === right.visionCells &&
    left.visionRange === right.visionRange &&
    left.visionAngle === right.visionAngle
  );
};

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  onStatsUpdate,
  onLifecycleChange,
  onAgentParametersChange,
  onBrainGraphStatusChange,
  controlMode,
  brainGraph,
  agentParameters,
  requestedLifecycleState,
  resetToken,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const lastAppliedResetTokenRef = useRef(resetToken);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineInstanceId, setEngineInstanceId] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const container = canvasRef.current;

    if (!container) {
      return;
    }

    const cleanupInitialization = ({
      app,
      engine,
      appendedView,
      errorMessage
    }: {
      app: PIXI.Application | null;
      engine: SimulationEngine | null;
      appendedView: HTMLCanvasElement | null;
      errorMessage: string | null;
    }): void => {
      const view = appendedView ?? (app?.view as HTMLCanvasElement | undefined) ?? null;

      if (engine) {
        try {
          engine.destroy();
        } catch (cleanupError) {
          console.error('Failed to destroy simulation engine during cleanup:', cleanupError);
        }
      }

      if (view?.parentNode) {
        try {
          view.parentNode.removeChild(view);
        } catch (cleanupError) {
          console.error('Failed to remove PIXI canvas during cleanup:', cleanupError);
        }
      }

      if (app) {
        try {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (cleanupError) {
          console.error('Failed to destroy PIXI application during cleanup:', cleanupError);
        }
      }

      engineRef.current = null;
      appRef.current = null;
      setIsEngineReady(false);
      setEngineInstanceId(0);
      setRenderError(errorMessage);
      onLifecycleChange('idle');
    };

    if (!appRef.current) {
      let newApp: PIXI.Application | null = null;
      let newEngine: SimulationEngine | null = null;
      let appendedView: HTMLCanvasElement | null = null;
      setRenderError(null);

      try {
        newApp = new PIXI.Application({
          width,
          height,
          backgroundColor: 0x87ceeb,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true
        });

        appendedView = newApp.view as HTMLCanvasElement;
        container.appendChild(appendedView);

        const fixedWorldWidth = 3000;
        const fixedWorldHeight = 3000;
        newEngine = new SimulationEngine(newApp, fixedWorldWidth, fixedWorldHeight);
        newEngine.onStatsUpdate = onStatsUpdate;
        newEngine.onLifecycleChange = onLifecycleChange;
        newEngine.onBrainGraphStatusChange = onBrainGraphStatusChange;
        newEngine.initialize();

        const mainAgent = newEngine.getMainAgent();
        if (mainAgent) {
          newEngine.setCameraTarget(mainAgent);
        }

        appRef.current = newApp;
        engineRef.current = newEngine;
        setIsEngineReady(true);
        setEngineInstanceId((prev) => prev + 1);
        onAgentParametersChange(newEngine.getAgentParameters());
        onBrainGraphStatusChange(newEngine.getBrainGraphRuntimeStatus());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Pixi renderer error';
        console.error('Failed to initialize simulation canvas:', error);
        cleanupInitialization({
          app: newApp,
          engine: newEngine,
          appendedView,
          errorMessage: message
        });
        return;
      }
    }

    return () => {
      if (appRef.current || engineRef.current) {
        cleanupInitialization({
          app: appRef.current,
          engine: engineRef.current,
          appendedView: (appRef.current?.view as HTMLCanvasElement | undefined) ?? null,
          errorMessage: null
        });
      }
    };
  }, [onAgentParametersChange, onBrainGraphStatusChange, onLifecycleChange, onStatsUpdate]);

  useEffect(() => {
    if (!appRef.current) {
      return;
    }

    appRef.current.renderer.resize(width, height);
  }, [width, height]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    engineRef.current.onStatsUpdate = onStatsUpdate;
  }, [onStatsUpdate]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    engineRef.current.onLifecycleChange = onLifecycleChange;
    onLifecycleChange(engineRef.current.getLifecycleState());
  }, [onLifecycleChange]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    engineRef.current.onBrainGraphStatusChange = onBrainGraphStatusChange;
  }, [onBrainGraphStatusChange]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    engine.setControlMode(controlMode);
  }, [controlMode]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    engine.setBrainGraph(brainGraph);
  }, [brainGraph]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    const currentParams = engine.getAgentParameters();
    if (areAgentParametersEqual(currentParams, agentParameters)) {
      return;
    }

    engine.updateAgentParameters(agentParameters);
    engine.setBrainGraph(brainGraph);
    onAgentParametersChange(engine.getAgentParameters());
  }, [agentParameters, brainGraph, onAgentParametersChange]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    switch (requestedLifecycleState) {
      case 'running':
        if (engine.getLifecycleState() === 'idle') {
          engine.start();
        } else if (engine.getLifecycleState() === 'paused') {
          engine.resume();
        }
        break;
      case 'paused':
        if (engine.getLifecycleState() === 'running') {
          engine.pause();
        }
        break;
      case 'idle':
        if (engine.getLifecycleState() !== 'idle') {
          engine.stop();
        }
        break;
    }
  }, [height, requestedLifecycleState, width]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine || lastAppliedResetTokenRef.current === resetToken) {
      return;
    }

    lastAppliedResetTokenRef.current = resetToken;
    engine.reset();
    engine.setBrainGraph(brainGraph);
    engine.setControlMode(controlMode);
    engine.updateAgentParameters(agentParameters);
    engine.setBrainGraph(brainGraph);
    onAgentParametersChange(engine.getAgentParameters());
  }, [agentParameters, brainGraph, controlMode, onAgentParametersChange, resetToken]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!engineRef.current) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!KEYBOARD_CONTROL_KEYS.includes(key as (typeof KEYBOARD_CONTROL_KEYS)[number])) {
        return;
      }

      engineRef.current.setKeyboardInputKey(key, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!engineRef.current) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!KEYBOARD_CONTROL_KEYS.includes(key as (typeof KEYBOARD_CONTROL_KEYS)[number])) {
        return;
      }

      engineRef.current.setKeyboardInputKey(key, false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      className="simulation-canvas"
      data-testid="simulation-canvas"
      data-engine-ready={isEngineReady ? 'true' : 'false'}
      data-engine-instance-id={String(engineInstanceId)}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {renderError && (
        <div
          data-testid="simulation-render-error"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#0f172a',
            color: '#e2e8f0',
            textAlign: 'center',
            lineHeight: 1.6
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>渲染初始化失败</div>
            <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
              当前浏览器环境未能初始化 Pixi 渲染器，请确认已启用 WebGL/Canvas 加速，或更换浏览器后重试。
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{renderError}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationCanvas;
