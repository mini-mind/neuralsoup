import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BRAIN_LIBRARY_STORAGE_KEY, selectors } from './selectors';

type StoredBrain = {
  agent?: {
    metadata?: {
      id?: string;
      name?: string;
    };
  };
};

type ExportedBrainDocument = {
  version?: number;
  kind?: string;
  agent?: {
    metadata?: {
      id?: string;
      name?: string;
    };
  };
};

export const waitForRenderOutcome = async (page: Page) =>
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
        message: 'expected simulation renderer to become ready or show explicit render error UI',
      }
    )
    .toMatch(/^(true|render-error)$/);

export const getRenderOutcome = async (page: Page) => {
  await waitForRenderOutcome(page);
  return (await page.locator(selectors.renderError).isVisible().catch(() => false)) ? 'render-error' : 'ready';
};

export const expectRendererReady = async (page: Page) => {
  await expect(getRenderOutcome(page)).resolves.toBe('ready');
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');
  await expect(page.locator(`${selectors.simulationCanvas} canvas`)).toHaveCount(1);
};

export const openSettingsAgentParameters = async (page: Page) => {
  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavAgentParameters).click();
  await expect(page.locator(selectors.visionCellsInput)).toBeVisible();
};

export const openSettingsKeyboardInputs = async (page: Page) => {
  await page.locator(selectors.editorTabSettings).click();
  await page.locator(selectors.settingsNavKeyboardInputs).click();
  await expect(page.locator(selectors.keyboardInputPanel)).toBeVisible();
};

export const setVisionCells = async (page: Page, value: number | string) => {
  const nextValue = String(value);
  await openSettingsAgentParameters(page);
  await page.locator(selectors.visionCellsInput).fill(nextValue);
  await page.locator(selectors.paramsApply).click();
  await expect(page.locator(selectors.visionCellsValue)).toHaveText(nextValue);
};

export const getBrainLibrarySelectButton = (page: Page, brainId: string) =>
  page.locator(`[data-testid="brain-library-select-${brainId}"]`);

export const getBrainLibraryExportButton = (page: Page, brainId: string) =>
  page.locator(`[data-testid="brain-library-export-${brainId}"]`);

export const openBrainLibrary = async (page: Page) => {
  await page.locator(selectors.brainLibraryButton).click();
  await expect(page.locator(selectors.brainLibraryModal)).toBeVisible();
};

export const closeBrainLibrary = async (page: Page) => {
  await page.locator(selectors.brainLibraryClose).click();
  await expect(page.locator(selectors.brainLibraryModal)).toHaveCount(0);
};

export const saveCurrentBrain = async (page: Page, name: string) => {
  await page.locator(selectors.brainLibrarySaveName).fill(name);
  await page.locator(selectors.brainLibrarySaveCurrent).click();
  await expect(page.locator(selectors.brainLibraryList)).toContainText(name);
};

export const getStoredBrainByName = async (page: Page, name: string): Promise<StoredBrain | null> =>
  page.evaluate(
    ({ storageKey, brainName }) => {
      const raw = window.localStorage.getItem(storageKey);
      const brains = raw ? ((JSON.parse(raw) as { brains?: StoredBrain[] }).brains ?? []) : [];
      return brains.find((brain) => brain.agent?.metadata?.name === brainName) ?? null;
    },
    { storageKey: BRAIN_LIBRARY_STORAGE_KEY, brainName: name }
  );

export const getStoredBrainIdByName = async (page: Page, name: string) =>
  (await getStoredBrainByName(page, name))?.agent?.metadata?.id ?? '';

export const exportBrainDocument = async (page: Page, brainId: string): Promise<ExportedBrainDocument> => {
  const downloadPromise = page.waitForEvent('download');
  await getBrainLibraryExportButton(page, brainId).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  expect(stream).toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ExportedBrainDocument;
};

export const selectBrainWithConfirm = async (page: Page, brainId: string) => {
  page.once('dialog', (dialog) => dialog.accept());
  await getBrainLibrarySelectButton(page, brainId).click();
};

export const getActiveAgentId = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getActiveAgentId() ?? null);

export const getActiveBrainId = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getActiveBrainId() ?? null);

export const getGraphPathIds = async (page: Page) =>
  page.evaluate(() => window.__NEURALSOUP_TEST_API__?.getGraphPathIds() ?? []);

export const importAgentDocument = async (page: Page, agent: unknown, name = 'imported-agent.json') => {
  await page.setInputFiles(selectors.brainLibraryImportFile, {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        kind: 'neuralsoup-agent',
        agent,
      })
    ),
  });
};
