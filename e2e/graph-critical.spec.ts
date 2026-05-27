import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  doubleClickNode,
  dragOnCanvas,
  getCreatedLinkLocator,
  getLocatorBox,
  getLocatorCenter,
  getNodeViewPosition,
  parsePointPair,
  rightClickSceneNode,
  rightClickLocator,
  rightDragBetweenNodes,
} from './support/canvas';
import { closeTopologyDetailModal, createNeuronThreeViaContextMenu, enterCoreGroup, getDetailField, getDetailModal, openGraphEditor } from './support/graph';
import { DEFAULT_NEURON_MODEL_ID, DEFAULT_SYNAPSE_MODEL_ID, selectors } from './support/selectors';
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator(selectors.simulationCanvas)).toHaveAttribute('data-engine-ready', 'true');
});

test('critical: graph root hierarchy and breadcrumb navigation', async ({ page }) => {
  await openGraphEditor(page);
  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();

  await enterCoreGroup(page);
  await page.locator(selectors.topologyBreadcrumbRoot).click();

  await expect(page.locator(selectors.coreGroupNode)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronOne)).toHaveCount(0);
});

test('critical: create and edit neuron/connection fields in graph flow', async ({ page }) => {
  test.slow();
  await openGraphEditor(page);
  await enterCoreGroup(page);

  const beforeNodeCount = Number.parseInt(await page.locator(selectors.topologyNodeCount).innerText(), 10);
  await createNeuronThreeViaContextMenu(page);
  await expect(page.locator(selectors.topologyNodeCount)).toHaveText(String(beforeNodeCount + 1));

  await rightDragBetweenNodes(page, selectors.nodeNeuronOne, '[data-testid="topology-node-neuron-3"]');
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologySelectedLink)).toContainText('link-neuron-1-neuron-3-');

  await doubleClickNode(page, selectors.nodeNeuronOne);
  await expect(getDetailModal(page)).toBeVisible();
  await getDetailField(page, selectors.neuronLabelInput).fill('critical-neuron-1');
  await getDetailField(page, selectors.neuronModelIdInput).fill(DEFAULT_NEURON_MODEL_ID);
  await getDetailField(page, selectors.neuronInitialStateVInput).fill('-62');
  await getDetailField(page, selectors.neuronInitialStateUInput).fill('-11');
  await expect(getDetailField(page, selectors.neuronInitialStateVInput)).toHaveValue('-62');
  await expect(getDetailField(page, selectors.neuronInitialStateUInput)).toHaveValue('-11');
  await closeTopologyDetailModal(page);

  const newLink = getCreatedLinkLocator(page, 'neuron-1', 'neuron-3');
  await expect(newLink).toBeVisible();
  await newLink.dblclick();
  await expect(getDetailModal(page)).toBeVisible();
  await getDetailField(page, selectors.connectionWeightInput).fill('1.25');
  await getDetailField(page, selectors.connectionSynapseModelIdInput).fill(DEFAULT_SYNAPSE_MODEL_ID);
  await getDetailField(page, selectors.connectionDelayMsInput).fill('7');
  await closeTopologyDetailModal(page);
  await expect(newLink).toContainText('1.25');

  await newLink.dblclick();
  await expect(getDetailModal(page)).toBeVisible();
  await expect(getDetailField(page, selectors.connectionWeightInput)).toHaveValue('1.25');
  await expect(getDetailField(page, selectors.connectionSynapseModelIdInput)).toHaveValue(DEFAULT_SYNAPSE_MODEL_ID);
  await expect(getDetailField(page, selectors.connectionDelayMsInput)).toHaveValue('7');
  await closeTopologyDetailModal(page);
});

test('critical: aggregate group expand and ungroup minimal path', async ({ page }) => {
  await openGraphEditor(page);
  await enterCoreGroup(page);

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');
  await rightClickLocator(page, selectors.nodeNeuronTwo);
  await page.locator(selectors.topologyContextAggregate).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);

  await rightClickLocator(page, groupSelector);
  const toggle = page.locator(selectors.topologyContextToggleGroup);
  const toggleText = (await toggle.innerText()).trim();
  if (toggleText === '展开') {
    await toggle.click();
  } else {
    await page.keyboard.press('Escape');
    await rightClickLocator(page, groupSelector);
    await expect(page.locator(selectors.topologyContextToggleGroup)).toHaveText('展开');
    await page.locator(selectors.topologyContextToggleGroup).click();
  }
  await expect(page.locator(groupSelector)).toHaveCount(1);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();

  const groupId = (await page.locator(groupSelector).getAttribute('data-testid'))?.replace('topology-node-', '');
  if (!groupId) {
    throw new Error('Expanded group id missing');
  }
  await rightClickLocator(page, `[data-testid="topology-node-title-${groupId}"]`);
  await page.locator(selectors.topologyContextUngroup).click();
  await expect(page.locator(groupSelector)).toHaveCount(0);
  await expect(page.locator(selectors.nodeNeuronOne)).toBeVisible();
  await expect(page.locator(selectors.nodeNeuronTwo)).toBeVisible();
});

