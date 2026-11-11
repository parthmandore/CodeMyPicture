/**
 * CodeMyFace V4 — Background Diagnostics Web Worker
 *
 * Runs heavy mathematical quality evaluation off the main UI thread:
 * - Structural Similarity Index Measure (SSIM)
 * - Micro-speck component analysis
 * - Euclidean color error sampling
 * - Difference heatmap generation and PNG encoding
 */

import { computeSSIM } from '../engine/v4/export/ssim';
import { countSpecks } from '../engine/v4/export/speckCounter';

export interface DiagnosticsRequest {
  jobId: string;
  dataA: Uint8ClampedArray;
  dataB: Uint8ClampedArray;
  evalW: number;
  evalH: number;
  photoSample?: Uint8ClampedArray;
  svgSample?: Uint8ClampedArray;
  sampleW: number;
  sampleH: number;
  diffW: number;
  diffH: number;
}

export interface DiagnosticsResponse {
  type: 'DIAGNOSTICS_SUCCESS' | 'DIAGNOSTICS_ERROR';
  jobId: string;
  ssim?: number;
  speckCount?: number;
  colorError?: number;
  diffBlob?: Blob | null;
  diffRaw?: Uint8ClampedArray | null;
  error?: string;
}

self.onmessage = async (e: MessageEvent<DiagnosticsRequest>) => {
  const {
    jobId,
    dataA,
    dataB,
    evalW,
    evalH,
    photoSample,
    svgSample,
    sampleW,
    sampleH,
    diffW,
    diffH,
  } = e.data;

  try {
    // 1. Structural Similarity Index Measure (SSIM) on 360px downsampled canvas
    const ssim = Math.round(
      computeSSIM(
        { width: evalW, height: evalH, data: dataA },
        { width: evalW, height: evalH, data: dataB }
      ) * 1000
    ) / 1000;

    // 2. Component speck counting on SVG raster
    const { speckCount } = countSpecks({ width: evalW, height: evalH, data: dataB });

    // 3. Euclidean Color Error sampling
    let colorError = 0;
    const pData = photoSample || dataA;
    const sData = svgSample || dataB;
    const totalSamplePixels = (sampleW && sampleH) ? sampleW * sampleH : evalW * evalH;

    let sum = 0;
    let count = 0;
    const step = 4; // Subsample every 4th pixel for speed
    for (let i = 0; i < totalSamplePixels; i += step) {
      const idx = i * 4;
      const dr = pData[idx] - sData[idx];
      const dg = pData[idx + 1] - sData[idx + 1];
      const db = pData[idx + 2] - sData[idx + 2];
      sum += Math.sqrt(dr * dr + dg * dg + db * db);
      count++;
    }
    if (count > 0) {
      colorError = Math.round((sum / count) * 10) / 10;
    }

    // 4. Difference Heatmap Generation
    let diffBlob: Blob | null = null;
    let diffRaw: Uint8ClampedArray | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const diffEvalCanvas = new OffscreenCanvas(evalW, evalH);
        const deCtx = diffEvalCanvas.getContext('2d');

        if (deCtx) {
          const rawImageData = deCtx.createImageData(evalW, evalH);
          for (let i = 0; i < evalW * evalH * 4; i += 4) {
            const dr = Math.abs(dataA[i] - dataB[i]);
            const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
            const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
            rawImageData.data[i] = Math.min(255, Math.round(dr * 2.2));
            rawImageData.data[i + 1] = Math.min(255, Math.round(dg * 2.2));
            rawImageData.data[i + 2] = Math.min(255, Math.round(db * 2.2));
            rawImageData.data[i + 3] = 255;
          }
          deCtx.putImageData(rawImageData, 0, 0);

          const diffCanvas = new OffscreenCanvas(diffW, diffH);
          const dCtx = diffCanvas.getContext('2d');
          if (dCtx) {
            dCtx.drawImage(diffEvalCanvas, 0, 0, diffW, diffH);
            if (typeof (diffCanvas as any).convertToBlob === 'function') {
              diffBlob = await (diffCanvas as any).convertToBlob({ type: 'image/png' });
            }
          }
        }
      } catch (_canvasErr) {
        // Fallback: compute diffRaw buffer without OffscreenCanvas
      }
    }

    // If convertToBlob was unsupported or failed, provide fallback diffRaw
    if (!diffBlob) {
      diffRaw = new Uint8ClampedArray(evalW * evalH * 4);
      for (let i = 0; i < evalW * evalH * 4; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        diffRaw[i] = Math.min(255, Math.round(dr * 2.2));
        diffRaw[i + 1] = Math.min(255, Math.round(dg * 2.2));
        diffRaw[i + 2] = Math.min(255, Math.round(db * 2.2));
        diffRaw[i + 3] = 255;
      }
    }

    const response: DiagnosticsResponse = {
      type: 'DIAGNOSTICS_SUCCESS',
      jobId,
      ssim,
      speckCount,
      colorError,
      diffBlob,
      diffRaw,
    };

    const transferables: Transferable[] = [];
    if (diffRaw) {
      transferables.push(diffRaw.buffer);
    }

    (self as any).postMessage(response, transferables);
  } catch (err: any) {
    self.postMessage({
      type: 'DIAGNOSTICS_ERROR',
      jobId,
      error: err?.message || String(err),
    });
  }
};
