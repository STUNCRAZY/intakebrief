/** @jsxRuntime automatic */
/**
 * ConceptSection — preview of the generated website concept for a firm.
 * The pack's accentColor is applied as a CSS custom property on the section.
 */
import type { CSSProperties } from 'react';
import shared from '@/app/shared.module.css';
import type { FirmContent } from '@/lib/firms/types';
import styles from './profile-sections.module.css';

export function ConceptSection({ content }: { content: FirmContent | null }) {
  if (!content) {
    return (
      <section aria-labelledby="concept-heading">
        <h2 id="concept-heading" className={styles.ruledHeading}>
          Website concept
        </h2>
        <p className={styles.pending}>Content pending — concept pack has not been generated for this firm yet.</p>
      </section>
    );
  }

  const { concept } = content;
  const accentStyle = { '--concept-accent': concept.accentColor } as CSSProperties;

  return (
    <section aria-labelledby="concept-heading">
      <h2 id="concept-heading" className={styles.ruledHeading}>
        Website concept
      </h2>
      <div className={styles.concept} style={accentStyle}>
        <p>
          <span className={`${shared.stamp} ${styles.conceptStamp}`}>
            Proposed concept — not the firm&apos;s official site
          </span>
        </p>
        <h3 className={styles.conceptHeadline}>{concept.headline}</h3>
        <p className={styles.conceptSub}>{concept.subheadline}</p>
        <ul className={styles.credList}>
          {concept.credibilityPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {concept.sections.map((block) => (
          <div key={block.title} className={styles.conceptBlock}>
            <h4>{block.title}</h4>
            <p>{block.body}</p>
          </div>
        ))}
        <p className={styles.ctaPreview}>
          <span className={styles.ctaLabel}>{concept.ctaText}</span>
          <span className={styles.ctaNote}>(call-to-action label)</span>
        </p>
      </div>
    </section>
  );
}