test('critical: group detail rename and aggregate link batch edit persist through modal reopen', async ({ page }) => {
  await openGraphEditor(page);
  await enterCoreGroup(page);

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await rightClickLocator(page, selectors.nodeNeuronTwo);
  await page.locator(selectors.topologyContextAggregate).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);
  const groupLocator = page.locator(groupSelector).first();
  const originalTestId = await groupLocator.getAttribute('data-testid');
  if (!originalTestId) {
    throw new Error('Grouped node test id missing');
  }
  const groupId = originalTestId.replace('topology-node-', '');

  await doubleClickNode(page, `[data-testid="${originalTestId}"]`);
  await expect(getDetailModal(page)).toBeVisible();
  await getDetailField(page, selectors.groupLabelInput).fill('critical-group');
  await closeTopologyDetailModal(page);
  await expect(page.locator(`[data-testid="topology-node-${groupId}"]`)).toContainText('critical-group');

  await rightClickLocator(page, `[data-testid="topology-node-${groupId}"]`);
  await page.locator(selectors.topologyContextToggleGroup).click();
  await expect(page.locator(`[data-testid="topology-node-body-${groupId}"]`)).toBeVisible();

  const aggregateLink = page.locator('[data-testid^="topology-link-aggregate:"]').first();
  await expect(aggregateLink).toBeVisible();
  await aggregateLink.dblclick({ force: true });
  await expect(getDetailModal(page)).toBeVisible();
  await expect(page.locator(selectors.aggregateLinkDetail)).toBeVisible();
  await getDetailField(page, selectors.connectionSynapseModelIdInput).fill(DEFAULT_SYNAPSE_MODEL_ID);
  await getDetailField(page, selectors.connectionWeightInput).fill('2.5');
  await getDetailField(page, selectors.connectionDelayMsInput).fill('9');
  await closeTopologyDetailModal(page);

  await aggregateLink.dblclick({ force: true });
  await expect(getDetailModal(page)).toBeVisible();
  await expect(getDetailField(page, selectors.connectionWeightInput)).toHaveValue('2.5');
  await expect(getDetailField(page, selectors.connectionSynapseModelIdInput)).toHaveValue(DEFAULT_SYNAPSE_MODEL_ID);
  await expect(getDetailField(page, selectors.connectionDelayMsInput)).toHaveValue('9');
  await closeTopologyDetailModal(page);
});

test('critical: move selection into group and move node back to parent via group context menu', async ({ page }) => {
  await openGraphEditor(page);
  await enterCoreGroup(page);
  await createNeuronThreeViaContextMenu(page);

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await rightClickLocator(page, selectors.nodeNeuronTwo);
  await page.locator(selectors.topologyContextAggregate).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);

  await page.locator(selectors.nodeNeuronThree).click();
  await rightClickLocator(page, groupSelector);
  await expect(page.locator(selectors.topologyContextMoveIntoGroup)).toBeVisible();
  await page.locator(selectors.topologyContextMoveIntoGroup).click();

  const groupId = ((await page.locator(groupSelector).getAttribute('data-testid')) ?? '').replace('topology-node-', '');
  await rightClickLocator(page, groupSelector);
  await page.locator(selectors.topologyContextEnterGroup).click();
  await page.locator(selectors.nodeNeuronThree).click();
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
  await expect(page.locator(selectors.topologyActionMoveOut)).toBeVisible();
  await page.locator(selectors.topologyActionMoveOut).click();
  await page.locator(selectors.topologyBreadcrumbRoot).click();
  await expect(page.locator(selectors.nodeNeuronThree)).toBeVisible();
});

test('critical: multi-select batch link happy path', async ({ page }) => {
  await openGraphEditor(page);
  await enterCoreGroup(page);
  await createNeuronThreeViaContextMenu(page);

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('2');

  const beforeOne = await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count();
  const beforeTwo = await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count();

  await rightDragBetweenNodes(page, selectors.nodeNeuronTwo, '[data-testid="topology-node-neuron-3"]');

  await expect
    .poll(async () => ({
      one: await page.locator('[data-testid^="topology-link-link-neuron-1-neuron-3-"]').count(),
      two: await page.locator('[data-testid^="topology-link-link-neuron-2-neuron-3-"]').count(),
    }))
    .toEqual({ one: beforeOne + 1, two: beforeTwo + 1 });
  await expect(page.locator(selectors.topologySelectedCount)).toHaveText('1');
});

