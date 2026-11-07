import React from 'react';
export const DiagnosticsInfoSection: React.FC = () => {
  const metrics = [
    { label: 'Source Dimensions & Aspect Ratio', detail: 'Width, height, and computed aspect ratio' },
    { label: 'Generated SVG Paths', detail: 'Count of mathematical <path> elements' },
    { label: 'Total Shapes & Elements', detail: 'Primitives (<rect>, <circle>, <path>) vs structural groups' },
    { label: 'Distinct SVG Fill Colors', detail: 'Exact document colors with visual palette chips' },
    { label: 'Source Colors Sampled', detail: 'Biometric calibration anchors (skin, hair, lips, bg)' },
    { label: 'Raw SVG Payload Size', detail: 'Precise byte size of generated XML code' },
    { label: 'Gzipped Transfer Size', detail: 'Calculated via native browser CompressionStream' },
    { label: 'Synthesis Execution Duration', detail: 'Worker processing elapsed time in ms/s' },
    { label: 'Reconstruction Mode', detail: 'Active pipeline: Painting vs Recreation' },
    { label: 'Selected Quality Setting', detail: 'Active resolution tier: High vs Low' },
    { label: 'Processing Status Verification', detail: 'Real-time telemetry (Success, In Progress, Idle, Error)' },
  ];

  return (
    <section id="diagnostics" className="landing-section" aria-labelledby="diagnostics-heading">
      <div className="landing-section__header">
        <div className="landing-section__badge mono">
          <span>05 // TELEMETRY & VERIFICATION</span>
        </div>
        <h2 id="diagnostics-heading" className="landing-section__title">
          Studio Diagnostics & Technical Telemetry
        </h2>
        <p className="landing-section__subtitle">
          Instead of relying on ambiguous accuracy claims, the Studio Workbench measures 11 verified
          engineering values in real time so you understand the exact geometry and footprint of every generated SVG.
        </p>
      </div>

      <div className="landing-diag-card">
        <div className="landing-diag-header">
          <div className="landing-diag-status mono">
            <span className="landing-diag-dot" />
            <span>STUDIO BENCHMARK TELEMETRY // 11 METRICS ACTIVE</span>
          </div>
          <span className="landing-diag-hint mono">Available live in Studio Workbench</span>
        </div>

        <div className="landing-diag-grid">
          {metrics.map((m, idx) => (
            <div key={idx} className="landing-diag-item">
              <span className="landing-diag-num mono">{String(idx + 1).padStart(2, '0')}.</span>
              <div className="landing-diag-text">
                <span className="landing-diag-label">{m.label}</span>
                <span className="landing-diag-detail">{m.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DiagnosticsInfoSection;
