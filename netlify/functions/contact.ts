/**
 * CodeMyPicture — Serverless Contact & Feedback Handler
 *
 * Implements server-side validation, anti-spam honeypot defense,
 * email header injection defense, rate-limiting, and transactional email dispatch.
 *
 * Supported Environment Variables:
 * - CONTACT_TO_EMAIL: The inbox receiving contact inquiries (e.g., team@codemypicture.app)
 * - RESEND_API_KEY: Transactional email API key from Resend (https://resend.com)
 * - CONTACT_FROM_EMAIL: Verified sender address (default: notifications@codemypicture.app)
 * - CONTACT_SEND_ACK: Whether to send receipt acknowledgement to visitor ('true'/'false')
 */

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  botField?: unknown;
  timestamp?: unknown;
}

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// In-memory rate limiting map: IP -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

// Email RFC 5322 validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Strips carriage returns and newlines to prevent email header injection attacks
 */
function sanitizeHeaderField(val: string): string {
  return val.replace(/[\r\n\t]/g, ' ').trim();
}

/**
 * Escapes HTML characters for safe email rendering
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  };

  // 1. HTTP Method Validation
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...jsonHeaders, Allow: 'POST' },
      body: JSON.stringify({ error: 'Method Not Allowed. Contact form requires POST.' }),
    };
  }

  // 2. Client IP Extraction & Rate Limiting
  const clientIp =
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    'unknown-client';

  const now = Date.now();
  const clientHistory = (rateLimitMap.get(clientIp) || []).filter(
    (time) => now - time < RATE_LIMIT_WINDOW_MS
  );

  if (clientHistory.length >= MAX_REQUESTS_PER_WINDOW) {
    return {
      statusCode: 429,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Too many submissions from this connection. Please wait 10 minutes before sending another inquiry.',
      }),
    };
  }

  // 3. Body Parsing
  let payload: ContactPayload;
  try {
    if (!event.body) {
      throw new Error('Empty request body');
    }
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Malformed JSON payload.' }),
    };
  }

  const { name, email, subject, message, botField, timestamp } = payload;

  // 4. Anti-Spam: Honeypot Verification
  // If the hidden bot field is filled, silently succeed without sending email (bot sinkhole)
  if (typeof botField === 'string' && botField.trim().length > 0) {
    console.warn(`[AntiSpam] Bot honeypot triggered from ${clientIp}`);
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Your inquiry has been received.',
      }),
    };
  }

  // 5. Anti-Spam: Time-to-Submit Check (Must be at least 2 seconds after page load)
  if (typeof timestamp === 'number') {
    const elapsed = now - timestamp;
    if (elapsed < 2000) {
      console.warn(`[AntiSpam] Submission too fast (${elapsed}ms) from ${clientIp}`);
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({
          error: 'Submission was too fast. Please take a moment to review your message.',
        }),
      };
    }
  }

  // 6. Strict Field Validation
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Name must be between 2 and 80 characters.' }),
    };
  }

  if (typeof email !== 'string' || email.trim().length > 100 || !EMAIL_REGEX.test(email.trim())) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Please provide a valid email address.' }),
    };
  }

  if (typeof subject !== 'string' || subject.trim().length < 3 || subject.trim().length > 120) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Subject must be between 3 and 120 characters.' }),
    };
  }

  if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 3000) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Message must be between 10 and 3,000 characters.' }),
    };
  }

  // 7. Sanitize values to prevent header injection
  const cleanName = sanitizeHeaderField(name);
  const cleanEmail = sanitizeHeaderField(email);
  const cleanSubject = sanitizeHeaderField(subject);
  const cleanMessage = message.trim();

  // Record submission in rate-limiter
  clientHistory.push(now);
  rateLimitMap.set(clientIp, clientHistory);

  // 8. Server-Side Email Notification Dispatch
  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || 'mandoreparth14@gmail.com';
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'CodeMyPicture <notifications@codemypicture.app>';
  const sendAck = process.env.CONTACT_SEND_ACK === 'true';

  // If Resend API key is not yet configured, operate in diagnostic staging mode.
  // CONTACT_TO_EMAIL is pre-configured; delivery activates once RESEND_API_KEY is set.
  if (!resendApiKey) {
    console.info(
      `[Contact Function] Validated submission from ${cleanEmail} (Subject: "${cleanSubject}"). Staging mode active: Set RESEND_API_KEY in Netlify environment variables to enable live inbox delivery to ${toEmail}.`
    );

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        simulated: true,
        message:
          'Your message has been received and validated. Our team will be in touch shortly.',
      }),
    };
  }

  // Send via Resend transactional email API
  try {
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Inquiry: ${escapeHtml(cleanSubject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #14110F; color: #F3EFEA; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1C1815; border: 1px solid #2A2421; border-radius: 4px; padding: 24px;">
    <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.08em; color: #87A96B; margin-bottom: 8px;">
      [CODEMYPICTURE // INQUIRY DISPATCH]
    </div>
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #F3EFEA;">
      ${escapeHtml(cleanSubject)}
    </h2>
    <div style="font-size: 13px; line-height: 1.6; border-bottom: 1px solid #2A2421; padding-bottom: 16px; margin-bottom: 16px;">
      <div><strong>Sender Name:</strong> ${escapeHtml(cleanName)}</div>
      <div><strong>Reply Email:</strong> <a href="mailto:${escapeHtml(cleanEmail)}" style="color: #FF4F2E;">${escapeHtml(cleanEmail)}</a></div>
      <div><strong>Submitted At:</strong> ${new Date(now).toUTCString()}</div>
    </div>
    <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #F3EFEA; background-color: #14110F; padding: 16px; border-radius: 3px; border: 1px solid #2A2421;">
${escapeHtml(cleanMessage)}
    </div>
    <div style="margin-top: 20px; font-family: monospace; font-size: 10px; color: #8F877C; text-align: center;">
      Dispatched via CodeMyPicture Secure Serverless Contact Function · Netlify Edge
    </div>
  </div>
</body>
</html>`;

    const emailText = `[CODEMYPICTURE // INQUIRY DISPATCH]
From: ${cleanName} <${cleanEmail}>
Subject: ${cleanSubject}
Date: ${new Date(now).toUTCString()}

Message:
${cleanMessage}
`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: cleanEmail,
        subject: `[CodeMyPicture Inquiry] ${cleanSubject}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[Resend Error]', resendRes.status, errText);
      throw new Error(`Email provider error: ${resendRes.status}`);
    }

    // Optional visitor acknowledgement
    if (sendAck) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [cleanEmail],
            subject: `We received your message: ${cleanSubject}`,
            text: `Hello ${cleanName},\n\nThank you for contacting CodeMyPicture. We have received your inquiry ("${cleanSubject}") and our team will get back to you shortly.\n\nWarm regards,\nThe CodeMyPicture Atelier Team`,
          }),
        });
      } catch (ackErr) {
        console.warn('[Acknowledgement Error]', ackErr);
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        simulated: false,
        message: 'Thank you! Your message has been sent successfully.',
      }),
    };
  } catch (err: any) {
    console.error('[Contact Error]', err?.message || err);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Unable to send message due to a server-side delivery issue. Please try again later.',
      }),
    };
  }
};
