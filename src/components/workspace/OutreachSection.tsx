/** @jsxRuntime automatic */
/**
 * OutreachSection — the generated outreach email draft, clearly stamped as
 * an unsent draft that requires explicit authorization before any send.
 */
import shared from '@/app/shared.module.css';
import type { FirmContent } from '@/lib/firms/types';
import styles from './profile-sections.module.css';

export function OutreachSection({ draft }: { draft: FirmContent['outreachDraft'] | null }) {
  if (!draft) {
    return (
      <section aria-labelledby="outreach-heading">
        <h2 id="outreach-heading" className={styles.ruledHeading}>
          Outreach draft
        </h2>
        <p className={styles.pending}>Content pending — outreach draft has not been generated for this firm yet.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="outreach-heading">
      <h2 id="outreach-heading" className={styles.ruledHeading}>
        Outreach draft
      </h2>
      <div className={styles.outreachHeader}>
        <span className={`${shared.stamp} ${shared.stampOxblood}`}>Draft</span>
        <p className={styles.outreachNote}>NOT SENT — requires explicit authorization before any outreach.</p>
      </div>
      <p className={styles.outreachSubject}>
        <strong>Subject:</strong> {draft.subject}
      </p>
      <pre className={styles.outreachBody}>{draft.body}</pre>
    </section>
  );
}
