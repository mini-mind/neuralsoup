import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  preflightBrainStructure,
  buildAgentBodyEndpointPreviewModel,
  resolveCompiledAgentBodyEndpointIds,
  resolveBodyInputVisionCellIndex,
  summarizeAgentIR,
  validateAgentIR,
  type AgentIR,
  type WorldRegistry,
} from '../../domain/brain';
import type { HostRuntimeProfile } from '../../host';
import type { AgentDraftStatus } from '../../types/agentRuntime';
import type {
  AgentParameters,
  BodyIRDraftStatus,
  BodyIRPreviewData,
  BodyIRValidationMessage,
} from '../editor/types';
import type { GraphDocumentChangeOptions } from './useSNNTopologyState';
import {
  GRAPH_DRAFT_ONLY_CHANGE,
  GRAPH_SEMANTIC_CHANGE,
} from './graphDocumentChangePolicy';

const areAgentParametersEqual = (left: AgentParameters, right: AgentParameters): boolean => {
  return (
    left.visionCells === right.visionCells &&
    left.visionRange === right.visionRange &&
    left.visionAngle === right.visionAngle
  );
};

const normalizeAgentForCompare = (agent: AgentIR): AgentIR => ({
  ...agent,
  metadata: {
    ...agent.metadata,
    updatedAt: '',
  },
});

const areAgentsEquivalent = (left: AgentIR, right: AgentIR): boolean =>
  JSON.stringify(normalizeAgentForCompare(left)) === JSON.stringify(normalizeAgentForCompare(right));

const createAgentDraftStatus = (
  draftAgent: AgentIR,
  worldRegistry: WorldRegistry
): AgentDraftStatus => {
  const summary = summarizeAgentIR(draftAgent, worldRegistry);
  const structuralIssues = preflightBrainStructure(draftAgent.brain).issues.map((issue) => ({
    code: 'invalid-brain-structure' as const,
    message: issue.message,
  }));
  const validationIssues = validateAgentIR(draftAgent, worldRegistry);
  const allIssues = [...structuralIssues, ...validationIssues];

  if (allIssues.length > 0) {
    return {
      state: 'invalid',
      issues: allIssues,
      message: allIssues.map((issue) => issue.message).join(' | '),
      summary,
    };
  }

  return {
    state: 'structurally-valid',
    issues: [],
    message: null,
    summary,
  };
};

const deriveProjectedVisionCellCountFromAgent = (
  agent: AgentIR,
  fallback: number
): number => {
  let maxVisionCellIndex = -1;

  const recordVisionNode = (nodeId: string) => {
    const cellIndex = resolveBodyInputVisionCellIndex(nodeId, agent.body);
    if (cellIndex != null && cellIndex >= 0) {
      maxVisionCellIndex = Math.max(maxVisionCellIndex, cellIndex);
    }
  };

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyInput') {
      recordVisionNode(connection.from.nodeId);
    }
    if (connection.to.scope === 'bodyInput') {
      recordVisionNode(connection.to.nodeId);
    }
  }

  for (const nodeId of Object.keys(agent.layout?.nodes ?? {})) {
    recordVisionNode(nodeId);
  }

  return maxVisionCellIndex >= 0 ? maxVisionCellIndex + 1 : fallback;
};

const deriveAgentParametersFromBrain = (
  agent: AgentIR,
  currentParameters: AgentParameters
): AgentParameters => ({
  ...currentParameters,
  visionCells: deriveProjectedVisionCellCountFromAgent(agent, currentParameters.visionCells),
});

interface UseAgentWorkspaceCoordinatorOptions {
  initialAgentDocument: AgentIR;
  defaultAgentParameters: AgentParameters;
  worldRegistry: WorldRegistry;
  hostProfile: HostRuntimeProfile;
  onRuntimeInstallRequest: (agent: AgentIR) => void;
  onPersistActiveBrainAgent: (agent: AgentIR, updatedAt: string) => void;
}

