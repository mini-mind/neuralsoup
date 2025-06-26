import React, { useRef, useCallback, useEffect } from 'react';

interface ResizableSplitterProps {
  onResize: (delta: number) => void;
  direction?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * 可调整大小的分割器组件
 * 允许用户通过拖拽来调整左右面板的大小
 */
const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  onResize,
  direction = 'vertical',
  className = '',
}) => {
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    
    const currentPos = direction === 'vertical' ? e.clientX : e.clientY;
    const delta = currentPos - startPos.current;
    startPos.current = currentPos;
    onResize(delta);
  }, [onResize, direction]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const splitterClassName = `resizable-splitter ${direction} ${className}`;

  return (
    <div
      className={splitterClassName}
      onMouseDown={handleMouseDown}
      title="拖拽调整面板大小"
    />
  );
};

export default ResizableSplitter; 