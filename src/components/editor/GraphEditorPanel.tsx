import React, { useEffect, useRef, useState } from 'react';
import SNNTopologyEditor from '../SNNTopologyEditor';
import type { AgentIR, WorldRegistry } from '../../domain/brain';
import type { AgentIRSummary } from '../../domain/brain/agent-ir';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../../types/agentRuntime';
import type { GraphPathItem } from './types';
import type { GraphDocumentChangeOptions } from '../hooks/useSNNTopologyState';

interface GraphEditorPanelProps {
  isActive: boolean;
  agent: AgentIR;
  graphSessionToken: string;
  visionCells: number;
  installedSummary: AgentIRSummary;
  worldRegistry: WorldRegistry;
  runtimeStatus: AgentRuntimeStatus;
  draftStatus: AgentDraftStatus;
  runtimeActivity: AgentRuntimeActivitySnapshot;
  onAgentChange: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
  onGraphPathChange: (graphPath: GraphPathItem[], sourceSessionToken: string) => void;
  onGraphPathNavigateRegister: (navigate: (pathId: string) => void, sourceSessionToken: string) => void;
}

const GraphEditorPanel: React.FC<GraphEditorPanelProps> = ({
  isActive,
  agent,
  graphSessionToken,
  visionCells,
  installedSummary,
  worldRegistry,
  runtimeStatus,
  draftStatus,
  runtimeActivity,
  onAgentChange,
  onGraphPathChange,
  onGraphPathNavigateRegister
}) => {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) {
      return;
    }

    const updateViewport = () => {
      const rect = container.getBoundingClientRect();
      setViewport((current) => {
        const next = {
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height))
        };

        if (current.width === next.width && current.height === next.height) {
          return current;
        }

        return next;
      });
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`content-panel snn-control ${isActive ? 'is-active' : 'is-hidden'}`}
      data-testid="topology-viewport"
      aria-hidden={!isActive}
    >
      <SNNTopologyEditor
        width={Math.max(viewport.width, 1)}
        height={Math.max(viewport.height, 1)}
        agent={agent}
        graphSessionToken={graphSessionToken}
        visionCells={visionCells}
        installedSummary={installedSummary}
        worldRegistry={worldRegistry}
        onAgentChange={onAgentChange}
        onGraphPathChange={onGraphPathChange}
        onGraphPathNavigateRegister={onGraphPathNavigateRegister}
        runtimeStatus={runtimeStatus}
        draftStatus={draftStatus}
        runtimeActivity={runtimeActivity}
        isActive={isActive}
      />
    </div>
  );
};

export default GraphEditorPanel;
