import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private from = 'noreply@opusheart.org';

  configure(config: { host: string; port: number; secure: boolean; user: string; pass: string; from: string }): void {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    this.from = config.from;
  }

  async send(options: EmailOptions): Promise<{ messageId: string }> {
    if (!this.transporter) {
      console.warn('[EmailService] No transporter configured, skipping send');
      return { messageId: 'skipped' };
    }

    // Strip newlines from header fields to prevent email header injection
    const sanitizeHeader = (val: string) => val.replace(/[\r\n\0]/g, '');

    const info = await this.transporter.sendMail({
      from: this.from,
      to: Array.isArray(options.to) ? options.to.map(sanitizeHeader).join(', ') : sanitizeHeader(options.to),
      subject: sanitizeHeader(options.subject),
      html: options.html,
      text: options.text,
      replyTo: options.replyTo ? sanitizeHeader(options.replyTo) : undefined,
    });
    return { messageId: info.messageId };
  }

  async sendBulk(recipients: string[], subject: string, html: string, text?: string): Promise<{
    sent: number;
    failed: number;
  }> {
    let sent = 0;
    let failed = 0;
    for (const to of recipients) {
      try {
        await this.send({ to, subject, html, text });
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  }
}

export const emailService = new EmailService();
