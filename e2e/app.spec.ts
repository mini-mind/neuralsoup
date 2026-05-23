import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createDefaultAgentIR } from '../src/domain/brain/agent-defaults';

const selectors = {
  simulationCanvas: '[data-testid="simulation-canvas"]',
  appSplitter: '[data-testid="app-splitter"]',
  simulationPanel: '[data-testid="simulation-panel"]',
  controlPanel: '[data-testid="control-panel"]',
  renderError: '[data-testid="simulation-render-error"]',
  runState: '[data-testid="simulation-run-state"]',
  controlModeValue: '[data-testid="control-mode-value"]',
  editorTabValue: '[data-testid="editor-tab-value"]',
  settingsSectionValue: '[data-testid="settings-section-value"]',
  brainLibraryButton: '[data-testid="brain-library-button"]',
  brainLibraryModal: '[data-testid="brain-library-modal"]',
  brainLibrarySaveName: '[data-testid="brain-library-save-name"]',
  brainLibrarySaveCurrent: '[data-testid="brain-library-save-current"]',
  brainLibraryList: '[data-testid="brain-library-list"]',
  brainLibraryClose: '[data-testid="brain-library-close"]',
  brainLibraryImportTrigger: '[data-testid="brain-library-import-trigger"]',
  brainLibraryImportFile: '[data-testid="brain-library-import-file"]',
  brainLibraryError: '[data-testid="brain-library-error"]',
  brainLibraryStatusMessage: '[data-testid="brain-library-status-message"]',
  editorTabSettings: '[data-testid="editor-tab-settings"]',
  editorTabGraph: '[data-testid="editor-tab-graph"]',
  startPauseButton: '[data-testid="start-pause-button"]',
  resetButton: '[data-testid="reset-button"]',
  settingsPanel: '[data-testid="settings-panel"]',
  settingsSidebar: '[data-testid="settings-sidebar"]',
  settingsNavAgentParameters: '[data-testid="settings-nav-agent-parameters"]',
  settingsNavBodyIr: '[data-testid="settings-nav-body-ir"]',
  settingsNavKeyboardInputs: '[data-testid="settings-nav-keyboard-inputs"]',
  agentParamsPanel: '[data-testid="agent-params-panel"]',
  bodyIrSettingsPanel: '[data-testid="body-ir-settings-panel"]',
  bodyIrPreviewPanel: '[data-testid="body-ir-preview-panel"]',
  bodyIrValidationCount: '[data-testid="body-ir-validation-count"]',
  bodyIrInputRulePattern0: '[data-testid="body-ir-input-rule-pattern-0"]',
  bodyIrOutputRuleTargetTemplate0: '[data-testid="body-ir-output-rule-target-template-0"]',
  visionCellsInput: '[data-testid="vision-cells-input"]',
  visionRangeInput: '[data-testid="vision-range-input"]',
  visionAngleInput: '[data-testid="vision-angle-input"]',
  visionCellsValue: '[data-testid="vision-cells-value"]',
  visionRangeValue: '[data-testid="vision-range-value"]',
  visionAngleValue: '[data-testid="vision-angle-value"]',
  paramsApply: '[data-testid="agent-params-apply"]',
  paramsResetDefaults: '[data-testid="agent-params-reset-defaults"]',
  keyboardInputPanel: '[data-testid="keyboard-input-panel"]',
  topologyEditor: '[data-testid="topology-editor"]',
  topologyViewport: '[data-testid="topology-viewport"]',
  topologyCanvas: '[data-testid="topology-canvas"]',
  topologyScene: '[data-testid="topology-scene"]',
  topologyNodeCount: '[data-testid="topology-node-count"]',
  topologySelectedCount: '[data-testid="topology-selected-count"]',
  topologySelectedLink: '[data-testid="topology-selected-link"]',
  topologyNodeCenters: '[data-testid="topology-node-centers"]',
  topologyCanvasOffset: '[data-testid="topology-canvas-offset"]',
  topologyCanvasScale: '[data-testid="topology-canvas-scale"]',
  topologyContextMenu: '[data-testid="topology-context-menu"]',
  topologyContextNewNeuron: '[data-testid="topology-context-new-neuron"]',
  topologyContextNewGroup: '[data-testid="topology-context-new-group"]',
  topologyContextAggregate: '[data-testid="topology-context-aggregate"]',
  topologyContextToggleGroup: '[data-testid="topology-context-toggle-group"]',
  topologyContextUngroup: '[data-testid="topology-context-ungroup"]',
  topologyDetailModal: '[data-testid="topology-detail-modal"]',
  topologyDetailModalOverlay: '[data-testid="topology-detail-modal-overlay"]',
  topologyDetailClose: '[data-testid="topology-detail-close"]',
  topologyBreadcrumbRoot: '[data-testid="topology-breadcrumb-root"]',
  topologyPendingLink: '[data-testid="topology-pending-link"]',
  topologyDraftInputCount: '[data-testid="topology-draft-input-count"]',
  topologyDraftOutputCount: '[data-testid="topology-draft-output-count"]',
  topologyDraftNeuronCount: '[data-testid="topology-draft-neuron-count"]',
  topologyDraftConnectionCount: '[data-testid="topology-draft-connection-count"]',
  topologyDraftValidationCount: '[data-testid="topology-draft-validation-count"]',
  topologyDraftState: '[data-testid="topology-draft-state"]',
  topologyDraftMessage: '[data-testid="topology-draft-message"]',
  topologyRuntimeState: '[data-testid="topology-runtime-state"]',
  topologyRuntimeValidationCount: '[data-testid="topology-runtime-validation-count"]',
  topologyRuntimeInputCount: '[data-testid="topology-runtime-input-count"]',
  topologyRuntimeOutputCount: '[data-testid="topology-runtime-output-count"]',
  topologyRuntimeNeuronCount: '[data-testid="topology-runtime-neuron-count"]',
  topologyRuntimeConnectionCount: '[data-testid="topology-runtime-connection-count"]',
  graphInstalledAgentId: '[data-testid="graph-ir-installed-agent-id"]',
  topologyInputCount: '[data-testid="topology-input-count"]',
  topologyOutputCount: '[data-testid="topology-output-count"]',
  topologyValidationCount: '[data-testid="topology-validation-count"]',
  neuronLabelInput: '[data-testid="neuron-label-input"]',
  neuronInitialStateVInput: '[data-testid="neuron-initial-state-v-input"]',
  neuronInitialStateUInput: '[data-testid="neuron-initial-state-u-input"]',
  connectionWeightInput: '[data-testid="connection-weight-input"]',
  inputAdapterNode: '[data-testid="topology-node-input-adapter"]',
  coreGroupNode: '[data-topology-root-container="true"]',
  outputAdapterNode: '[data-testid="topology-node-output-adapter"]',
  coreInputAdapterNode: '[data-testid="topology-node-core-input-adapter"]',
  coreOutputAdapterNode: '[data-testid="topology-node-core-output-adapter"]',
  aggregateLinkDetail: '[data-testid="topology-aggregate-link-detail"]',
  aggregateLinkCount: '[data-testid="topology-aggregate-link-count"]',
  aggregateLinkReadonly: '[data-testid="topology-aggregate-link-readonly"]',
  nodeNeuronOne: '[data-testid="topology-node-neuron-1"]',
  nodeNeuronTwo: '[data-testid="topology-node-neuron-2"]'
} as const;

type E2EStoredBrain = {
  agent: {
    metadata?: { id?: string; name?: string };
    body?: Record<string, unknown>;
  };
  metadata?: never;
  packageVersion?: never;
};

const BRAIN_LIBRARY_STORAGE_KEY = 'neuralsoup.brain-library.v1';

type StartupDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
};

type DiagnosticsExpectation = 'none' | 'expected-render-init-errors';

const diagnosticsByPage = new WeakMap<Page, StartupDiagnostics>();
const diagnosticsExpectationsByPage = new WeakMap<Page, DiagnosticsExpectation>();

const degradedRendererProjectName = 'chromium-webgl-disabled';
const expectedRenderInitErrorPrefix = 'Failed to initialize simulation canvas:';
const DEFAULT_AGENT_CONNECTION_COUNT = createDefaultAgentIR(36).connections.length;

const installStartupDiagnostics = (page: Page) => {
  const diagnostics: StartupDiagnostics = {
    consoleErrors: [],
    pageErrors: []
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });

  diagnosticsByPage.set(page, diagnostics);
};

const getStartupDiagnostics = (page: Page) => {
  const diagnostics = diagnosticsByPage.get(page);
  if (!diagnostics) {
    throw new Error('Startup diagnostics were not installed for this page');
  }

  return diagnostics;
};

const setDiagnosticsExpectation = (page: Page, expectation: DiagnosticsExpectation) => {
  diagnosticsExpectationsByPage.set(page, expectation);
};

const getDiagnosticsExpectation = (page: Page) => diagnosticsExpectationsByPage.get(page) ?? 'none';

const isDegradedRendererProject = (testInfo: TestInfo) => testInfo.project.name === degradedRendererProjectName;

const disableWebGLContexts = async (page: Page) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function getContextOverride(
      contextType: string,
      ...args: unknown[]
    ) {
      if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
        return null;
      }

      return originalGetContext.call(this, contextType, ...(args as []));
    };
  });
};

const waitForRenderOutcome = async (page: Page) =>
  expect
    .poll(
      async () => {
        if (await page.locator(selectors.renderError).isVisible().catch(() => false)) {
          return 'render-error';
        }

        return await page.locator(selectors.simulationCanvas).getAttribute('data-engine-ready');
      },
      {
        timeout: 10_000,
        message: 'expected simulation renderer to become ready or show an explicit render error'
      }
    )
    .toMatch(/^(true|render-error)$/);

const getRenderOutcome = async (page: Page) => {
  await waitForRenderOutcome(page);
  return (await page.locator(selectors.renderError).isVisible().catch(() => false)) ? 'render-error' : 'ready';
};

const expectDegradedRenderErrorUI = async (page: Page) => {
  await expect(page.locator(selectors.renderError)).toBeVisible();
  await expect(page.locator(selectors.renderError)).toContainText('渲染初始化失败');
  await expect(page.locator(selectors.runState)).toBeVisible();
  await expect(page.locator(selectors.startPauseButton)).toBeVisible();
  await expect(page.locator(selectors.editorTabGraph)).toBeVisible();
};

const expectInteractiveRenderReady = async (page: Page, testInfo: TestInfo) => {
  const outcome = await getRenderOutcome(page);
  if (outcome === 'ready') {
    await expectReadyCanvas(page);
    await expectNoUnhandledStartupErrors(page);
    return true;
  }

  if (!isDegradedRendererProject(testInfo)) {
    throw new Error('Expected the standard renderer path to become ready, but the render error UI was shown.');
  }

  setDiagnosticsExpectation(page, 'expected-render-init-errors');
  await expectDegradedRenderErrorUI(page);
  return false;
};

