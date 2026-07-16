/**
 * Firm profile — server component. Renders the full research dossier,
 * the generated website concept + identity sentence, a read-only preview
 * of the custom contact form, the outreach draft, and the operator's
 * localStorage-backed pipeline tracker.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { docketNumber, getAllFirms, getFirm, getFirmContent } from '@/lib/firms/load';
import type { WebsiteQualityClassification } from '@/lib/firms/types';
import { ConceptSection } from '@/components/workspace/ConceptSection';
import { ContactFormSection } from '@/components/workspace/ContactFormSection';
import { LANE_LABEL } from '@/components/workspace/labels';
import { OutreachSection } from '@/components/workspace/OutreachSection';
import { PipelineTracker } from '@/components/workspace/PipelineTracker';
import { ResearchRecord } from '@/components/workspace/ResearchRecord';
import shared from '../../shared.module.css';
import styles from '@/components/workspace/profile-sections.module.css';

const QUALITY_STAMP: Record<WebsiteQualityClassification, string> = {
  Strong: shared.stampSuccess,
  Adequate: shared.stampWarning,
  Subpar: shared.stampDanger,
};

export function generateStaticParams() {
  return getAllFirms().map((firm) => ({ id: firm.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const firm = getFirm(id);
  return { title: firm ? firm.name : 'Unknown firm' };
}

export default async function FirmProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firm = getFirm(id);
  if (!firm) notFound();

  const index = getAllFirms().findIndex((candidate) => candidate.id === firm.id);
  const docket = docketNumber(index < 0 ? 0 : index);
  const content = getFirmContent(firm.id);

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.breadcrumb}>
          <Link href="/">← Docket index</Link>
        </p>
        <div className={styles.headerRow}>
          <span className={shared.docket}>{docket}</span>
          <span className={`${shared.stamp} ${shared.stampSlate}`}>{LANE_LABEL[firm.lane]}</span>
          <span className={`${shared.stamp} ${QUALITY_STAMP[firm.websiteQuality.classification]}`}>
            {firm.websiteQuality.classification} site
          </span>
        </div>
        <h1 className={styles.title}>{firm.name}</h1>
        <p className={styles.meta}>
          {firm.location.city}, {firm.location.state}
        </p>
        <p className={styles.meta}>
          <span className={styles.mono}>{firm.phone}</span> ·{' '}
          <a href={firm.website} target="_blank" rel="noopener noreferrer">
            Visit current website
          </a>
        </p>
        <hr className={shared.rule} />
      </header>

      <ResearchRecord firm={firm} />

      <ConceptSection content={content} />

      <ContactFormSection firm={firm} identitySentence={content?.identitySentence ?? null} />

      <OutreachSection draft={content?.outreachDraft ?? null} />

      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className={styles.ruledHeading}>
          Pipeline tracker
        </h2>
        <PipelineTracker firmId={firm.id} />
      </section>
    </div>
  );
}
