import React, { useRef, useCallback, useEffect } from 'react';

interface ResizableSplitterProps {
  onResize: (deltaX: number) => void;
  className?: string;
}

/**
 * 可调整大小的分割器组件
 * 允许用户通过拖拽来调整左右面板的大小
 */
const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  onResize,
  className = '',
}) => {
  const isDragging = useRef(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    
    const deltaX = e.clientX - startX.current;
    startX.current = e.clientX;
    onResize(deltaX);
  }, [onResize]);

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

  return (
    <div
      className={`resizable-splitter ${className}`}
      onMouseDown={handleMouseDown}
      title="拖拽调整面板大小"
    />
  );
};

export default ResizableSplitter; 