const flushTeardownDiagnostics = async (page: Page) => {
  if (page.isClosed()) {
    return;
  }

  await page.goto('about:blank', { waitUntil: 'load' });
  await page.waitForTimeout(50);
};

const expectNoUnhandledStartupErrors = async (page: Page) => {
  const diagnostics = getStartupDiagnostics(page);
  expect(diagnostics.pageErrors, `Unexpected page errors: ${diagnostics.pageErrors.join('\n')}`).toEqual([]);
  expect(
    diagnostics.consoleErrors,
    `Unexpected console errors: ${diagnostics.consoleErrors.join('\n')}`
  ).toEqual([]);
};

const expectOnlyExpectedRenderInitErrors = async (page: Page) => {
  const diagnostics = getStartupDiagnostics(page);
  expect(diagnostics.pageErrors, `Unexpected page errors: ${diagnostics.pageErrors.join('\n')}`).toEqual([]);
  expect(diagnostics.consoleErrors, 'Expected at least one PIXI initialization console error').not.toHaveLength(0);
  expect(
    diagnostics.consoleErrors.every((message) => message.startsWith(expectedRenderInitErrorPrefix)),
    `Unexpected console errors: ${diagnostics.consoleErrors.join('\n')}`
  ).toBe(true);
};

const expectReadyCanvas = async (page: Page) => {
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');

  const actualCanvas = page.locator(`${selectors.simulationCanvas} canvas`);
  await expect(actualCanvas).toHaveCount(1);
  await expect(actualCanvas).toBeVisible();

  return actualCanvas;
};

const getCanvasBox = async (page: Page) => {
  const box = await page.locator(selectors.topologyCanvas).boundingBox();
  if (!box) {
    throw new Error('Topology canvas bounding box not available');
  }

  return box;
};

const getLocatorBox = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`Bounding box not available for selector: ${selector}`);
  }

  return box;
};

const getSceneClientPoint = async (page: Page, scenePoint: { x: number; y: number }) => {
  const [sceneBox, scaleText] = await Promise.all([
    getLocatorBox(page, selectors.topologyScene),
    page.locator(selectors.topologyCanvasScale).innerText(),
  ]);
  const scale = Number.parseFloat(scaleText);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`Invalid topology canvas scale: ${scaleText}`);
  }

  return {
    x: sceneBox.x + scenePoint.x * scale,
    y: sceneBox.y + scenePoint.y * scale,
  };
};

const getLocatorCenter = async (page: Page, selector: string) => {
  const locator = page.locator(selector).first();
  const viewNodeId = await locator.getAttribute('data-topology-view-node-id');
  if (viewNodeId) {
    const sceneCenter = await getNodeCenterFromSummary(page, viewNodeId);
    return getSceneClientPoint(page, sceneCenter);
  }

  const box = await getLocatorBox(page, selector);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
};

const getVisibleLocatorCenterInCanvas = async (page: Page, selector: string) => {
  const locator = page.locator(selector).first();
  const viewNodeId = await locator.getAttribute('data-topology-view-node-id');
  if (viewNodeId) {
    const [center, canvasBox] = await Promise.all([
      getLocatorCenter(page, selector),
      getCanvasBox(page),
    ]);
    return {
      x: Math.max(canvasBox.x + 2, Math.min(center.x, canvasBox.x + canvasBox.width - 2)),
      y: Math.max(canvasBox.y + 2, Math.min(center.y, canvasBox.y + canvasBox.height - 2)),
    };
  }

  const [box, canvasBox] = await Promise.all([
    getLocatorBox(page, selector),
    getCanvasBox(page),
  ]);
  const left = Math.max(box.x, canvasBox.x);
  const top = Math.max(box.y, canvasBox.y);
  const right = Math.min(box.x + box.width, canvasBox.x + canvasBox.width);
  const bottom = Math.min(box.y + box.height, canvasBox.y + canvasBox.height);

  if (right <= left || bottom <= top) {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    };
  }

  return {
    x: left + (right - left) / 2,
    y: top + (bottom - top) / 2
  };
};

const getSvgLineMidpoint = async (page: Page, selector: string) => {
  const locator = page.locator(selector).first();
  const line = locator.locator('line.topology-link-hit, line.topology-link-stroke').first();
  const point = await line.evaluate((element) => {
    const x1 = Number.parseFloat(element.getAttribute('x1') ?? '');
    const y1 = Number.parseFloat(element.getAttribute('y1') ?? '');
    const x2 = Number.parseFloat(element.getAttribute('x2') ?? '');
    const y2 = Number.parseFloat(element.getAttribute('y2') ?? '');
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      return null;
    }

    return {
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
    };
  });

  if (point) {
    return getSceneClientPoint(page, point);
  }

  return getLocatorCenter(page, selector);
};

const getLeafLinkLocator = (page: Page, fromNodeId: string, toNodeId: string) =>
  page
    .locator(
      `[data-topology-link-from-node-id="${fromNodeId}"][data-topology-link-to-node-id="${toNodeId}"]`
    )
    .first();

const getAggregateLinkLocator = (page: Page) =>
  page
    .locator('g.topology-link.is-aggregate[data-topology-link-from-node-id][data-topology-link-to-node-id]')
    .first();

const getBrainLibrarySelectButton = (page: Page, brainId: string) =>
  page.locator(`[data-testid="brain-library-select-${brainId}"]`);

const doubleClickNode = async (page: Page, selector: string) => {
  const center = await getVisibleLocatorCenterInCanvas(page, selector);
  await page.mouse.dblclick(center.x, center.y);
};

const doubleClickAtCenter = async (page: Page, selector: string) => {
  const center = selector.includes('topology-link') ? await getSvgLineMidpoint(page, selector) : await getLocatorCenter(page, selector);
  await page.mouse.dblclick(center.x, center.y);
};

const closeTopologyDetailModal = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.locator(selectors.topologyDetailModal)).toHaveCount(0);
};

const rightDragBetweenNodes = async (page: Page, fromSelector: string, toSelector: string) => {
  await expect(page.locator(fromSelector)).toBeVisible();
  await expect(page.locator(toSelector)).toBeVisible();
  const from = await getLocatorCenter(page, fromSelector);
  const to = await getLocatorCenter(page, toSelector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up({ button: 'right' });
};

const beginRightLinkFromNode = async (page: Page, selector: string) => {
  const from = await getLocatorCenter(page, selector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'right' });
};

const rightClickAt = async (page: Page, point: { x: number; y: number }) => {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
};

const aggregateDefaultNeuronsIntoGroup = async (page: Page) => {
  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  const nodeTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);
  await rightClickAt(page, nodeTwoCenter);
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextAggregate).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);
  return groupSelector;
};

const expandGroupInPlace = async (page: Page, groupSelector: string) => {
  const groupCenter = await getLocatorCenter(page, groupSelector);
  await rightClickAt(page, groupCenter);
  await expect(page.locator(selectors.topologyContextToggleGroup)).toHaveText('展开');
  await page.locator(selectors.topologyContextToggleGroup).click();
  await expect(page.locator(groupSelector)).toHaveClass(/is-expanded/);
};

const parsePointPair = (value: string) => {
  const [x, y] = value.split(',').map((part) => Number.parseFloat(part));
  return { x, y };
};

const dragOnCanvas = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options?: { button?: 'left' | 'right' }
) => {
  const button = options?.button ?? 'left';
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up({ button });
};

const getNodeCenterFromSummary = async (page: Page, nodeId: string) => {
  const summary = await page.locator(selectors.topologyNodeCenters).innerText();
  const entry = summary
    .split('|')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nodeId}:`));

  if (!entry) {
    throw new Error(`Node center summary missing node ${nodeId}`);
  }

  const [, coordinates] = entry.split(':');
  const [x, y] = coordinates.split(',').map((value) => Number.parseInt(value, 10));
  return { x, y };
};

const getNodeCenterFromSummaryMatching = async (page: Page, nodeId: string) => {
  const summary = await page.locator(selectors.topologyNodeCenters).innerText();
  const entries = summary.split('|').map((item) => item.trim());
  const entry =
    entries.find((item) => item.startsWith(`${nodeId}:`)) ??
    entries.find((item) => item.split(':', 1)[0]?.endsWith(nodeId));

  if (!entry) {
    throw new Error(`Node center summary missing node ${nodeId}`);
  }

  const [, coordinates] = entry.split(':');
  const [x, y] = coordinates.split(',').map((value) => Number.parseInt(value, 10));
  return { x, y };
};

const getNodeViewPositionFromSummary = async (page: Page, nodeId: string) => {
  const summary = await page.locator('[data-testid="topology-node-view-positions"]').innerText();
  const entry = summary
    .split('|')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nodeId}:`));

  if (!entry) {
    throw new Error(`Node view position summary missing node ${nodeId}`);
  }

  const [, coordinates] = entry.split(':');
  const [x, y] = coordinates.split(',').map((value) => Number.parseInt(value, 10));
  return { x, y };
};

const getNodeViewId = async (page: Page, selector: string) => {
  const viewId = await page.locator(selector).getAttribute('data-topology-view-node-id');
  if (!viewId) {
    throw new Error(`Missing data-topology-view-node-id for selector ${selector}`);
  }

  return viewId;
};

const injectInvalidGraphDraft = async (page: Page) => {
  await page.evaluate(() => {
    window.__NEURALSOUP_TEST_API__?.injectInvalidGraphDraft();
  });
};

const injectValidDraftOnly = async (page: Page) => {
  await page.evaluate(() => {
    window.__NEURALSOUP_TEST_API__?.injectValidDraftOnly();
  });
};

const getActiveAgentId = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getActiveAgentId() ?? null);

const getActiveBrainId = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getActiveBrainId() ?? null);

const getDraftAgentId = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getDraftAgentId() ?? null);

const getGraphPathIds = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getGraphPathIds() ?? []);

const dispatchCanvasMouseSequence = async (
  page: Page,
  sequence: Array<{ type: 'mousedown' | 'mouseup'; x: number; y: number; button?: number }>
) => {
  await page.locator(selectors.topologyCanvas).evaluate((canvas, steps) => {
    for (const step of steps) {
      canvas.dispatchEvent(
        new MouseEvent(step.type, {
          bubbles: true,
          cancelable: true,
          clientX: step.x,
          clientY: step.y,
          button: step.button ?? 0,
          buttons: step.type === 'mousedown' ? 1 : 0,
          view: window,
        })
      );
    }
  }, sequence);
};

const getRuntimeActiveNodeIds = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getRuntimeActiveNodeIds() ?? []);

