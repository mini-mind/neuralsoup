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
  assert.equal(agent.body.inputEndpoints.length, 12);
  assert.equal(agent.body.outputEndpoints.length, 3);
  assert.equal(agent.body.mappings.filter((mapping) => mapping.kind === 'input').length, 12);
  assert.equal(agent.body.mappings.filter((mapping) => mapping.kind === 'output').length, 3);
  assert.equal(agent.body.inputEndpoints.some((endpoint) => endpoint.source === 'vision.R.0'), true);
  assert.equal(agent.body.inputEndpoints.some((endpoint) => endpoint.source === 'vision.G.1'), true);
  assert.equal(agent.body.inputEndpoints.some((endpoint) => endpoint.source === 'vision.B.3'), true);
  assert.deepEqual(
    new Set(agent.body.outputEndpoints.map((endpoint) => endpoint.target)),
    new Set(['action.turn-left', 'action.move-forward', 'action.turn-right'])
  );
  assert.equal(agent.brain.neuronModels.length >= 1, true);
  assert.equal(agent.brain.synapseModels.length >= 1, true);
  const synapseModels = agent.brain.synapseModels;
  assert.ok(synapseModels);
  assert.equal(
    synapseModels.some((model) => model.kind === 'dual-exp-stp'),
    false
  );
  assert.equal(agent.brain.neurons.every((neuron) => typeof neuron.neuronModelId === 'string'), true);
  assert.equal(
    agent.connections.every((connection) => typeof connection.synapseModelId === 'string'),
    true
  );
  const synapseModelIds = new Set(synapseModels.map((model) => model.id));
  const dualExpStpModelIds = new Set(
    synapseModels
      .filter((model) => model.kind === 'dual-exp-stp')
      .map((model) => model.id)
  );
  assert.equal(
    agent.connections.every((connection) => {
      assert.ok(connection.synapseModelId);
      return synapseModelIds.has(connection.synapseModelId);
    }),
    true
  );
  assert.equal(
    agent.connections.some((connection) => {
      assert.ok(connection.synapseModelId);
      return dualExpStpModelIds.has(connection.synapseModelId);
    }),
    false
  );
  assert.deepEqual(validateAgentIR(agent, WORLD_REGISTRY), []);
  assert.deepEqual(summarizeAgentIR(agent, WORLD_REGISTRY, 4), {
    inputSignalCount: 12,
    outputSignalCount: 3,
    neuronCount: 2,
    connectionCount: agent.connections.length,
    leafLinkCount: agent.connections.length,
  });
});

test('vision-action host seed layout does not persist non-canonical bridge nodes', () => {
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
    new Set(agent.body.outputEndpoints.map((endpoint) => endpoint.target)),
    new Set(['action.yaw-left', 'action.thrust', 'action.yaw-right'])
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
