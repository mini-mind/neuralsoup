import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAgentIR, validateAgentIR } from '../../src/domain/brain';
import {
  createVisionActionHostProfile,
  createVisionActionSeedAgentIR,
  createVisionActionWorldRegistry,
} from '../../src/host';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

test('vision-action host seed AgentIR is valid and exposes vision-aligned body and runtime counts', () => {
  const agent = createVisionActionSeedAgentIR(4, 'Seed Agent');

  assert.equal(agent.metadata.name, 'Seed Agent');
  assert.deepEqual(
    agent.body.inputRules.map((rule) => rule.id),
    ['vision-inputs']
  );
  assert.deepEqual(
    agent.body.outputRules.map((rule) => rule.id),
    ['motor-outputs']
  );
  assert.deepEqual(validateAgentIR(agent, WORLD_REGISTRY), []);
  assert.deepEqual(summarizeAgentIR(agent, WORLD_REGISTRY, 4), {
    inputSignalCount: 12,
    outputSignalCount: 3,
    neuronCount: 2,
    leafLinkCount: agent.connections.length,
  });
});

test('vision-action host seed layout does not persist compat-only bridge nodes', () => {
  const agent = createVisionActionSeedAgentIR(4, 'Seed Agent');
  const layoutNodeIds = new Set(Object.keys(agent.layout?.nodes ?? {}));

  assert.equal(layoutNodeIds.has('core-input-adapter'), false);
  assert.equal(layoutNodeIds.has('core-output-adapter'), false);
  assert.equal(layoutNodeIds.has('core-input-R'), false);
  assert.equal(layoutNodeIds.has('core-input-G'), false);
  assert.equal(layoutNodeIds.has('core-input-B'), false);
  assert.equal(layoutNodeIds.has('core-output-turn-left'), false);
  assert.equal(layoutNodeIds.has('core-output-move-forward'), false);
  assert.equal(layoutNodeIds.has('core-output-turn-right'), false);
  assert.equal(layoutNodeIds.has('input-adapter'), false);
  assert.equal(layoutNodeIds.has('output-adapter'), false);
  assert.equal([...layoutNodeIds].some((nodeId) => nodeId.startsWith('__body-vision-cell-')), false);
  assert.equal(layoutNodeIds.has(agent.brain.rootContainerId), true);
  assert.equal(agent.brain.rootContainerId, 'root-container');
  assert.equal(layoutNodeIds.has('neuron-1'), true);
  assert.equal(layoutNodeIds.has('neuron-2'), true);
});

test('custom movement bindings produce a seed agent aligned with the injected host profile registry', () => {
  const hostProfile = createVisionActionHostProfile({
    turnLeft: 'yaw-left',
    moveForward: 'thrust',
    turnRight: 'yaw-right',
  });

  const agent = hostProfile.createSeedAgentIR(4, 'Custom Host Seed');

  assert.deepEqual(
    agent.body.outputRules.map((rule) => rule.nodeIdPattern),
    ['^output-(yaw-left|thrust|yaw-right)$']
  );
  assert.equal(
    agent.connections.some(
      (connection) =>
        connection.to.scope === 'bodyOutput' &&
        connection.to.nodeId === 'output-thrust'
    ),
    true
  );
  assert.deepEqual(validateAgentIR(agent, hostProfile.worldRegistry), []);
  assert.deepEqual(summarizeAgentIR(agent, hostProfile.worldRegistry, 4).outputSignalCount, 3);
});
