import Link from 'next/link';
import shared from '../shared.module.css';
import styles from './page.module.css';

export const metadata = { title: 'Integration status' };

interface IntegrationCheck {
  key: string;
  label: string;
  required: string[];
  optional: string[];
}

const INTEGRATIONS: IntegrationCheck[] = [
  {
    key: 'email',
    label: 'Email — Resend',
    required: ['RESEND_API_KEY', 'EMAIL_FROM'],
    optional: ['TEST_INBOX_ADDRESS', 'FIRM_RECIPIENTS_JSON'],
  },
  {
    key: 'calendar',
    label: 'Calendar — Google Calendar',
    required: [
      'GOOGLE_CALENDAR_CLIENT_ID',
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REFRESH_TOKEN',
      'GOOGLE_CALENDAR_ID',
    ],
    optional: ['CALENDAR_TIMEZONE'],
  },
  {
    key: 'payments',
    label: 'Payments — Stripe',
    required: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    optional: ['STRIPE_PRICE_ID'],
  },
  {
    key: 'ai',
    label: 'AI provider (optional)',
    required: ['AI_PROVIDER', 'AI_API_KEY'],
    optional: [],
  },
];

export default function StatusPage() {
  return (
    <div className={styles.page}>
      <header>
        <p className={styles.breadcrumb}>
          <Link href="/">← Docket index</Link>
        </p>
        <h1 className={styles.title}>Integration status</h1>
        <p className={styles.meta}>
          Status is computed from environment-variable presence only. No live connectivity is tested, and no
          integration reports green until its credentials are actually configured.
        </p>
        <hr className={shared.rule} />
      </header>

      <ul className={styles.list}>
        {INTEGRATIONS.map((integration) => {
          const missing = integration.required.filter((name) => !process.env[name]);
          const configured = missing.length === 0;
          return (
            <li key={integration.key} className={styles.row}>
              <div className={styles.rowHeader}>
                <h2 className={styles.integrationName}>{integration.label}</h2>
                <span className={`${shared.stamp} ${configured ? shared.stampSuccess : shared.stampDanger}`}>
                  {configured ? 'Configured' : 'Blocked'}
                </span>
              </div>
              {configured ? (
                <p className={styles.detail}>All required variables present: {integration.required.join(', ')}.</p>
              ) : (
                <p className={styles.detail}>
                  Missing required {missing.length === 1 ? 'variable' : 'variables'}:{' '}
                  <span className={styles.mono}>{missing.join(', ')}</span>
                </p>
              )}
              {integration.optional.length > 0 ? (
                <p className={styles.optional}>Optional: {integration.optional.join(', ')}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
