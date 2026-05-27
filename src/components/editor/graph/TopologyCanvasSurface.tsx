import React from 'react';
import { normalizeRect } from './tools/canvasGeometry';

interface TopologyCanvasSurfaceProps {
  surfaceRef?: React.RefObject<HTMLDivElement>;
  sceneRef?: React.RefObject<HTMLDivElement>;
  width: number;
  height: number;
  sceneWidth: number;
  sceneHeight: number;
  canvasViewport: {
    x: number;
    y: number;
  };
  canvasScale: number;
  isPanning?: boolean;
  isSelecting?: boolean;
  isLinking?: boolean;
  selectionRect?:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null;
  beforeScene?: React.ReactNode;
  children: React.ReactNode;
  onCanvasContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSceneDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  dataTestId?: string;
  sceneDataTestId?: string;
}

const TopologyCanvasSurface: React.FC<TopologyCanvasSurfaceProps> = ({
  surfaceRef,
  sceneRef,
  width,
  height,
  sceneWidth,
  sceneHeight,
  canvasViewport,
  canvasScale,
  isPanning = false,
  isSelecting = false,
  isLinking = false,
  selectionRect = null,
  beforeScene,
  children,
  onCanvasContextMenu,
  onCanvasMouseDown,
  onSceneDoubleClick,
  dataTestId = 'topology-canvas',
  sceneDataTestId = 'topology-scene',
}) => {
  const normalizedSelectionRect = selectionRect ? normalizeRect(selectionRect) : null;

  return (
    <div
      ref={surfaceRef}
      className={[
        'topology-surface',
        isPanning ? 'is-panning' : '',
        isSelecting ? 'is-marqueeing' : '',
        isLinking ? 'is-linking' : '',
      ].join(' ')}
      data-testid={dataTestId}
      tabIndex={0}
      style={{
        width: Math.max(width, 1),
        height: Math.max(height, 1),
      }}
      onContextMenu={onCanvasContextMenu}
      onMouseDown={onCanvasMouseDown}
    >
      {beforeScene}

      <div
        ref={sceneRef}
        className="topology-scene"
        data-testid={sceneDataTestId}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          transform: `translate(${canvasViewport.x}px, ${canvasViewport.y}px) scale(${canvasScale})`,
          transformOrigin: '0 0',
        }}
        onDoubleClick={onSceneDoubleClick}
      >
        {children}

        {normalizedSelectionRect ? (
          <div
            className="topology-marquee"
            style={{
              left: normalizedSelectionRect.x,
              top: normalizedSelectionRect.y,
              width: normalizedSelectionRect.width,
              height: normalizedSelectionRect.height,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default TopologyCanvasSurface;
