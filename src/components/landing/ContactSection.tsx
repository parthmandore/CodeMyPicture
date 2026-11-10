import React, { useState } from 'react';
import { Send, Mail, User, MessageSquare, Tag, Copy, Check, ExternalLink, Info } from 'lucide-react';
import { useToast } from '../common/ToastContext';
import analytics from '../../services/analytics';

// ─── Contact destination ──────────────────────────────────────────────────────
const CONTACT_EMAIL = 'mandoreparth14@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// ─── Mailto builder ───────────────────────────────────────────────────────────
/**
 * Builds a fully URL-encoded mailto: link.
 * encodeURIComponent handles special chars, unicode, and newlines.
 */
function buildMailtoLink(name: string, email: string, subject: string, message: string): string {
  const body = [
    `From: ${name} <${email}>`,
    '',
    message,
  ].join('\n');

  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);

  // URLSearchParams uses + for spaces; mailto: requires %20
  const encoded = params.toString().replace(/\+/g, '%20');
  return `mailto:${encodeURIComponent(CONTACT_EMAIL)}?${encoded}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ContactSection: React.FC = () => {
  const toast = useToast();

  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [mailtoOpened, setMailtoOpened] = useState(false);
  const [mailtoLink, setMailtoLink] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Please provide your name (at least 2 characters).';
    } else if (formData.name.trim().length > 80) {
      errs.name = 'Name must not exceed 80 characters.';
    }

    if (!formData.email.trim()) {
      errs.email = 'Please provide your email address.';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address (e.g. name@domain.com).';
    } else if (formData.email.trim().length > 100) {
      errs.email = 'Email address is too long (max 100 characters).';
    }

    if (!formData.subject.trim() || formData.subject.trim().length < 3) {
      errs.subject = 'Subject must be at least 3 characters.';
    } else if (formData.subject.trim().length > 120) {
      errs.subject = 'Subject must not exceed 120 characters.';
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters long.';
    } else if (formData.message.trim().length > 3000) {
      errs.message = 'Message must not exceed 3,000 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please resolve the errors highlighted in the form.');
      return;
    }

    const link = buildMailtoLink(
      formData.name.trim(),
      formData.email.trim(),
      formData.subject.trim(),
      formData.message.trim()
    );

    setMailtoLink(link);
    setMailtoOpened(true);

    // Open the mailto link
    window.location.href = link;

    analytics.trackEvent('contact_form_submitted', { has_subject: true });
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setEmailCopied(true);
      toast.success('Email address copied to clipboard.');
      setTimeout(() => setEmailCopied(false), 2500);
    } catch {
      // Clipboard API blocked (e.g. HTTP or permissions)
      toast.error('Could not access clipboard. Please copy the address manually.');
    }
  };

  const handleReset = () => {
    setFormData({ name: '', email: '', subject: '', message: '' });
    setErrors({});
    setMailtoOpened(false);
    setMailtoLink('');
  };

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    backgroundColor: 'var(--base)',
    border: hasError ? '1px solid var(--rose)' : '1px solid var(--line)',
    borderRadius: '3px',
    padding: '10px 14px',
    color: 'var(--paper)',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 150ms',
  });

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--paper-dim)',
    marginBottom: '8px',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--rose)',
    marginTop: '4px',
  };

  // ── Post-open state ─────────────────────────────────────────────────────────
  if (mailtoOpened) {
    return (
      <section id="contact" className="landing-section landing-contact-section" aria-labelledby="contact-heading">
        <div className="landing-section-header">
          <div className="landing-section-badge mono">
            <Mail size={13} style={{ color: 'var(--accent)' }} />
            <span>CONTACT &amp; TECHNICAL FEEDBACK</span>
          </div>
          <h2 id="contact-heading" className="landing-section-title">
            Connect with the Atelier Engineering Team
          </h2>
        </div>

        <div
          className="contact-card-atelier"
          style={{
            backgroundColor: 'var(--raised)',
            border: '1px solid var(--line-strong)',
            borderRadius: '4px',
            maxWidth: '720px',
            margin: '0 auto',
            padding: '36px 32px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* ── Instruction banner ── */}
          <div
            className="mono"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: 'rgba(255, 79, 46, 0.08)',
              border: '1px solid rgba(255, 79, 46, 0.25)',
              borderRadius: '3px',
              padding: '14px 16px',
              marginBottom: '28px',
            }}
          >
            <Info size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--paper)' }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--accent)' }}>
                ACTION REQUIRED — YOUR EMAIL APPLICATION SHOULD HAVE OPENED
              </strong>
              Your message has been pre-filled in your default email client. Please review and
              click <strong>Send</strong> inside your email application to deliver the inquiry.
              <br />
              <span style={{ color: 'var(--paper-dim)' }}>
                If the email client did not open, use the direct link or copy the address below.
              </span>
            </div>
          </div>

          {/* ── Message preview ── */}
          <div
            style={{
              backgroundColor: 'var(--base)',
              border: '1px solid var(--line)',
              borderRadius: '3px',
              padding: '16px',
              marginBottom: '24px',
              fontSize: '12px',
              lineHeight: 1.6,
              color: 'var(--paper-dim)',
            }}
          >
            <div className="mono" style={{ color: 'var(--paper-dim)', marginBottom: '10px', fontSize: '10px' }}>
              MESSAGE PREVIEW
            </div>
            <div><strong style={{ color: 'var(--paper)' }}>To:</strong> {CONTACT_EMAIL}</div>
            <div><strong style={{ color: 'var(--paper)' }}>Subject:</strong> {formData.subject}</div>
            <div><strong style={{ color: 'var(--paper)' }}>From:</strong> {formData.name} &lt;{formData.email}&gt;</div>
            <div
              style={{
                marginTop: '10px',
                borderTop: '1px solid var(--line)',
                paddingTop: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {formData.message}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {/* Re-open mailto */}
            <a
              href={mailtoLink}
              className="v4-btn v4-btn--primary"
              style={{ padding: '9px 20px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              aria-label="Open email application again"
            >
              <ExternalLink size={12} />
              <span>Open Email Client</span>
            </a>

            {/* Copy email */}
            <button
              type="button"
              onClick={handleCopyEmail}
              className="v4-btn"
              style={{ padding: '9px 20px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              aria-label="Copy contact email address"
            >
              {emailCopied ? <Check size={12} /> : <Copy size={12} />}
              <span>{emailCopied ? 'Copied!' : 'Copy Email Address'}</span>
            </button>

            {/* Send another */}
            <button
              type="button"
              onClick={handleReset}
              className="v4-btn"
              style={{ padding: '9px 20px', fontSize: '12px' }}
            >
              <span>Edit &amp; Resend</span>
            </button>
          </div>

          {/* ── Fallback direct link ── */}
          <div
            className="mono"
            style={{ fontSize: '11px', color: 'var(--paper-dim)', borderTop: '1px solid var(--line)', paddingTop: '16px' }}
          >
            Direct email address:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  return (
    <section id="contact" className="landing-section landing-contact-section" aria-labelledby="contact-heading">
      <div className="landing-section-header">
        <div className="landing-section-badge mono">
          <Mail size={13} style={{ color: 'var(--accent)' }} />
          <span>CONTACT &amp; TECHNICAL FEEDBACK</span>
        </div>
        <h2 id="contact-heading" className="landing-section-title">
          Connect with the Atelier Engineering Team
        </h2>
        <p className="landing-section-desc">
          Have inquiries regarding vector synthesis algorithms, enterprise licensing, or feature proposals?
          Fill the form below — your default email application will open with the message pre-filled.
        </p>
      </div>

      <div
        className="contact-card-atelier"
        style={{
          backgroundColor: 'var(--raised)',
          border: '1px solid var(--line-strong)',
          borderRadius: '4px',
          maxWidth: '720px',
          margin: '0 auto',
          padding: '32px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          {/* Name + Email row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}
          >
            {/* Name */}
            <div>
              <label htmlFor="contact-name" className="mono" style={labelStyle}>
                <User size={12} />
                <span>NAME OR ORGANIZATION *</span>
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                placeholder="Ada Lovelace"
                required
                maxLength={80}
                value={formData.name}
                onChange={handleChange}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
                style={inputStyle(Boolean(errors.name))}
              />
              {errors.name && (
                <div id="contact-name-error" className="mono" style={errorStyle}>
                  {errors.name}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="contact-email" className="mono" style={labelStyle}>
                <Mail size={12} />
                <span>REPLY EMAIL ADDRESS *</span>
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                placeholder="developer@example.com"
                required
                maxLength={100}
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
                style={inputStyle(Boolean(errors.email))}
              />
              {errors.email && (
                <div id="contact-email-error" className="mono" style={errorStyle}>
                  {errors.email}
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="contact-subject" className="mono" style={labelStyle}>
              <Tag size={12} />
              <span>SUBJECT *</span>
            </label>
            <input
              id="contact-subject"
              type="text"
              name="subject"
              placeholder="Inquiry regarding vector contour quantization"
              required
              maxLength={120}
              value={formData.subject}
              onChange={handleChange}
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
              style={inputStyle(Boolean(errors.subject))}
            />
            {errors.subject && (
              <div id="contact-subject-error" className="mono" style={errorStyle}>
                {errors.subject}
              </div>
            )}
          </div>

          {/* Message */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="contact-message" className="mono" style={{ ...labelStyle, marginBottom: 0 }}>
                <MessageSquare size={12} />
                <span>INQUIRY MESSAGE *</span>
              </label>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--paper-dim)' }}>
                {formData.message.length} / 3000
              </span>
            </div>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              placeholder="Describe your inquiry, bug report, or feature request in detail..."
              required
              maxLength={3000}
              value={formData.message}
              onChange={handleChange}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'contact-message-error' : undefined}
              style={{
                ...inputStyle(Boolean(errors.message)),
                lineHeight: 1.6,
                resize: 'vertical',
                minHeight: '120px',
              }}
            />
            {errors.message && (
              <div id="contact-message-error" className="mono" style={errorStyle}>
                {errors.message}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              borderTop: '1px solid var(--line)',
              paddingTop: '20px',
            }}
          >
            {/* How it works hint */}
            <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)' }}>
              <Mail size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span>Opens your email client with message pre-filled</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Copy email fallback */}
              <button
                type="button"
                onClick={handleCopyEmail}
                className="v4-btn"
                style={{ padding: '9px 16px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                aria-label="Copy contact email address"
              >
                {emailCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{emailCopied ? 'Copied!' : 'Copy Email'}</span>
              </button>

              {/* Submit */}
              <button
                type="submit"
                className="v4-btn v4-btn--primary"
                style={{ padding: '9px 24px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={12} />
                <span>Open Email &amp; Send</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ContactSection;