export const useAgentWorkspaceCoordinator = ({
  initialAgentDocument,
  defaultAgentParameters,
  worldRegistry,
  hostProfile,
  onRuntimeInstallRequest,
  onPersistActiveBrainAgent,
}: UseAgentWorkspaceCoordinatorOptions) => {
  const [currentAgentDocument, setCurrentAgentDocument] =
    useState<AgentIR>(initialAgentDocument);
  const [draftAgentDocument, setDraftAgentDocument] =
    useState<AgentIR>(initialAgentDocument);
  const [draftGraphStatusOverride, setDraftGraphStatusOverride] =
    useState<AgentDraftStatus | null>(null);
  const [agentParameters, setAgentParameters] =
    useState<AgentParameters>(defaultAgentParameters);
  const [draftAgentParameters, setDraftAgentParameters] =
    useState<AgentParameters>(defaultAgentParameters);
  const draftAgentDocumentRef = useRef(draftAgentDocument);
  const currentAgentDocumentRef = useRef(currentAgentDocument);
  const agentParametersRef = useRef(agentParameters);

  const draftProjectedVisionCellCount = draftAgentParameters.visionCells;
  const bodyPreviewDraftStatus = useMemo<AgentDraftStatus>(
    () => createAgentDraftStatus(draftAgentDocument, worldRegistry),
    [draftAgentDocument, worldRegistry]
  );
  const agentDraftStatus = useMemo<AgentDraftStatus>(
    () => draftGraphStatusOverride ?? bodyPreviewDraftStatus,
    [bodyPreviewDraftStatus, draftGraphStatusOverride]
  );
  const bodyDraftStatus = useMemo<BodyIRDraftStatus>(
    () => ({
      hasChanges:
        JSON.stringify(currentAgentDocument.body) !==
        JSON.stringify(draftAgentDocument.body),
    }),
    [currentAgentDocument.body, draftAgentDocument.body]
  );
  const hasDraftEditingChanges = !areAgentsEquivalent(
    currentAgentDocument,
    draftAgentDocument
  );
  const hasUnsavedDraftChanges = hasDraftEditingChanges || bodyDraftStatus.hasChanges;

  const bodyEndpointPreviewModel = useMemo(
    () =>
      buildAgentBodyEndpointPreviewModel(
        draftAgentDocument,
        worldRegistry,
        draftProjectedVisionCellCount
      ),
    [draftAgentDocument, draftProjectedVisionCellCount, worldRegistry]
  );

  const bodyEndpointPreview = useMemo<BodyIRPreviewData>(() => {
    const inputEndpointById = new Map(
      draftAgentDocument.body.inputEndpoints.map((endpoint) => [endpoint.id, endpoint])
    );
    const outputEndpointById = new Map(
      draftAgentDocument.body.outputEndpoints.map((endpoint) => [endpoint.id, endpoint])
    );

    const inputMatches = bodyEndpointPreviewModel.input.endpointMappings.flatMap(
      (previewGroup) => {
        const endpointEntry = inputEndpointById.get(previewGroup.endpointId);
        return previewGroup.mappings.map((previewEndpoint) => ({
          endpointId: previewGroup.endpointId,
          endpointIndex: draftAgentDocument.body.inputEndpoints.findIndex(
            (endpoint) => endpoint.id === previewGroup.endpointId
          ),
          nodeId: previewEndpoint.nodeId,
          resolvedSource: previewEndpoint.resolved,
          scale: endpointEntry?.scale,
        }));
      }
    );

    const outputMatches = bodyEndpointPreviewModel.output.endpointMappings.flatMap(
      (previewGroup) => {
        const endpointEntry = outputEndpointById.get(previewGroup.endpointId);
        return previewGroup.mappings.map((previewEndpoint) => ({
          endpointId: previewGroup.endpointId,
          endpointIndex: draftAgentDocument.body.outputEndpoints.findIndex(
            (endpoint) => endpoint.id === previewGroup.endpointId
          ),
          nodeId: previewEndpoint.nodeId,
          resolvedTarget: previewEndpoint.resolved,
          decayPerSecond: endpointEntry?.decayPerSecond,
        }));
      }
    );

    const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(
      draftAgentDocument,
      worldRegistry
    );

    return {
      canonicalSummary: `host projected coverage ${draftProjectedVisionCellCount} cells；输入 endpoint ${bodyEndpointPreviewModel.input.endpointNodeIds.length} 个，输出 endpoint ${bodyEndpointPreviewModel.output.endpointNodeIds.length} 个。`,
      compiledSummary: `compiled runtime shape：输入 endpoint ${compiledEndpointIds.bodyInputNodeIds.length} 个，输出 endpoint ${compiledEndpointIds.bodyOutputNodeIds.length} 个。`,
      inputMatches,
      outputMatches,
    };
  }, [bodyEndpointPreviewModel, draftAgentDocument, draftProjectedVisionCellCount, worldRegistry]);

  const bodyEndpointValidation = useMemo<BodyIRValidationMessage[]>(() => {
    return bodyEndpointPreviewModel.issues.map((issue) => ({
      code: issue.code,
      level: issue.kind === 'compile-error' || issue.kind === 'conflict' ? 'error' : 'warning',
      message: issue.message,
      scope: issue.scope === 'input' ? 'input-endpoint' : 'output-endpoint',
      endpointId: issue.endpointId,
      nodeId: issue.nodeId,
      relatedMappingIds: issue.relatedMappingIds,
      resolved: issue.resolved,
      target: issue.target,
      endpointIndex:
        issue.scope === 'input'
          ? draftAgentDocument.body.inputEndpoints.findIndex(
              (endpoint) => endpoint.id === issue.endpointId
            )
          : issue.scope === 'output'
            ? draftAgentDocument.body.outputEndpoints.findIndex(
                (endpoint) => endpoint.id === issue.endpointId
              )
            : undefined,
    }));
  }, [bodyEndpointPreviewModel.issues, draftAgentDocument.body.inputEndpoints, draftAgentDocument.body.outputEndpoints]);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  useEffect(() => {
    draftAgentDocumentRef.current = draftAgentDocument;
  }, [draftAgentDocument]);

  useEffect(() => {
    currentAgentDocumentRef.current = currentAgentDocument;
  }, [currentAgentDocument]);

  useEffect(() => {
    agentParametersRef.current = agentParameters;
  }, [agentParameters]);

  const syncAgentParametersFromBrain = useCallback((agent: AgentIR) => {
    const nextParameters = deriveAgentParametersFromBrain(agent, agentParametersRef.current);
    setAgentParameters((current) =>
      areAgentParametersEqual(current, nextParameters) ? current : nextParameters
    );
    setDraftAgentParameters((current) =>
      areAgentParametersEqual(current, nextParameters) ? current : nextParameters
    );
  }, []);

  const commitEditedAgentDocument = useCallback(
    (nextAgentDocument: AgentIR, options?: GraphDocumentChangeOptions) => {
      const nextUpdatedAt = new Date().toISOString();
      const shouldCommitToCurrentDocument =
        options?.commitToCurrentDocument !== false;
      const shouldInstallToRuntime = options?.installToRuntime !== false;
      const shouldPersistActiveBrain =
        options?.persistActiveBrain ?? shouldCommitToCurrentDocument;
      const normalizedAgentDocument: AgentIR = {
        ...nextAgentDocument,
        metadata: {
          ...nextAgentDocument.metadata,
          updatedAt: nextUpdatedAt,
        },
      };

      setDraftGraphStatusOverride(null);
      setDraftAgentDocument(normalizedAgentDocument);
      if (shouldCommitToCurrentDocument) {
        setCurrentAgentDocument(normalizedAgentDocument);
      }
      if (shouldInstallToRuntime) {
        onRuntimeInstallRequest(normalizedAgentDocument);
      }

      const canPersistActiveBrain =
        validateAgentIR(normalizedAgentDocument, worldRegistry).length === 0;
      if (shouldPersistActiveBrain && canPersistActiveBrain) {
        onPersistActiveBrainAgent(normalizedAgentDocument, nextUpdatedAt);
      }
    },
    [onPersistActiveBrainAgent, onRuntimeInstallRequest, worldRegistry]
  );

  const handleAgentChange = useCallback(
    (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => {
      const currentDraftAgent = draftAgentDocumentRef.current;
      const nextAgentDocument = updater(currentDraftAgent);
      if (nextAgentDocument === currentDraftAgent) {
        return;
      }

      commitEditedAgentDocument(nextAgentDocument, options);
    },
    [commitEditedAgentDocument]
  );

  const handleGraphAgentChange = useCallback(
    (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => {
      const currentDraftAgent = draftAgentDocumentRef.current;
      const nextDraftAgent = updater(currentDraftAgent);
      if (nextDraftAgent === currentDraftAgent) {
        return;
      }

      commitEditedAgentDocument(nextDraftAgent, options);
    },
    [commitEditedAgentDocument]
  );

  const handleAgentParametersApply = useCallback(
    (params: AgentParameters) => {
      setAgentParameters((current) =>
        areAgentParametersEqual(current, params) ? current : params
      );
      handleAgentChange(
        (currentAgent) => hostProfile.reconcileAgentIR(currentAgent, params.visionCells),
        GRAPH_SEMANTIC_CHANGE
      );
    },
    [handleAgentChange, hostProfile]
  );

  const handleDraftAgentParametersChange = useCallback<
    React.Dispatch<React.SetStateAction<AgentParameters>>
  >((value) => {
    setDraftAgentParameters((current) =>
      typeof value === 'function' ? value(current) : value
    );
  }, []);

  const handleBodyApply = useCallback(() => {
    handleAgentChange(
      (currentAgent) =>
        hostProfile.reconcileAgentIR(
          {
            ...currentAgent,
            body: draftAgentDocumentRef.current.body,
          },
          agentParameters.visionCells
        ),
      GRAPH_SEMANTIC_CHANGE
    );
  }, [agentParameters.visionCells, handleAgentChange, hostProfile]);

  const handleBodyReset = useCallback(() => {
    const currentCommittedBody = currentAgentDocumentRef.current.body;
    commitEditedAgentDocument(
      {
        ...draftAgentDocumentRef.current,
        body: currentCommittedBody,
      },
      GRAPH_DRAFT_ONLY_CHANGE
    );
  }, [commitEditedAgentDocument]);

  const applyDraftAgentParameters = useCallback(() => {
    handleAgentParametersApply(draftAgentParameters);
  }, [draftAgentParameters, handleAgentParametersApply]);

  const resetDraftAgentParameters = useCallback(() => {
    setDraftAgentParameters(defaultAgentParameters);
  }, [defaultAgentParameters]);

  return {
    currentAgentDocument,
    currentAgentDocumentRef,
    draftAgentDocument,
    draftAgentDocumentRef,
    draftGraphStatusOverride,
    setCurrentAgentDocument,
    setDraftAgentDocument,
    setDraftGraphStatusOverride,
    agentParameters,
    draftAgentParameters,
    setAgentParameters,
    setDraftAgentParameters,
    syncAgentParametersFromBrain,
    draftProjectedVisionCellCount,
    agentDraftStatus,
    bodyDraftStatus,
    bodyEndpointPreview,
    bodyEndpointValidation,
    hasUnsavedDraftChanges,
    handleAgentParametersChange: setAgentParameters,
    handleAgentChange,
    handleGraphAgentChange,
    handleDraftAgentParametersChange,
    handleBodyApply,
    handleBodyReset,
    applyDraftAgentParameters,
    resetDraftAgentParameters,
    commitEditedAgentDocument,
  };
};
