import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPH_DRAFT_ONLY_CHANGE,
  GRAPH_LAYOUT_ONLY_CHANGE,
  GRAPH_SEMANTIC_CHANGE,
} from '../../src/components/hooks/graphDocumentChangePolicy';

test('graph document change policy encodes semantic edits as draft/current/runtime updates', () => {
  assert.deepEqual(GRAPH_SEMANTIC_CHANGE, {
    installToRuntime: true,
    commitToCurrentDocument: true,
    persistActiveBrain: true,
  });
});

test('graph document change policy encodes layout edits as persisted non-runtime changes', () => {
  assert.deepEqual(GRAPH_LAYOUT_ONLY_CHANGE, {
    installToRuntime: false,
    commitToCurrentDocument: true,
    persistActiveBrain: true,
  });
});

test('graph document change policy encodes draft-only diagnostics mutations as non-persisted changes', () => {
  assert.deepEqual(GRAPH_DRAFT_ONLY_CHANGE, {
    installToRuntime: false,
    commitToCurrentDocument: false,
    persistActiveBrain: false,
  });
});
