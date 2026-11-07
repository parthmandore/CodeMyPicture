import React from 'react';
import { FileCode, Globe, Code2, Image as ImageIcon } from 'lucide-react';

export const ExportFormatsSection: React.FC = () => {
  const formats = [
    {
      format: 'portrait.svg',
      type: 'Scalable Vector Graphic',
      icon: <FileCode size={18} className="export-format-icon" />,
      desc: 'Standards-compliant, standalone SVG document with organized layers and path elements. Ready for instant import into Figma, Adobe Illustrator, Inkscape, or pen-plotter workflows.',
      tag: 'VECTOR // STANDALONE',
    },
    {
      format: 'embed.html',
      type: 'Self-Contained Web Page',
      icon: <Globe size={18} className="export-format-icon" />,
      desc: 'Complete HTML5 file with dark-theme viewport styling and centered responsive framing. Opens directly in any browser for immediate sharing, presentation, or iframe embedding.',
      tag: 'HTML5 // EMBEDDABLE',
    },
    {
      format: 'Portrait.jsx',
      type: 'React TSX Component',
      icon: <Code2 size={18} className="export-format-icon" />,
      desc: 'Production-ready React component formatted with valid JSX attributes (strokeWidth, fillRule) and standard React TypeScript props. Drop directly into Next.js, Vite, or Remix apps.',
      tag: 'REACT // PRODUCTION',
    },
    {
      format: 'portrait.png',
      type: 'High-Resolution Raster',
      icon: <ImageIcon size={18} className="export-format-icon" />,
      desc: 'Clean 1:1 pixel snapshot rendered straight from the mathematical SVG vector geometry onto an HTML5 canvas buffer for rapid sharing or social media avatars.',
      tag: 'BITMAP // RASTERIZED',
    },
  ];

  return (
    <section id="exports" className="landing-section" aria-labelledby="export-heading">
      <div className="landing-section__header">
        <div className="landing-section__badge mono">
          <span>04 // OUTPUT SPECIFICATIONS</span>
        </div>
        <h2 id="export-heading" className="landing-section__title">
          Supported Export Formats
        </h2>
        <p className="landing-section__subtitle">
          CodeMyPicture provides multiple code formats to seamlessly fit your web engineering, graphic design, and presentation pipelines.
        </p>
      </div>

      <div className="landing-export-grid">
        {formats.map((fmt) => (
          <div key={fmt.format} className="landing-export-card">
            <div className="landing-export-card__top">
              <div className="landing-export-card__icon-box">{fmt.icon}</div>
              <span className="landing-export-card__tag mono">{fmt.tag}</span>
            </div>
            <h3 className="landing-export-card__title mono">{fmt.format}</h3>
            <div className="landing-export-card__type">{fmt.type}</div>
            <p className="landing-export-card__desc">{fmt.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ExportFormatsSection;
