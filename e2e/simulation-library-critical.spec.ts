import { expect, test } from '@playwright/test';
import { createVisionActionSeedAgentIR } from '../src/host';
import { doubleClickNode } from './support/canvas';
import { selectors } from './support/selectors';
import {
  closeBrainLibrary,
  expectRendererReady,
  exportBrainDocument,
  getActiveAgentId,
  getActiveBrainId,
  getGraphPathIds,
  getRenderOutcome,
  getStoredBrainIdByName,
  getStoredBrainByName,
  importAgentDocument,
  openBrainLibrary,
  openSettingsAgentParameters,
  openSettingsKeyboardInputs,
  saveCurrentBrain,
  selectBrainWithConfirm,
  setVisionCells,
} from './support/simulation';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('critical: startup shows simulation canvas and renderer ready-or-explicit-error outcome', async ({ page }) => {
  await expect(page.locator(selectors.simulationCanvas)).toBeVisible();
  const outcome = await getRenderOutcome(page);
  if (outcome === 'ready') {
    await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');
    await expect(page.locator(`${selectors.simulationCanvas} canvas`)).toHaveCount(1);
    return;
  }

  await expect(page.locator(selectors.renderError)).toBeVisible();
  await expect(page.locator(selectors.startPauseButton)).toBeVisible();
  await expect(page.locator(selectors.runState)).toBeVisible();
});

test('critical: simulation start pause reset updates visible lifecycle state chain', async ({ page }) => {
  await expectRendererReady(page);
  await expect(page.locator(selectors.runState)).toHaveText('idle');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.startPauseButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await page.locator(selectors.resetButton).click();
  await expect(page.locator(selectors.runState)).toHaveText('idle');
  await expect(page.locator(selectors.fpsValue)).toHaveText('0.0');
});

test('critical: global space toggles lifecycle but is ignored in editable input and brain library modal', async ({ page }) => {
  test.slow();
  await expectRendererReady(page);
  await expect(page.locator(selectors.runState)).toHaveText('idle');

  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await openSettingsKeyboardInputs(page);
  await page.locator(selectors.keyboardInputPanel).click();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await openSettingsAgentParameters(page);
  await page.locator(selectors.visionCellsInput).focus();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');

  await openSettingsKeyboardInputs(page);
  await page.locator(selectors.keyboardInputPanel).click();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');

  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('running');
  await page.locator(selectors.brainLibraryModalOverlay).click({ position: { x: 12, y: 12 } });
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);

  await page.locator(selectors.keyboardInputPanel).click();
  await page.keyboard.press('Space');
  await expect(page.locator(selectors.runState)).toHaveText('paused');
});

test('critical: brain library supports save select export import and rejects unsupported envelope', async ({ page }) => {
  test.slow();
  await expectRendererReady(page);

  await setVisionCells(page, 24);

  await openBrainLibrary(page);
  await saveCurrentBrain(page, 'Critical Saved Brain');
  const savedBrainId = await getStoredBrainIdByName(page, 'Critical Saved Brain');
  expect(savedBrainId).not.toBe('');

  const exportedDocument = await exportBrainDocument(page, savedBrainId);
  expect(exportedDocument.version).toBe(2);
  expect(exportedDocument.kind).toBe('neuralsoup-agent');
  expect(exportedDocument.agent?.metadata?.id).toBe(savedBrainId);

  await selectBrainWithConfirm(page, savedBrainId);
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('24');
  await closeBrainLibrary(page);

  await setVisionCells(page, 36);

  const importedAgent = createVisionActionSeedAgentIR(30);
  importedAgent.metadata.name = 'Critical Imported Brain';
  await openBrainLibrary(page);
  page.once('dialog', (dialog) => dialog.accept());
  await importAgentDocument(page, importedAgent, 'critical-import.json');
  await expect(page.locator(`[data-testid="brain-library-select-${importedAgent.metadata.id}"]`)).toBeVisible();

  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name: 'critical-unsupported-envelope.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        kind: 'neuralsoup-agent',
        agent: exportedDocument.agent,
      })
    ),
  });
  await expect(page.locator(selectors.brainLibraryError)).toContainText('当前支持的 Brain JSON 格式');
});

test('critical: switching a brain resets graph path and installs the selected session identity', async ({ page }) => {
  test.slow();
  await expectRendererReady(page);

  await openBrainLibrary(page);
  await saveCurrentBrain(page, 'Critical Switch Brain A');
  await saveCurrentBrain(page, 'Critical Switch Brain B');
  await closeBrainLibrary(page);

  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.visionCellsInput).fill('60');
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText('60');

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root', 'root-container']);

  await openBrainLibrary(page);
  const targetBrain = await getStoredBrainByName(page, 'Critical Switch Brain A');
  expect(targetBrain?.agent?.metadata?.id).toBeTruthy();
  await selectBrainWithConfirm(page, targetBrain!.agent!.metadata!.id!);
  await page.waitForTimeout(50);
  if (await page.locator(selectors.brainLibraryModal).count()) {
    await closeBrainLibrary(page);
  }

  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root']);
  await expect.poll(async () => getActiveBrainId(page)).toBe(targetBrain!.agent!.metadata!.id);
  await expect.poll(async () => getActiveAgentId(page)).toBe(targetBrain!.agent!.metadata!.id);
});

test('critical: importing brain resets graph path to root and installs imported session identity', async ({ page }) => {
  await expectRendererReady(page);

  await page.locator(selectors.editorTabGraph).click();
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root', 'root-container']);

  const importedAgent = createVisionActionSeedAgentIR(24);
  importedAgent.metadata.name = 'Critical Identity Reset Brain';

  await openBrainLibrary(page);
  page.once('dialog', (dialog) => dialog.accept());
  await importAgentDocument(page, importedAgent, 'critical-identity-reset.json');
  await closeBrainLibrary(page);

  await expect.poll(async () => getGraphPathIds(page)).toEqual(['root']);
  await expect.poll(async () => getActiveBrainId(page)).toBe(importedAgent.metadata.id);
  await expect.poll(async () => getActiveAgentId(page)).toBe(importedAgent.metadata.id);
});
