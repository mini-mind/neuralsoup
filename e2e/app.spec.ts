import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

const selectors = {
  simulationCanvas: '[data-testid="simulation-canvas"]',
  renderError: '[data-testid="simulation-render-error"]',
  runState: '[data-testid="simulation-run-state"]',
  controlModeValue: '[data-testid="control-mode-value"]',
  editorTabValue: '[data-testid="editor-tab-value"]',
  settingsSectionValue: '[data-testid="settings-section-value"]',
  editorTabSettings: '[data-testid="editor-tab-settings"]',
  editorTabGraph: '[data-testid="editor-tab-graph"]',
  startPauseButton: '[data-testid="start-pause-button"]',
  resetButton: '[data-testid="reset-button"]',
  settingsPanel: '[data-testid="settings-panel"]',
  settingsSidebar: '[data-testid="settings-sidebar"]',
  settingsNavAgentParameters: '[data-testid="settings-nav-agent-parameters"]',
  settingsNavKeyboardInputs: '[data-testid="settings-nav-keyboard-inputs"]',
  agentParamsPanel: '[data-testid="agent-params-panel"]',
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
  topologyNodeCount: '[data-testid="topology-node-count"]',
  topologySelectedCount: '[data-testid="topology-selected-count"]',
  topologySelectedLink: '[data-testid="topology-selected-link"]',
  topologyNodeCenters: '[data-testid="topology-node-centers"]',
  topologyDetailModal: '[data-testid="topology-detail-modal"]',
  topologyDetailModalOverlay: '[data-testid="topology-detail-modal-overlay"]',
  topologyDetailClose: '[data-testid="topology-detail-close"]',
  topologyBreadcrumbRoot: '[data-testid="topology-breadcrumb-root"]',
  topologyPendingLink: '[data-testid="topology-pending-link"]',
  topologyDraftInputCount: '[data-testid="topology-draft-input-count"]',
  topologyDraftOutputCount: '[data-testid="topology-draft-output-count"]',
  topologyDraftNeuronCount: '[data-testid="topology-draft-neuron-count"]',
  topologyDraftSynapseCount: '[data-testid="topology-draft-synapse-count"]',
  topologyDraftValidationCount: '[data-testid="topology-draft-validation-count"]',
  topologyRuntimeState: '[data-testid="topology-runtime-state"]',
  topologyRuntimeValidationCount: '[data-testid="topology-runtime-validation-count"]',
  topologyRuntimeInputCount: '[data-testid="topology-runtime-input-count"]',
  topologyRuntimeOutputCount: '[data-testid="topology-runtime-output-count"]',
  topologyRuntimeNeuronCount: '[data-testid="topology-runtime-neuron-count"]',
  topologyRuntimeSynapseCount: '[data-testid="topology-runtime-synapse-count"]',
  topologyInputCount: '[data-testid="topology-input-count"]',
  topologyOutputCount: '[data-testid="topology-output-count"]',
  topologyValidationCount: '[data-testid="topology-validation-count"]',
  neuronLabelInput: '[data-testid="neuron-label-input"]',
  synapseWeightInput: '[data-testid="synapse-weight-input"]',
  inputAdapterNode: '[data-testid="topology-node-input-adapter"]',
  coreGroupNode: '[data-testid="topology-node-core-neuron-group"]',
  outputAdapterNode: '[data-testid="topology-node-output-adapter"]',
  enterCoreGroup: '[data-testid="topology-enter-core-neuron-group"]',
  startLinkVisionR0: '[data-testid="topology-start-link-proxy:vision-R-0"]',
  editNeuronOne: '[data-testid="topology-edit-neuron-1"]',
  linkNeuronOneNeuronTwo: '[data-testid="topology-link-link-neuron-1-neuron-2"]',
  nodeNeuronOne: '[data-testid="topology-node-neuron-1"]',
  nodeNeuronTwo: '[data-testid="topology-node-neuron-2"]',
  nodeVisionR0Proxy: '[data-testid="topology-node-proxy:vision-R-0"]',
  nodeOutputMoveForwardProxy: '[data-testid="topology-node-proxy:output-move-forward"]'
} as const;

type StartupDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
};

type DiagnosticsExpectation = 'none' | 'expected-render-init-errors';

const diagnosticsByPage = new WeakMap<Page, StartupDiagnostics>();
const diagnosticsExpectationsByPage = new WeakMap<Page, DiagnosticsExpectation>();

const degradedRendererProjectName = 'chromium-webgl-disabled';
const expectedRenderInitErrorPrefix = 'Failed to initialize simulation canvas:';

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

const getRuntimeDiagnostics = async (page: Page) => ({
  state: await page.locator(selectors.topologyRuntimeState).innerText(),
  validationCount: await page.locator(selectors.topologyRuntimeValidationCount).innerText()
});

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

test('settings and graph tabs preserve sidebar and graph state across switches', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();
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

test('graph view shows root adapters and supports hierarchical navigation', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
  await expect(page.locator(selectors.inputAdapterNode)).toBeVisible();
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
  await expect(page.locator(selectors.outputAdapterNode)).toBeVisible();

  await page.locator(selectors.enterCoreGroup).click();
  await expect.poll(async () => Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10)).toBeGreaterThan(3);
  await expect(page.locator(selectors.topologyBreadcrumbRoot)).toBeVisible();
  await expect(page.locator(selectors.nodeVisionR0Proxy)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  await page.locator(selectors.topologyBreadcrumbRoot).click();
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');
});

