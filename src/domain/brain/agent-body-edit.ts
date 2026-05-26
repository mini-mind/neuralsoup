import type {
  BodyIR,
  BodyInputEndpointIR,
  BodyInputMappingIR,
  BodyMappingIR,
  BodyOutputEndpointIR,
  BodyOutputMappingIR,
} from './agent-ir';

type BodyEndpointScope = 'input' | 'output';

type BodyIRMutationAction =
  | {
      type: 'input-endpoint.upsert';
      endpoint: BodyInputEndpointIR;
    }
  | {
      type: 'input-endpoint.remove';
      endpointId: string;
      pruneMappings?: boolean;
    }
  | {
      type: 'output-endpoint.upsert';
      endpoint: BodyOutputEndpointIR;
    }
  | {
      type: 'output-endpoint.remove';
      endpointId: string;
      pruneMappings?: boolean;
    }
  | {
      type: 'mapping.upsert';
      mapping: BodyMappingIR;
    }
  | {
      type: 'mapping.remove';
      mappingId: string;
    }
  | {
      type: 'mapping.replace-for-node';
      scope: BodyEndpointScope;
      nodeId: string;
      mapping: BodyInputMappingIR | BodyOutputMappingIR;
    }
  | {
      type: 'mapping.remove-for-node';
      scope: BodyEndpointScope;
      nodeId: string;
    };

export interface BodyIRMutationResult {
  body: BodyIR;
  changed: boolean;
}

const replaceById = <T extends { id: string }>(entries: T[], nextEntry: T): T[] => {
  const index = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (index < 0) {
    return [...entries, nextEntry];
  }
  return entries.map((entry, currentIndex) => (currentIndex === index ? nextEntry : entry));
};

const areMappingsEquivalent = (left: BodyMappingIR, right: BodyMappingIR): boolean =>
  left.id === right.id &&
  left.kind === right.kind &&
  left.endpointId === right.endpointId &&
  left.nodeId === right.nodeId;

const applySingleBodyIRMutation = (body: BodyIR, action: BodyIRMutationAction): BodyIRMutationResult => {
  switch (action.type) {
    case 'input-endpoint.upsert': {
      const nextInputEndpoints = replaceById(body.inputEndpoints, action.endpoint);
      return {
        body: {
          ...body,
          inputEndpoints: nextInputEndpoints,
        },
        changed: JSON.stringify(nextInputEndpoints) !== JSON.stringify(body.inputEndpoints),
      };
    }
    case 'input-endpoint.remove': {
      const nextInputEndpoints = body.inputEndpoints.filter((endpoint) => endpoint.id !== action.endpointId);
      let nextMappings = body.mappings;
      if (action.pruneMappings) {
        nextMappings = body.mappings.filter(
          (mapping) => !(mapping.kind === 'input' && mapping.endpointId === action.endpointId)
        );
      }
      return {
        body: {
          ...body,
          inputEndpoints: nextInputEndpoints,
          mappings: nextMappings,
        },
        changed:
          nextInputEndpoints.length !== body.inputEndpoints.length || nextMappings.length !== body.mappings.length,
      };
    }
    case 'output-endpoint.upsert': {
      const nextOutputEndpoints = replaceById(body.outputEndpoints, action.endpoint);
      return {
        body: {
          ...body,
          outputEndpoints: nextOutputEndpoints,
        },
        changed: JSON.stringify(nextOutputEndpoints) !== JSON.stringify(body.outputEndpoints),
      };
    }
    case 'output-endpoint.remove': {
      const nextOutputEndpoints = body.outputEndpoints.filter((endpoint) => endpoint.id !== action.endpointId);
      let nextMappings = body.mappings;
      if (action.pruneMappings) {
        nextMappings = body.mappings.filter(
          (mapping) => !(mapping.kind === 'output' && mapping.endpointId === action.endpointId)
        );
      }
      return {
        body: {
          ...body,
          outputEndpoints: nextOutputEndpoints,
          mappings: nextMappings,
        },
        changed:
          nextOutputEndpoints.length !== body.outputEndpoints.length || nextMappings.length !== body.mappings.length,
      };
    }
    case 'mapping.upsert': {
      const index = body.mappings.findIndex((mapping) => mapping.id === action.mapping.id);
      if (index < 0) {
        return {
          body: {
            ...body,
            mappings: [...body.mappings, action.mapping],
          },
          changed: true,
        };
      }

      const current = body.mappings[index];
      if (areMappingsEquivalent(current, action.mapping)) {
        return { body, changed: false };
      }
      return {
        body: {
          ...body,
          mappings: body.mappings.map((mapping, currentIndex) => (currentIndex === index ? action.mapping : mapping)),
        },
        changed: true,
      };
    }
    case 'mapping.remove': {
      const nextMappings = body.mappings.filter((mapping) => mapping.id !== action.mappingId);
      return {
        body: {
          ...body,
          mappings: nextMappings,
        },
        changed: nextMappings.length !== body.mappings.length,
      };
    }
    case 'mapping.replace-for-node': {
      const nextMappings = [
        ...body.mappings.filter((mapping) => !(mapping.kind === action.scope && mapping.nodeId === action.nodeId)),
        action.mapping,
      ];
      return {
        body: {
          ...body,
          mappings: nextMappings,
        },
        changed: JSON.stringify(nextMappings) !== JSON.stringify(body.mappings),
      };
    }
    case 'mapping.remove-for-node': {
      const nextMappings = body.mappings.filter(
        (mapping) => !(mapping.kind === action.scope && mapping.nodeId === action.nodeId)
      );
      return {
        body: {
          ...body,
          mappings: nextMappings,
        },
        changed: nextMappings.length !== body.mappings.length,
      };
    }
    default: {
      const _exhaustive: never = action;
      return { body, changed: _exhaustive };
    }
  }
};

export const mutateBodyIR = (body: BodyIR, actions: BodyIRMutationAction[]): BodyIRMutationResult => {
  let current = body;
  let changed = false;
  for (const action of actions) {
    const result = applySingleBodyIRMutation(current, action);
    current = result.body;
    changed = changed || result.changed;
  }
  return {
    body: current,
    changed,
  };
};

export type { BodyIRMutationAction, BodyEndpointScope };
