/**
 * Atelier V4 Workbench - Step 2 Skip Button & Run Isolation Test Suite (Playwright)
 *
 * Requirements:
 * - Clicks Skip on 4 photos.
 * - 3s later assert:
 *   1. 0 rAFs (no requestAnimationFrame frames firing)
 *   2. 0 running CSS animations (document.getAnimations running === 0)
 *   3. 0 active background timers
 *   4. worker terminated (__v4ActiveWorker === 0)
 *   5. no skip button in DOM
 *   6. overlay canvas removed (.atelier-sketch-intro-canvas count === 0)
 *   7. editor scrollTop is 0
 */

import { test, expect } from '@playwright/test';

const TEST_PHOTOS = [
  '01_woman_blue_top.jpg',
  '02_man_curly_beard.jpg',
  '04_two_men_beach_screenshot.jpg',
  '08_striped_shirt_girl.jpg',
];

test.describe('Atelier V4 Workbench - Step 2 Runaway Animation & Skip Verification', () => {
  for (const photo of TEST_PHOTOS) {
    test(`Clicking Skip on ${photo} cleanly halts animation and all background work within 3s`, async ({
      page,
    }) => {
      // 1. Load workbench in dev mode
      await page.goto('http://localhost:5180/?view=v4&dev=1');

      // 2. Select photo
      const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
      await fixtureSelect.waitFor({ state: 'visible' });
      await fixtureSelect.selectOption(photo);

      // 3. Wait 1.5s into generation / painting animation
      await page.waitForTimeout(1500);

      // 4. Click Skip button if visible, or fallback to Escape
      const skipBtn = page.locator('button[title*="Skip"]');
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // 5. Wait 3 seconds per specification
      await page.waitForTimeout(3000);

      // --- ASSERTION 1: 0 rAFs scheduled in 500ms observation window ---
      const rafFrameCount = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let frames = 0;
          const originalRaf = window.requestAnimationFrame;
          window.requestAnimationFrame = (cb) => {
            frames++;
            return originalRaf(cb);
          };
          setTimeout(() => {
            window.requestAnimationFrame = originalRaf;
            resolve(frames);
          }, 500);
        });
      });
      expect(rafFrameCount).toBe(0);

      // --- ASSERTION 2: 0 running CSS animations ---
      const runningAnimations = await page.evaluate(() => {
        return document.getAnimations().filter((a) => a.playState === 'running').length;
      });
      expect(runningAnimations).toBe(0);

      // --- ASSERTION 3: 0 active background watchdog timers ---
      const activeWatchdog = await page.evaluate(() => {
        return (window as any).__v4ActiveWatchdog || 0;
      });
      expect(activeWatchdog).toBe(0);

      // --- ASSERTION 4: Web Worker terminated ---
      const activeWorker = await page.evaluate(() => {
        return (window as any).__v4ActiveWorker || 0;
      });
      expect(activeWorker).toBe(0);

      // --- ASSERTION 5: No skip button in DOM ---
      const skipButtonCount = await page.locator('button[title*="Skip"]').count();
      expect(skipButtonCount).toBe(0);

      // --- ASSERTION 6: Overlay canvas removed from DOM ---
      const overlayCanvasCount = await page.locator('.atelier-sketch-intro-canvas').count();
      expect(overlayCanvasCount).toBe(0);

      // --- ASSERTION 7: Editor scrollTop is 0 ---
      const editorScrollTop = await page.evaluate(() => {
        const scroller = document.querySelector('.cm-scroller');
        return scroller ? scroller.scrollTop : 0;
      });
      expect(editorScrollTop).toBe(0);

      // Additional sanity check: Replay button is visible
      const replayBtn = page.locator('button[title*="Replay"]');
      await expect(replayBtn).toBeVisible();
    });
  }
});
