import React from 'react';
import { getNodeCenter } from './tools/canvasGeometry';

export interface TopologyLinkSceneNode {
  sceneX: number;
  sceneY: number;
  width: number;
  height: number;
}

export interface TopologyLinkLayerItem {
  id: string;
  dataTestId?: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  aggregate?: boolean;
  selected?: boolean;
  inspectable?: boolean;
  onClick?: (event: React.MouseEvent<SVGGElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<SVGGElement>) => void;
  onContextMenu?: (event: React.MouseEvent<SVGGElement>) => void;
}

interface TopologyLinkLayerProps {
  sceneNodeMap: Map<string, TopologyLinkSceneNode>;
  links: TopologyLinkLayerItem[];
  pendingLinkLine?:
    | {
        from: { x: number; y: number };
        to: { x: number; y: number };
      }
    | null;
  labelFormatter?: (link: TopologyLinkLayerItem) => string | null;
}

const TopologyLinkLayer: React.FC<TopologyLinkLayerProps> = ({
  sceneNodeMap,
  links,
  pendingLinkLine = null,
  labelFormatter = (link) => link.label ?? null,
}) => {
  return (
    <svg className="topology-links" aria-hidden="true">
      {links.map((link) => {
        const fromNode = sceneNodeMap.get(link.fromNodeId);
        const toNode = sceneNodeMap.get(link.toNodeId);
        if (!fromNode || !toNode) {
          return null;
        }

        const from = getNodeCenter({
          x: fromNode.sceneX,
          y: fromNode.sceneY,
          width: fromNode.width,
          height: fromNode.height,
        });
        const to = getNodeCenter({
          x: toNode.sceneX,
          y: toNode.sceneY,
          width: toNode.width,
          height: toNode.height,
        });
        const label = labelFormatter(link);

        return (
          <g
            key={link.id}
            className={`topology-link ${link.aggregate ? 'is-aggregate' : 'is-leaf'} ${link.selected ? 'is-selected' : ''}`}
            data-testid={link.dataTestId}
            data-topology-link={link.inspectable ? 'true' : undefined}
            data-topology-link-id={link.inspectable ? link.id : undefined}
            data-topology-link-from-node-id={link.inspectable ? link.fromNodeId : undefined}
            data-topology-link-to-node-id={link.inspectable ? link.toNodeId : undefined}
            onClick={link.onClick}
            onDoubleClick={link.onDoubleClick}
            onContextMenu={link.onContextMenu}
          >
            <line className="topology-link-hit" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <line className="topology-link-stroke" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <line className="topology-link-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            {label ? <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>{label}</text> : null}
          </g>
        );
      })}

      {pendingLinkLine ? (
        <line
          className="topology-link-preview"
          x1={pendingLinkLine.from.x}
          y1={pendingLinkLine.from.y}
          x2={pendingLinkLine.to.x}
          y2={pendingLinkLine.to.y}
        />
      ) : null}
    </svg>
  );
};

export default TopologyLinkLayer;