test('graph view edits leaf params and leaf link weights through Graph IR inspectors', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');

  await page.locator(selectors.editNeuronOne).click();
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.neuronLabelInput).fill('已编辑神经元');
  await page.locator(selectors.topologyDetailClose).click();
  await expect(page.locator(selectors.topologyDetailModal)).toHaveCount(0);
  await expect(page.locator(selectors.nodeNeuronOne)).toContainText('已编辑神经元');

  await page.locator(selectors.linkNeuronOneNeuronTwo).dblclick();
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.synapseWeightInput).fill('1.25');
  await page.locator(selectors.topologyDetailClose).click();
  await expect(page.locator(selectors.linkNeuronOneNeuronTwo)).toContainText('w 1.25');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');
});

test('graph view diagnostics keep draft and installed runtime summaries aligned after valid edits', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();

  const initialDraftInputCount = await page.locator(selectors.topologyDraftInputCount).innerText();
  const initialDraftOutputCount = await page.locator(selectors.topologyDraftOutputCount).innerText();
  const initialDraftNeuronCount = await page.locator(selectors.topologyDraftNeuronCount).innerText();

  await expect(page.locator(selectors.topologyInputCount)).toHaveText(initialDraftInputCount);
  await expect(page.locator(selectors.topologyRuntimeInputCount)).toHaveText(initialDraftInputCount);
  await expect(page.locator(selectors.topologyOutputCount)).toHaveText(initialDraftOutputCount);
  await expect(page.locator(selectors.topologyRuntimeOutputCount)).toHaveText(initialDraftOutputCount);
  await expect(page.locator(selectors.topologyRuntimeNeuronCount)).toHaveText(initialDraftNeuronCount);
  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('112');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');

  await page.locator(selectors.startLinkVisionR0).click();
  await page.locator(selectors.nodeNeuronTwo).click();

  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('113');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');
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
  await page.locator(selectors.enterCoreGroup).click();

  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('112');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');

  await injectValidDraftOnly(page);

  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('113');
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');
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
  await page.locator(selectors.enterCoreGroup).click();
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');
  await page.locator(selectors.startLinkVisionR0).click();
  await expect(page.locator(selectors.topologyPendingLink)).toBeVisible();
  await page.locator(selectors.nodeNeuronTwo).click();
  await expect(page.locator(selectors.topologyPendingLink)).toHaveCount(0);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-vision-R-0-neuron-2-/);
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.settingsSectionValue)).toHaveText('keyboard-inputs');

  await page.locator(selectors.editorTabGraph).click();
  await expect.poll(async () => Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10)).toBeGreaterThan(3);
  await expect(page.locator('[data-testid^="topology-link-link-vision-R-0-neuron-2-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-vision-R-0-neuron-2-/);
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');
});

test('graph view blocks duplicate and proxy-only links while preserving pending state safety', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');

  await page.locator(selectors.startLinkVisionR0).click();
  await expect(page.locator(selectors.topologyPendingLink)).toBeVisible();
  await page.locator(selectors.nodeNeuronTwo).click();
  await expect(page.locator(selectors.topologyPendingLink)).toHaveCount(0);
  await expect(page.locator('[data-testid^="topology-link-link-vision-R-0-neuron-2-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');

  await page.locator(selectors.startLinkVisionR0).click();
  await page.locator(selectors.nodeNeuronTwo).click();
  await expect(page.locator('[data-testid^="topology-link-link-vision-R-0-neuron-2-"]')).toHaveCount(1);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toHaveText(/link-vision-R-0-neuron-2-/);
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');

  await page.locator(selectors.startLinkVisionR0).click();
  await page.locator(selectors.nodeOutputMoveForwardProxy).click();
  await expect(page.locator(selectors.topologyPendingLink)).toHaveCount(0);
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('113');
  await expect(page.locator('[data-testid^="topology-link-link-vision-R-0-output-move-forward-"]')).toHaveCount(0);
});

test('graph view diagnostics expose invalid draft divergence from installed runtime', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();

  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeValidationCount)).toHaveText('0');
  await expect(page.locator(selectors.topologyRuntimeState)).toHaveText('applied');
  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('112');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');

  await injectInvalidGraphDraft(page);

  await expect(page.locator(selectors.topologyDraftSynapseCount)).toHaveText('113');
  await expect(page.locator(selectors.topologyDraftValidationCount)).toHaveText('1');
  await expect(page.locator(selectors.topologyValidationCount)).toHaveText('1');
  await expect(page.locator(selectors.topologyRuntimeSynapseCount)).toHaveText('112');
  await expect
    .poll(() => getRuntimeDiagnostics(page))
    .toEqual({
      state: 'invalid',
      validationCount: '1'
    });
});

test('graph view keyboard interactions remain safe after event hook removal', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.editorTabGraph).click();
  await page.locator(selectors.enterCoreGroup).click();

  await page.locator(selectors.editNeuronOne).click();
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

  await page.locator(selectors.startLinkVisionR0).click();
  await expect(page.locator(selectors.topologyPendingLink)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(selectors.topologyPendingLink)).toHaveCount(0);

  await page.locator(selectors.nodeNeuronOne).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await page.keyboard.press('Backspace');
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('0');

  const canvasBox = await getCanvasBox(page);
  await page.mouse.dblclick(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await expect.poll(async () => Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10)).toBeGreaterThan(4);
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
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

  expect(Math.round(canvasBox.width)).toBe(Math.round(viewportBox.width));
  expect(Math.round(canvasBox.height)).toBe(Math.round(viewportBox.height));
  expect(canvasBox.width).toBeLessThan(500);

  await page.locator(selectors.enterCoreGroup).click();
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await page.locator(selectors.nodeNeuronOne).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
});
