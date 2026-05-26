import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphPathItem } from '../editor/types';

const ROOT_GRAPH_PATH: GraphPathItem[] = [{ id: 'root', label: 'root' }];

const areGraphPathsEqual = (left: GraphPathItem[], right: GraphPathItem[]): boolean =>
  left.length === right.length &&
  left.every((item, index) => item.id === right[index]?.id && item.label === right[index]?.label);

export const useGraphNavigationCoordinator = (graphSessionToken: string) => {
  const [graphPath, setGraphPath] = useState<GraphPathItem[]>(ROOT_GRAPH_PATH);
  const graphPathNavigateRef = useRef<(pathId: string) => void>(() => {});
  const graphSessionTokenRef = useRef(graphSessionToken);

  useEffect(() => {
    graphSessionTokenRef.current = graphSessionToken;
  }, [graphSessionToken]);

  useEffect(() => {
    graphPathNavigateRef.current = () => {};
    setGraphPath(ROOT_GRAPH_PATH);
  }, [graphSessionToken]);

  const handleGraphPathNavigate = useCallback((pathId: string) => {
    graphPathNavigateRef.current(pathId);
  }, []);

  const handleGraphPathChange = useCallback((nextGraphPath: GraphPathItem[], sourceSessionToken: string) => {
    if (sourceSessionToken !== graphSessionTokenRef.current) {
      return;
    }

    setGraphPath((currentGraphPath) => (
      areGraphPathsEqual(currentGraphPath, nextGraphPath) ? currentGraphPath : nextGraphPath
    ));
  }, []);

  const handleGraphPathNavigateRegister = useCallback((
    navigate: (pathId: string) => void,
    sourceSessionToken: string
  ) => {
    if (sourceSessionToken !== graphSessionTokenRef.current) {
      return;
    }

    graphPathNavigateRef.current = navigate;
  }, []);

  return {
    graphPath,
    handleGraphPathNavigate,
    handleGraphPathChange,
    handleGraphPathNavigateRegister,
  };
};
