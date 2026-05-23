export {
  assertValidGraphIRDocument,
  GraphIRValidationError,
  collectNeuronNodes,
  collectSignalNodes,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
} from '../domain/brain/ir';

export type {
  GraphIRDocument,
  ModelDefinition,
  NeuronNode,
} from '../domain/brain/ir';