const getRuntimeDiagnostics = async (page: Page) => ({
  state: await page.locator(selectors.topologyRuntimeState).innerText(),
  validationCount: await page.locator(selectors.topologyRuntimeValidationCount).innerText()
});

const getDraftDiagnostics = async (page: Page) => ({
  state: await page.locator(selectors.topologyDraftState).innerText(),
  validationCount: await page.locator(selectors.topologyDraftValidationCount).innerText(),
  message: await page.locator(selectors.topologyDraftMessage).innerText()
});

const getStoredBrains = async (page: Page): Promise<E2EStoredBrain[]> =>
  page.evaluate((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    return ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []);
  }, BRAIN_LIBRARY_STORAGE_KEY);

const getStoredBrainByName = async (page: Page, name: string): Promise<E2EStoredBrain | null> => {
  const storedBrains = await getStoredBrains(page);
  return storedBrains.find((brain) => brain.agent?.metadata?.name === name) ?? null;
};

const getNumericLocatorText = async (page: Page, selector: string) =>
  Number.parseInt(await page.locator(selector).innerText(), 10);

const saveCurrentBrainToLibrary = async (page: Page, name: string) => {
  await page.locator(selectors.brainLibrarySaveName).fill(name);
  const saveButton = page.locator(selectors.brainLibrarySaveCurrent);
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click({ force: true });
  await expect(page.locator(selectors.brainLibraryList)).toContainText(name);
};

const ensureGraphEditorVisible = async (page: Page) => {
  const topologyEditor = page.locator(selectors.topologyEditor);
  if (await topologyEditor.isVisible().catch(() => false)) {
    return;
  }

  await page.locator(selectors.editorTabGraph).evaluate((tab: HTMLElement) => tab.click());
  await expect(topologyEditor).toBeVisible();
};

test.beforeEach(async ({ page }, testInfo) => {
  installStartupDiagnostics(page);
  setDiagnosticsExpectation(page, 'none');

  if (isDegradedRendererProject(testInfo)) {
    await disableWebGLContexts(page);
  }

  await page.goto('/');
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'skipped') {
    return;
  }

  await flushTeardownDiagnostics(page);

  if (getDiagnosticsExpectation(page) === 'expected-render-init-errors') {
    await expectOnlyExpectedRenderInitErrors(page);
    return;
  }

  await expectNoUnhandledStartupErrors(page);
});

test('startup initializes a visible simulation canvas without runtime errors', async ({ page }, testInfo) => {
  test.skip(isDegradedRendererProject(testInfo), 'This assertion targets the standard renderer path.');

  await expect(getRenderOutcome(page)).resolves.toBe('ready');
  await expectReadyCanvas(page);
  await expectNoUnhandledStartupErrors(page);
});

test('degraded renderer path falls back cleanly or surfaces an explicit render error', async ({ page }, testInfo) => {
  test.skip(!isDegradedRendererProject(testInfo), 'This assertion targets the degraded renderer path only.');

  const outcome = await getRenderOutcome(page);
  if (outcome === 'ready') {
    const actualCanvas = await expectReadyCanvas(page);
    const contextKinds = await actualCanvas.evaluate((canvas) => ({
      has2d: Boolean(canvas.getContext('2d')),
      hasWebgl: Boolean(canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl'))
    }));

    expect(contextKinds.has2d).toBe(true);
    expect(contextKinds.hasWebgl).toBe(false);

    await expect(page.locator(selectors.runState)).toHaveText('idle');
    await expect(page.locator(selectors.startPauseButton)).toBeVisible();
    await page.locator(selectors.startPauseButton).click();
    await expect(page.locator(selectors.runState)).toHaveText('running');
    await page.locator(selectors.startPauseButton).click();
    await expect(page.locator(selectors.runState)).toHaveText('paused');
    return;
  }

  setDiagnosticsExpectation(page, 'expected-render-init-errors');
  await expectDegradedRenderErrorUI(page);
});

test('simulation lifecycle controls update visible run state', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  const initialEngineInstanceId = await page.locator(selectors.simulationCanvas).getAttribute('data-engine-instance-id');
  await expect(page.locator(selectors.runState)).toHaveText('idle');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute(
    'data-engine-instance-id',
    initialEngineInstanceId ?? '1'
  );
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.resetButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('idle');
  await expect(page.locator('[data-testid="fps-value"]')).toHaveText('0.0');
});

test('start pause control can be toggled from the keyboard when the button is focused', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  const startPauseButton = page.locator(selectors.startPauseButton);

  await startPauseButton.focus();
  await expect(startPauseButton).toBeFocused();
  await expect(page.locator(selectors.runState)).toHaveText('idle');

  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await expect(startPauseButton).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await expect(startPauseButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(selectors.runState)).toHaveText('running');
});

test('space toggles simulation lifecycle globally but is ignored in editable controls', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await expect(page.locator(selectors.runState)).toHaveText('idle');

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.keyboardInputPanel)).toBeVisible();
  await page.locator(selectors.keyboardInputPanel).click();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await page.locator(selectors.settingsNavAgentParameters).click();
  await expect(page.locator(selectors.agentParamsPanel)).toBeVisible();
  await page.locator(selectors.visionCellsInput).focus();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');
});

test('space does not toggle simulation lifecycle while the brain library modal is open', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await expect(page.locator(selectors.runState)).toHaveText('idle');
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');
});

test('reset keeps the existing renderer instance interactive and restartable', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  const engine = page.locator(selectors.simulationCanvas);
  const initialEngineInstanceId = await engine.getAttribute('data-engine-instance-id');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.resetButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('idle');
  await expect(page.locator('[data-testid="fps-value"]')).toHaveText('0.0');
  await expect(engine).toHaveAttribute('data-engine-ready', 'true');
  await expect(engine).toHaveAttribute('data-engine-instance-id', initialEngineInstanceId ?? '1');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');
});

test('settings page persists applied agent parameter values and supports reset defaults', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsPanel)).toBeVisible();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('agent-parameters');
  await expect(page.locator(selectors.agentParamsPanel)).toBeVisible();

  await page.locator(selectors.visionCellsInput).fill('24');
  await page.locator(selectors.visionRangeInput).fill('300');
  await page.locator(selectors.visionAngleInput).fill('90');
  await page.locator(selectors.paramsApply).click();

  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
  await expect(page.locator(selectors.visionRangeValue)).toHaveText('300');
  await expect(page.locator(selectors.visionAngleValue)).toHaveText('90');

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsNavAgentParameters)).toBeVisible();
  await expect(page.locator(selectors.visionCellsInput)).toHaveValue('24');
  await expect(page.locator(selectors.visionRangeInput)).toHaveValue('300');
  await expect(page.locator(selectors.visionAngleInput)).toHaveValue('90');

  await page.locator(selectors.paramsResetDefaults).click();
  await expect(page.locator(selectors.visionCellsInput)).toHaveValue('36');
  await expect(page.locator(selectors.visionRangeInput)).toHaveValue('250');
  await expect(page.locator(selectors.visionAngleInput)).toHaveValue('120');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('36');
  await expect(page.locator(selectors.visionRangeValue)).toHaveText('250');
  await expect(page.locator(selectors.visionAngleValue)).toHaveText('120');
});

test('body ir settings shows preview panel, surfaces validation after rule edits, and clears it after repair', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsPanel)).toBeVisible();
  await page.locator(selectors.settingsNavBodyIr).click();

  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('body-ir');
  await expect(page.locator(selectors.bodyIrSettingsPanel)).toBeVisible();
  await expect(page.locator(selectors.bodyIrPreviewPanel)).toBeVisible();
  await expect(page.locator(selectors.bodyIrPreviewPanel)).toContainText('Preview / Validation');
  await expect(page.locator(selectors.bodyIrPreviewPanel)).toContainText('输入 endpoint 108 个，输出 endpoint 3 个。');
  await expect(page.locator('[data-testid="body-ir-input-preview-item-0"]')).toBeVisible();
  await expect(page.locator('[data-testid="body-ir-input-preview-item-0"]')).toContainText('vision-B-0');
  await expect(page.locator('[data-testid="body-ir-output-preview-item-0"]')).toBeVisible();
  await expect(page.locator('[data-testid="body-ir-output-preview-item-0"]')).toContainText('output-move-forward');
  await expect(page.locator(selectors.bodyIrValidationCount)).toHaveText('0');

  await expect(page.locator(selectors.bodyIrInputRulePattern0)).toHaveValue('^vision-([RGB])-(\\d+)$');
  await page.locator(selectors.bodyIrOutputRuleTargetTemplate0).fill('unsupported.$1');

  await expect(page.locator(selectors.bodyIrValidationCount)).not.toHaveText('0');
  await expect(page.locator('[data-testid^="body-ir-output-rule-message-0-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="body-ir-output-rule-message-0-"]').first()).toContainText('unsupported target');

  await page.locator(selectors.bodyIrOutputRuleTargetTemplate0).fill('action.$1');

  await expect(page.locator(selectors.bodyIrValidationCount)).toHaveText('0');
  await expect(page.locator('[data-testid^="body-ir-output-rule-message-0-"]')).toHaveCount(0);
  await expect(page.locator(selectors.bodyIrOutputRuleTargetTemplate0)).toHaveValue('action.$1');
});

test('body ir edits stay draft-only until apply, then affect runtime/install state', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsPanel)).toBeVisible();
  await page.locator(selectors.settingsNavBodyIr).click();

  const runtimeInputCountBefore = await page.locator(selectors.topologyRuntimeInputCount).innerText();
  const runtimeStateBefore = await page.locator(selectors.topologyRuntimeState).innerText();

  await page.locator(selectors.bodyIrOutputRuleTargetTemplate0).fill('thruster.$1');
  await expect(page.locator(selectors.bodyIrValidationCount)).not.toHaveText('0');
  await expect(page.locator('[data-testid^="body-ir-output-rule-message-0-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="body-ir-apply"]')).toBeEnabled();
  await expect(page.locator('[data-testid="body-ir-reset"]')).toBeEnabled();
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText(runtimeStateBefore);
  await expect(page.locator(selectors.topologyRuntimeInputCount)).toHaveText(runtimeInputCountBefore);

  await page.locator('[data-testid="body-ir-reset"]').click();
  await expect(page.locator(selectors.bodyIrValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.bodyIrOutputRuleTargetTemplate0)).toHaveValue('action.$1');
  await expect(page.locator('[data-testid="body-ir-apply"]')).toBeDisabled();
  await expect(page.locator('[data-testid="body-ir-reset"]')).toBeDisabled();

  await page.locator(selectors.bodyIrOutputRuleTargetTemplate0).fill('thruster.$1');
  await expect(page.locator('[data-testid="body-ir-apply"]')).toBeEnabled();

  await page.locator('[data-testid="body-ir-apply"]').click();
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('invalid');
  await expect(page.locator(selectors.graphInstalledAgentId)).not.toHaveText('');
});

