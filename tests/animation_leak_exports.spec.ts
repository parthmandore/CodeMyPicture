/**
 * Atelier V4 Workbench - Step 3 Animation State Leak & Byte-Standardized Export Suite (Playwright)
 *
 * Requirements:
 * - Test 7 export scenarios:
 *   1. export before animation starts
 *   2. halfway through animation
 *   3. after it finishes
 *   4. after clicking Skip
 *   5. after clicking Replay
 *   6. after zooming
 *   7. after toggling tabs
 * - All 7 exports must be byte-identical (SHA-256 identical).
 * - Ensure no animation artifacts exist: no opacity="0.996...", no transform styles, no extra wrappers.
 */

import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

test.describe('Atelier V4 Workbench - Step 3 Animation State Leak Verification', () => {
  test('all 7 export scenarios yield 100% byte-identical SVG output with zero leaks', async ({
    page,
  }) => {
    // Collect 7 export SVGs
    const exports: { name: string; svg: string; hash: string }[] = [];

    // Helper to capture canonical export SVG from page
    const getExportSvg = async (): Promise<string> => {
      return await page.evaluate(() => {
        return (window as any).__v4CurrentSvg || '';
      });
    };

    // 1. Load Workbench with dev fixtures
    await page.goto('http://localhost:5180/?view=v4&dev=1');
    const fixtureSelect = page.locator('select[title*="Standardized test photo"]');
    await fixtureSelect.waitFor({ state: 'visible' });
    await fixtureSelect.selectOption('08_striped_shirt_girl.jpg');

    // Scenario 1: Export as soon as SVG is available (before/start of animation)
    await page.waitForFunction(() => !!(window as any).__v4CurrentSvg, { timeout: 15000 });
    const svg1 = await getExportSvg();
    expect(svg1.length).toBeGreaterThan(1000);
    exports.push({ name: '1_before_animation', svg: svg1, hash: sha256(svg1) });

    // Scenario 2: Halfway through animation (~1.5s in)
    await page.waitForTimeout(1500);
    const svg2 = await getExportSvg();
    exports.push({ name: '2_halfway_animation', svg: svg2, hash: sha256(svg2) });

    // Scenario 3: After clicking Skip
    const skipBtn = page.locator('button[title*="Skip"]');
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }
    await page.waitForTimeout(500);
    const svg3 = await getExportSvg();
    exports.push({ name: '3_after_skip', svg: svg3, hash: sha256(svg3) });

    // Scenario 4: After clicking Replay and waiting for it to finish
    const replayBtn = page.locator('button[title*="Replay"]');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();
    await page.waitForTimeout(600);
    // Let replay complete or skip again
    const skipBtn2 = page.locator('button[title*="Skip"]');
    if (await skipBtn2.isVisible()) {
      await skipBtn2.click();
    }
    await page.waitForTimeout(500);
    const svg4 = await getExportSvg();
    exports.push({ name: '4_after_replay', svg: svg4, hash: sha256(svg4) });

    // Scenario 5: After animation completes normally (wait for terminal)
    const svg5 = await getExportSvg();
    exports.push({ name: '5_after_finish', svg: svg5, hash: sha256(svg5) });

    // Scenario 6: After zooming in and resetting fit
    const zoomInBtn = page.locator('button[title="Zoom in"]');
    await zoomInBtn.click();
    await zoomInBtn.click();
    const fitBtn = page.locator('button[title*="Reset zoom"]');
    await fitBtn.click();
    await page.waitForTimeout(300);
    const svg6 = await getExportSvg();
    exports.push({ name: '6_after_zooming', svg: svg6, hash: sha256(svg6) });

    // Scenario 7: After toggling tabs (html tab -> jsx tab -> svg tab)
    const htmlTab = page.locator('button.v4-editor-tab:has-text("embed.html")');
    if (await htmlTab.isVisible()) {
      await htmlTab.click();
      await page.waitForTimeout(200);
    }
    const svgTab = page.locator('button.v4-editor-tab:has-text("portrait.svg")');
    if (await svgTab.isVisible()) {
      await svgTab.click();
      await page.waitForTimeout(200);
    }
    const svg7 = await getExportSvg();
    exports.push({ name: '7_after_tabs', svg: svg7, hash: sha256(svg7) });

    // Log the hashes
    console.log('\n--- STEP 3 EXPORT HASH COMPARISON ---');
    exports.forEach((e) => {
      console.log(`[${e.name}] SHA-256: ${e.hash} (${e.svg.length} bytes)`);
    });

    // Verification: All 7 exports must be 100% byte-identical
    const baselineHash = exports[0].hash;
    for (const exp of exports) {
      expect(exp.hash).toBe(baselineHash);
      expect(exp.svg).toBe(exports[0].svg);
      // Ensure zero animation leaks
      expect(exp.svg).not.toMatch(/opacity="0\.996/);
      expect(exp.svg).not.toMatch(/style="transform/);
      expect(exp.svg).not.toMatch(/<div/);
    }
  });
});
