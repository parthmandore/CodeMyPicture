import React from 'react';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';

export interface FooterProps {
  onOpenPrivacy?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy }) => {
  return (
    <footer className="studio-footer" role="contentinfo">
      <div className="studio-footer__inner">
        {/* Brand & Purpose Column */}
        <div className="studio-footer__brand-col">
          <div className="studio-footer__wordmark">
            CodeMy<em className="v4-wordmark-face">Picture</em>
          </div>
          <p className="studio-footer__tagline">
            Photograph to Scalable Vector Graphics reconstruction studio. Converts portrait and scene
            photographs into genuine, editable SVG code directly inside local browser memory.
          </p>
          <div className="studio-footer__privacy-note mono">
            <ShieldCheck size={13} style={{ color: 'var(--moss)' }} />
            <span>100% In-Browser Execution · Zero Cloud Uploads</span>
          </div>
        </div>

        {/* Navigation & Live Deployment */}
        <div className="studio-footer__links-col">
          <div className="studio-footer__col-heading mono">TOOLS & CONVERTERS</div>
          <ul className="studio-footer__link-list">
            <li>
              <a
                href="/image-to-svg/"
                className="studio-footer__link"
                title="Convert raster images to clean SVG vector code"
              >
                <span>Image to SVG Converter</span>
              </a>
            </li>
            <li>
              <a
                href="/photo-to-vector/"
                className="studio-footer__link"
                title="Transform portrait photographs into vector artwork"
              >
                <span>Photo to Vector Converter</span>
              </a>
            </li>
            <li>
              <a
                href="/photo-to-painting/"
                className="studio-footer__link"
                title="Create painterly digital portrait art in pure SVG"
              >
                <span>Photo to Painting</span>
              </a>
            </li>
            <li>
              <a
                href="https://github.com/parthmandore/CodeMyPicture"
                target="_blank"
                rel="noopener noreferrer"
                className="studio-footer__link"
                title="View repository on GitHub"
              >
                <span>GitHub Repository</span>
                <ArrowUpRight size={12} />
              </a>
            </li>
          </ul>
        </div>

        {/* Modes & Architecture Column */}
        <div className="studio-footer__links-col">
          <div className="studio-footer__col-heading mono">PRODUCT SECTIONS</div>
          <ul className="studio-footer__link-list">
            <li>
              <a href="#modes" className="studio-footer__link" title="Jump to Painting and Recreation Mode Comparison">
                <span className="mono">01 //</span> Modes (Painting & Recreation)
              </a>
            </li>
            <li>
              <a href="#workflow" className="studio-footer__link" title="Jump to Five-Stage Reconstruction Workflow">
                <span className="mono">02 //</span> How It Works (Workflow)
              </a>
            </li>
            <li>
              <a href="#features" className="studio-footer__link" title="Jump to Technical Features and Architecture">
                <span className="mono">03 //</span> Architecture & Geometry
              </a>
            </li>
            <li>
              <a href="#privacy" className="studio-footer__link" title="Jump to 100% In-Browser Privacy Guarantee">
                <span className="mono">04 //</span> Client-Side Privacy
              </a>
            </li>
            {onOpenPrivacy && (
              <li>
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="studio-footer__link"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left', font: 'inherit' }}
                  title="Open Privacy Architecture & Data Preferences Center"
                >
                  <span className="mono">07 //</span> Privacy Preferences
                </button>
              </li>
            )}
            <li>
              <a href="#exports" className="studio-footer__link" title="Jump to Export Formats (SVG, HTML, JSX, PNG)">
                <span className="mono">05 //</span> Export Formats
              </a>
            </li>
            <li>
              <a href="#diagnostics" className="studio-footer__link" title="Jump to Studio Diagnostics Telemetry">
                <span className="mono">06 //</span> Diagnostics Telemetry
              </a>
            </li>
            <li>
              <a href="#contact" className="studio-footer__link" title="Jump to Contact Form & Technical Feedback">
                <span className="mono">08 //</span> Contact & Feedback
              </a>
            </li>
          </ul>
        </div>

        {/* Technical Stack Column */}
        <div className="studio-footer__links-col">
          <div className="studio-footer__col-heading mono">SPECIFICATIONS</div>
          <ul className="studio-footer__link-list mono">
            <li className="studio-footer__item-static">Vite 8 · React 19 · TypeScript</li>
            <li className="studio-footer__item-static">MediaPipe Vision WASM</li>
            <li className="studio-footer__item-static">Web Workers Vector Tracing</li>
            <li className="studio-footer__item-static">CodeMirror 6 Atelier Theme</li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar: Copyright & Restrained Note */}
      <div className="studio-footer__bottom mono">
        <div className="studio-footer__copy">
          © {new Date().getFullYear()} CodeMyPicture. All rights reserved.
        </div>
        <div className="studio-footer__meta">
          {onOpenPrivacy && (
            <>
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="studio-footer__link mono"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 'inherit' }}
                title="Open Privacy Architecture & Data Preferences Center"
              >
                PRIVACY & PREFERENCES
              </button>
              <span className="studio-footer__bullet">·</span>
            </>
          )}
          <span>LIVE ATELIER v4.0</span>
          <span className="studio-footer__bullet">·</span>
          <span>CLIENT-SIDE SYNTHESIS</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
