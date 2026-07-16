import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import React from 'react';
import { docketNumber, getAllFirms, getFirm, getFirmContent } from '@/lib/firms/load';
import { getFieldsForFirm } from '@/lib/inquiry/fields';
import { getPreparationGuidance } from '@/lib/guidance/preparation';
import { InquiryForm } from '@/components/capture/InquiryForm';
import shared from '../../shared.module.css';
import styles from './page.module.css';

const LANE_LABEL: Record<string, string> = {
  family: 'family-law',
  criminal: 'criminal-defense',
  estate: 'estate and probate',
  pi: 'personal-injury',
  business: 'business and civil',
};

export function generateStaticParams() {
  return getAllFirms().map((firm) => ({ id: firm.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const firm = getFirm(id);
  return { title: firm ? `${firm.name} — proposed concept` : 'Unknown firm' };
}

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firm = getFirm(id);
  if (!firm) notFound();

  const index = getAllFirms().findIndex((f) => f.id === firm.id);
  const docket = docketNumber(index < 0 ? 0 : index);

  const content = getFirmContent(id);
  const concept = content?.concept ?? {
    headline: firm.name,
    subheadline: `A ${LANE_LABEL[firm.lane] ?? firm.lane} practice in ${firm.location.city}, ${firm.location.state}.`,
    credibilityPoints: [] as string[],
    accentColor: '#7A1E2B',
    ctaText: 'Request a consultation',
    sections: [] as { title: string; body: string }[],
  };
  const identitySentence =
    content?.identitySentence ??
    `${firm.name} is a ${LANE_LABEL[firm.lane] ?? firm.lane} law firm in ${firm.location.city}, ${firm.location.state}.`;

  const fields = getFieldsForFirm(firm);
  const preparation = getPreparationGuidance({ lane: firm.lane, topics: [] });

  return (
    <div className={styles.page} style={{ '--accent': concept.accentColor } as CSSProperties}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <span className={`${shared.stamp} ${shared.stampOxblood}`}>
            PROPOSED CONCEPT — not the firm&rsquo;s official website
          </span>
          <span className={shared.docket}>{docket}</span>
        </div>
        <p className={styles.firmLine}>
          Prepared for <strong>{firm.name}</strong> · {firm.location.city}, {firm.location.state} · {firm.phone}
        </p>
        <h1 className={styles.headline}>{concept.headline}</h1>
        <p className={styles.subheadline}>{concept.subheadline}</p>
        {concept.credibilityPoints.length > 0 ? (
          <ul className={styles.credList}>
            {concept.credibilityPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        <p className={styles.ctaRow}>
          <a className={styles.cta} href="#inquiry">
            {concept.ctaText}
          </a>
        </p>
        <hr className={shared.rule} />
      </header>

      {concept.sections.map((section) => (
        <section key={section.title} className={styles.conceptSection}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <hr className={shared.rule} />

      <section id="inquiry" className={styles.intake} aria-labelledby="intake-heading">
        <h2 id="intake-heading" className={styles.sectionTitle}>
          {concept.ctaText}
        </h2>
        <p className={styles.identity}>{identitySentence}</p>
        <InquiryForm firm={firm} fields={fields} preparation={preparation} />
      </section>
    </div>
  );
}