test('brain library refuses to save an invalid current brain instead of persisting corrupt library data', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsPanel)).toBeVisible();
  await page.locator(selectors.settingsNavBodyIr).click();
  await expect(page.locator(selectors.bodyIrSettingsPanel)).toBeVisible();

  await page.locator(selectors.bodyIrOutputRuleTargetTemplate0).fill('thruster.$1');
  await expect(page.locator(selectors.bodyIrValidationCount)).not.toHaveText('0');
  await page.locator('[data-testid="body-ir-apply"]').click();
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('invalid');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.locator(selectors.brainLibrarySaveName).fill('Invalid Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();

  await expect(page.locator(selectors.brainLibraryError)).toContainText('当前 AgentIR 无效');
  await expect(page.locator(selectors.brainLibraryList)).not.toContainText('Invalid Brain');
});

test('editor tabs switch between settings and graph view with settings sidebar navigation', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await expect(page.locator(selectors.editorTabValue)).toHaveText('graph');
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.editorTabValue)).toHaveText('settings');
  await expect(page.locator(selectors.settingsSidebar)).toBeVisible();
  await expect(page.locator(selectors.agentParamsPanel)).toBeVisible();

  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('keyboard-inputs');
  await expect(page.locator(selectors.keyboardInputPanel)).toBeVisible();

  await page.locator(selectors.settingsNavAgentParameters).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('agent-parameters');
  await expect(page.locator(selectors.agentParamsPanel)).toBeVisible();

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.editorTabValue)).toHaveText('graph');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('snn');
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();
});

test('brain library opens from the editor toolbar and saves the current IR to LocalStorage', async ({ page }, testInfo) => {
  test.slow();

  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.visionCellsInput).fill('24');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();

  await page.locator(selectors.brainLibrarySaveName).fill('E2E Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();
  await expect(page.locator(selectors.brainLibraryList)).toContainText('E2E Brain');
  await expect
    .poll(async () => {
      const [activeId, draftId] = await Promise.all([getActiveAgentId(page), getDraftAgentId(page)]);
      return activeId && draftId && activeId === draftId;
    })
    .toBe(true);

  const storedBrains = await page.evaluate((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    return ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []);
  }, BRAIN_LIBRARY_STORAGE_KEY);

  const storedBrain = storedBrains.find((brain) => brain.agent?.metadata?.name === 'E2E Brain');
  expect(storedBrain).toBeTruthy();
  expect(storedBrain?.agent?.metadata?.name).toBe('E2E Brain');
  expect(storedBrain?.agent?.metadata?.id).toBeTruthy();
  expect('metadata' in (storedBrain ?? {})).toBe(false);
  expect('packageVersion' in (storedBrain ?? {})).toBe(false);

  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeHidden();

  await page.locator(selectors.brainLibraryButton).click();
  page.once('dialog', async (dialog) => {
    throw new Error(`保存当前 Brain 后不应立即出现未保存确认，但收到: ${dialog.message()}`);
  });
  await getBrainLibrarySelectButton(page, storedBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');

  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeHidden();

  await page.locator(selectors.visionCellsInput).fill('36');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('36');

  await page.evaluate(({ storageKey, brain }) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        storageVersion: 1,
        savedAt: new Date().toISOString(),
        brains: [brain],
      })
    );
  }, { storageKey: BRAIN_LIBRARY_STORAGE_KEY, brain: storedBrain });
  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('36');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, storedBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
});

test('brain library manages saved items and reports import errors', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await page.locator(selectors.brainLibrarySaveName).fill('Manage Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();

  const savedBrainId = await page.evaluate((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    const brains = rawValue ? ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []) : [];
    return brains.find((brain) => brain.agent?.metadata?.name === 'Manage Brain')?.agent?.metadata?.id ?? '';
  }, BRAIN_LIBRARY_STORAGE_KEY);
  expect(savedBrainId).not.toBe('');

  await page.locator(`[data-testid="brain-library-rename-${savedBrainId}"]`).click();
  await page.locator(`[data-testid="brain-library-rename-input-${savedBrainId}"]`).fill('Renamed Brain');
  await page.locator(`[data-testid="brain-library-rename-save-${savedBrainId}"]`).click();
  await expect(page.locator(selectors.brainLibraryList)).toContainText('Renamed Brain');

  await page.locator(`[data-testid="brain-library-duplicate-${savedBrainId}"]`).click();
  await expect(page.locator(selectors.brainLibraryList)).toContainText('Renamed Brain 副本');

  const downloadPromise = page.waitForEvent('download');
  await page.locator(`[data-testid="brain-library-export-${savedBrainId}"]`).click();
  const downloadedBrain = JSON.parse(await (await downloadPromise).createReadStream().then(async (stream) => {
    if (!stream) {
      return '';
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
  })) as { version?: number; kind?: string; metadata?: { name?: string }; agent?: { metadata?: { name?: string } } };
  expect(downloadedBrain.version).toBe(1);
  expect(downloadedBrain.kind).toBe('neuralsoup-agent');
  expect(downloadedBrain.metadata).toBeUndefined();
  expect(downloadedBrain.agent?.metadata?.name).toBe('Renamed Brain');
  expect(downloadedBrain.agent?.metadata?.name).toBe('Renamed Brain');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator(`[data-testid="brain-library-delete-${savedBrainId}"]`).click();
  await expect
    .poll(async () =>
      page.evaluate(
        ({ storageKey, brainId }) => {
          const rawValue = window.localStorage.getItem(storageKey);
          const brains = rawValue ? ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []) : [];
          return brains.some((brain) => brain.agent?.metadata?.id === brainId);
        },
        { storageKey: BRAIN_LIBRARY_STORAGE_KEY, brainId: savedBrainId }
      )
    )
    .toBe(false);

  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name: 'renamed-brain.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(downloadedBrain)),
  });
  await expect(page.locator(selectors.brainLibraryList)).toContainText('Renamed Brain');

  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.locator(selectors.brainLibraryError)).toContainText('JSON 解析失败');
});

test('deleting the active brain resets the editor/runtime session instead of leaving an orphan active identity', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await page.locator(selectors.brainLibrarySaveName).fill('Delete Active Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();

  const savedBrainId = await page.evaluate((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    const brains = rawValue ? ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []) : [];
    return brains.find((brain) => brain.agent?.metadata?.name === 'Delete Active Brain')?.agent?.metadata?.id ?? '';
  }, BRAIN_LIBRARY_STORAGE_KEY);
  expect(savedBrainId).not.toBe('');

  await expect.poll(async () => getActiveBrainId(page)).toBe(savedBrainId);
  await expect.poll(async () => getActiveAgentId(page)).toBe(savedBrainId);
  await expect.poll(async () => getDraftAgentId(page)).toBe(savedBrainId);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator(`[data-testid="brain-library-delete-${savedBrainId}"]`).click();
  await expect
    .poll(async () =>
      page.evaluate(
        ({ storageKey, brainId }) => {
          const rawValue = window.localStorage.getItem(storageKey);
          const brains = rawValue ? ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []) : [];
          return brains.some((brain) => brain.agent?.metadata?.id === brainId);
        },
        { storageKey: BRAIN_LIBRARY_STORAGE_KEY, brainId: savedBrainId }
      )
    )
    .toBe(false);

  await expect.poll(async () => getActiveBrainId(page)).toBe(null);
  await expect.poll(async () => getActiveAgentId(page)).not.toBe(savedBrainId);
  await expect.poll(async () => getDraftAgentId(page)).not.toBe(savedBrainId);
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
});

test('renaming the active brain preserves draft-only edits instead of replacing the current draft snapshot', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await saveCurrentBrainToLibrary(page, 'Rename Active Brain');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const baseDraftConnectionCount = await getNumericLocatorText(page, selectors.topologyDraftConnectionCount);
  const baseRuntimeConnectionCount = await getNumericLocatorText(page, selectors.topologyRuntimeConnectionCount);
  await injectValidDraftOnly(page);

  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(baseDraftConnectionCount + 1));
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));

  const savedBrainId = await page.evaluate((storageKey) => {
    const rawValue = window.localStorage.getItem(storageKey);
    const brains = rawValue ? ((JSON.parse(rawValue) as { brains?: E2EStoredBrain[] }).brains ?? []) : [];
    return brains.find((brain) => brain.agent?.metadata?.name === 'Rename Active Brain')?.agent?.metadata?.id ?? '';
  }, BRAIN_LIBRARY_STORAGE_KEY);
  expect(savedBrainId).not.toBe('');

  await page.locator(selectors.brainLibraryButton).click();
  await page.locator(`[data-testid="brain-library-rename-${savedBrainId}"]`).click();
  await page.locator(`[data-testid="brain-library-rename-input-${savedBrainId}"]`).fill('Renamed Active Brain');
  await page.locator(`[data-testid="brain-library-rename-save-${savedBrainId}"]`).click();
  await expect(page.locator(selectors.brainLibraryList)).toContainText('Renamed Active Brain');
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(baseDraftConnectionCount + 1));
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));
  await expect
    .poll(async () => {
      const [activeAgentId, activeBrainId, draftId] = await Promise.all([
        getActiveAgentId(page),
        getActiveBrainId(page),
        getDraftAgentId(page),
      ]);
      return Boolean(activeAgentId && activeBrainId && draftId && activeAgentId === activeBrainId && activeBrainId === draftId);
    })
    .toBe(true);
});

test('brain library recovers from corrupted LocalStorage payloads', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate((storageKey) => {
    window.localStorage.setItem(storageKey, '{broken');
  }, BRAIN_LIBRARY_STORAGE_KEY);
  await page.reload();

  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryStatusMessage)).toContainText('已隔离损坏数据');
  await expect(page.locator(selectors.brainLibraryList)).toContainText('暂无已保存 Brain');
  await expect
    .poll(async () =>
      page.evaluate(() => Boolean(window.localStorage.getItem('neuralsoup.brain-library.v1.corrupt')))
    )
    .toBe(true);
  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }
  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryStatusMessage)).toContainText('已隔离损坏数据');
});

test('brain library asks before replacing an unsaved current Brain', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await page.locator(selectors.brainLibrarySaveName).fill('Saved Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();
  await page.locator(selectors.brainLibraryClose).click();

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();

  const savedBrain = await getStoredBrainByName(page, 'Saved Brain');
  expect(savedBrain).toBeTruthy();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('尚未保存');
    await dialog.dismiss();
  });
  await getBrainLibrarySelectButton(page, savedBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.editorTabValue)).toHaveText('graph');
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
});

