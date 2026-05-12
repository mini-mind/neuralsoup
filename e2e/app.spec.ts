import { expect, test } from '@playwright/test';

const selectors = {
  simulationCanvas: '[data-testid="simulation-canvas"]',
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
  scriptPanel: '[data-testid="script-control-panel"]',
  manualPanel: '[data-testid="manual-control-panel"]',
  scriptCodeInput: '[data-testid="script-code-input"]',
  scriptSyntaxCheck: '[data-testid="script-syntax-check"]',
  scriptOverride: '[data-testid="script-player-override"]',
  topologyEditor: '[data-testid="topology-editor"]',
  topologyCanvas: '[data-testid="topology-canvas"]',
  topologyNodeCount: '[data-testid="topology-node-count"]',
  topologySelectedCount: '[data-testid="topology-selected-count"]',
  topologyNodeCenters: '[data-testid="topology-node-centers"]',
  topologyDetailModal: '[data-testid="topology-detail-modal"]',
  neuronLabelInput: '[data-testid="neuron-label-input"]'
} as const;

const parseNodeCenters = (summary: string) =>
  summary
    .split('|')
    .filter(Boolean)
    .map((entry) => {
      const [id, coords] = entry.split(':');
      const [x, y] = coords.split(',').map((value) => Number.parseInt(value, 10));
      return { id, x, y };
    });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');
});

test('simulation lifecycle controls update visible run state', async ({ page }) => {
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

test('agent parameter modal persists applied values and discards cancelled drafts', async ({ page }) => {
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

test('control mode switching and script syntax check stay coherent', async ({ page }) => {
  await expect(page.locator(selectors.manualPanel)).toBeVisible();

  await page.locator(selectors.controlModeSelect).selectOption('script');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('script');
  await expect(page.locator(selectors.scriptPanel)).toBeVisible();

  page.once('dialog', async (dialog) => {
    await expect(dialog.message()).toContain('脚本语法检查通过');
    await dialog.accept();
  });
  await page.locator(selectors.scriptSyntaxCheck).click();

  await page.locator(selectors.scriptCodeInput).fill('return [');
  page.once('dialog', async (dialog) => {
    await expect(dialog.message()).toContain('脚本语法错误');
    await dialog.accept();
  });
  await page.locator(selectors.scriptSyntaxCheck).click();

  await page.locator(selectors.scriptOverride).check();
  await expect(page.locator(selectors.scriptOverride)).toBeChecked();

  await page.locator(selectors.controlModeSelect).selectOption('snn');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('snn');
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();

  await page.locator(selectors.controlModeSelect).selectOption('manual');
  await expect(page.locator(selectors.controlModeValue)).toHaveText('manual');
  await expect(page.locator(selectors.manualPanel)).toBeVisible();
});

test('topology sandbox supports creating, selecting, deleting, and editing a neuron', async ({ page }) => {
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
