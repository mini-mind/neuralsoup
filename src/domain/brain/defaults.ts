import { GraphIRValidationError, collectNeuronNodes, collectSignalNodes, validateGraphIRDocument } from './ir';
import type { GraphIRDocument, LeafLink, ModelDefinition, NeuronNode, SignalNode, TopologyNode } from './ir';
import type { BrainInputChannel, BrainOutputChannel, IzhikevichNeuronParameters } from './shared';

const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const OUTPUT_CHANNELS: Array<{ channel: BrainOutputChannel; label: string }> = [
  { channel: 'turn-left', label: '左转' },
  { channel: 'move-forward', label: '前进' },
  { channel: 'turn-right', label: '右转' },
];

const INPUT_CHANNELS: BrainInputChannel[] = ['R', 'G', 'B'];
const GRAPH_IR_SIGNAL_MODEL_ID = 'world-signal-bridge';
const GRAPH_IR_NEURON_MODEL_ID = 'izhikevich-neuron';
const INTERNAL_SIGNAL_ID = 'scalar-signal';
const INTERNAL_SIGNAL = {
  id: INTERNAL_SIGNAL_ID,
  valueType: 'number',
} as const;
const VISION_SIGNAL_DOC = 'World observation channel metadata for a single vision cell sample.';
const MOTOR_SIGNAL_DOC = 'World action channel metadata consumed by movement effectors.';
const DEFAULT_NEURON_LAYOUT: Array<{
  id: string;
  label: string;
  position: { x: number; y: number };
}> = [
  {
    id: 'neuron-1',
    label: '神经元1',
    position: { x: 50, y: 150 },
  },
  {
    id: 'neuron-2',
    label: '神经元2',
    position: { x: 50, y: 250 },
  },
];

const createDefaultGraphIRModels = (): ModelDefinition[] => [
  {
    id: GRAPH_IR_NEURON_MODEL_ID,
    kind: 'neuron',
    doc: 'Default Izhikevich neuron used by the seed graph, including recovery variable and spike reset semantics.',
    state: [
      {
        id: 'v',
        valueType: 'number',
        defaultValue: -65,
      },
      {
        id: 'u',
        valueType: 'number',
        defaultValue: 0,
      },
    ],
    parameters: [
      {
        id: 'a',
        valueType: 'number',
        defaultValue: DEFAULT_NEURON_PARAMS.a,
      },
      {
        id: 'b',
        valueType: 'number',
        defaultValue: DEFAULT_NEURON_PARAMS.b,
      },
      {
        id: 'c',
        valueType: 'number',
        defaultValue: DEFAULT_NEURON_PARAMS.c,
      },
      {
        id: 'd',
        valueType: 'number',
        defaultValue: DEFAULT_NEURON_PARAMS.d,
      },
      {
        id: 'threshold',
        valueType: 'number',
        defaultValue: DEFAULT_NEURON_PARAMS.threshold,
      },
    ],
    internals: [
      {
        id: 'drive',
        valueType: 'number',
        defaultValue: 0,
      },
    ],
    inputs: [
      {
        id: 'dendrite',
        signal: INTERNAL_SIGNAL,
      },
    ],
    outputs: [
      {
        id: 'axon',
        signal: INTERNAL_SIGNAL,
      },
    ],
    equations: [
      {
        id: 'dv',
        target: 'v',
        expression: {
          kind: 'binary',
          operator: '+',
          left: {
            kind: 'reference',
            target: 'v',
          },
          right: {
            kind: 'reference',
            target: 'drive',
          },
        },
      },
      {
        id: 'du',
        target: 'u',
        expression: {
          kind: 'binary',
          operator: '+',
          left: {
            kind: 'reference',
            target: 'u',
          },
          right: {
            kind: 'call',
            callee: 'scale',
            args: [
              {
                kind: 'reference',
                target: 'a',
              },
              {
                kind: 'binary',
                operator: '-',
                left: {
                  kind: 'binary',
                  operator: '*',
                  left: {
                    kind: 'reference',
                    target: 'b',
                  },
                  right: {
                    kind: 'reference',
                    target: 'v',
                  },
                },
                right: {
                  kind: 'reference',
                  target: 'u',
                },
              },
              {
                kind: 'literal',
                value: 0.1,
              },
            ],
          },
        },
      },
    ],
    onReceive: [
      {
        portId: 'dendrite',
        body: [
          {
            kind: 'assign',
            target: 'drive',
            expression: {
              kind: 'binary',
              operator: '+',
              left: {
                kind: 'reference',
                target: 'drive',
              },
              right: {
                kind: 'reference',
                target: 'dendrite',
              },
            },
          },
        ],
      },
    ],
    update: [
      {
        id: 'emit-spike',
        body: [
          {
            kind: 'if',
            condition: {
              kind: 'binary',
              operator: '>=',
              left: {
                kind: 'reference',
                target: 'v',
              },
              right: {
                kind: 'reference',
                target: 'threshold',
              },
            },
            then: [
              {
                kind: 'emit',
                portId: 'axon',
                expression: {
                  kind: 'literal',
                  value: 1,
                },
              },
              {
                kind: 'assign',
                target: 'v',
                expression: {
                  kind: 'reference',
                  target: 'c',
                },
              },
              {
                kind: 'assign',
                target: 'u',
                expression: {
                  kind: 'binary',
                  operator: '+',
                  left: {
                    kind: 'reference',
                    target: 'u',
                  },
                  right: {
                    kind: 'reference',
                    target: 'd',
                  },
                },
              },
            ],
          },
          {
            kind: 'assign',
            target: 'drive',
            expression: {
              kind: 'literal',
              value: 0,
            },
          },
        ],
      },
    ],
  },
  {
    id: GRAPH_IR_SIGNAL_MODEL_ID,
    kind: 'signal',
    doc: 'Adapter bridge for world observation and action signals.',
    state: [
      {
        id: 'value',
        valueType: 'number',
        defaultValue: 0,
      },
    ],
    parameters: [],
    internals: [],
    inputs: [
      {
        id: 'in',
        signal: INTERNAL_SIGNAL,
      },
    ],
    outputs: [
      {
        id: 'out',
        signal: INTERNAL_SIGNAL,
      },
    ],
    equations: [],
    onReceive: [
      {
        portId: 'in',
        body: [
          {
            kind: 'assign',
            target: 'value',
            expression: {
              kind: 'reference',
              target: 'in',
            },
          },
        ],
      },
    ],
    update: [
      {
        id: 'forward',
        body: [
          {
            kind: 'emit',
            portId: 'out',
            expression: {
              kind: 'reference',
              target: 'value',
            },
          },
        ],
      },
    ],
  },
];

