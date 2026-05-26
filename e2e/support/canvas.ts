import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { selectors } from './selectors';

type Point = { x: number; y: number };

export const parsePointPair = (value: string): Point => {
  const [x, y] = value.split(',').map((part) => Number.parseFloat(part));
  return { x, y };
};

export const getLocatorBox = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    throw new Error(`Bounding box not available for selector: ${selector}`);
  }
  return box;
};

const parseSummaryEntries = (summary: string) =>
  summary
    .split('|')
    .map((item) => item.trim())
    .map((entry) => {
      const match = entry.match(/^(.*):(-?\d+),(-?\d+)$/);
      if (!match) {
        return null;
      }
      return {
        id: match[1],
        x: Number.parseInt(match[2], 10),
        y: Number.parseInt(match[3], 10),
      };
    })
    .filter((entry): entry is { id: string; x: number; y: number } => entry != null);

export const getNodeCenterFromSummary = async (page: Page, nodeId: string) => {
  const summary = await page.locator(selectors.topologyNodeCenters).innerText();
  const entry = parseSummaryEntries(summary).find((item) => item.id === nodeId);
  if (!entry) {
    throw new Error(`Node center summary missing node ${nodeId}`);
  }
  return { x: entry.x, y: entry.y };
};

export const getNodeViewPosition = async (page: Page, nodeId: string) => {
  const summary = await page.locator(selectors.topologyNodeViewPositions).innerText();
  const entry = parseSummaryEntries(summary).find((item) => item.id === nodeId);
  if (!entry) {
    throw new Error(`Node view position summary missing node ${nodeId}`);
  }
  return { x: entry.x, y: entry.y };
};

export const getSceneClientPoint = async (page: Page, scenePoint: Point) => {
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

export const getLocatorCenter = async (page: Page, selector: string) => {
  const locator = page.locator(selector).first();
  const viewNodeId = await locator.getAttribute('data-topology-view-node-id');
  if (viewNodeId) {
    return getSceneClientPoint(page, await getNodeCenterFromSummary(page, viewNodeId));
  }
  const box = await getLocatorBox(page, selector);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const getVisibleLocatorCenterInCanvas = async (page: Page, selector: string) => {
  const [box, canvasBox] = await Promise.all([
    getLocatorBox(page, selector),
    getLocatorBox(page, selectors.topologyCanvas),
  ]);
  const left = Math.max(box.x, canvasBox.x);
  const top = Math.max(box.y, canvasBox.y);
  const right = Math.min(box.x + box.width, canvasBox.x + canvasBox.width);
  const bottom = Math.min(box.y + box.height, canvasBox.y + canvasBox.height);
  if (right <= left || bottom <= top) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return {
    x: left + (right - left) / 2,
    y: top + (bottom - top) / 2,
  };
};

export const dragOnCanvas = async (
  page: Page,
  from: Point,
  to: Point,
  options?: { button?: 'left' | 'right' }
) => {
  const button = options?.button ?? 'left';
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up({ button });
};

export const rightClickAt = async (page: Page, point: Point) => {
  await page.mouse.click(point.x, point.y, { button: 'right' });
};

export const rightClickLocator = async (page: Page, selector: string) => {
  await rightClickAt(page, await getLocatorCenter(page, selector));
  await expect(page.locator(selectors.topologyContextMenu)).toBeVisible();
};

export const rightDragBetweenNodes = async (page: Page, fromSelector: string, toSelector: string) => {
  await dragOnCanvas(page, await getLocatorCenter(page, fromSelector), await getLocatorCenter(page, toSelector), {
    button: 'right',
  });
};

export const doubleClickNode = async (page: Page, selector: string) => {
  await expect(page.locator(selector).first()).toBeVisible();
  const center = await getVisibleLocatorCenterInCanvas(page, selector);
  await page.mouse.dblclick(center.x, center.y);
};

export const getCreatedLinkLocator = (page: Page, fromId: string, toId: string): Locator =>
  page.locator(`[data-testid^="topology-link-link-${fromId}-${toId}-"]`).first();
