import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Atelier V4 Workbench - Step 5 Layout Bugs & Responsive Viewport', () => {
  test.beforeEach(async () => {
    test.setTimeout(90000);
  });

  test.beforeAll(async () => {
    const dir = path.resolve('screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const VIEWPORTS = [
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '375x667', width: 375, height: 667, isMobile: true },
  ];

  for (const vp of VIEWPORTS) {
    test(`Layout verification at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:5180/?view=v4&dev=1&empty=1');

      // Select test photo
      const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
      await fixtureSelect.waitFor({ state: 'visible' });
      await fixtureSelect.selectOption('01_woman_blue_top.jpg');

      await page.waitForFunction(() => !!(window as any).__v4CurrentSvg, { timeout: 45000 });
      await page.waitForTimeout(1000);

      // Skip animation if still in progress so we test the final workbench layout
      const skipBtn = page.locator('button[title*="Skip"]');
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // If mobile, ensure we switch to the result tab
      if (vp.isMobile) {
        const resultTabBtn = page.locator('.v4-mobile-tabs button', { hasText: 'Result' });
        if (await resultTabBtn.isVisible().catch(() => false)) {
          await resultTabBtn.click().catch(() => {});
          await page.waitForTimeout(300);
        }
      }

      // 1. Assert no sideways scroll on window / document
      const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const docClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(docScrollWidth).toBeLessThanOrEqual(docClientWidth + 1);

      const rightPane = page.locator('.v4-right-pane');
      await expect(rightPane).toBeVisible();

      // 2. Assert no sideways scroll on right pane
      const rightPaneScrollWidth = await rightPane.evaluate((el) => el.scrollWidth);
      const rightPaneClientWidth = await rightPane.evaluate((el) => el.clientWidth);
      expect(rightPaneScrollWidth).toBeLessThanOrEqual(rightPaneClientWidth + 1);

      // 3. Assert no element starts left of its pane
      const rightPaneBox = await rightPane.boundingBox();
      expect(rightPaneBox).not.toBeNull();
      if (!rightPaneBox) return;

      // Check toolbar button ("Painting") does not lose its first letter
      const paintingBtn = page.locator('.v4-pane-toolbar button', { hasText: 'Painting' });
      await expect(paintingBtn).toBeVisible();
      const paintingBtnBox = await paintingBtn.boundingBox();
      expect(paintingBtnBox).not.toBeNull();
      if (paintingBtnBox) {
        expect(paintingBtnBox.x).toBeGreaterThanOrEqual(rightPaneBox.x - 1);
      }

      // Check caption does not lose its first letter
      const captionFilename = page.locator('.atelier-caption-filename');
      await expect(captionFilename).toBeVisible();
      const captionBox = await captionFilename.boundingBox();
      expect(captionBox).not.toBeNull();
      if (captionBox) {
        expect(captionBox.x).toBeGreaterThanOrEqual(rightPaneBox.x - 1);
      }

      // 4. Assert frame height is at least 50% of the pane height
      const atelierFrame = page.locator('.atelier-frame');
      await expect(atelierFrame).toBeVisible();
      const frameBox = await atelierFrame.boundingBox();
      expect(frameBox).not.toBeNull();
      if (frameBox) {
        const heightRatio = frameBox.height / rightPaneBox.height;
        expect(heightRatio).toBeGreaterThanOrEqual(0.50);
      }

      // 5. Assert the whole photo is inside the frame at Fit (no overflow/cropping)
      const previewImg = page.locator('.atelier-frame img[alt="Vector painting result"], .atelier-frame .v4-painting-canvas').first();
      await expect(previewImg).toBeVisible();
      const imgBox = await previewImg.boundingBox();
      expect(imgBox).not.toBeNull();
      if (imgBox && frameBox) {
        expect(imgBox.y).toBeGreaterThanOrEqual(frameBox.y - 2);
        expect(imgBox.y + imgBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 2);
        expect(imgBox.x).toBeGreaterThanOrEqual(frameBox.x - 2);
        expect(imgBox.x + imgBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 2);
      }

      // 6. Capture screenshot
      const screenshotPath = path.resolve(`screenshots/step5_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    });
  }

  test('Zoom and pan apply ONLY inside the picture frame, never to the controls', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:5180/?view=v4&dev=1&empty=1');

    const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
    await fixtureSelect.waitFor({ state: 'visible' });
    await fixtureSelect.selectOption('01_woman_blue_top.jpg');

    await page.waitForFunction(() => !!(window as any).__v4CurrentSvg, { timeout: 45000 });
    await page.waitForTimeout(1000);

    const skipBtn = page.locator('button[title*="Skip"]');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => {});
    }

    // Record initial bounding boxes of controls and caption
    const controlRow = page.locator('.atelier-control-row');
    const caption = page.locator('.atelier-caption');
    const initialControlBox = await controlRow.boundingBox();
    const initialCaptionBox = await caption.boundingBox();

    // Click Zoom In (+) three times
    const zoomInBtn = page.locator('button[title*="Zoom in"]');
    await zoomInBtn.click();
    await zoomInBtn.click();
    await zoomInBtn.click();
    await page.waitForTimeout(300);

    // Verify zoom level indicator increased beyond 100%
    const zoomIndicator = page.locator('.v4-pane-toolbar span', { hasText: '%' });
    const zoomText = await zoomIndicator.innerText();
    expect(parseInt(zoomText, 10)).toBeGreaterThan(100);

    // Assert that controls and caption have NOT moved or scaled
    const zoomedControlBox = await controlRow.boundingBox();
    const zoomedCaptionBox = await caption.boundingBox();
    expect(zoomedControlBox?.x).toBe(initialControlBox?.x);
    expect(zoomedControlBox?.y).toBe(initialControlBox?.y);
    expect(zoomedControlBox?.width).toBe(initialControlBox?.width);
    expect(zoomedCaptionBox?.x).toBe(initialCaptionBox?.x);
    expect(zoomedCaptionBox?.y).toBe(initialCaptionBox?.y);

    // Click Fit button
    const fitBtn = page.locator('button[title*="Reset zoom"]');
    await fitBtn.click();
    await page.waitForTimeout(300);

    // Verify zoom level reset to 100%
    const resetZoomText = await zoomIndicator.innerText();
    expect(resetZoomText).toBe('100%');
  });

  test('Terminal log collapses to one line with summary and [L] open log', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:5180/?view=v4&dev=1&empty=1');

    const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
    await fixtureSelect.waitFor({ state: 'visible' });
    await fixtureSelect.selectOption('01_woman_blue_top.jpg');

    await page.waitForFunction(() => !!(window as any).__v4CurrentSvg, { timeout: 45000 });
    await page.waitForTimeout(1000);

    const skipBtn = page.locator('button[title*="Skip"]');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => {});
    }

    // Assert terminal is collapsed to one line
    const collapsedBar = page.locator('.v4-terminal-collapsed-bar');
    await expect(collapsedBar).toBeVisible();

    const previewText = await page.locator('.v4-terminal-collapsed-preview').innerText();
    expect(previewText).toMatch(/Done ·.*· SSIM/i);

    const openLogText = await page.locator('.v4-terminal-expand-text').innerText();
    expect(openLogText.toLowerCase()).toContain('open log');

    // Press 'L' to open log
    await page.keyboard.press('l');
    await page.waitForTimeout(300);

    // Assert summary card is visible
    const summaryCard = page.locator('.atelier-summary-card');
    await expect(summaryCard).toBeVisible();
    await expect(page.locator('.atelier-summary-header')).toHaveText('Studio Synthesis Record');
  });

  test('CodeMirror dims path data (d="...") in muted colour', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:5180/?view=v4&dev=1&empty=1');

    const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
    await fixtureSelect.waitFor({ state: 'visible' });
    await fixtureSelect.selectOption('01_woman_blue_top.jpg');

    await page.waitForFunction(() => !!(window as any).__v4CurrentSvg, { timeout: 45000 });
    await page.waitForTimeout(1000);

    const skipBtn = page.locator('button[title*="Skip"]');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => {});
    }

    // Check for .cm-path-data elements in CodeMirror
    const pathDataElems = page.locator('.cm-path-data');
    const count = await pathDataElems.count();
    expect(count).toBeGreaterThan(0);

    const opacity = await pathDataElems.first().evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
    expect(parseFloat(opacity)).toBeCloseTo(0.55, 1);
  });
});
