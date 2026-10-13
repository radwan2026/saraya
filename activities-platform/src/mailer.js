// إرسال الشكاوى والأفكار إلى بريد اللجنة (اختياري — يعمل فقط عند ضبط متغيرات SMTP).
import nodemailer from 'nodemailer';

export function createMailer(env = process.env) {
  if (!env.SMTP_HOST) {
    return { enabled: false, async send() { return false; } };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  const from = env.SMTP_FROM || env.SMTP_USER;
  return {
    enabled: true,
    async send({ to, subject, text, replyTo }) {
      if (!to) return false;
      try {
        await transport.sendMail({ from, to, subject, text, replyTo: replyTo || undefined });
        return true;
      } catch (err) {
        console.error('[mail] فشل إرسال البريد:', err.message);
        return false;
      }
    },
  };
}
