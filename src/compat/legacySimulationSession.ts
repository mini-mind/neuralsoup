import {
  AgentValidationError,
  type AgentValidationIssue,
} from '../domain/brain';
import {
  assertLegacyBrainDefinitionCompilable,
} from '../compat/legacyBrainCompiler';
import {
  createAgentIRFromLegacyGraphDetailed,
  createLegacyGraphBridgeFromAgent,
  type LegacyGraphBridgeResult,
} from './legacyGraphBridge';
import {
  GraphIRValidationError,
  type GraphIRValidationIssue,
  validateGraphIRDocument,
  type GraphIRDocument,
} from './legacyGraphIR';
import type { LegacyBodyDefinition } from '../compat/legacyBrainPackage';
import type { AgentRuntimeStatus } from '../types/agentRuntime';
import { deriveAgentIRVisionCellCount } from './legacyVisionCellCount';
import type { LegacyCompatContext } from './legacyCompatContext';
import {
  getLegacySimulationSessionAdapter,
  type LegacySimulationSessionAdapter,
} from './legacySimulationSessionAdapter';

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

const createInvalidCompatStatus = (
  target: LegacySimulationSessionAdapter,
  issues: AgentValidationIssue[]
): AgentRuntimeStatus => {
  const session = getLegacySimulationSessionAdapter(target);
  return {
    state: 'invalid',
    appliedSummary: session.getAppliedAgentSummary(),
    issues,
    message: issues.map((issue) => issue.message).join(' | '),
  };
};

const createCompatLinkLossIssues = (
  linkIds: string[],
  prefix: string
): AgentValidationIssue[] =>
  linkIds.map((linkId) => ({
    code: 'runtime-binding-error',
    message: `${prefix} "${linkId}".`,
  }));

const createCompatMessageIssues = (messages: string[]): AgentValidationIssue[] =>
  messages.map((message) => ({
    code: 'runtime-binding-error',
    message,
  }));

const auditLegacyCompatBridge = (
  compatBridge: LegacyGraphBridgeResult,
  context: LegacyCompatContext
): AgentValidationIssue[] => {
  const sinkIssues: AgentValidationIssue[] = [
    ...createCompatLinkLossIssues(
      compatBridge.droppedConnectionIds,
      'Legacy GraphIR compat bridge cannot preserve AgentIR connection'
    ),
    ...createCompatMessageIssues(compatBridge.documentOnlyLosses),
  ];
  if (sinkIssues.length > 0) {
    return sinkIssues;
  }

  const graphIssues = validateGraphIRDocument(compatBridge.document);
  if (graphIssues.length > 0) {
    return toAgentValidationIssues(graphIssues);
  }

  try {
    assertLegacyBrainDefinitionCompilable(compatBridge.document, compatBridge.body, context);
    return [];
  } catch (error) {
    if (error instanceof GraphIRValidationError || error instanceof AgentValidationError) {
      return error instanceof GraphIRValidationError ? toAgentValidationIssues(error.issues) : error.issues;
    }

    return [
      {
        code: 'runtime-binding-error',
        message: error instanceof Error ? error.message : 'Unknown GraphIR runtime binding failure.',
      },
    ];
  }
};

const createLegacyCompatSinkAudit = (
  agent: ReturnType<typeof createAgentIRFromLegacyGraphDetailed>['agent'],
  context: LegacyCompatContext,
  availableVisionCellCount?: number
): { compatBridge: LegacyGraphBridgeResult; issues: AgentValidationIssue[] } => {
  const compatBridge = createLegacyGraphBridgeFromAgent(agent, context, {
    visionCellCount: availableVisionCellCount,
  });
  return {
    compatBridge,
    issues: auditLegacyCompatBridge(compatBridge, context),
  };
};

