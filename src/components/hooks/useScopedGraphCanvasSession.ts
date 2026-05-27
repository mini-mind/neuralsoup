import { useCallback, useRef } from 'react';
import { clampZoom } from '../editor/graph/tools/canvasGeometry';
import type {
  GraphCanvasSessionState,
  GraphCanvasViewport,
  GraphCanvasViewportMetrics,
} from './useSNNTopologyState';

const arePointsEqual = (left: GraphCanvasViewport, right: GraphCanvasViewport) => left.x === right.x && left.y === right.y;

interface UseScopedGraphCanvasSessionOptions {
  canvasSession: GraphCanvasSessionState;
  setCanvasViewport: (nextViewport: GraphCanvasViewport) => void;
  setCanvasScale: (nextScale: number) => void;
  setCanvasSession: (
    nextSession:
      | GraphCanvasSessionState
      | ((currentSession: GraphCanvasSessionState) => GraphCanvasSessionState)
  ) => void;
}

export const useScopedGraphCanvasSession = ({
  canvasSession,
  setCanvasViewport,
  setCanvasScale,
  setCanvasSession,
}: UseScopedGraphCanvasSessionOptions) => {
  const activeCanvasScopeKeyRef = useRef<string | null>(null);
  const viewportStateByScopeKeyRef = useRef<
    Map<string, { session: GraphCanvasSessionState; metrics: GraphCanvasViewportMetrics | null }>
  >(new Map());

  const resetScopedCanvasSessions = useCallback(() => {
    activeCanvasScopeKeyRef.current = null;
    viewportStateByScopeKeyRef.current = new Map();
  }, []);

  const setScopedCanvasOffset = useCallback(
    (offset: GraphCanvasViewport) => {
      const activeScopeKey = activeCanvasScopeKeyRef.current;
      if (activeScopeKey) {
        const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
        viewportStateByScopeKeyRef.current.set(activeScopeKey, {
          session: {
            viewport: offset,
            scale: currentRecord?.session.scale ?? canvasSession.scale,
          },
          metrics: currentRecord?.metrics ?? null,
        });
      }
      setCanvasViewport(offset);
    },
    [canvasSession.scale, setCanvasViewport]
  );

  const setScopedCanvasScale = useCallback(
    (nextScale: number) => {
      const normalizedScale = clampZoom(nextScale);
      const activeScopeKey = activeCanvasScopeKeyRef.current;
      if (activeScopeKey) {
        const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
        viewportStateByScopeKeyRef.current.set(activeScopeKey, {
          session: {
            viewport: currentRecord?.session.viewport ?? canvasSession.viewport,
            scale: normalizedScale,
          },
          metrics: currentRecord?.metrics ?? null,
        });
      }
      setCanvasScale(normalizedScale);
    },
    [canvasSession.viewport, setCanvasScale]
  );

  const setScopedCanvasSession = useCallback(
    (nextSession: GraphCanvasSessionState) => {
      const normalizedSession: GraphCanvasSessionState = {
        viewport: nextSession.viewport,
        scale: clampZoom(nextSession.scale),
      };
      const activeScopeKey = activeCanvasScopeKeyRef.current;
      if (activeScopeKey) {
        const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
        viewportStateByScopeKeyRef.current.set(activeScopeKey, {
          session: normalizedSession,
          metrics: currentRecord?.metrics ?? null,
        });
      }
      setCanvasSession((currentSession) => {
        if (
          arePointsEqual(currentSession.viewport, normalizedSession.viewport) &&
          currentSession.scale === normalizedSession.scale
        ) {
          return currentSession;
        }

        return normalizedSession;
      });
    },
    [setCanvasSession]
  );

  const syncCanvasViewportForScope = useCallback(
    ({
      scopeKey,
      recommendedViewport,
      metrics,
      isActive,
    }: {
      scopeKey: string;
      recommendedViewport: GraphCanvasViewport;
      metrics: GraphCanvasViewportMetrics;
      isActive: boolean;
    }) => {
      if (metrics.width <= 1 || metrics.height <= 1) {
        return;
      }

      const viewportStateByScopeKey = viewportStateByScopeKeyRef.current;
      const previousActiveScopeKey = activeCanvasScopeKeyRef.current;
      const existingRecord = viewportStateByScopeKey.get(scopeKey) ?? null;
      const recommendedSession: GraphCanvasSessionState = {
        viewport: recommendedViewport,
        scale: 1,
      };

      if (previousActiveScopeKey !== scopeKey) {
        activeCanvasScopeKeyRef.current = scopeKey;
        const nextSession = existingRecord?.session ?? recommendedSession;
        viewportStateByScopeKey.set(scopeKey, {
          session: nextSession,
          metrics,
        });
        setCanvasSession((currentSession) =>
          arePointsEqual(currentSession.viewport, nextSession.viewport) && currentSession.scale === nextSession.scale
            ? currentSession
            : nextSession
        );
        return;
      }

      if (!existingRecord) {
        viewportStateByScopeKey.set(scopeKey, {
          session: recommendedSession,
          metrics,
        });
        setCanvasSession((currentSession) =>
          arePointsEqual(currentSession.viewport, recommendedSession.viewport) &&
          currentSession.scale === recommendedSession.scale
            ? currentSession
            : recommendedSession
        );
        return;
      }

      const previousMetrics = existingRecord.metrics;
      if (!previousMetrics || previousMetrics.width <= 1 || previousMetrics.height <= 1 || !isActive) {
        viewportStateByScopeKey.set(scopeKey, {
          session: existingRecord.session,
          metrics,
        });
        return;
      }

      const deltaX =
        (metrics.width - previousMetrics.width) / 2 +
        (metrics.originX - previousMetrics.originX) * existingRecord.session.scale;
      const deltaY =
        (metrics.height - previousMetrics.height) / 2 +
        (metrics.originY - previousMetrics.originY) * existingRecord.session.scale;
      if (deltaX === 0 && deltaY === 0) {
        viewportStateByScopeKey.set(scopeKey, {
          session: existingRecord.session,
          metrics,
        });
        return;
      }

      setCanvasSession((currentSession) => {
        const baseSession =
          arePointsEqual(currentSession.viewport, existingRecord.session.viewport) &&
          currentSession.scale === existingRecord.session.scale
            ? currentSession
            : existingRecord.session;
        const nextSession: GraphCanvasSessionState = {
          viewport: {
            x: baseSession.viewport.x + deltaX,
            y: baseSession.viewport.y + deltaY,
          },
          scale: baseSession.scale,
        };
        viewportStateByScopeKey.set(scopeKey, {
          session: nextSession,
          metrics,
        });
        return nextSession;
      });
    },
    [setCanvasSession]
  );

  return {
    resetScopedCanvasSessions,
    setScopedCanvasOffset,
    setScopedCanvasScale,
    setScopedCanvasSession,
    syncCanvasViewportForScope,
  };
};
