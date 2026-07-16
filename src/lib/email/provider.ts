/**
 * Email provider abstraction.
 * ResendProvider talks to the Resend API; NullEmailProvider is the honest
 * "blocked" stand-in used whenever configuration is missing — it never
 * pretends to have sent anything.
 */
import { Resend } from 'resend';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface ProviderResult {
  status: 'accepted' | 'failed' | 'blocked';
  providerId?: string;
  detail: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<ProviderResult>;
}

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  private readonly testInbox: string | undefined;

  constructor(opts: { apiKey: string; from: string; testInbox?: string }) {
    this.client = new Resend(opts.apiKey);
    this.from = opts.from;
    this.testInbox = opts.testInbox;
  }

  async send(msg: EmailMessage): Promise<ProviderResult> {
    // Sandbox redirect: when TEST_INBOX_ADDRESS is configured, every message
    // goes to the test inbox and the original recipient is noted in the subject.
    const redirected = Boolean(this.testInbox);
    const to = this.testInbox ?? msg.to;
    const subject = redirected ? `${msg.subject} [TEST → ${msg.to}]` : msg.subject;
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      });
      if (error) {
        return { status: 'failed', detail: `resend error: ${error.message}` };
      }
      return {
        status: 'accepted',
        providerId: data?.id,
        detail: redirected ? `sandbox redirect: delivered to test inbox, original recipient ${msg.to}` : 'sent',
      };
    } catch (err) {
      return { status: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Always returns blocked, naming the missing configuration. Never claims a send. */
export class NullEmailProvider implements EmailProvider {
  constructor(private readonly missingVar: string) {}

  send(): Promise<ProviderResult> {
    return Promise.resolve({
      status: 'blocked',
      detail: `email blocked: missing env var ${this.missingVar}`,
    });
  }
}

/** Configured Resend provider, or NullEmailProvider naming the missing env var. */
export function getEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (!env.RESEND_API_KEY) return new NullEmailProvider('RESEND_API_KEY');
  if (!env.EMAIL_FROM) return new NullEmailProvider('EMAIL_FROM');
  return new ResendProvider({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    testInbox: env.TEST_INBOX_ADDRESS || undefined,
  });
}
