import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

const selectors = {
  simulationCanvas: '[data-testid="simulation-canvas"]',
  renderError: '[data-testid="simulation-render-error"]',
  runState: '[data-testid="simulation-run-state"]',
  controlModeValue: '[data-testid="control-mode-value"]',
  controlModeSelect: '[data-testid="control-mode-select"]',
  startPauseButton: '[data-testid="start-pause-button"]',
  resetButton: '[data-testid="reset-button"]',
  agentParamsButton: '[data-testid="agent-params-button"]',
  paramsModal: '[data-testid="agent-params-modal"]',
  visionCellsInput: '[data-testid="vision-cells-input"]',
  visionRangeInput: '[data-testid="vision-range-input"]',
  visionAngleInput: '[data-testid="vision-angle-input"]',
  visionCellsValue: '[data-testid="vision-cells-value"]',
  visionRangeValue: '[data-testid="vision-range-value"]',
  visionAngleValue: '[data-testid="vision-angle-value"]',
  paramsApply: '[data-testid="agent-params-apply"]',
  paramsCancel: '[data-testid="agent-params-cancel"]',
  paramsResetDefaults: '[data-testid="agent-params-reset-defaults"]',
  manualPanel: '[data-testid="manual-control-panel"]',
  topologyEditor: '[data-testid="topology-editor"]',
  topologyCanvas: '[data-testid="topology-canvas"]',
  topologyNodeCount: '[data-testid="topology-node-count"]',
  topologySelectedCount: '[data-testid="topology-selected-count"]',
  topologyNodeCenters: '[data-testid="topology-node-centers"]',
  topologyDetailModal: '[data-testid="topology-detail-modal"]',
  neuronLabelInput: '[data-testid="neuron-label-input"]'
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
  await expect(page.locator(selectors.controlModeSelect)).toBeVisible();
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

const parseNodeCenters = (summary: string) =>
  summary
    .split('|')
    .filter(Boolean)
    .map((entry) => {
      const [id, coords] = entry.split(':');
      const [x, y] = coords.split(',').map((value) => Number.parseInt(value, 10));
      return { id, x, y };
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

test('agent parameter modal persists applied values and discards cancelled drafts', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.agentParamsButton).click();
  await expect(page.locator(selectors.paramsModal)).toBeVisible();

  await page.locator(selectors.visionCellsInput).fill('24');
  await page.locator(selectors.visionRangeInput).fill('300');
  await page.locator(selectors.visionAngleInput).fill('90');
  await page.locator(selectors.paramsApply).click();

  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
  await expect(page.locator(selectors.visionRangeValue)).toHaveText('300');
  await expect(page.locator(selectors.visionAngleValue)).toHaveText('90');

  await page.locator(selectors.agentParamsButton).click();
  await expect(page.locator(selectors.visionCellsInput)).toHaveValue('24');
  await expect(page.locator(selectors.visionRangeInput)).toHaveValue('300');
  await expect(page.locator(selectors.visionAngleInput)).toHaveValue('90');

  await page.locator(selectors.visionCellsInput).fill('18');
  await page.locator(selectors.paramsCancel).click();

  await page.locator(selectors.agentParamsButton).click();
  await expect(page.locator(selectors.visionCellsInput)).toHaveValue('24');

  await page.locator(selectors.paramsResetDefaults).click();
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('36');
  await expect(page.locator(selectors.visionRangeValue)).toHaveText('250');
  await expect(page.locator(selectors.visionAngleValue)).toHaveText('120');
});

test('control mode switching stays coherent between keyboard and snn', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await expect(page.locator(selectors.manualPanel)).toBeVisible();

  await page.locator(selectors.controlModeSelect).selectOption('snn');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('snn');
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  await page.locator(selectors.controlModeSelect).selectOption('keyboard');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('keyboard');
  await expect(page.locator(selectors.manualPanel)).toBeVisible();
});

test('topology sandbox supports creating, selecting, deleting, and editing a neuron', async ({ page }, testInfo) => {
  if (!(await expectInteractiveRenderReady(page, testInfo))) {
    return;
  }

  await page.locator(selectors.controlModeSelect).selectOption('snn');
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  const canvas = page.locator(selectors.topologyCanvas);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('2');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Topology canvas bounding box not available');
  }

  await canvas.dblclick({
    position: {
      x: Math.round(box.width * 0.6),
      y: Math.round(box.height * 0.45)
    }
  });
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('3');

  const nodeCenters = parseNodeCenters(await page.locator(selectors.topologyNodeCenters).innerText());
  const neuronOne = nodeCenters.find((node) => node.id === 'neuron-1');
  if (!neuronOne) {
    throw new Error('neuron-1 center not found');
  }

  await canvas.click({
    position: {
      x: neuronOne.x,
      y: neuronOne.y
    }
  });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');

  await page.keyboard.press('Delete');
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText('2');
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('0');

  const remainingNodeCenters = parseNodeCenters(await page.locator(selectors.topologyNodeCenters).innerText());
  const neuronTwo = remainingNodeCenters.find((node) => node.id === 'neuron-2');
  if (!neuronTwo) {
    throw new Error('neuron-2 center not found');
  }

  await canvas.dblclick({
    position: {
      x: neuronTwo.x,
      y: neuronTwo.y
    }
  });
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
  await page.locator(selectors.neuronLabelInput).fill('已编辑神经元');
  await expect(page.locator(selectors.topologyDetailModal)).toBeVisible();
});