const createDefaultGraphIRInputSignals = (visionCells: number): SignalNode[] => {
  const signals: SignalNode[] = [];

  for (const [channelIndex, channel] of INPUT_CHANNELS.entries()) {
    for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
      signals.push({
        kind: 'signal',
        id: `vision-${channel}-${cellIndex}`,
        label: `${channel}${cellIndex}`,
        modelId: GRAPH_IR_SIGNAL_MODEL_ID,
        direction: 'input',
        signal: {
          id: `vision-${channel.toLowerCase()}`,
          valueType: 'number',
          doc: VISION_SIGNAL_DOC,
        },
        position: {
          x: -260,
          y: 60 + cellIndex * 18 + channelIndex * Math.max(visionCells, 1) * 22,
        },
      });
    }
  }

  return signals;
};

const createDefaultGraphIRNeurons = (): NeuronNode[] =>
  DEFAULT_NEURON_LAYOUT.map((neuron) => ({
    kind: 'neuron',
    id: neuron.id,
    label: neuron.label,
    modelId: GRAPH_IR_NEURON_MODEL_ID,
    position: neuron.position,
  }));

const createDefaultGraphIROutputSignals = (): SignalNode[] =>
  OUTPUT_CHANNELS.map(({ channel, label }, index) => ({
    kind: 'signal',
    id: `output-${channel}`,
    label,
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'output',
    signal: {
      id: channel,
      valueType: 'number',
      doc: MOTOR_SIGNAL_DOC,
    },
    position: {
      x: 320,
      y: 160 + index * 70,
    },
  }));

const createDefaultCoreInputSignals = (): SignalNode[] => [
  {
    kind: 'signal',
    id: 'core-input-R',
    label: 'R输入',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'input',
    signal: {
      id: 'vision-r',
      valueType: 'number',
      doc: VISION_SIGNAL_DOC,
    },
    position: { x: -110, y: 120 },
  },
  {
    kind: 'signal',
    id: 'core-input-G',
    label: 'G输入',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'input',
    signal: {
      id: 'vision-g',
      valueType: 'number',
      doc: VISION_SIGNAL_DOC,
    },
    position: { x: -110, y: 190 },
  },
  {
    kind: 'signal',
    id: 'core-input-B',
    label: 'B输入',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'input',
    signal: {
      id: 'vision-b',
      valueType: 'number',
      doc: VISION_SIGNAL_DOC,
    },
    position: { x: -110, y: 260 },
  },
];

