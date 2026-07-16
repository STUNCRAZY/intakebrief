/**
 * Dashboard — server component. Loads every researched firm profile,
 * serializes the card data, and hands it to the client WorkspaceBrowser
 * for instant search / quality / lane filtering.
 */
import Link from 'next/link';
import { docketNumber, getAllFirms } from '@/lib/firms/load';
import { WorkspaceBrowser, type WorkspaceFirm } from '@/components/workspace/WorkspaceBrowser';
import shared from './shared.module.css';
import styles from '@/components/workspace/workspace-browser.module.css';

export default function DashboardPage() {
  const firms: WorkspaceFirm[] = getAllFirms().map((firm, index) => ({
    id: firm.id,
    docket: docketNumber(index),
    name: firm.name,
    city: firm.location.city,
    state: firm.location.state,
    lane: firm.lane,
    quality: firm.websiteQuality.classification,
    phone: firm.phone,
    practiceAreas: firm.practiceAreas,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.wordmark}>IntakeBrief</span>
          <span className={`${shared.stamp} ${shared.stampOxblood}`}>Research Workspace</span>
        </div>
        <p className={styles.tagline}>
          Lead capture &amp; sales research for boutique law firms — {firms.length} firm profiles on the docket.
        </p>
        <hr className={shared.rule} />
      </header>

      <WorkspaceBrowser firms={firms} />

      <footer className={styles.footer}>
        <hr className={shared.rule} />
        <p>
          <Link href="/status">Integration status</Link>
        </p>
      </footer>
    </div>
  );
}
