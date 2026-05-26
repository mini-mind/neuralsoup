import React from 'react';

export interface TopologyNodeLayerItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  title?: string;
  ariaLabel?: string;
  dataTestId?: string;
  dataAttributes?: Record<string, string | undefined>;
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => void;
  content: React.ReactNode;
  asButton?: boolean;
}

interface TopologyNodeLayerProps {
  nodes: TopologyNodeLayerItem[];
}

const TopologyNodeLayer: React.FC<TopologyNodeLayerProps> = ({ nodes }) => {
  return (
    <>
      {nodes.map((node) => {
        const sharedProps = {
          key: node.id,
          className: node.className,
          title: node.title,
          'aria-label': node.ariaLabel,
          'data-testid': node.dataTestId,
          style: {
            left: node.x,
            top: node.y,
            width: node.width,
            height: node.height,
          },
          onMouseDown: node.onMouseDown,
          onContextMenu: node.onContextMenu,
          onDoubleClick: node.onDoubleClick,
          onClick: node.onClick,
          ...node.dataAttributes,
        };

        if (node.asButton) {
          return (
            <button type="button" {...sharedProps}>
              {node.content}
            </button>
          );
        }

        return (
          <div {...sharedProps}>
            {node.content}
          </div>
        );
      })}
    </>
  );
};

export default TopologyNodeLayer;
