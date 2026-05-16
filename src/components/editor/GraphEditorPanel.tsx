import React, { useEffect, useRef, useState } from 'react';
import SNNTopologyEditor from '../SNNTopologyEditor';
import type { BrainGraph } from '../../domain/brain';
import type { BrainGraphRuntimeStatus } from '../../types/brainGraphRuntime';

interface GraphEditorPanelProps {
  isActive: boolean;
  graph: BrainGraph;
  visionCells: number;
  runtimeStatus: BrainGraphRuntimeStatus;
  onGraphChange: (graph: BrainGraph) => void;
}

const GraphEditorPanel: React.FC<GraphEditorPanelProps> = ({
  isActive,
  graph,
  visionCells,
  runtimeStatus,
  onGraphChange
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
        graph={graph}
        visionCells={visionCells}
        onGraphChange={onGraphChange}
        runtimeStatus={runtimeStatus}
        isActive={isActive}
      />
    </div>
  );
};

export default GraphEditorPanel;
