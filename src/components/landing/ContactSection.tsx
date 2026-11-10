import React, { useState, useRef } from 'react';
import { Send, CheckCircle2, AlertTriangle, Mail, ShieldCheck, User, MessageSquare, Tag } from 'lucide-react';
import { useToast } from '../common/ToastContext';
import analytics from '../../services/analytics';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  botField: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const ContactSection: React.FC = () => {
  const toast = useToast();
  const mountTimeRef = useRef<number>(Date.now());

  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
    botField: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please resolve the errors highlighted in the form.');
      return;
    }

    setIsSubmitting(true);
    setResponseMessage('');

    try {
      // Primary serverless endpoint, with fallback if in local dev
      let endpoint = '/api/contact';
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: mountTimeRef.current,
        }),
      });

      // If /api/contact is not mapped in dev server, try direct function endpoint
      if (res.status === 404) {
        endpoint = '/.netlify/functions/contact';
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            timestamp: mountTimeRef.current,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }

      setSubmittedSuccess(true);
      setIsSimulated(Boolean(data.simulated));
      setResponseMessage(
        data.message || 'Your inquiry has been received. Thank you for contacting CodeMyPicture.'
      );

      // Track conversion event (Zero PII transmitted)
      analytics.trackEvent('contact_form_submitted', {
        simulated: Boolean(data.simulated),
        has_subject: true,
      });

      toast.success('Inquiry submitted successfully.');
    } catch (err: any) {
      console.error('Contact submission error:', err);
      const msg = err?.message || 'Failed to send message. Please try again.';
      setResponseMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: '',
      botField: '',
    });
    setErrors({});
    setSubmittedSuccess(false);
    setResponseMessage('');
    setIsSimulated(false);
    mountTimeRef.current = Date.now();
  };

  return (
    <section id="contact" className="landing-section landing-contact-section" aria-labelledby="contact-heading">
      <div className="landing-section-header">
        <div className="landing-section-badge mono">
          <Mail size={13} style={{ color: 'var(--accent)' }} />
          <span>CONTACT & TECHNICAL FEEDBACK</span>
        </div>
        <h2 id="contact-heading" className="landing-section-title">
          Connect with the Atelier Engineering Team
        </h2>
        <p className="landing-section-desc">
          Have inquiries regarding vector synthesis algorithms, enterprise licensing, or feature proposals?
          Send a direct message through our spam-protected serverless gateway.
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
        {submittedSuccess ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px 12px',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(135, 169, 107, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--moss)',
              }}
            >
              <CheckCircle2 size={24} />
            </div>

            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--paper)' }}>
              Message Transmitted
            </h3>

            <p style={{ margin: 0, color: 'var(--paper-dim)', fontSize: '13px', maxWidth: '520px', lineHeight: 1.6 }}>
              {responseMessage}
            </p>

            {isSimulated && (
              <div
                className="mono"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(255, 179, 71, 0.1)',
                  border: '1px solid rgba(255, 179, 71, 0.3)',
                  color: 'var(--amber)',
                  padding: '10px 14px',
                  borderRadius: '3px',
                  maxWidth: '560px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>[DIAGNOSTIC NOTICE]</div>
                Form validation, rate-limiting, and payload sanitization executed successfully. Live email inbox delivery will activate once <code>RESEND_API_KEY</code> and <code>CONTACT_TO_EMAIL</code> are configured in Netlify environment variables.
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="v4-btn v4-btn--primary"
              style={{ marginTop: '12px' }}
            >
              <span>Send Another Message</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Honeypot field for bot trap */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <label htmlFor="contact-bot-field">Do not fill this field</label>
              <input
                id="contact-bot-field"
                type="text"
                name="botField"
                tabIndex={-1}
                autoComplete="off"
                value={formData.botField}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {/* Name Field */}
              <div>
                <label
                  htmlFor="contact-name"
                  className="mono"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)', marginBottom: '8px' }}
                >
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
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--base)',
                    border: errors.name ? '1px solid var(--rose)' : '1px solid var(--line)',
                    borderRadius: '3px',
                    padding: '10px 14px',
                    color: 'var(--paper)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.name && (
                  <div id="contact-name-error" className="mono" style={{ fontSize: '11px', color: 'var(--rose)', marginTop: '4px' }}>
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="mono"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)', marginBottom: '8px' }}
                >
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
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--base)',
                    border: errors.email ? '1px solid var(--rose)' : '1px solid var(--line)',
                    borderRadius: '3px',
                    padding: '10px 14px',
                    color: 'var(--paper)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.email && (
                  <div id="contact-email-error" className="mono" style={{ fontSize: '11px', color: 'var(--rose)', marginTop: '4px' }}>
                    {errors.email}
                  </div>
                )}
              </div>
            </div>

            {/* Subject Field */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="contact-subject"
                className="mono"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)', marginBottom: '8px' }}
              >
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
                style={{
                  width: '100%',
                  backgroundColor: 'var(--base)',
                  border: errors.subject ? '1px solid var(--rose)' : '1px solid var(--line)',
                  borderRadius: '3px',
                  padding: '10px 14px',
                  color: 'var(--paper)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              {errors.subject && (
                <div id="contact-subject-error" className="mono" style={{ fontSize: '11px', color: 'var(--rose)', marginTop: '4px' }}>
                  {errors.subject}
                </div>
              )}
            </div>

            {/* Message Field */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label
                  htmlFor="contact-message"
                  className="mono"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)' }}
                >
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
                  width: '100%',
                  backgroundColor: 'var(--base)',
                  border: errors.message ? '1px solid var(--rose)' : '1px solid var(--line)',
                  borderRadius: '3px',
                  padding: '12px 14px',
                  color: 'var(--paper)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  minHeight: '120px',
                }}
              />
              {errors.message && (
                <div id="contact-message-error" className="mono" style={{ fontSize: '11px', color: 'var(--rose)', marginTop: '4px' }}>
                  {errors.message}
                </div>
              )}
            </div>

            {/* Global Error Notice if any */}
            {responseMessage && !submittedSuccess && (
              <div
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(235, 77, 75, 0.1)',
                  border: '1px solid rgba(235, 77, 75, 0.3)',
                  color: 'var(--rose)',
                  padding: '10px 14px',
                  borderRadius: '3px',
                  marginBottom: '20px',
                  fontSize: '12px',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{responseMessage}</span>
              </div>
            )}

            {/* Action Bar */}
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
              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--paper-dim)' }}>
                <ShieldCheck size={13} style={{ color: 'var(--moss)' }} />
                <span>SPAM & INJECTION PROTECTED GATEWAY</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="v4-btn v4-btn--primary"
                style={{ padding: '9px 24px', fontSize: '12px' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="analyzing-hud-spinner" style={{ width: 12, height: 12, marginRight: 6 }} aria-hidden="true" />
                    <span>Transmitting…</span>
                  </>
                ) : (
                  <>
                    <Send size={12} style={{ marginRight: '6px' }} />
                    <span>Transmit Inquiry</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

export default ContactSection;