const auditLegacyCompatImport = (
  document: GraphIRDocument,
  body: LegacyBodyDefinition,
  context: LegacyCompatContext
): AgentValidationIssue[] => {
  const graphIssues = validateGraphIRDocument(document);
  if (graphIssues.length > 0) {
    return toAgentValidationIssues(graphIssues);
  }

  try {
    assertLegacyBrainDefinitionCompilable(document, body, context);
    return [];
  } catch (error) {
    if (error instanceof GraphIRValidationError || error instanceof AgentValidationError) {
      return error instanceof GraphIRValidationError ? toAgentValidationIssues(error.issues) : error.issues;
    }

    return [
      {
        code: 'runtime-binding-error',
        message: error instanceof Error ? error.message : 'Unknown GraphIR runtime binding failure.',
      },
    ];
  }
};

const auditLegacyGraphIRDocumentOnlyImport = (document: GraphIRDocument): AgentValidationIssue[] => {
  const graphIssues = validateGraphIRDocument(document);
  return graphIssues.length > 0 ? toAgentValidationIssues(graphIssues) : [];
};

export const inspectLegacyGraphIRExport = (
  target: LegacySimulationSessionAdapter,
  context: LegacyCompatContext
): { compatBridge: LegacyGraphBridgeResult; issues: AgentValidationIssue[] } =>
  createLegacyCompatSinkAudit(
    getLegacySimulationSessionAdapter(target).getCurrentAgentIR(),
    context,
    getLegacySimulationSessionAdapter(target).getAvailableVisionCellCount()
  );

export const setLegacyGraphIRDocument = (
  target: LegacySimulationSessionAdapter,
  document: GraphIRDocument,
  context: LegacyCompatContext,
  body?: LegacyBodyDefinition
): AgentRuntimeStatus => {
  const session = getLegacySimulationSessionAdapter(target);
  const currentAgent = session.getCurrentAgentIR();
  const visionCells = session.getAvailableVisionCellCount();
  const bridgeResult = createAgentIRFromLegacyGraphDetailed(
    currentAgent.metadata.name,
    document,
    body,
    undefined,
    currentAgent.metadata
  );
  if (bridgeResult.droppedLinkIds.length > 0) {
    return createInvalidCompatStatus(
      target,
      createCompatLinkLossIssues(
        bridgeResult.droppedLinkIds,
        'Legacy GraphIR compat setter cannot preserve draft link'
      )
    );
  }
  const importIssues = body
    ? auditLegacyCompatImport(document, body, context)
    : auditLegacyGraphIRDocumentOnlyImport(document);
  if (importIssues.length > 0) {
    return createInvalidCompatStatus(target, importIssues);
  }
  const outOfRangeConnections = bridgeResult.agent.connections.filter((connection) => {
    if (connection.from.scope !== 'bodyInput') {
      return false;
    }
    const match = connection.from.nodeId.match(LEGACY_VISION_INPUT_PATTERN);
    return match ? Number.parseInt(match[1] ?? '-1', 10) >= visionCells : false;
  });

  if (outOfRangeConnections.length > 0) {
    return createInvalidCompatStatus(
      target,
      outOfRangeConnections.map((connection) => ({
        code: 'runtime-binding-error',
        message: `Legacy GraphIR compat setter requires vision cell ${connection.from.nodeId}, but session only has ${visionCells} cells.`,
      }))
    );
  }

  const nextAgent = bridgeResult.agent;
  const requiredVisionCells = deriveAgentIRVisionCellCount(nextAgent, context);
  if (requiredVisionCells > visionCells) {
    return createInvalidCompatStatus(target, [
      {
        code: 'runtime-binding-error',
        message: `Legacy GraphIR compat setter requires ${requiredVisionCells} vision cells, but session only has ${visionCells} cells.`,
      },
    ]);
  }

  const exportAudit = createLegacyCompatSinkAudit(nextAgent, context, visionCells);
  if (exportAudit.issues.length > 0) {
    return createInvalidCompatStatus(session, exportAudit.issues);
  }

  return session.setAgentIR(nextAgent);
};

export const exportLegacyGraphIRDocument = (
  target: LegacySimulationSessionAdapter,
  context: LegacyCompatContext
): GraphIRDocument =>
  (() => {
    const { compatBridge, issues } = inspectLegacyGraphIRExport(target, context);

    if (issues.length > 0) {
      throw new AgentValidationError(issues);
    }

    return compatBridge.document;
  })();
