import {
  AgentValidationError,
  deriveAgentIRVisionCellCount,
  type AgentValidationIssue,
} from '../domain/brain';
import { compileLegacyBrainDefinition } from '../compat/legacyBrainCompiler';
import {
  createAgentIRFromLegacyGraphDetailed,
  createLegacyGraphBridgeFromAgent,
} from '../domain/brain/legacy-graph-bridge';
import {
  GraphIRValidationError,
  type GraphIRValidationIssue,
  validateGraphIRDocument,
  type GraphIRDocument,
} from '../domain/brain/ir';
import type { LegacyBodyDefinition } from '../compat/legacyBrainPackage';
import type { AgentRuntimeStatus } from '../types/agentRuntime';
import { SimulationSession } from '../runtime/SimulationSession';

const LEGACY_VISION_INPUT_PATTERN = /^vision-[RGB]-(\d+)$/;

const toAgentValidationIssues = (issues: GraphIRValidationIssue[]): AgentValidationIssue[] =>
  issues.map((issue) => ({
    code:
      issue.code === 'missing-link-node'
        ? 'missing-brain-node'
        : issue.code === 'invalid-link-direction'
          ? 'invalid-connection-direction'
          : 'runtime-binding-error',
    message: issue.message,
  }));

export const setLegacyGraphIRDocument = (
  session: SimulationSession,
  document: GraphIRDocument,
  body?: LegacyBodyDefinition
): AgentRuntimeStatus => {
  const mainAgent = session.getMainAgent();
  const currentAgent = session.getCurrentAgentIR();
  const visionCells = mainAgent?.visionCells.length ?? session.getVisionCellCount();
  const bridgeResult = createAgentIRFromLegacyGraphDetailed(
    currentAgent.metadata.name,
    document,
    body,
    undefined,
    currentAgent.metadata
  );
  if (bridgeResult.droppedLinkIds.length > 0) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: bridgeResult.droppedLinkIds.map((linkId) => ({
        code: 'runtime-binding-error' as const,
        message: `Legacy GraphIR compat setter cannot preserve draft link "${linkId}".`,
      })),
      message: bridgeResult.droppedLinkIds
        .map((linkId) => `Legacy GraphIR compat setter cannot preserve draft link "${linkId}".`)
        .join(' | '),
    };
  }
  const outOfRangeConnections = bridgeResult.agent.connections.filter((connection) => {
    if (connection.from.scope !== 'bodyInput') {
      return false;
    }
    const match = connection.from.nodeId.match(LEGACY_VISION_INPUT_PATTERN);
    return match ? Number.parseInt(match[1] ?? '-1', 10) >= visionCells : false;
  });

  if (outOfRangeConnections.length > 0) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: outOfRangeConnections.map((connection) => ({
        code: 'runtime-binding-error' as const,
        message: `Legacy GraphIR compat setter requires vision cell ${connection.from.nodeId}, but session only has ${visionCells} cells.`,
      })),
      message: outOfRangeConnections
        .map(
          (connection) =>
            `Legacy GraphIR compat setter requires vision cell ${connection.from.nodeId}, but session only has ${visionCells} cells.`
        )
        .join(' | '),
    };
  }

  const nextAgent = bridgeResult.agent;
  const requiredVisionCells = deriveAgentIRVisionCellCount(nextAgent);
  if (requiredVisionCells > visionCells) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: [
        {
          code: 'runtime-binding-error',
          message: `Legacy GraphIR compat setter requires ${requiredVisionCells} vision cells, but session only has ${visionCells} cells.`,
        },
      ],
      message: `Legacy GraphIR compat setter requires ${requiredVisionCells} vision cells, but session only has ${visionCells} cells.`,
    };
  }
  const compatBridge = createLegacyGraphBridgeFromAgent(nextAgent);
  const reconciledDocument = compatBridge.document;
  const reconciledBody = compatBridge.body;
  if (compatBridge.droppedConnectionIds.length > 0) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: compatBridge.droppedConnectionIds.map((connectionId) => ({
        code: 'runtime-binding-error' as const,
        message: `Legacy GraphIR compat bridge cannot preserve AgentIR connection "${connectionId}".`,
      })),
      message: compatBridge.droppedConnectionIds
        .map((connectionId) => `Legacy GraphIR compat bridge cannot preserve AgentIR connection "${connectionId}".`)
        .join(' | '),
    };
  }
  if (compatBridge.documentOnlyLosses.length > 0) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: compatBridge.documentOnlyLosses.map((message) => ({
        code: 'runtime-binding-error' as const,
        message,
      })),
      message: compatBridge.documentOnlyLosses.join(' | '),
    };
  }
  const issues = validateGraphIRDocument(reconciledDocument);

  if (issues.length > 0) {
    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: toAgentValidationIssues(issues),
      message: issues.map((issue) => issue.message).join(' | '),
    };
  }

  try {
    compileLegacyBrainDefinition(reconciledDocument, reconciledBody);
  } catch (error) {
    if (error instanceof GraphIRValidationError || error instanceof AgentValidationError) {
      const compatIssues = error instanceof GraphIRValidationError ? toAgentValidationIssues(error.issues) : error.issues;
      return {
        state: 'invalid',
        appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
        issues: compatIssues,
        message: compatIssues.map((issue) => issue.message).join(' | '),
      };
    }

    return {
      state: 'invalid',
      appliedSummary: session.getAgentRuntimeStatus().appliedSummary,
      issues: [
        {
          code: 'runtime-binding-error',
          message: error instanceof Error ? error.message : 'Unknown GraphIR runtime binding failure.',
        },
      ],
      message: error instanceof Error ? error.message : 'Unknown GraphIR runtime binding failure.',
    };
  }

  return session.setAgentIR(nextAgent);
};

export const getCurrentLegacyGraphIRDocument = (session: SimulationSession): GraphIRDocument =>
  (() => {
    const compatBridge = createLegacyGraphBridgeFromAgent(session.getCurrentAgentIR());
    const issues = [
      ...compatBridge.droppedConnectionIds.map((connectionId) => ({
        code: 'runtime-binding-error' as const,
        message: `Legacy GraphIR compat getter cannot preserve AgentIR connection "${connectionId}".`,
      })),
      ...compatBridge.documentOnlyLosses.map((message) => ({
        code: 'runtime-binding-error' as const,
        message,
      })),
    ];

    if (issues.length > 0) {
      throw new AgentValidationError(issues);
    }

    return compatBridge.document;
  })();