test('brain switch resets lifecycle stats and runtime activity before installing the selected Brain', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await page.locator(selectors.brainLibrarySaveName).fill('Switch Brain');
  await page.locator(selectors.brainLibrarySaveCurrent).click();
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');
  await expect
    .poll(async () => Number.parseInt(await page.locator('[data-testid="topology-runtime-active-node-count"]').innerText(), 10))
    .toBeGreaterThan(0);

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.brainLibraryButton).click();
  const switchBrain = await getStoredBrainByName(page, 'Switch Brain');
  expect(switchBrain).toBeTruthy();
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, switchBrain!.agent.metadata!.id!).click();

  await expect(page.locator(selectors.runState)).toHaveText('idle');
  await expect(page.locator('[data-testid="fps-value"]')).toHaveText('0.0');
  await expect(page.locator('[data-testid="topology-runtime-active-node-count"]')).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
});

test('brain switch resets graph view path to root and replaces prior scoped session state', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await saveCurrentBrainToLibrary(page, 'Graph Reset Brain');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root', 'root-container']);

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root', 'root-container']);

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const graphResetBrain = await getStoredBrainByName(page, 'Graph Reset Brain');
  expect(graphResetBrain).toBeTruthy();
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, graphResetBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root']);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
});

test('brain library preserves draft-only expanded group state across later saved edits', async ({ page }, testInfo) => {
  test.slow();

  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await rightClickAt(page, await getLocatorCenter(page, selectors.coreGroupNode));
  await expect(page.locator(selectors.topologyContextToggleGroup)).toHaveText('展开');
  await page.locator(selectors.topologyContextToggleGroup).click();
  await expect(page.locator(selectors.coreGroupNode)).toHaveClass(/is-expanded/);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await saveCurrentBrainToLibrary(page, 'Draft Layout Brain');
  await page.locator(selectors.brainLibraryClose).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.visionRangeInput).fill('320');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionRangeValue)).toHaveText('320');

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const draftLayoutBrain = await getStoredBrainByName(page, 'Draft Layout Brain');
  expect(draftLayoutBrain).toBeTruthy();
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, draftLayoutBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.locator(selectors.brainLibraryClose).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.coreGroupNode)).toHaveClass(/is-expanded/);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
});

test('brain library confirms before replacing a saved brain with draft-only changes on switch or import', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await saveCurrentBrainToLibrary(page, 'Saved Brain');
  await saveCurrentBrainToLibrary(page, 'Other Brain');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const baseDraftConnectionCount = await getNumericLocatorText(page, selectors.topologyDraftConnectionCount);
  const baseRuntimeConnectionCount = await getNumericLocatorText(page, selectors.topologyRuntimeConnectionCount);
  expect(baseDraftConnectionCount).toBe(baseRuntimeConnectionCount);
  await injectValidDraftOnly(page);
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(
    String(baseDraftConnectionCount + 1)
  );
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const otherBrain = await getStoredBrainByName(page, 'Other Brain');
  expect(otherBrain).toBeTruthy();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未安装的草稿改动');
    await dialog.dismiss();
  });
  await getBrainLibrarySelectButton(page, otherBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(
    String(baseDraftConnectionCount + 1)
  );
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));

  const savedBrain = await getStoredBrainByName(page, 'Saved Brain');
  expect(savedBrain).toBeTruthy();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未安装的草稿改动');
    await dialog.dismiss();
  });
  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name: 'saved-brain.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        kind: 'neuralsoup-agent',
        agent: savedBrain?.agent,
      })
    ),
  });
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(
    String(baseDraftConnectionCount + 1)
  );
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未安装的草稿改动');
    await dialog.accept();
  });
  await getBrainLibrarySelectButton(page, otherBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(baseDraftConnectionCount));
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));
});

test('brain library also confirms when runtime install is behind current draft after an invalid semantic commit', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await saveCurrentBrainToLibrary(page, 'Runtime Diverged Brain');
  await saveCurrentBrainToLibrary(page, 'Runtime Diverged Target');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const installedAgentIdBefore = await page.locator(selectors.graphInstalledAgentId).innerText();
  const baseRuntimeConnectionCount = await getNumericLocatorText(page, selectors.topologyRuntimeConnectionCount);

  await injectInvalidGraphDraft(page);

  await expect(page.locator(selectors.topologyDraftState)).toHaveText('invalid');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.graphInstalledAgentId)).toHaveText(installedAgentIdBefore);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const targetBrain = await getStoredBrainByName(page, 'Runtime Diverged Target');
  expect(targetBrain).toBeTruthy();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未安装的草稿改动');
    await dialog.dismiss();
  });
  await getBrainLibrarySelectButton(page, targetBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await expect(page.locator(selectors.graphInstalledAgentId)).toHaveText(installedAgentIdBefore);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(baseRuntimeConnectionCount));
});

test('body-only draft changes trigger replacement confirmation and are included when saving current brain', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await saveCurrentBrainToLibrary(page, 'Body Draft Target');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavBodyIr).click();
  await page.locator('[data-testid="body-ir-output-rule-decay-0"]').fill('9');
  await expect(page.locator(selectors.bodyIrValidationCount)).toHaveText('0');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const targetBrain = await getStoredBrainByName(page, 'Body Draft Target');
  expect(targetBrain).toBeTruthy();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未安装的草稿改动');
    await dialog.dismiss();
  });
  await getBrainLibrarySelectButton(page, targetBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await expect(page.locator('[data-testid="body-ir-output-rule-decay-0"]')).toHaveValue('9');

  await saveCurrentBrainToLibrary(page, 'Body Draft Saved');
  const savedBodyDraftBrain = await getStoredBrainByName(page, 'Body Draft Saved');
  expect(savedBodyDraftBrain?.agent.body?.outputRules?.[0]?.decayPerSecond).toBe(9);
});

test('body ir visionCellCount apply keeps runtime vision parameters aligned', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavBodyIr).click();
  await expect(page.locator(selectors.bodyIrSettingsPanel)).toBeVisible();

  await page.locator('[data-testid="body-ir-vision-cell-count"]').fill('24');
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('36');
  await page.locator('[data-testid="body-ir-apply"]').click();

  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
  await expect(page.locator(selectors.topologyRuntimeInputCount)).toHaveText('72');
});

test('brain import resets graph view path to root and installs the imported session identity', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root', 'root-container']);

  const importedAgent = createDefaultAgentIR(24);
  importedAgent.metadata.name = 'Imported Reset Brain';

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name: 'imported-reset-brain.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        kind: 'neuralsoup-agent',
        agent: importedAgent,
      })
    ),
  });
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root']);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
  await expect.poll(async () => getActiveBrainId(page)).toBe(importedAgent.metadata.id);
  await expect.poll(async () => getActiveAgentId(page)).toBe(importedAgent.metadata.id);
});

test('applying agent parameters persists the current brain library layout instead of reverting to an older snapshot', async ({ page }, testInfo) => {
  test.slow();

  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  const rootContainerViewId = await getNodeViewId(page, selectors.coreGroupNode);
  const initialPosition = await getNodeViewPositionFromSummary(page, rootContainerViewId);
  const nodeCenter = await getLocatorCenter(page, selectors.coreGroupNode);
  await dragOnCanvas(page, nodeCenter, {
    x: nodeCenter.x + 92,
    y: nodeCenter.y + 44,
  });

  await expect
    .poll(() => getNodeViewPositionFromSummary(page, rootContainerViewId))
    .toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

  const movedPosition = await getNodeViewPositionFromSummary(page, rootContainerViewId);
  expect(movedPosition.x !== initialPosition.x || movedPosition.y !== initialPosition.y).toBe(true);

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await saveCurrentBrainToLibrary(page, 'Applied Params Brain');
  await page.locator(selectors.brainLibraryClose).click();

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.visionCellsInput).fill('24');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  const appliedParamsBrain = await getStoredBrainByName(page, 'Applied Params Brain');
  expect(appliedParamsBrain).toBeTruthy();
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, appliedParamsBrain!.agent.metadata!.id!).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.locator(selectors.brainLibraryClose).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await ensureGraphEditorVisible(page);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
  await expect(page.locator(selectors.topologyBreadcrumbRoot)).toBeVisible();
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
  const restoredPosition = await getNodeViewPositionFromSummary(page, rootContainerViewId);
  expect(restoredPosition.x).toBe(movedPosition.x);
  expect(restoredPosition.y).toBe(movedPosition.y);

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.editorTabValue)).toHaveText('settings');
  await expect(page.locator(selectors.agentParamsPanel)).toBeVisible();
  await expect(page.locator(selectors.visionCellsInput)).toHaveValue('24');
});

test('settings and graph tabs preserve sidebar and graph state across switches', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect.poll(async () => Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10)).toBeGreaterThan(3);

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('keyboard-inputs');

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyBreadcrumbRoot)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  await page.locator(selectors.editorTabSettings).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('keyboard-inputs');
  await expect(page.locator(selectors.keyboardInputPanel)).toBeVisible();
});

test('graph view shows the root container and supports hierarchical navigation without proxy nodes', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
  await expect(page.locator(selectors.inputAdapterNode)).toBeVisible();
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
  await expect(page.locator(selectors.outputAdapterNode)).toBeVisible();

  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('4');
  await expect(page.locator(selectors.topologyBreadcrumbRoot)).toBeVisible();
  await expect(page.locator(selectors.coreInputAdapterNode)).toBeVisible();
  await expect(page.locator(selectors.coreOutputAdapterNode)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator('[data-testid^="topology-node-proxy:"]')).toHaveCount(0);

  await page.locator(selectors.topologyBreadcrumbRoot).click();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
});

test('graph view syncs runtime active nodes from simulator hooks into visible highlight state', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.startPauseButton).click();

  await expect
    .poll(async () => {
      const activeNodeIds = await getRuntimeActiveNodeIds(page);
      return activeNodeIds.length;
    })
    .toBeGreaterThan(0);

  await expect
    .poll(async () => Number.parseInt(await page.locator('[data-testid="topology-runtime-active-node-count"]').innerText(), 10))
    .toBeGreaterThan(0);

  await expect
    .poll(async () => page.locator('.topology-node.is-active').count())
    .toBeGreaterThan(0);
});

