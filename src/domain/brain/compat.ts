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
  createAgentPackage,
  createBrainLayoutFromDefinition,
  createBrainPackage,
  createDefaultBodyDefinition,
  getBodyVisionCellCount,
  isBrainPackage,
} from './package';
export type {
  AgentPackage,
  BodyDefinition,
  BodyInputBinding,
  BodyInputSignal,
  BodyOutputBinding,
  BodyOutputSignal,
  BrainDefinition,
  BrainLayoutDocument,
  BrainLayoutNodeState,
  BrainMetadata,
  BrainPackage,
} from './package';

export { compileBrainDefinition } from './compiler';
export type {
  BrainProgram,
  BrainProgramConnection,
  BrainProgramInputBinding,
  BrainProgramNeuronNode,
  BrainProgramNodeIndex,
  BrainProgramOutputBinding,
  BrainProgramSignalNode,
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
  createBrainProgramRuntimeState,
  resetBrainProgramRuntimeState,
  stepBrainProgram,
} from './step';
export type {
  BrainProgramRuntimeState,
  BrainProgramStepResult,
} from './step';
