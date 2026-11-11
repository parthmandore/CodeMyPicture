/**
 * CodeMyFace V4 — Types & Interfaces
 *
 * Grounded in empirical photo evidence: authentic pixel sampling,
 * feature geometry extraction without cartoon templates, and multi-candidate comparison.
 */

import { NormalizedLandmark } from '../../services/faceDetection/types';

export type WorkbenchStatus =
  | 'idle'
  | 'analyzing'
  | 'painting'
  | 'done'
  | 'skipped'
  | 'cancelled'
  | 'error';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface PaletteEntry {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
}

export interface ColorPaletteAnalysis {
  skin: {
    base: string;          // Hex code of median skin tone
    baseRgb: [number, number, number];
    shadow: string;        // Shadow skin tone (under jaw, nose side)
    shadowRgb: [number, number, number];
    highlight: string;     // Highlight skin tone (forehead, nose ridge)
    highlightRgb: [number, number, number];
    transition?: string;   // Warm intermediate transition tone
    transitionRgb?: [number, number, number];
    tones?: string[];      // 5-7 smooth Lab tones (highlight -> shadow)
    palette14?: PaletteEntry[]; // Step 3 Dedicated >= 12-level skin palette
    averageRgb?: [number, number, number];
    averageHex?: string;
    luminance: number;     // 0-1 relative luminance
    status?: 'found' | 'not found';
  };
  iris: {
    hex: string;
    rgb: [number, number, number];
    luminance: number;
    estimatedCategory: 'blue' | 'green' | 'hazel' | 'brown' | 'dark';
    leftIrisSampled: string;
    rightIrisSampled: string;
    status?: 'found' | 'not found';
  };
  sclera: {
    hex: string;
    rgb: [number, number, number];
    status?: 'found' | 'not found';
  };
  lips: {
    base: string;
    upper: string;
    lower: string;
    baseRgb: [number, number, number];
    contrastToSkin: number;
    status?: 'found' | 'not found';
  };
  teeth?: {
    hex: string;
    rgb: [number, number, number];
    visible: boolean;
    status?: 'found' | 'not found';
  };
  brows: {
    hex: string;
    rgb: [number, number, number];
    status?: 'found' | 'not found';
  };
  hair: {
    base: string;
    highlight: string;
    shadow?: string;
    shadowRgb?: [number, number, number];
    baseRgb: [number, number, number];
    tones?: string[];      // 3-5 Lab tones for rich curl & texture definition
    palette16?: PaletteEntry[]; // Step 3 Dedicated >= 16-level dark-range hair palette
    luminance: number;
    hasTonalDepth?: boolean;
    status?: 'found' | 'not found';
  };
  beard?: {
    base: string;
    baseRgb: [number, number, number];
    shadow: string;
    shadowRgb: [number, number, number];
    highlight: string;
    highlightRgb: [number, number, number];
    tones?: string[];
    present: boolean;
    coverage: number;
    status?: 'found' | 'not found';
  };
  clothing: {
    hex: string;
    rgb: [number, number, number];
    shadow?: string;
    shadowRgb?: [number, number, number];
    highlight?: string;
    highlightRgb?: [number, number, number];
    tones?: string[];
    hasTonalVariance?: boolean;
    status?: 'found' | 'not found';
  };
  background: {
    hex: string;
    rgb: [number, number, number];
    status?: 'found' | 'not found';
  };
  averagePhotoColor?: string; // Average hex color of the entire photograph
}

export interface V4StyleControls {
  paintingDetail?: number;           // 1 (broad painterly) - 5 (fine detail), default 3
  colorComplexity?: number;          // 1 (harmonious minimal) - 5 (rich gamut), default 3
  edgeStrength?: number;             // 1 (soft impressionist) - 5 (defined contours), default 3
  backgroundSimplification?: number; // 1 (ambient texture) - 5 (clean studio), default 4
}

export type V4CandidateId = 'candidate-a' | 'candidate-b' | 'candidate-c';

export interface V4CandidateResult {
  candidateId: V4CandidateId;
  name: string;
  title: string;
  description: string;
  svgString: string;
  metrics: {
    pathCount: number;
    nodeCount: number;
    fileSizeKb: number;
    executionTimeMs: number;
  };
  metadata?: Record<string, unknown>;
}

export interface V4LayerVisibility {
  bg?: boolean;
  skin?: boolean;
  hair?: boolean;
  beard?: boolean;
  clothes?: boolean;
  features?: boolean;
  glasses?: boolean;
}

export type QualitySetting = 'high' | 'medium' | 'low';

export interface V4ExperimentOptions {
  // Mode flag: 'painting' (artistic interpretation) vs 'recreation' (faithful vector copy)
  mode?: 'painting' | 'recreation';
  quality?: QualitySetting;
  // Detail Preset (Low 16, Medium 32, High 48, Max 64+)
  detailPreset?: 'low' | 'medium' | 'high' | 'max';
  targetColors?: number;

  // Experiment A: Vector Tracer options
  tracerColors?: number;
  tracerBlur?: number;
  tracerPathOmit?: number;
  tracerPreset?: 'posterized2' | 'curvy' | 'smoothed' | 'detailed' | 'default';

  // Experiment B: Feature options
  eyeRefinement?: 'faithful' | 'expressive';
  browStyle?: 'natural-fill' | 'strand-strokes';
  lipDetail?: 'planar' | 'segmented';

  // Experiment C: Hybrid options
  shadingBands?: number;
  clothingSimplification?: number;
  hasGlasses?: boolean;

  // Genuine Style Controls
  styleControls?: V4StyleControls;

  // Debug Layer Visibility Toggles
  layerVisibility?: V4LayerVisibility;

  // Multiple faces
  detectedFaceCount?: number;
  allFacesLandmarks?: NormalizedLandmark[][];

  // Step 2 & 3 & 4 Options
  useSyntheticOverlays?: boolean;
  skinSoftEdge?: boolean;
  skinSoftEdgeRadius?: number;
  skyWallGradient?: boolean;

  // Step 2 Hole Detection Debug Switch
  debugMagentaBase?: boolean;
  selectedTier?: string;
  targetSizeKb?: number;
  useAverageColorBase?: boolean;
}

export interface V4PipelineResult {
  candidates: Record<V4CandidateId, V4CandidateResult>;
  colorPalette: ColorPaletteAnalysis;
  dimensions: {
    width: number;
    height: number;
  };
  executionTimeMs: number;
  tiers?: any;
}