test('graph view preserves active highlight when dragging a node after runtime activity is observed', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.startPauseButton).click();

  await expect
    .poll(async () => {
      const activeNode = page.locator('.topology-node.is-active').first();
      const testId = await activeNode.getAttribute('data-testid').catch(() => null);
      return testId ?? '';
    })
    .not.toEqual('');

  const activeNodeTestId =
    (await page.locator('.topology-node.is-active').first().getAttribute('data-testid')) ?? '';

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  const activeNode = page.locator(`[data-testid="${activeNodeTestId}"]`);
  await expect(activeNode).toHaveClass(/is-active/);

  const beforeDrag = await activeNode.boundingBox();
  if (!beforeDrag) {
    throw new Error(`Bounding box not available for ${activeNodeTestId}`);
  }

  await activeNode.hover();
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 48, beforeDrag.y + 24, { steps: 10 });
  await page.mouse.up();

  await expect(activeNode).toHaveClass(/is-active/);
});

test('graph view edits leaf params and leaf link weights through Graph IR inspectors', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const runtimeConnectionCount = await getNumericLocatorText(page, selectors.topologyRuntimeConnectionCount);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(runtimeConnectionCount));

  await doubleClickNode(page, selectors.nodeNeuronOne);
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.neuronLabelInput).fill('已编辑神经元');
  await page.locator(selectors.neuronInitialStateVInput).fill('-62');
  await page.locator(selectors.neuronInitialStateUInput).fill('-11');
  await closeTopologyDetailModal(page);
  await doubleClickNode(page, selectors.nodeNeuronOne);
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await expect(page.locator(selectors.neuronLabelInput)).toHaveValue('已编辑神经元');
  await expect(page.locator(selectors.neuronInitialStateVInput)).toHaveValue('-62');
  await expect(page.locator(selectors.neuronInitialStateUInput)).toHaveValue('-11');
  await page.locator(selectors.neuronInitialStateUInput).fill('');
  await closeTopologyDetailModal(page);
  await doubleClickNode(page, selectors.nodeNeuronOne);
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await expect(page.locator(selectors.neuronInitialStateVInput)).toHaveValue('-62');
  await expect(page.locator(selectors.neuronInitialStateUInput)).toHaveValue('');
  await closeTopologyDetailModal(page);

  const leafLink = getLeafLinkLocator(page, 'neuron-1', 'neuron-2');
  await expect(leafLink).toBeVisible();
  await leafLink.click();
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText('link-neuron-1-neuron-2');
  await doubleClickAtCenter(
    page,
    `[data-topology-link-from-node-id="neuron-1"][data-topology-link-to-node-id="neuron-2"]`
  );
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.connectionWeightInput).fill('1.25');
  await closeTopologyDetailModal(page);
  await expect(getLeafLinkLocator(page, 'neuron-1', 'neuron-2')).toContainText('1.25');
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(runtimeConnectionCount));
});

test('graph view diagnostics keep draft and installed runtime summaries aligned after valid edits', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const initialDraftInputCount = await page.locator(selectors.topologyDraftInputCount).innerText();
  const initialDraftOutputCount = await page.locator(selectors.topologyDraftOutputCount).innerText();
  const initialDraftNeuronCount = await page.locator(selectors.topologyDraftNeuronCount).innerText();

  await expect(page.locator(selectors.topologyInputCount)).toHaveText(initialDraftInputCount);
  await expect(page.locator(selectors.topologyRuntimeInputCount)).toHaveText(initialDraftInputCount);
  await expect(page.locator(selectors.topologyOutputCount)).toHaveText(initialDraftOutputCount);
  await expect(page.locator(selectors.topologyRuntimeOutputCount)).toHaveText(initialDraftOutputCount);
  await expect(page.locator(selectors.topologyRuntimeNeuronCount)).toHaveText(initialDraftNeuronCount);
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT));
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT));
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');

  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT));
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT));
  await expect(page.locator(selectors.topologyRuntimeInputCount)).toHaveText(initialDraftInputCount);
  await expect(page.locator(selectors.topologyRuntimeOutputCount)).toHaveText(initialDraftOutputCount);
  await expect(page.locator(selectors.topologyRuntimeNeuronCount)).toHaveText(initialDraftNeuronCount);
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
});

test('graph view diagnostics keep valid draft counts distinct from installed runtime until runtime installs them', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const baseDraftConnectionCount = await page.locator(selectors.topologyDraftConnectionCount).innerText();
  const baseRuntimeConnectionCount = await page.locator(selectors.topologyRuntimeConnectionCount).innerText();

  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(baseDraftConnectionCount);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);

  await injectValidDraftOnly(page);

  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(
    String(Number.parseInt(baseDraftConnectionCount, 10) + 1)
  );
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);
  await expect.poll(() => getRuntimeDiagnostics(page)).toEqual({
    state: 'applied',
    validationCount: '0'
  });
});

test('graph view supports creating a leaf link and keeps state across tab switches', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const baseRuntimeConnectionCount = await page.locator(selectors.topologyRuntimeConnectionCount).innerText();
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);
  const canvasBox = await getCanvasBox(page);
  const createPoint = { x: canvasBox.x + 300, y: canvasBox.y + 220 };
  await page.mouse.move(createPoint.x, createPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextNewNeuron).click();

  const newNeuronSelector = '[data-testid="topology-node-neuron-3"]';
  await expect(page.locator(newNeuronSelector)).toBeVisible();
  await rightDragBetweenNodes(page, selectors.nodeNeuronOne, newNeuronSelector);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-neuron-1-neuron-3-/);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(
    String(Number.parseInt(baseRuntimeConnectionCount, 10) + 1)
  );

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('keyboard-inputs');

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(newNeuronSelector)).toBeVisible();
  await expect(page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-neuron-1-neuron-3-/);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(
    String(Number.parseInt(baseRuntimeConnectionCount, 10) + 1)
  );
});

test('graph view routes link-covered left-drag through canvas gestures without losing link selection or detail', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const canvasBox = await getCanvasBox(page);
  const createPoint = { x: canvasBox.x + 300, y: canvasBox.y + 220 };
  await page.mouse.move(createPoint.x, createPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextNewNeuron).click();

  const newNeuronSelector = '[data-testid="topology-node-neuron-3"]';
  await expect(page.locator(newNeuronSelector)).toBeVisible();
  await rightDragBetweenNodes(page, selectors.nodeNeuronOne, newNeuronSelector);

  const linkSelector = '[data-testid^="topology-link-link-neuron-1-neuron-3-"]';
  const linkLocator = page.locator(linkSelector).first();
  await expect(linkLocator).toBeVisible();

  const linkBox = await linkLocator.boundingBox();
  if (!linkBox) {
    throw new Error('Link bounding box not available');
  }

  const dragStart = {
    x: linkBox.x + linkBox.width / 2,
    y: linkBox.y + linkBox.height / 2,
  };
  const dragEnd = {
    x: dragStart.x + 80,
    y: dragStart.y + 80,
  };

  await dragOnCanvas(page, dragStart, dragEnd);

  await expect(page.locator(selectors.topologySelectedLink)).toHaveText('none');
  await expect(page.locator('.topology-marquee')).toHaveCount(0);

  await doubleClickAtCenter(page, linkSelector);
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await expect(page.locator(selectors.connectionWeightInput)).toBeVisible();
  await closeTopologyDetailModal(page);
});

test('graph view blocks duplicate local links and keeps external nodes out of the current canvas', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT));

  const canvasBox = await getCanvasBox(page);
  const createPoint = { x: canvasBox.x + 300, y: canvasBox.y + 220 };
  await page.mouse.move(createPoint.x, createPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextNewNeuron).click();

  const newNeuronSelector = '[data-testid="topology-node-neuron-3"]';
  await expect(page.locator(newNeuronSelector)).toBeVisible();

  await rightDragBetweenNodes(page, selectors.nodeNeuronOne, newNeuronSelector);
  await expect(page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT + 1));

  await rightDragBetweenNodes(page, selectors.nodeNeuronOne, newNeuronSelector);
  await expect(page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-neuron-1-neuron-3-/);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(String(DEFAULT_AGENT_CONNECTION_COUNT + 1));

  await expect(page.locator('[data-testid^="topology-node-proxy:"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="topology-link-link-vision-R-0-output-move-forward-"]')).toHaveCount(0);
});

test('graph view supports wheel zoom and clears transient drag or marquee state reliably', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const canvasBox = await getCanvasBox(page);
  const initialScale = await page.locator(selectors.topologyCanvasScale).innerText();

  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -120);

  await expect(page.locator(selectors.topologyCanvasScale)).not.toHaveText(initialScale);

  await dragOnCanvas(
    page,
    { x: canvasBox.x + 40, y: canvasBox.y + 40 },
    { x: canvasBox.x + 180, y: canvasBox.y + 160 }
  );
  await expect(page.locator('.topology-marquee')).toHaveCount(0);

  const beforeMove = await getLocatorCenter(page, selectors.nodeNeuronOne);
  await dragOnCanvas(
      page,
      beforeMove,
      { x: beforeMove.x + 48, y: beforeMove.y + 24 }
  );

  await expect
    .poll(async () => {
      const afterMove = await getLocatorCenter(page, selectors.nodeNeuronOne);
      return Math.abs(afterMove.x - beforeMove.x) + Math.abs(afterMove.y - beforeMove.y);
    })
    .toBeGreaterThan(0);

  const settledAfterMove = await getLocatorCenter(page, selectors.nodeNeuronOne);
  await page.mouse.move(settledAfterMove.x + 80, settledAfterMove.y + 80, { steps: 8 });
  await page.waitForTimeout(50);
  const afterRelease = await getLocatorCenter(page, selectors.nodeNeuronOne);
  expect(Math.abs(afterRelease.x - settledAfterMove.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterRelease.y - settledAfterMove.y)).toBeLessThanOrEqual(1);
});

test('graph view diagnostics expose invalid draft divergence through the real draft editing path', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  const installedAgentIdBefore = await page.locator(selectors.graphInstalledAgentId).innerText();
  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const baseDraftConnectionCount = await page.locator(selectors.topologyDraftConnectionCount).innerText();
  const baseRuntimeConnectionCount = await page.locator(selectors.topologyRuntimeConnectionCount).innerText();

  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyDraftState)).toHaveText('structurally-valid');
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(baseDraftConnectionCount);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);

  await injectInvalidGraphDraft(page);

  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(String(Number.parseInt(baseDraftConnectionCount, 10) + 1));
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('1');
  await expect(page.locator(selectors.topologyValidationCount)).toHaveText('1');
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);
  await expect.poll(() => getDraftDiagnostics(page).then((value) => value.state)).toBe('invalid');
  await expect.poll(() => getDraftDiagnostics(page).then((value) => value.validationCount)).toBe('1');
  await expect
    .poll(() => getDraftDiagnostics(page).then((value) => value.message))
    .toContain('cannot start from bodyOutput');
  await expect
    .poll(() => getRuntimeDiagnostics(page))
    .toEqual({
      state: 'applied',
      validationCount: '0'
    });
  await expect(page.locator(selectors.graphInstalledAgentId)).toHaveText(installedAgentIdBefore);

  await page.reload();
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }
  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.topologyDraftConnectionCount)).toHaveText(baseRuntimeConnectionCount);
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(baseRuntimeConnectionCount);
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
});

