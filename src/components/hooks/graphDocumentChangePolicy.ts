import type { GraphDocumentChangeOptions } from './useSNNTopologyState';

export const GRAPH_LAYOUT_ONLY_CHANGE: GraphDocumentChangeOptions = Object.freeze({
  installToRuntime: false,
  commitToCurrentDocument: true,
  persistActiveBrain: true,
});

export const GRAPH_SEMANTIC_CHANGE: GraphDocumentChangeOptions = Object.freeze({
  installToRuntime: true,
  commitToCurrentDocument: true,
  persistActiveBrain: true,
});

export const GRAPH_DRAFT_ONLY_CHANGE: GraphDocumentChangeOptions = Object.freeze({
  installToRuntime: false,
  commitToCurrentDocument: false,
  persistActiveBrain: false,
});
