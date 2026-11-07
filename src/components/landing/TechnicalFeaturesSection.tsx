import React from 'react';
import { Layers, Orbit, Palette, Binary } from 'lucide-react';

export const TechnicalFeaturesSection: React.FC = () => {
  const features = [
    {
      num: '01',
      title: 'Pure Vector Geometry',
      icon: <Layers size={16} />,
      desc: 'Outputs genuine mathematical vector curves (<path>, <rect>, <circle>). Contains zero embedded raster bitmaps, zero <image> tags, and zero base64 payload bloat.',
    },
    {
      num: '02',
      title: 'Full-Image Scene Coverage',
      icon: <Orbit size={16} />,
      desc: 'Structural analysis spans the complete composition: hair volume, head boundaries, clothing texture, hands, furniture, and environmental details — never restricted to face landmarks.',
    },
    {
      num: '03',
      title: 'Subpixel Coordinate Precision',
      icon: <Binary size={16} />,
      desc: 'Uses subpixel curve tolerance (0.6px) and 2-decimal coordinate rounding. Renders razor-sharp on Retina and 4K displays without resolution loss or pixelation.',
    },
    {
      num: '04',
      title: 'Color Region Quantization',
      icon: <Palette size={16} />,
      desc: 'Multi-scale adaptive color clustering and biometric tone recovery preserve natural skin, hair, and clothing illumination while keeping the overall palette tight and efficient.',
    },
  ];

  return (
    <section id="features" className="landing-section" aria-labelledby="features-heading">
      <div className="landing-section__header">
        <div className="landing-section__badge mono">
          <span>03 // VECTOR ENGINE CAPABILITIES</span>
        </div>
        <h2 id="features-heading" className="landing-section__title">
          Engine Architecture & Geometry
        </h2>
        <p className="landing-section__subtitle">
          Engineered for creative developers, designers, and digital artists who require clean, inspectable, and standards-compliant SVG code.
        </p>
      </div>

      <div className="landing-features-grid">
        {features.map((f) => (
          <div key={f.num} className="landing-feature-card">
            <div className="landing-feature-card__header">
              <span className="landing-feature-card__num mono">{f.num} // ARCHITECTURE</span>
              <div className="landing-feature-card__icon">{f.icon}</div>
            </div>
            <h3 className="landing-feature-card__title">{f.title}</h3>
            <p className="landing-feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TechnicalFeaturesSection;
