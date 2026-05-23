export {
  GraphIRValidationError,
  assertValidGraphIRDocument,
  collectLeafNodes,
  collectNeuronNodes,
  collectSignalNodes,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
} from './ir';
export type {
  AggregateLinkView,
  AdapterNode,
  GraphIRDocument,
  GraphIRDocumentSummary,
  GraphIRValidationIssue,
  LeafLink,
  LiteralValue,
  ModelDefinition,
  NeuronGroupNode,
  NeuronNode,
  RootGraph,
  SignalNode,
  TopologyNode,
} from './ir';

export {
  createLegacyAgentPackage,
  createLegacyBrainLayoutFromDefinition,
  createLegacyBrainPackage,
  createDefaultLegacyBodyDefinition,
  getLegacyBodyVisionCellCount,
  isLegacyBrainPackage,
} from './package';
export type {
  AgentPackage,
  LegacyBodyDefinition as BodyDefinition,
  BodyInputBinding,
  BodyInputSignal,
  BodyOutputBinding,
  BodyOutputSignal,
  LegacyBrainDefinition as BrainDefinition,
  BrainLayoutDocument,
  BrainLayoutNodeState,
  BrainMetadata,
  LegacyBrainPackage as BrainPackage,
} from './package';

export { compileLegacyBrainDefinition } from './compiler';
export type {
  LegacyGraphProgram,
  BrainProgramConnection,
  BrainProgramInputBinding,
  BrainProgramNeuronNode,
  BrainProgramNodeIndex,
  BrainProgramOutputBinding,
  BrainProgramSignalNode,
  LegacyBrainProgram,
  ProgramInputPort,
  ProgramOutputPort,
} from './program';

export {
  createAgentIRFromLegacyGraph,
  createLegacyGraphBridgeFromAgent,
} from './legacy-graph-bridge';
export type { LegacyGraphBridgeResult } from './legacy-graph-bridge';

export {
  createDefaultGraphIRDocument,
  reconcileGraphIRDocumentVisionCells,
} from './defaults';

export {
  createLegacyBrainProgramRuntimeState,
  resetLegacyBrainProgramRuntimeState,
  stepLegacyBrainProgram,
} from './step';
export type {
  LegacyBrainProgramRuntimeState,
  LegacyBrainProgramStepResult,
} from './step';
