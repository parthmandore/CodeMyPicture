/**
 * CodeMyFace V4 Image Classifier
 * Classifies input images into:
 * - 'photo' (natural portraits, landscapes, pets, continuous textures)
 * - 'flat-graphic' (logos, icons, badges, UI vector art)
 * - 'text-document' (spec sheets, code documents, typography layouts)
 */

export type ClassifiedImageType = 'photo' | 'flat-graphic' | 'text-document';

export interface ImageClassificationResult {
  type: ClassifiedImageType;
  confidence: number;
  uniqueColors: number;
  flatPixelPct: number;
  lightBackgroundPct: number;
  meanSaturation: number;
  edgeGradientConcentration: number;
}

export function classifyImage(imgData: {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}): ImageClassificationResult {
  const { width: w, height: h, data } = imgData;
  const totalPixels = w * h;

  // 1. Color Palette Diversity (quantized to 15-bit color space: 5 bits per channel)
  const colorSet = new Set<number>();
  let lightBgCount = 0;
  let totalSat = 0;

  // Sample every Nth pixel for fast classification (< 5ms)
  const step = Math.max(1, Math.floor(totalPixels / 20000));
  let samples = 0;

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // 15-bit color key
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colorSet.add(key);

    // Luminance & Light background check
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 225) {
      lightBgCount++;
    }

    // Saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    totalSat += sat;
    samples++;
  }

  const uniqueColors = colorSet.size;
  const lightBackgroundPct = Math.round((lightBgCount / samples) * 100);
  const meanSaturation = Math.round((totalSat / samples) * 100) / 100;

  // 2. Spatial Flatness and Edge Gradient Concentration
  let flatPixelCount = 0;
  let highGradCount = 0;
  let totalGradSamples = 0;

  const gradStep = Math.max(2, Math.floor(Math.sqrt(totalPixels) / 150));
  for (let y = 1; y < h - 1; y += gradStep) {
    for (let x = 1; x < w - 1; x += gradStep) {
      // center idx
      const left = (y * w + (x - 1)) * 4;
      const right = (y * w + (x + 1)) * 4;
      const up = ((y - 1) * w + x) * 4;
      const down = ((y + 1) * w + x) * 4;

      const gradH = Math.abs(data[right] - data[left]) + Math.abs(data[right + 1] - data[left + 1]) + Math.abs(data[right + 2] - data[left + 2]);
      const gradV = Math.abs(data[down] - data[up]) + Math.abs(data[down + 1] - data[up + 1]) + Math.abs(data[down + 2] - data[up + 2]);
      const totalGrad = gradH + gradV;

      if (totalGrad < 8) {
        flatPixelCount++;
      } else if (totalGrad > 80) {
        highGradCount++;
      }
      totalGradSamples++;
    }
  }

  const flatPixelPct = Math.round((flatPixelCount / totalGradSamples) * 100);
  const edgeGradientConcentration = Math.round((highGradCount / totalGradSamples) * 100);

  // 3. Classification Logic
  let type: ClassifiedImageType = 'photo';
  let confidence = 0.8;

  // Text-Document: High white background (> 60%), low color saturation, many flat regions
  if (lightBackgroundPct > 55 && meanSaturation < 0.25 && uniqueColors < 350) {
    type = 'text-document';
    confidence = 0.95;
  }
  // Flat-Graphic / Logo: Low unique colors (< 120), high flat pixel ratio (> 50%)
  else if (uniqueColors < 140 && flatPixelPct > 45) {
    type = 'flat-graphic';
    confidence = 0.92;
  }

  return {
    type,
    confidence,
    uniqueColors,
    flatPixelPct,
    lightBackgroundPct,
    meanSaturation,
    edgeGradientConcentration,
  };
}
