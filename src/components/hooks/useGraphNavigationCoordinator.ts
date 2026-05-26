import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphPathItem } from '../editor/types';

const ROOT_GRAPH_PATH: GraphPathItem[] = [{ id: 'root', label: 'root' }];

const areGraphPathsEqual = (left: GraphPathItem[], right: GraphPathItem[]): boolean =>
  left.length === right.length &&
  left.every((item, index) => item.id === right[index]?.id && item.label === right[index]?.label);

export const useGraphNavigationCoordinator = (graphSessionToken: string) => {
  const [mirroredGraphPath, setMirroredGraphPath] = useState<GraphPathItem[]>(ROOT_GRAPH_PATH);
  const bridgeNavigateToPathIdRef = useRef<(pathId: string) => void>(() => {});
  const graphSessionTokenRef = useRef(graphSessionToken);

  useEffect(() => {
    graphSessionTokenRef.current = graphSessionToken;
  }, [graphSessionToken]);

  useEffect(() => {
    bridgeNavigateToPathIdRef.current = () => {};
    setMirroredGraphPath(ROOT_GRAPH_PATH);
  }, [graphSessionToken]);

  const bridgeNavigateToPathId = useCallback((pathId: string) => {
    bridgeNavigateToPathIdRef.current(pathId);
  }, []);

  const syncMirroredGraphPath = useCallback((nextGraphPath: GraphPathItem[], sourceSessionToken: string) => {
    if (sourceSessionToken !== graphSessionTokenRef.current) {
      return;
    }

    setMirroredGraphPath((currentGraphPath) => (
      areGraphPathsEqual(currentGraphPath, nextGraphPath) ? currentGraphPath : nextGraphPath
    ));
  }, []);

  const registerBridgePathNavigator = useCallback((
    navigate: (pathId: string) => void,
    sourceSessionToken: string
  ) => {
    if (sourceSessionToken !== graphSessionTokenRef.current) {
      return;
    }

    bridgeNavigateToPathIdRef.current = navigate;
  }, []);

  return {
    mirroredGraphPath,
    bridgeNavigateToPathId,
    syncMirroredGraphPath,
    registerBridgePathNavigator,
  };
};
