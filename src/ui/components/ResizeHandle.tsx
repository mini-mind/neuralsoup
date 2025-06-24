import React from "react";

interface ResizeHandleProps {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 拖拽分割条组件
 * 负责调整左右区域的尺寸
 */
const ResizeHandle: React.FC<ResizeHandleProps> = ({
  isDragging,
  onMouseDown,
}) => {
  return (
    <div
      className={`resize-handle ${isDragging ? "dragging" : ""}`}
      onMouseDown={onMouseDown}
    >
      <div className="resize-indicator">
        <div className="resize-line"></div>
        <div className="resize-line"></div>
        <div className="resize-line"></div>
      </div>
    </div>
  );
};

export default ResizeHandle;