test('critical: wheel zoom, right-pan, and node drag release cleanup', async ({ page }) => {
  await openGraphEditor(page);
  await enterCoreGroup(page);

  const canvasBox = await getLocatorBox(page, selectors.topologyCanvas);
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -120);
  await expect(page.locator(selectors.topologyCanvasScale)).toHaveText('1.20');
  await page.mouse.wheel(0, 120);
  await expect(page.locator(selectors.topologyCanvasScale)).toHaveText('1.00');

  const beforeDrag = await getNodeViewPosition(page, 'neuron-1');
  const nodeCenter = await getLocatorCenter(page, selectors.nodeNeuronOne);
  await dragOnCanvas(page, nodeCenter, { x: nodeCenter.x + 80, y: nodeCenter.y + 48 });
  await expect
    .poll(() => getNodeViewPosition(page, 'neuron-1'))
    .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  const settledAfterDrag = await getNodeViewPosition(page, 'neuron-1');
  expect(settledAfterDrag.x).toBeGreaterThan(beforeDrag.x + 20);
  expect(settledAfterDrag.y).toBeGreaterThan(beforeDrag.y + 10);

  await page.mouse.move(nodeCenter.x + 180, nodeCenter.y + 140, { steps: 8 });
  await page.waitForTimeout(60);
  const afterRelease = await getNodeViewPosition(page, 'neuron-1');
  expect(Math.abs(afterRelease.x - settledAfterDrag.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterRelease.y - settledAfterDrag.y)).toBeLessThanOrEqual(1);

  const beforePan = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  await dragOnCanvas(
    page,
    { x: canvasBox.x + 100, y: canvasBox.y + 100 },
    { x: canvasBox.x + 190, y: canvasBox.y + 150 },
    { button: 'right' }
  );
  const afterPan = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  expect(afterPan.x - beforePan.x).toBeGreaterThan(30);
  expect(afterPan.y - beforePan.y).toBeGreaterThan(15);
});

test('critical: expanded group body supports marquee and right-pan while title remains the drag handle', async ({ page }) => {
  test.slow();
  await openGraphEditor(page);
  await enterCoreGroup(page);

  await page.locator(selectors.nodeNeuronOne).click();
  await page.locator(selectors.nodeNeuronTwo).click({ modifiers: ['Shift'] });
  await rightClickLocator(page, selectors.nodeNeuronTwo);
  await page.locator(selectors.topologyContextAggregate).click();

  const groupSelector = '[data-testid^="topology-node-group-"]';
  await expect(page.locator(groupSelector)).toHaveCount(1);
  const groupId = (await page.locator(groupSelector).getAttribute('data-testid'))?.replace('topology-node-', '');
  if (!groupId) {
    throw new Error('Expanded group id missing');
  }

  await rightClickLocator(page, groupSelector);
  await page.locator(selectors.topologyContextToggleGroup).click();
  await expect(page.locator(selectors.topologyGroupTitleHandle)).toBeVisible();

  const beforePan = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  const groupBodyBox = await getLocatorBox(page, `[data-testid="topology-node-body-${groupId}"]`);
  const panPoint = {
    x: groupBodyBox.x + 24,
    y: groupBodyBox.y + groupBodyBox.height - 24,
  };
  await dragOnCanvas(
    page,
    panPoint,
    { x: panPoint.x + 90, y: panPoint.y + 45 },
    { button: 'right' }
  );
  const afterPan = parsePointPair(await page.locator(selectors.topologyCanvasOffset).innerText());
  expect(afterPan.x - beforePan.x).toBeGreaterThan(30);
  expect(afterPan.y - beforePan.y).toBeGreaterThan(15);

  await dragOnCanvas(
    page,
    { x: groupBodyBox.x + 18, y: groupBodyBox.y + 36 },
    { x: groupBodyBox.x + Math.min(groupBodyBox.width - 18, 160), y: groupBodyBox.y + Math.min(groupBodyBox.height - 18, 150) }
  );
  await expect
    .poll(async () => Number.parseInt(await page.locator(selectors.topologySelectedCount).innerText(), 10))
    .toBeGreaterThanOrEqual(2);

  const groupViewId = await page.locator(groupSelector).getAttribute('data-topology-view-node-id');
  if (!groupViewId) {
    throw new Error('Expanded group view id missing');
  }
  const beforeMove = await getNodeViewPosition(page, groupViewId);
  const titleCenter = await getLocatorCenter(page, `[data-testid="topology-node-title-${groupId}"]`);
  await dragOnCanvas(page, titleCenter, { x: titleCenter.x + 70, y: titleCenter.y + 30 });
  const afterMove = await getNodeViewPosition(page, groupViewId);
  expect(afterMove.x).toBeGreaterThan(beforeMove.x + 20);
  expect(afterMove.y).toBeGreaterThan(beforeMove.y + 8);
});
