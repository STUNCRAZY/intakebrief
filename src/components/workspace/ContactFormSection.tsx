/** @jsxRuntime automatic */
/**
 * ContactFormSection — read-only preview of the firm's custom inquiry form.
 * Shows the generated identity sentence verbatim and the merged field list
 * from getFieldsForFirm; links out to the live form tester at /capture/[id].
 */
import Link from 'next/link';
import type { FirmProfile } from '@/lib/firms/types';
import { getFieldsForFirm } from '@/lib/inquiry/fields';
import styles from './profile-sections.module.css';

export function ContactFormSection({
  firm,
  identitySentence,
}: {
  firm: FirmProfile;
  identitySentence: string | null;
}) {
  const fields = getFieldsForFirm(firm);

  return (
    <section aria-labelledby="contact-form-heading">
      <h2 id="contact-form-heading" className={styles.ruledHeading}>
        Custom contact form
      </h2>

      {identitySentence ? (
        <blockquote className={styles.identity}>
          <p>{identitySentence}</p>
        </blockquote>
      ) : (
        <p className={styles.pending}>Content pending — identity sentence has not been generated for this firm yet.</p>
      )}

      <h3 className={styles.subHead}>Field preview (read-only)</h3>
      <ul className={styles.fieldList}>
        {fields.map((field) => (
          <li key={field.name} className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <span className={styles.fieldMeta}>
              <code>{field.type}</code>
              {field.options ? ` · ${field.options.length} options` : ''} · {field.required ? 'required' : 'optional'}
            </span>
          </li>
        ))}
      </ul>

      <p>
        <Link href={`/capture/${firm.id}`} className={styles.testerLink}>
          Open the live form tester
        </Link>
      </p>
    </section>
  );
}