test('graph view boundary aggregate links are inspectable but remain read-only', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const aggregateLink = page.locator('[data-testid^="topology-link-aggregate:"]').first();
  await expect(aggregateLink).toBeVisible();
  const runtimeConnectionCount = await page.locator(selectors.topologyRuntimeConnectionCount).innerText();

  await doubleClickAtCenter(page, '[data-testid^="topology-link-aggregate:"]');
  await expect(page.locator(selectors.aggregateLinkDetail)).toBeVisible();
  await expect(page.locator(selectors.aggregateLinkReadonly)).toHaveText('只读摘要链路');
  await expect(page.locator(selectors.aggregateLinkCount)).not.toHaveText('0');

  await page.keyboard.press('Delete');
  await expect(page.locator(selectors.topologyRuntimeConnectionCount)).toHaveText(runtimeConnectionCount);
  await expect(page.locator(selectors.aggregateLinkDetail)).toHaveCount(0);
});

test('graph view keyboard interactions remain safe after event hook removal', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  await doubleClickNode(page, selectors.nodeNeuronOne);
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.neuronLabelInput).focus();
  await page.keyboard.press('Backspace');
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(1);
  await page.locator(selectors.topologyDetailClose).focus();
  await page.keyboard.press('Backspace');
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator(selectors.topologyDetailModal)).toHaveCount(0);

  await beginRightLinkFromNode(page, selectors.nodeNeuronOne);
  await expect(page.locator(selectors.topologyPendingLink)).toBeVisible();
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page.locator(selectors.topologyPendingLink)).toHaveCount(0);

  await page.locator(selectors.nodeNeuronOne).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await page.keyboard.press('Backspace');
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('0');

  const canvasBox = await getCanvasBox(page);
  await page.locator(selectors.topologyCanvas).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('0');
});

test('graph view uses the real narrow-screen container size and keeps hierarchical nodes usable', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  const viewportBox = await page.locator(selectors.topologyViewport).boundingBox();
  const canvasBox = await getCanvasBox(page);
  if (!viewportBox) {
    throw new Error('Topology viewport bounding box not available');
  }

  expect(Math.abs(canvasBox.width - viewportBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasBox.height - viewportBox.height)).toBeLessThanOrEqual(1);
  expect(canvasBox.width).toBeLessThan(500);

  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await page.locator(selectors.nodeNeuronOne).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
});

test('graph view canvas resizes with its viewport after window size changes', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  const expectCanvasMatchesViewport = async () => {
    const viewportBox = await page.locator(selectors.topologyViewport).boundingBox();
    const canvasBox = await getCanvasBox(page);
    if (!viewportBox) {
      throw new Error('Topology viewport bounding box not available');
    }

    expect(Math.round(canvasBox.width)).toBe(Math.round(viewportBox.width));
    expect(Math.round(canvasBox.height)).toBe(Math.round(viewportBox.height));
  };

  await expectCanvasMatchesViewport();

  await page.setViewportSize({ width: 1280, height: 720 });
  await expectCanvasMatchesViewport();

  await page.setViewportSize({ width: 420, height: 900 });
  await expectCanvasMatchesViewport();
});

test('graph view keeps the same scene focus after viewport resize', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const canvasBox = await getCanvasBox(page);
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 80);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 140, { steps: 16 });
  await page.mouse.up({ button: 'right' });

  const getRelativeNodePosition = async () => {
    const nodeCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
    const nextCanvasBox = await getCanvasBox(page);
    return {
      x: nodeCenter.x - (nextCanvasBox.x + nextCanvasBox.width / 2),
      y: nodeCenter.y - (nextCanvasBox.y + nextCanvasBox.height / 2),
    };
  };

  const initialViewport = page.viewportSize();
  if (!initialViewport) {
    throw new Error('Viewport size not available');
  }

  const beforeResizeRelative = await getRelativeNodePosition();
  const beforeResizeOffset = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());

  await page.setViewportSize({ width: 1280, height: 720 });

  const afterResizeRelative = await getRelativeNodePosition();
  const afterResizeOffset = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());

  expect(afterResizeOffset.x - beforeResizeOffset.x).toBeCloseTo((1280 - initialViewport.width) / 2, 0);
  expect(afterResizeOffset.y - beforeResizeOffset.y).toBeCloseTo((720 - initialViewport.height) / 2, 0);
  expect(Math.abs(afterResizeRelative.x - beforeResizeRelative.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterResizeRelative.y - beforeResizeRelative.y)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 420, height: 900 });

  const finalRelative = await getRelativeNodePosition();
  expect(Math.abs(finalRelative.x - beforeResizeRelative.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(finalRelative.y - beforeResizeRelative.y)).toBeLessThanOrEqual(1);
});

test('graph view preserves per-scope viewport when navigating away and back', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const canvasBox = await getCanvasBox(page);
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 80);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 140, { steps: 16 });
  await page.mouse.up({ button: 'right' });

  const childOffset = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());

  await page.locator(selectors.topologyBreadcrumbRoot).click();
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();

  const rootOffset = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  expect(Math.abs(rootOffset.x - childOffset.x) > 1 || Math.abs(rootOffset.y - childOffset.y) > 1).toBe(true);

  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const restoredChildOffset = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  expect(restoredChildOffset.x).toBeCloseTo(childOffset.x, 0);
  expect(restoredChildOffset.y).toBeCloseTo(childOffset.y, 0);
});

test('graph view opens canvas context menu and creates a neuron from it', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const beforeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);
  const canvasBox = await getCanvasBox(page);
  const point = { x: canvasBox.x + canvasBox.width - 80, y: canvasBox.y + 80 };

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x + 1, point.y + 1);
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();

  await page.locator(selectors.topologyContextNewNeuron).click();
  await expect(page.locator(selectors.topologyContextMenu)).toHaveCount(0);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeCount + 1));
});

test('graph view opens canvas context menu and creates an empty group from it', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const beforeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);
  const canvasBox = await getCanvasBox(page);
  const point = { x: canvasBox.x + canvasBox.width - 96, y: canvasBox.y + 132 };

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x + 1, point.y + 1);
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await expect(page.locator(selectors.topologyContextNewGroup)).toBeVisible();

  await page.locator(selectors.topologyContextNewGroup).click();
  await expect(page.locator(selectors.topologyContextMenu)).toHaveCount(0);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeCount + 1));
  await expect(page.locator('[data-testid^="topology-node-group-"]')).toHaveCount(1);
});

test('graph view opens a group context menu and ungroups it into the current level', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const canvasBox = await getCanvasBox(page);
  const point = { x: canvasBox.x + canvasBox.width - 96, y: canvasBox.y + 144 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x + 1, point.y + 1);
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextNewGroup).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);
  const beforeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);

  await page.locator(groupSelector).click();
  const groupCenter = await getLocatorCenter(page, groupSelector);
  await page.mouse.move(groupCenter.x, groupCenter.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });

  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await expect(page.locator(selectors.topologyContextUngroup)).toBeVisible();
  await page.locator(selectors.topologyContextUngroup).click();

  await expect(page.locator(selectors.topologyContextMenu)).toHaveCount(0);
  await expect(page.locator(groupSelector)).toHaveCount(0);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeCount - 1));
});

test('graph view opens selection context menu and aggregates selected nodes', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const nodeTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);
  await page.mouse.move(nodeTwoCenter.x, nodeTwoCenter.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();

  await page.locator(selectors.topologyContextAggregate).click();
  await expect(page.locator(selectors.topologyContextMenu)).toHaveCount(0);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator('[data-testid^="topology-node-group-"]')).toHaveCount(1);
});

test('graph view expands a group in place from a direct group context menu', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  const groupSelector = await aggregateDefaultNeuronsIntoGroup(page);
  await page.mouse.click(20, 20);
  await expandGroupInPlace(page, groupSelector);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  const expandedGroupBox = await getLocatorBox(page, groupSelector);
  const expandedNodeOneBox = await getLocatorBox(page, selectors.nodeNeuronOne);
  expect(expandedNodeOneBox.x).toBeGreaterThan(expandedGroupBox.x);
  expect(expandedNodeOneBox.y).toBeGreaterThan(expandedGroupBox.y);
  expect(expandedNodeOneBox.x + expandedNodeOneBox.width).toBeLessThan(expandedGroupBox.x + expandedGroupBox.width);
  expect(expandedNodeOneBox.y + expandedNodeOneBox.height).toBeLessThan(expandedGroupBox.y + expandedGroupBox.height);
});

test('graph view keeps expanded group child links editable and child deletion coherent', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  const groupSelector = await aggregateDefaultNeuronsIntoGroup(page);
  await expandGroupInPlace(page, groupSelector);

  const expandedChildLinkSelector = '[data-topology-link="true"]';
  const firstVisibleLink = page.locator(expandedChildLinkSelector).first();
  await expect(firstVisibleLink).toBeVisible();
  await firstVisibleLink.click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');

  await page.locator(selectors.nodeNeuronOne).click();
  await page.keyboard.press('Delete');
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
  await expect(page.locator('[data-topology-link-from-node-id*="neuron-1"]')).toHaveCount(0);
  await expect(page.locator('[data-topology-link-to-node-id*="neuron-1"]')).toHaveCount(0);
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();
});

test('graph view keeps multi-selection when dragging an already selected node', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const beforeOne = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const beforeTwo = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  await dragOnCanvas(
    page,
    beforeTwo,
    { x: beforeTwo.x + 56, y: beforeTwo.y + 28 }
  );

  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const afterOne = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const afterTwo = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  expect(Math.abs(afterOne.x - beforeOne.x)).toBeGreaterThan(10);
  expect(Math.abs(afterOne.y - beforeOne.y)).toBeGreaterThan(5);
  expect(Math.abs(afterTwo.x - beforeTwo.x)).toBeGreaterThan(10);
  expect(Math.abs(afterTwo.y - beforeTwo.y)).toBeGreaterThan(5);
});

test('graph view geometry hit-test prefers the visually topmost overlapping node', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  const nodeOneCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const nodeTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  await dragOnCanvas(page, nodeOneCenter, nodeTwoCenter);

  const overlappedNodeOneCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const overlappedNodeTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);
  expect(Math.abs(overlappedNodeOneCenter.x - overlappedNodeTwoCenter.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlappedNodeOneCenter.y - overlappedNodeTwoCenter.y)).toBeLessThanOrEqual(1);

  await dispatchCanvasMouseSequence(page, [
    { type: 'mousedown', x: overlappedNodeTwoCenter.x, y: overlappedNodeTwoCenter.y },
    { type: 'mouseup', x: overlappedNodeTwoCenter.x, y: overlappedNodeTwoCenter.y },
  ]);

  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator('[data-testid="topology-selected-node"]')).toHaveText('neuron-2');
});

