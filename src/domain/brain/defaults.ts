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
          nodeId: 'neuron-1',
          portId: 'dendrite',
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
          nodeId: 'neuron-1',
          portId: 'dendrite',
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
          nodeId: 'neuron-2',
          portId: 'dendrite',
        },
        weight: 0.75,
      }
    );
  }

  links.push(
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
        nodeId: 'output-turn-right',
        portId: 'in',
      },
      weight: 1,
    }
  );

  return links;
};

export const createDefaultGraphIRDocument = (visionCells: number = 36): GraphIRDocument => {
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
          children: createDefaultGraphIRInputSignals(visionCells),
        },
        {
          kind: 'neuron-group',
          id: 'core-neuron-group',
          label: '默认神经元组',
          position: { x: 50, y: 200 },
          children: createDefaultGraphIRNeurons(),
        },
        {
          kind: 'adapter',
          id: 'output-adapter',
          label: '运动输出',
          adapterType: 'output',
          position: { x: 320, y: 200 },
          children: createDefaultGraphIROutputSignals(),
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
  const currentInputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const currentOutputAdapter = document.root.children.find((node) => node.id === 'output-adapter');

  if (!nextInputAdapter || nextInputAdapter.kind !== 'adapter' || !nextOutputAdapter || nextOutputAdapter.kind !== 'adapter') {
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

    return node;
  });

  if (!currentInputAdapter || currentInputAdapter.kind !== 'adapter') {
    return {
      ...document,
      root: {
        ...document.root,
        children: nextRootChildren,
        links: document.root.links,
      },
    };
  }

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