const createDefaultCoreOutputSignals = (): SignalNode[] => [
  {
    kind: 'signal',
    id: 'core-output-turn-left',
    label: '左转输出',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'output',
    signal: {
      id: 'turn-left',
      valueType: 'number',
      doc: MOTOR_SIGNAL_DOC,
    },
    position: { x: 270, y: 120 },
  },
  {
    kind: 'signal',
    id: 'core-output-move-forward',
    label: '前进输出',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'output',
    signal: {
      id: 'move-forward',
      valueType: 'number',
      doc: MOTOR_SIGNAL_DOC,
    },
    position: { x: 270, y: 190 },
  },
  {
    kind: 'signal',
    id: 'core-output-turn-right',
    label: '右转输出',
    modelId: GRAPH_IR_SIGNAL_MODEL_ID,
    direction: 'output',
    signal: {
      id: 'turn-right',
      valueType: 'number',
      doc: MOTOR_SIGNAL_DOC,
    },
    position: { x: 270, y: 260 },
  },
];

const createDefaultGraphIRLinks = (visionCells: number): LeafLink[] => {
  const links: LeafLink[] = [];

  for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
    links.push(
      {
        id: `link-vision-R-${cellIndex}-neuron-1`,
        from: {
          nodeId: `vision-R-${cellIndex}`,
          portId: 'out',
        },
        to: {
          nodeId: 'core-input-R',
          portId: 'in',
        },
        weight: 1,
      },
      {
        id: `link-vision-G-${cellIndex}-neuron-1`,
        from: {
          nodeId: `vision-G-${cellIndex}`,
          portId: 'out',
        },
        to: {
          nodeId: 'core-input-G',
          portId: 'in',
        },
        weight: 0.75,
      },
      {
        id: `link-vision-B-${cellIndex}-neuron-2`,
        from: {
          nodeId: `vision-B-${cellIndex}`,
          portId: 'out',
        },
        to: {
          nodeId: 'core-input-B',
          portId: 'in',
        },
        weight: 0.75,
      }
    );
  }

  links.push(
    {
      id: 'link-core-input-R-neuron-1',
      from: {
        nodeId: 'core-input-R',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 1,
    },
    {
      id: 'link-core-input-G-neuron-1',
      from: {
        nodeId: 'core-input-G',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 0.75,
    },
    {
      id: 'link-core-input-B-neuron-2',
      from: {
        nodeId: 'core-input-B',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-2',
        portId: 'dendrite',
      },
      weight: 0.75,
    },
    {
      id: 'link-neuron-1-neuron-2',
      from: {
        nodeId: 'neuron-1',
        portId: 'axon',
      },
      to: {
        nodeId: 'neuron-2',
        portId: 'dendrite',
      },
      weight: 0.5,
    },
    {
      id: 'link-neuron-1-output-move-forward',
      from: {
        nodeId: 'neuron-1',
        portId: 'axon',
      },
      to: {
        nodeId: 'core-output-move-forward',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'link-core-output-move-forward-output-move-forward',
      from: {
        nodeId: 'core-output-move-forward',
        portId: 'out',
      },
      to: {
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'link-neuron-2-output-turn-left',
      from: {
        nodeId: 'neuron-2',
        portId: 'axon',
      },
      to: {
        nodeId: 'core-output-turn-left',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'link-core-output-turn-left-output-turn-left',
      from: {
        nodeId: 'core-output-turn-left',
        portId: 'out',
      },
      to: {
        nodeId: 'output-turn-left',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'link-neuron-2-output-turn-right',
      from: {
        nodeId: 'neuron-2',
        portId: 'axon',
      },
      to: {
        nodeId: 'core-output-turn-right',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'link-core-output-turn-right-output-turn-right',
      from: {
        nodeId: 'core-output-turn-right',
        portId: 'out',
      },
      to: {
        nodeId: 'output-turn-right',
        portId: 'in',
      },
      weight: 1,
    }
  );

  return links;
};

export const createDefaultGraphIRDocument = (visionCells: number = 36): GraphIRDocument => {
  const rootInputSignals = createDefaultGraphIRInputSignals(visionCells);
  const rootOutputSignals = createDefaultGraphIROutputSignals();
  const document: GraphIRDocument = {
    version: 1,
    models: createDefaultGraphIRModels(),
    root: {
      id: 'root',
      children: [
        {
          kind: 'adapter',
          id: 'input-adapter',
          label: '视觉输入',
          adapterType: 'input',
          position: { x: -260, y: 180 },
          children: rootInputSignals,
        },
        {
          kind: 'neuron-group',
          id: 'core-neuron-group',
          label: '默认神经元组',
          position: { x: 50, y: 200 },
          children: [
            {
              kind: 'adapter',
              id: 'core-input-adapter',
              label: '组输入',
              adapterType: 'input',
              position: { x: -180, y: 170 },
              children: createDefaultCoreInputSignals(),
            },
            ...createDefaultGraphIRNeurons(),
            {
              kind: 'adapter',
              id: 'core-output-adapter',
              label: '组输出',
              adapterType: 'output',
              position: { x: 260, y: 180 },
              children: createDefaultCoreOutputSignals(),
            },
          ],
        },
        {
          kind: 'adapter',
          id: 'output-adapter',
          label: '运动输出',
          adapterType: 'output',
          position: { x: 320, y: 200 },
          children: rootOutputSignals,
        },
      ],
      links: createDefaultGraphIRLinks(visionCells),
    },
  };

  const issues = validateGraphIRDocument(document);
  if (issues.length > 0) {
    throw new GraphIRValidationError(issues);
  }

  return document;
};

export const reconcileGraphIRDocumentVisionCells = (
  document: GraphIRDocument,
  visionCells: number
): GraphIRDocument => {
  const nextDefault = createDefaultGraphIRDocument(visionCells);
  const nextInputAdapter = nextDefault.root.children.find((node) => node.id === 'input-adapter');
  const nextOutputAdapter = nextDefault.root.children.find((node) => node.id === 'output-adapter');
  const nextCoreGroup = nextDefault.root.children.find((node) => node.id === 'core-neuron-group');
  const currentInputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const currentOutputAdapter = document.root.children.find((node) => node.id === 'output-adapter');
  const currentCoreGroup = document.root.children.find((node) => node.id === 'core-neuron-group');

  if (
    !nextInputAdapter ||
    nextInputAdapter.kind !== 'adapter' ||
    !nextOutputAdapter ||
    nextOutputAdapter.kind !== 'adapter' ||
    !nextCoreGroup ||
    nextCoreGroup.kind !== 'neuron-group'
  ) {
    return document;
  }

  const mergeAdapterChildren = (
    currentAdapter: Extract<TopologyNode, { kind: 'adapter' }> | undefined,
    nextAdapter: Extract<TopologyNode, { kind: 'adapter' }>
  ): SignalNode[] => {
    const nextSignalChildren = nextAdapter.children.filter(
      (child): child is SignalNode => child.kind === 'signal'
    );
    const existingById = new Map(
      currentAdapter?.children
        .filter((child): child is SignalNode => child.kind === 'signal')
        .map((child) => [child.id, child])
    );

    return nextSignalChildren.map((child) => {
      const existing = existingById.get(child.id);
      return existing ? { ...child, ...existing } : child;
    });
  };

  const currentCoreChildrenById =
    currentCoreGroup && currentCoreGroup.kind === 'neuron-group'
      ? new Map(currentCoreGroup.children.map((child) => [child.id, child]))
      : new Map<string, TopologyNode>();

  const nextCoreChildren = nextCoreGroup.children.map((child) => {
    const currentChild = currentCoreChildrenById.get(child.id);

    if (child.kind === 'adapter') {
      return {
        ...child,
        ...(currentChild?.kind === 'adapter' ? currentChild : {}),
        children: mergeAdapterChildren(currentChild?.kind === 'adapter' ? currentChild : undefined, child),
      };
    }

    return currentChild?.kind === child.kind ? currentChild : child;
  });
  const nextCoreChildIds = new Set(nextCoreChildren.map((child) => child.id));
  const preservedCustomCoreChildren =
    currentCoreGroup && currentCoreGroup.kind === 'neuron-group'
      ? currentCoreGroup.children.filter((child) => !nextCoreChildIds.has(child.id))
      : [];
  const mergedCoreChildren = [...nextCoreChildren, ...preservedCustomCoreChildren];

  const nextRootChildren = document.root.children.map((node) => {
    if (node.id === 'input-adapter' && node.kind === 'adapter') {
      return {
        ...node,
        children: mergeAdapterChildren(currentInputAdapter?.kind === 'adapter' ? currentInputAdapter : undefined, nextInputAdapter),
      };
    }

    if (node.id === 'output-adapter' && node.kind === 'adapter') {
      return {
        ...node,
        children: mergeAdapterChildren(currentOutputAdapter?.kind === 'adapter' ? currentOutputAdapter : undefined, nextOutputAdapter),
      };
    }

    if (node.id === 'core-neuron-group' && node.kind === 'neuron-group') {
      return {
        ...node,
        children: mergedCoreChildren,
      };
    }

    return node;
  });

  const validNodeIds = new Set<string>([
    ...collectSignalNodes(nextRootChildren, 'input').map((node) => node.id),
    ...collectSignalNodes(nextRootChildren, 'output').map((node) => node.id),
    ...collectNeuronNodes(nextRootChildren).map((node) => node.id),
  ]);

  return {
    ...document,
    root: {
      ...document.root,
      children: nextRootChildren,
      links: document.root.links.filter((link) => validNodeIds.has(link.from.nodeId) && validNodeIds.has(link.to.nodeId)),
    },
  };
};
