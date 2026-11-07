import React from 'react';
import { Palette, Camera } from 'lucide-react';

export const ModeComparisonSection: React.FC = () => {
  return (
    <section id="modes" className="landing-section" aria-labelledby="modes-heading">
      <div className="landing-section__header">
        <div className="landing-section__badge mono">
          <span>01 // DUAL SYNTHESIS ENGINES</span>
        </div>
        <h2 id="modes-heading" className="landing-section__title">
          Painting versus Recreation
        </h2>
        <p className="landing-section__subtitle">
          CodeMyPicture provides two separate vector synthesis pipelines. Choose expressive digital brushwork
          or high-fidelity photographic reconstruction, with dedicated quality tiers for each.
        </p>
      </div>

      <div className="landing-modes-grid">
        {/* Mode 1: Painting */}
        <div className="landing-mode-card">
          <div className="landing-mode-card__top">
            <div className="landing-mode-card__icon-box">
              <Palette size={20} className="landing-mode-icon--painting" />
            </div>
            <div className="landing-mode-card__tag mono">OPTION A</div>
          </div>

          <h3 className="landing-mode-card__title">Painting Mode</h3>
          <p className="landing-mode-card__tagline">
            Organic Planar Brushwork & Biometric Color Recovery
          </p>

          <p className="landing-mode-card__desc">
            Synthesizes multi-scale vector layers that mimic physical paint strokes and continuous planar masses.
            Empirical color recovery samples genuine skin, vermilion lip, hair volume, and ambient background tones
            from the original photograph, producing warm, cohesive digital artwork without synthetic facial overlays or blur filters.
          </p>

          <div className="landing-mode-tiers">
            <div className="landing-mode-tier">
              <div className="landing-tier-header">
                <span className="landing-tier-badge mono">HIGH QUALITY</span>
                <span className="landing-tier-summary">Detailed Planar Depth</span>
              </div>
              <p className="landing-tier-desc">
                Multi-layer underpainting with fine tonal gradations, subtle facial shading, and preserved likeness.
              </p>
            </div>

            <div className="landing-mode-tier">
              <div className="landing-tier-header">
                <span className="landing-tier-badge mono">LOW QUALITY</span>
                <span className="landing-tier-summary">Broad Brushwork</span>
              </div>
              <p className="landing-tier-desc">
                Balanced planar masses optimized for rapid web loading and compact SVG file weight while retaining core likeness.
              </p>
            </div>
          </div>

          <div className="landing-mode-specs mono">
            <span className="mode-spec-item">Geometry: Multi-Scale Organic Planes</span>
            <span className="mode-spec-item">Color: 4-Point Biometric Calibration</span>
            <span className="mode-spec-item">Seams: 100% Opaque (Zero Gaps)</span>
          </div>
        </div>

        {/* Mode 2: Recreation */}
        <div className="landing-mode-card landing-mode-card--recreation">
          <div className="landing-mode-card__top">
            <div className="landing-mode-card__icon-box">
              <Camera size={20} className="landing-mode-icon--recreation" />
            </div>
            <div className="landing-mode-card__tag mono">OPTION B</div>
          </div>

          <h3 className="landing-mode-card__title">Recreation Mode</h3>
          <p className="landing-mode-card__tagline">
            Photographic Vector Copy & High Contour Fidelity
          </p>

          <p className="landing-mode-card__desc">
            A fidelity-focused vector reconstruction pipeline. Faithfully preserves fine facial structure,
            iris details, hair texture, narrow clothing patterns (such as thin horizontal stripes or lace), and
            ambient scene objects using subpixel coordinate precision and tight curve fitting.
          </p>

          <div className="landing-mode-tiers">
            <div className="landing-mode-tier">
              <div className="landing-tier-header">
                <span className="landing-tier-badge mono">HIGH QUALITY</span>
                <span className="landing-tier-summary">High-Density Contours</span>
              </div>
              <p className="landing-tier-desc">
                Tight curve fitting (0.6px tolerance), micro-detail preservation, and dedicated tonal bands for high fidelity.
              </p>
            </div>

            <div className="landing-mode-tier">
              <div className="landing-tier-header">
                <span className="landing-tier-badge mono">LOW QUALITY</span>
                <span className="landing-tier-summary">Compact Geometry</span>
              </div>
              <p className="landing-tier-desc">
                Essential structural silhouettes and tonal regions with simplified path counts for minimal payload size.
              </p>
            </div>
          </div>

          <div className="landing-mode-specs mono">
            <span className="mode-spec-item">Coordinates: Subpixel (roundcoords: 2)</span>
            <span className="mode-spec-item">Tolerance: Tight (ltres: 0.6, qtres: 0.6)</span>
            <span className="mode-spec-item">Micro-Detail: Preserved (pathomit: 3)</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ModeComparisonSection;
