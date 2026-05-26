import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { doubleClickNode, getLocatorBox, rightClickAt } from './canvas';
import { selectors } from './selectors';

export const openGraphEditor = async (page: Page) => {
  await page.locator(selectors.editorTabGraph).click();
  await expect(page.locator(selectors.topologyEditor)).toBeVisible();
};

export const enterCoreGroup = async (page: Page) => {
  await doubleClickNode(page, selectors.coreGroupNode);
  await expect(page.locator(selectors.topologyBreadcrumbRoot)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();
};

export const closeTopologyDetailModal = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.locator(selectors.topologyDetailModal)).toHaveCount(0);
};

export const getDetailModal = (page: Page) => page.locator(selectors.topologyDetailModal);

export const getDetailField = (page: Page, selector: string) => getDetailModal(page).locator(selector).first();

export const openCanvasContextMenu = async (page: Page) => {
  const canvasBox = await getLocatorBox(page, selectors.topologyCanvas);
  await rightClickAt(page, {
    x: canvasBox.x + canvasBox.width - 100,
    y: canvasBox.y + 120,
  });
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
};

export const createNeuronThreeViaContextMenu = async (page: Page) => {
  await openCanvasContextMenu(page);
  await page.locator(selectors.topologyContextNewNeuron).click();
  await expect(page.locator(selectors.topologyContextMenu)).toHaveCount(0);
  await expect(page.locator('[data-testid="topology-node-neuron-3"]')).toBeVisible();
};
