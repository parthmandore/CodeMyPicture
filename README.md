# CodeMyPicture

**In-Browser Photograph-to-Vector Reconstruction & Creative Coding Studio**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-codemypicture.netlify.app-blue?style=flat-square)](https://codemypicture.netlify.app/)
[![Repository](https://img.shields.io/badge/GitHub-CodeMyPicture-black?style=flat-square&logo=github)](https://github.com/parthmandore/CodeMyPicture)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square)]()

---

## 1. Project Overview

**CodeMyPicture** is a high-performance client-side creative coding studio and vector reconstruction application. It converts uploaded portrait, figure, and scene photographs into genuine, standards-compliant Scalable Vector Graphics (SVG) code directly inside your web browser.

The system synthesizes scalable mathematical vector geometry rather than embedding base64 raster bitmaps or applying artificial blur filters. Users can inspect the generated markup in an integrated CodeMirror 6 code editor, evaluate real-time technical diagnostics, navigate interactive visual comparison modes (side-by-side, wipe slider, full-scene geometry overlays), and export production-ready vector assets in multiple code formats.

* **Live Demo:** [https://codemypicture.netlify.app/](https://codemypicture.netlify.app/)
* **Repository:** [https://github.com/parthmandore/CodeMyPicture](https://github.com/parthmandore/CodeMyPicture)

---

## 2. Key Features

- **Genuine Mathematical Vector Geometry**: Generates pure vector elements (`<path>`, `<rect>`, `<circle>`). Contains zero embedded raster bitmaps, zero `<image>` elements, and zero base64 payload bloat.
- **Dual Vector Synthesis Engines**: Distinct **Painting** and **Recreation** pipelines tailored for stylized artistic planar brushwork versus high-fidelity photographic vector reproduction.
- **Dual Quality Settings**: Dedicated **High Quality** and **Low Quality** profiles for each synthesis engine, balancing visual detail against SVG payload weight.
- **Full-Image Scene Coverage**: Structural analysis captures the complete composition—hair volume, head contours, clothing textures, hands, furniture, and environmental details—rather than restricting geometry to facial landmarks.
- **Interactive Studio Workbench**: Side-by-side comparison pane, interactive split-wipe slider, pan/zoom navigation (25% to 500%), and keyboard-driven Focus Mode (`F`).
- **Full-Scene Geometry Overlays**: Non-destructive diagnostic overlays for Full-Image Geometry, Edge Contours (Sobel gradient magnitude), Facial Landmarks (478-point MediaPipe mesh), and SVG Path wireframes.
- **Multi-Format Code Export**: Instant export as standalone SVG (`portrait.svg`), responsive embeddable HTML (`embed.html`), production React component (`Portrait.jsx`), or high-resolution PNG (`portrait.png`).
- **Integrated CodeMirror 6 Editor**: Dark Atelier syntax theme, color swatches, path data dimming, XML validation, and word-wrap toggles.
- **100% In-Browser Privacy**: All image decoding, computer vision inference, palette quantization, and vector tracing execute in local device memory via Web Workers and WebAssembly. No photos are ever uploaded or stored remotely.

---

## 3. Painting and Recreation Modes

CodeMyPicture provides two independent vector generation pipelines:

### Painting Mode
- **Design Intent**: Synthesizes multi-scale organic vector planar masses inspired by physical oil and acrylic portrait paintings.
- **Color Calibration**: Uses empirical biometric color sampling across facial skin, hair luminance, vermilion lip, and ambient background tones. Eliminates artificial facial mask cutouts and produces continuous, expressive planar forms.
- **Edge Character**: Organic vector boundaries with 100% opaque planar layering and zero transparent seams.

### Recreation Mode
- **Design Intent**: A fidelity-focused photographic vector reconstruction pipeline.
- **Structure Tracking**: Accurately preserves fine facial structure, iris detail, hair volume, glasses frames, and narrow clothing patterns.
- **Geometric Configuration**: Configured with subpixel coordinate precision (`roundcoords: 2`), tight curve tolerances (`ltres: 0.6`, `qtres: 0.6`), micro-speck preservation (`pathomit: 3`), and zero blur filters.

---

## 4. High and Low Quality Options

Both modes provide two verified quality profiles:

| Mode | Quality Tier | Target Characteristics | Typical Use Case |
| :--- | :--- | :--- | :--- |
| **Painting** | **High Quality** | Multi-layer planar depth, subtle shading gradations, nuanced facial planes. | Digital art prints, high-resolution hero illustrations. |
| **Painting** | **Low Quality** | Broad painterly planes, streamlined path counts, fast browser rendering. | Lightweight web assets, avatars, mobile UI graphics. |
| **Recreation** | **High Quality** | Dense contour tracking, tight curve fitting (0.6px tolerance), dedicated tones. | Detailed vector reproduction, pen-plotter vectorization. |
| **Recreation** | **Low Quality** | Essential structural contours and tonal masses with reduced path density. | Scalable web graphics, responsive vector placeholders. |

---

## 5. Technology Stack

- **UI Framework**: React 19 (`react`, `react-dom`)
- **Language**: TypeScript 5.9 / 6.0 (`typescript`)
- **Build Tool & Bundler**: Vite 8 (`vite`, `@vitejs/plugin-react`)
- **Code Editor**: CodeMirror 6 (`codemirror`, `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lang-xml`, `@codemirror/lang-html`, `@codemirror/lang-javascript`, `@lezer/highlight`)
- **Computer Vision**: MediaPipe Tasks Vision WebAssembly (`@mediapipe/tasks-vision`)
- **Vector Tracing**: ImageTracerJS (`imagetracerjs`) with custom planar optimization
- **Iconography**: Lucide React (`lucide-react`)
- **Compression Telemetry**: Browser native `CompressionStream('gzip')` API

---

## 6. Architecture Overview

```text
[ Upload & Calibration Stage ]
       │
       ├── Image Ingestion & Buffer Validation (imageValidator.ts, imageLoader.ts)
       ├── Computer Vision Landmarks (MediaPipe Tasks Vision WASM & TFLite)
       └── Full-Image Sobel Edge & Contour Analysis (imageGeometryService.ts)
       │
[ Studio Workbench State Machine ]
       │
       ├── Mode & Quality Configuration (Painting / Recreation · High / Low)
       ├── Background Web Worker Dispatch (v4PipelineWorker.ts)
       │       ├── Palette Quantization & Biometric Tones (colorAnalysis.ts)
       │       ├── Multi-Scale Vector Planar Tracing (paintingEngine.ts / recreationEngine.ts)
       │       └── SVG String Generation & Path Optimization (svgOptimizer.ts)
       │
[ Studio Workbench Presentation ]
       ├── Viewport Pane (V4ResultPane.tsx): Side-by-side, Wipe Slider, Overlays, Focus Mode
       ├── Code Editor (V4CodeEditor.tsx): CodeMirror 6, SVG/HTML/JSX/Diagnostics Tabs
       ├── Terminal & Status (V4Terminal.tsx): Execution telemetry, duration, status
       └── Export Modal (V4ExportModal.tsx): Standalone SVG, HTML, JSX, PNG
```

---

## 7. How Image Processing Works

1. **Pre-Decoding Validation**: Validates file existence, MIME type (JPEG, PNG, WebP), and byte size (up to 25 MB). Checks binary magic bytes to prevent malformed buffer ingestion.
2. **In-Browser Decoding**: Decodes image bytes into an ephemeral `HTMLImageElement` via `URL.createObjectURL()`. Dimensions, aspect ratio, and luminance metrics are calculated.
3. **Computer Vision & Full-Image Edge Analysis**:
   - MediaPipe's `FaceLandmarker` WASM model detects 478 biometric landmarks when facial features are visible.
   - Concurrently, `imageGeometryService` runs a 3×3 Sobel gradient operator across luminance data on an in-memory canvas, applying adaptive thresholding and Moore-neighbor boundary tracing to generate polylines covering hair volume, head boundaries, clothing folds, body contours, and scene objects.
4. **Worker-Based Vector Synthesis**: The raster image buffer, selected mode, and quality settings are posted to `v4PipelineWorker.ts`. The worker executes palette clustering, tone calibration, and path tracing in an isolated background thread.
5. **Path Optimization & Cleanup**: `svgCleaner.ts` formats the XML structure, strips redundant whitespace, normalizes viewBox coordinates, and prepares the document for CodeMirror and DOM rendering.

---

## 8. Export Functionality

| Format | File Name | Description |
| :--- | :--- | :--- |
| **SVG Document** | `portrait.svg` | Standards-compliant standalone SVG vector file. Fully editable in Figma, Adobe Illustrator, Inkscape, or pen-plotter workflows. |
| **HTML Embed** | `embed.html` | Self-contained HTML5 file with dark-theme viewport framing and responsive styling. Ready for browser preview or iframe embedding. |
| **React Component** | `Portrait.jsx` | Production React component formatted with valid JSX attributes (`strokeWidth`, `fillRule`) and TypeScript prop types. |
| **PNG Bitmap** | `portrait.png` | High-resolution raster bitmap rendered directly from the vector geometry onto an HTML5 canvas for rapid sharing. |

---

## 9. Privacy and Local Processing

CodeMyPicture is engineered around strict, non-negotiable client-side privacy:

- **Zero Server Uploads**: No image pixels, biometric vectors, or rendered SVG documents are ever transmitted over the network or stored in external databases.
- **Local In-Memory Execution**: Computer vision inference, color quantization, and SVG tracing execute strictly in browser Web Workers and WebAssembly memory.
- **Ephemeral Lifecycles**: Image object URLs (`blob:`) and decoded canvas buffers are explicitly revoked via `safeRevokeObjectURL()` whenever an image is cleared or replaced.
- **Offline Capable**: All required machine learning models and WebAssembly modules are hosted locally within `public/`, eliminating any runtime dependency on third-party CDNs.

---

## 10. Installation & Setup

### Prerequisites
- **Node.js**: `20.0.0` or higher
- **npm**: `9.0.0` or higher
- **Web Browser**: Modern browser with WebAssembly support (Chrome, Edge, Firefox, Safari)

### Installation
```bash
# Clone repository
git clone https://github.com/parthmandore/CodeMyPicture.git
cd CodeMyPicture

# Install dependencies
npm install
```

---

## 11. Development Commands

```bash
# Start local development server with Vite hot module replacement
npm run dev
```

By default, Vite serves the application at `http://localhost:5173/`.

---

## 12. Production Build

```bash
# Type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

Build outputs are generated into the `dist/` directory:
- `dist/index.html`
- `dist/assets/index-[hash].js`
- `dist/assets/index-[hash].css`
- `dist/assets/v4PipelineWorker-[hash].js`

---

## 13. Repository Structure

```text
CodeMyPicture/
├── public/
│   ├── favicon.svg                               # Application vector icon
│   ├── face_landmarker.task                      # MediaPipe 478-point facial landmark model
│   ├── selfie_multiclass_256x256.tflite          # MediaPipe selfie segmentation model
│   └── wasm/                                     # MediaPipe WebAssembly binaries and JS runtime
├── src/
│   ├── App.tsx                                   # Root application orchestrator
│   ├── main.tsx                                  # React DOM entry point
│   ├── flags.ts                                  # Feature flags
│   ├── vite-env.d.ts                             # Vite environment types
│   ├── components/
│   │   ├── common/                               # Common components (ErrorAlert)
│   │   ├── landing/                              # Landing page technical sections
│   │   ├── layout/                               # Layout shell (Header, Footer)
│   │   ├── studio/                               # Studio Workbench components
│   │   │   ├── StepIndicator.tsx                 # Pipeline stage indicator
│   │   │   ├── V4DiagnosticWorkbench.tsx         # Main Studio Workbench controller
│   │   │   └── v4/                               # ResultPane, CodeEditor, Terminal, Overlays
│   │   └── upload/                               # Dropzone, PhotoPreview, UploadWorkflow
│   ├── engine/
│   │   └── v4/                                   # Vector synthesis engines
│   │       ├── colorAnalysis.ts                  # Biometric tone extraction
│   │       ├── paintingEngine.ts                 # Painting mode planar engine
│   │       ├── recreationEngine.ts               # Recreation mode high-fidelity engine
│   │       ├── svgOptimizer.ts                   # SVG path optimizer
│   │       ├── tiers.ts                          # High/Low quality configurations
│   │       ├── types.ts                          # Engine interfaces and contracts
│   │       ├── v4Pipeline.ts                     # Synthesis coordinator
│   │       ├── sketch/                           # Charcoal sketch vector engine
│   │       ├── export/                           # SSIM, speck counter, and standalone HTML
│   │       └── sizeOptimizer/                    # Vector size and path optimizers
│   ├── services/
│   │   ├── faceDetection/                        # MediaPipe Tasks Vision wrapper
│   │   ├── geometry/                             # Full-image Sobel edge and contour tracer
│   │   └── segmentation/                         # Image segmentation services
│   ├── styles/                                   # Atelier dark-theme stylesheets
│   ├── types/                                    # Shared TypeScript interfaces
│   ├── utils/                                    # Utility helpers
│   └── workers/
│       └── v4PipelineWorker.ts                   # Web Worker for non-blocking vectorization
├── .env.example                                  # Template environment configuration
├── .gitignore                                    # Production Git ignore rules
├── index.html                                    # HTML5 application shell
├── package.json                                  # Project manifest and dependencies
├── package-lock.json                             # Dependency lockfile
├── tsconfig.json                                 # TypeScript compiler configuration
├── vercel.json                                   # Production deployment routing
└── vite.config.ts                                # Vite configuration
```

---

## 14. Known Limitations

- **Image Complexity vs. File Weight**: Highly intricate scenes with complex textures (e.g. dense foliage or knitted knitwear) naturally generate higher path counts and larger SVG payloads.
- **Severe Lighting Conditions**: Extremely underexposed or blown-out photographs offer low luminance contrast, which may reduce edge detection fidelity.
- **Pose Dependencies for Facial Biometrics**: MediaPipe facial landmark tracking requires an unobstructed front or semi-profile pose (though full-image geometry and contours execute regardless of face orientation).
- **Browser Memory Limits**: Mobile browsers with strict tab memory limits (<512 MB) may terminate Web Workers when processing raw camera photos exceeding 20 megapixels; downscaling images to under 4000px on the longest side is recommended.

---

## 15. License & Project Information

- **Live Deployment**: [https://codemypicture.netlify.app/](https://codemypicture.netlify.app/)
- **Repository**: [https://github.com/parthmandore/CodeMyPicture](https://github.com/parthmandore/CodeMyPicture)
- **Author**: Parth Mandore