test('graph view supports multi-select right-drag batch linking', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  const canvasBox = await getCanvasBox(page);
  const createPoint = { x: canvasBox.x + 300, y: canvasBox.y + 220 };
  await page.mouse.move(createPoint.x, createPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
  await page.locator(selectors.topologyContextNewNeuron).click();

  const newNeuronSelector = '[data-testid="topology-node-neuron-3"]';
  await expect(page.locator(newNeuronSelector)).toBeVisible();

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const targetBeforeOne = await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count();
  const targetBeforeTwo = await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count();
  await rightDragBetweenNodes(page, selectors.nodeNeuronTwo, newNeuronSelector);

  await expect
    .poll(async () => ({
      one: await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count(),
      two: await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count(),
    }))
    .toEqual({
      one: targetBeforeOne + 1,
      two: targetBeforeTwo + 1,
    });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).not.toHaveText('none');
});

test('graph view right-drag batch linking into empty canvas creates a new neuron target and connects to it', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const beforeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);
  const targetBeforeOne = await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count();
  const targetBeforeTwo = await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count();
  const nodeTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);
  const canvasBox = await getCanvasBox(page);
  const backgroundTarget = {
    x: canvasBox.x + canvasBox.width - 84,
    y: canvasBox.y + canvasBox.height - 92,
  };

  await dragOnCanvas(page, nodeTwoCenter, backgroundTarget, { button: 'right' });

  const newNeuronSelector = '[data-testid="topology-node-neuron-3"]';
  await expect(page.locator(newNeuronSelector)).toBeVisible();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeCount + 1));
  await expect
    .poll(async () => ({
      one: await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count(),
      two: await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count(),
    }))
    .toEqual({
      one: targetBeforeOne + 1,
      two: targetBeforeTwo + 1,
    });
});

test('graph view keeps additive drag selection in sync when shift-dragging an already selected node', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const beforeOne = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const beforeTwo = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  await page.keyboard.down('Shift');
  await dragOnCanvas(
    page,
    beforeTwo,
    { x: beforeTwo.x + 56, y: beforeTwo.y + 28 }
  );
  await page.keyboard.up('Shift');

  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');

  const afterOne = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const afterTwo = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  expect(Math.abs(afterOne.x - beforeOne.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterOne.y - beforeOne.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterTwo.x - beforeTwo.x)).toBeGreaterThan(10);
});

test('graph view supports wheel zoom, stable right-drag pan, clears marquee, and ends node drag on mouseup', async ({ page }, testInfo) => {
  test.slow();

  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const canvas = page.locator(selectors.topologyCanvas);
  const initialNeuronOneCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
  const initialNeuronTwoCenter = await getLocatorCenter(page, selectors.nodeNeuronTwo);

  const marqueeStart = {
    x: Math.max(initialNeuronOneCenter.x, initialNeuronTwoCenter.x) + 20,
    y: Math.max(initialNeuronOneCenter.y, initialNeuronTwoCenter.y) + 20,
  };
  const marqueeEnd = {
    x: Math.min(initialNeuronOneCenter.x, initialNeuronTwoCenter.x) - 20,
    y: Math.min(initialNeuronOneCenter.y, initialNeuronTwoCenter.y) - 20,
  };

  await page.mouse.move(marqueeStart.x, marqueeStart.y);
  await page.mouse.down();
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.topology-marquee')).toHaveCount(0);

  const canvasBox = await getCanvasBox(page);
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -120);
  await expect(page.locator('[data-testid="topology-canvas-scale"]')).toHaveText('1.20');
  await page.mouse.wheel(0, 120);
  await expect(page.locator('[data-testid="topology-canvas-scale"]')).toHaveText('1.00');

  const beforeDrag = await getNodeViewPositionFromSummary(page, 'neuron-1');
  const currentNeuronOneCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
  await dragOnCanvas(page, currentNeuronOneCenter, {
    x: currentNeuronOneCenter.x + 80,
    y: currentNeuronOneCenter.y + 50,
  });
  await expect.poll(() => getNodeViewPositionFromSummary(page, 'neuron-1')).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
  });
  const afterDrag = await getNodeViewPositionFromSummary(page, 'neuron-1');
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 30);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 10);

  const beforePan = parsePointPair(await page.locator('[data-testid="topology-canvas-offset"]').innerText());
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 80);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 140, { steps: 16 });
  await page.mouse.up({ button: 'right' });
  const afterPan = parsePointPair(await page.locator('[data-testid="topology-canvas-offset"]').innerText());
  expect(afterPan.x - beforePan.x).toBeGreaterThan(85);
  expect(afterPan.x - beforePan.x).toBeLessThan(115);
  expect(afterPan.y - beforePan.y).toBeGreaterThan(45);
  expect(afterPan.y - beforePan.y).toBeLessThan(75);

  await page.mouse.click(canvasBox.x + 12, canvasBox.y + canvasBox.height - 12);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('0');
});

test('graph view allows dragging a node beyond the current canvas bounds', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const beforeCenter = await getNodeCenterFromSummary(page, 'neuron-1');
  const canvasBox = await getCanvasBox(page);
  const dragTarget = {
    x: canvasBox.x + canvasBox.width + 180,
    y: canvasBox.y + canvasBox.height + 160,
  };

  await dragOnCanvas(page, await getLocatorCenter(page, selectors.nodeNeuronOne), dragTarget);

  await expect
    .poll(() => getNodeCenterFromSummary(page, 'neuron-1'))
    .toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

  const afterCenter = await getNodeCenterFromSummary(page, 'neuron-1');
  expect(afterCenter.x).toBeGreaterThan(beforeCenter.x + 180);
  expect(afterCenter.y).toBeGreaterThan(beforeCenter.y + 140);
});

test('graph view allows dragging a node beyond the current canvas bounds toward the top-left', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const beforePosition = await getNodeViewPositionFromSummary(page, 'neuron-1');
  const canvasBox = await getCanvasBox(page);
  const dragTarget = {
    x: canvasBox.x - 220,
    y: canvasBox.y - 180,
  };

  await dragOnCanvas(page, await getLocatorCenter(page, selectors.nodeNeuronOne), dragTarget);

  await expect
    .poll(() => getNodeViewPositionFromSummary(page, 'neuron-1'))
    .toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });

  const settledPosition = await getNodeViewPositionFromSummary(page, 'neuron-1');
  expect(settledPosition.x).toBeLessThan(beforePosition.x - 180);
  expect(settledPosition.y).toBeLessThan(beforePosition.y - 140);
});

test('graph view keeps context menu visible and actionable near the canvas edge', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const beforeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);
  const canvasBox = await getCanvasBox(page);
  const point = { x: canvasBox.x + canvasBox.width - 4, y: canvasBox.y + canvasBox.height - 4 };

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });

  const menuBox = await page.locator(selectors.topologyContextMenu).boundingBox();
  if (!menuBox) {
    throw new Error('Topology context menu bounding box not available');
  }

  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height);

  await page.locator(selectors.topologyContextNewNeuron).click();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeCount + 1));
});

test('graph view keeps group context menu visible near the canvas edge', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);

  const canvasBox = await getCanvasBox(page);
  const point = { x: canvasBox.x + canvasBox.width - 220, y: canvasBox.y + canvasBox.height - 132 };
  await rightClickAt(page, point);
  await expect(page.locator(selectors.topologyContextNewGroup)).toBeVisible();
  await page.locator(selectors.topologyContextNewGroup).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);
  const groupBox = await getLocatorBox(page, groupSelector);
  await rightClickAt(page, {
    x: groupBox.x + groupBox.width / 2,
    y: groupBox.y + groupBox.height - 8
  });
  await expect(page.locator(selectors.topologyContextToggleGroup)).toBeVisible();
  await expect(page.locator(selectors.topologyContextUngroup)).toBeVisible();

  const menuBox = await page.locator(selectors.topologyContextMenu).boundingBox();
  if (!menuBox) {
    throw new Error('Topology group context menu bounding box not available');
  }

  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height);
});

test('layout splitter resizes the simulation and editor panels', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  const simulationPanel = page.locator(selectors.simulationPanel);
  const controlPanel = page.locator(selectors.controlPanel);
  const splitter = page.locator(selectors.appSplitter);

  const beforeSimulationBox = await simulationPanel.boundingBox();
  const beforeControlBox = await controlPanel.boundingBox();
  const splitterBox = await splitter.boundingBox();
  if (!beforeSimulationBox || !beforeControlBox || !splitterBox) {
    throw new Error('Splitter layout bounding boxes are not available');
  }

  const horizontalLayout = splitterBox.height > splitterBox.width;
  const dragFrom = {
    x: splitterBox.x + splitterBox.width / 2,
    y: splitterBox.y + splitterBox.height / 2,
  };
  const dragTo = horizontalLayout
    ? { x: dragFrom.x + 120, y: dragFrom.y }
    : { x: dragFrom.x, y: dragFrom.y + 120 };

  await dragOnCanvas(page, dragFrom, dragTo);

  await expect
    .poll(async () => {
      const simulationBox = await simulationPanel.boundingBox();
      const controlBox = await controlPanel.boundingBox();
      if (!simulationBox || !controlBox) {
        throw new Error('Panel bounding boxes disappeared after splitter drag');
      }

      return horizontalLayout
        ? {
            simulationSpan: Math.round(simulationBox.width),
            controlSpan: Math.round(controlBox.width),
          }
        : {
            simulationSpan: Math.round(simulationBox.height),
            controlSpan: Math.round(controlBox.height),
          };
    })
    .not.toEqual(
      horizontalLayout
        ? {
            simulationSpan: Math.round(beforeSimulationBox.width),
            controlSpan: Math.round(beforeControlBox.width),
          }
        : {
            simulationSpan: Math.round(beforeSimulationBox.height),
            controlSpan: Math.round(beforeControlBox.height),
          }
    );

  const afterSimulationBox = await simulationPanel.boundingBox();
  const afterControlBox = await controlPanel.boundingBox();
  if (!afterSimulationBox || !afterControlBox) {
    throw new Error('Final panel bounding boxes are not available');
  }

  if (horizontalLayout) {
    expect(afterSimulationBox.width).toBeGreaterThan(beforeSimulationBox.width + 40);
    expect(afterControlBox.width).toBeLessThan(beforeControlBox.width - 40);
    return;
  }

  expect(afterSimulationBox.height).toBeGreaterThan(beforeSimulationBox.height + 40);
  expect(afterControlBox.height).toBeLessThan(beforeControlBox.height - 40);
});
