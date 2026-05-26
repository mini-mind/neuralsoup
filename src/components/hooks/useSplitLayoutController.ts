import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const STACKED_LAYOUT_BREAKPOINT = 768;
const SPLIT_DIVIDER_SIZE = 8;
const MIN_PANEL_SIZE = 280;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const clampSplitRatio = (containerSize: number, ratio: number): number => {
  if (containerSize <= MIN_PANEL_SIZE * 2 + SPLIT_DIVIDER_SIZE) {
    return 0.5;
  }

  const minRatio = MIN_PANEL_SIZE / containerSize;
  const maxRatio = (containerSize - MIN_PANEL_SIZE - SPLIT_DIVIDER_SIZE) / containerSize;
  return clamp(ratio, minRatio, maxRatio);
};

export const useSplitLayoutController = () => {
  const appRef = useRef<HTMLDivElement | null>(null);
  const simulationPanelRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(1);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [isStackedLayout, setIsStackedLayout] = useState<boolean>(() => (
    typeof window !== 'undefined' ? window.innerWidth <= STACKED_LAYOUT_BREAKPOINT : false
  ));
  const [isResizingSplit, setIsResizingSplit] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${STACKED_LAYOUT_BREAKPOINT}px)`);
    const updateLayoutMode = (event?: MediaQueryListEvent) => {
      setIsStackedLayout(event ? event.matches : mediaQuery.matches);
    };

    updateLayoutMode();
    mediaQuery.addEventListener('change', updateLayoutMode);
    return () => {
      mediaQuery.removeEventListener('change', updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    const container = simulationPanelRef.current;
    if (!container) {
      return;
    }

    const updateCanvasDimensions = () => {
      const rect = container.getBoundingClientRect();
      setCanvasWidth((current) => {
        const nextWidth = Math.max(1, Math.floor(rect.width));
        return current === nextWidth ? current : nextWidth;
      });
      setCanvasHeight((current) => {
        const nextHeight = Math.max(1, Math.floor(rect.height));
        return current === nextHeight ? current : nextHeight;
      });
    };

    updateCanvasDimensions();
    const observer = new ResizeObserver(updateCanvasDimensions);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const updateSplitRatioFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const appElement = appRef.current;
    if (!appElement) {
      return;
    }

    const rect = appElement.getBoundingClientRect();
    const containerSize = isStackedLayout ? rect.height : rect.width;
    if (containerSize <= 0) {
      return;
    }

    const pointerOffset = isStackedLayout ? clientY - rect.top : clientX - rect.left;
    setSplitRatio(clampSplitRatio(containerSize, pointerOffset / containerSize));
  }, [isStackedLayout]);

  const handleSplitPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const divider = event.currentTarget;
    divider.setPointerCapture(event.pointerId);
    setIsResizingSplit(true);
    updateSplitRatioFromClientPoint(event.clientX, event.clientY);

    const nextCursor = isStackedLayout ? 'row-resize' : 'col-resize';
    document.body.style.cursor = nextCursor;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateSplitRatioFromClientPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const finishResize = () => {
      setIsResizingSplit(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
  }, [isStackedLayout, updateSplitRatioFromClientPoint]);

  const handleSplitKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const appElement = appRef.current;
    if (!appElement) {
      return;
    }

    const containerSize = isStackedLayout ? appElement.clientHeight : appElement.clientWidth;
    const step = 0.04;
    let nextRatio: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        if (!isStackedLayout) {
          nextRatio = splitRatio - step;
        }
        break;
      case 'ArrowRight':
        if (!isStackedLayout) {
          nextRatio = splitRatio + step;
        }
        break;
      case 'ArrowUp':
        if (isStackedLayout) {
          nextRatio = splitRatio - step;
        }
        break;
      case 'ArrowDown':
        if (isStackedLayout) {
          nextRatio = splitRatio + step;
        }
        break;
      case 'Home':
        nextRatio = 0;
        break;
      case 'End':
        nextRatio = 1;
        break;
      default:
        break;
    }

    if (nextRatio == null) {
      return;
    }

    event.preventDefault();
    setSplitRatio(clampSplitRatio(containerSize, nextRatio));
  }, [isStackedLayout, splitRatio]);

  const panelStyles = useMemo(() => {
    const dividerHalfSize = SPLIT_DIVIDER_SIZE / 2;
    const gamePanePercent = splitRatio * 100;
    const controlPanePercent = 100 - gamePanePercent;
    const gameAreaStyle: CSSProperties = {
      flexBasis: `calc(${gamePanePercent}% - ${dividerHalfSize}px)`
    };
    const controlAreaStyle: CSSProperties = {
      flexBasis: `calc(${controlPanePercent}% - ${dividerHalfSize}px)`
    };
    return {
      gameAreaStyle,
      controlAreaStyle,
    };
  }, [splitRatio]);

  return {
    appRef,
    simulationPanelRef,
    canvasWidth,
    canvasHeight,
    isStackedLayout,
    isResizingSplit,
    handleSplitPointerDown,
    handleSplitKeyDown,
    ...panelStyles,
  };
};
