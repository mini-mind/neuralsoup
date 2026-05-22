import type { AgentIR } from './agent-ir';
import { createDefaultGraphIRDocument } from './defaults';
import { createAgentIRFromLegacyGraph } from './legacy-graph-bridge';
import { createDefaultBodyDefinition } from './package';

export const createDefaultAgentIR = (
  visionCells: number = 36,
  name: string = '当前 Agent'
): AgentIR =>
  createAgentIRFromLegacyGraph(
    name,
    createDefaultGraphIRDocument(visionCells),
    createDefaultBodyDefinition(visionCells)
  );
