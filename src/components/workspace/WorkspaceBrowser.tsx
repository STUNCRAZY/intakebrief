/** @jsxRuntime automatic */
'use client';

/**
 * WorkspaceBrowser — client-side search/filter browser over the firm docket.
 * The server page serializes one WorkspaceFirm per profile and passes it down;
 * all filtering happens client-side so the toolbar is instant.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import shared from '@/app/shared.module.css';
import type { FirmLane, WebsiteQualityClassification } from '@/lib/firms/types';
import { LANE_LABEL, LANE_ORDER, QUALITY_ORDER } from './labels';
import styles from './workspace-browser.module.css';

/** Serializable card data for one firm, prepared by the server dashboard page. */
export interface WorkspaceFirm {
  id: string;
  docket: string;
  name: string;
  city: string;
  state: string;
  lane: FirmLane;
  quality: WebsiteQualityClassification;
  phone: string;
  practiceAreas: string[];
}

const QUALITY_STAMP: Record<WebsiteQualityClassification, string> = {
  Strong: shared.stampSuccess,
  Adequate: shared.stampWarning,
  Subpar: shared.stampDanger,
};

type QualityFilter = 'All' | WebsiteQualityClassification;
type LaneFilter = 'All' | FirmLane;

export function WorkspaceBrowser({ firms }: { firms: WorkspaceFirm[] }) {
  const [query, setQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('All');
  const [laneFilter, setLaneFilter] = useState<LaneFilter>('All');

  const qualityCounts = useMemo(() => {
    const counts = new Map<WebsiteQualityClassification, number>();
    for (const firm of firms) counts.set(firm.quality, (counts.get(firm.quality) ?? 0) + 1);
    return counts;
  }, [firms]);

  const lanesPresent = useMemo(() => LANE_ORDER.filter((lane) => firms.some((f) => f.lane === lane)), [firms]);

  const laneCounts = useMemo(() => {
    const counts = new Map<FirmLane, number>();
    for (const firm of firms) counts.set(firm.lane, (counts.get(firm.lane) ?? 0) + 1);
    return counts;
  }, [firms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return firms.filter((firm) => {
      if (qualityFilter !== 'All' && firm.quality !== qualityFilter) return false;
      if (laneFilter !== 'All' && firm.lane !== laneFilter) return false;
      if (q) {
        const haystack = `${firm.name} ${firm.practiceAreas.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [firms, query, qualityFilter, laneFilter]);

  const clearAll = () => {
    setQuery('');
    setQualityFilter('All');
    setLaneFilter('All');
  };

  return (
    <section aria-label="Firm workspace browser">
      <div className={styles.controls}>
        <div className={styles.searchGroup}>
          <label htmlFor="workspace-search" className={styles.searchLabel}>
            Search firms
          </label>
          <input
            id="workspace-search"
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Firm name or practice area"
          />
        </div>

        <fieldset className={styles.chipGroup}>
          <legend className={styles.chipLegend}>Website quality</legend>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={qualityFilter === 'All'}
            onClick={() => setQualityFilter('All')}
          >
            All<span className={styles.chipCount}>{firms.length}</span>
          </button>
          {QUALITY_ORDER.map((quality) => (
            <button
              key={quality}
              type="button"
              className={styles.chip}
              aria-pressed={qualityFilter === quality}
              onClick={() => setQualityFilter(quality)}
            >
              {quality}
              <span className={styles.chipCount}>{qualityCounts.get(quality) ?? 0}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className={styles.chipGroup}>
          <legend className={styles.chipLegend}>Lane</legend>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={laneFilter === 'All'}
            onClick={() => setLaneFilter('All')}
          >
            All<span className={styles.chipCount}>{firms.length}</span>
          </button>
          {lanesPresent.map((lane) => (
            <button
              key={lane}
              type="button"
              className={styles.chip}
              aria-pressed={laneFilter === lane}
              onClick={() => setLaneFilter(lane)}
            >
              {LANE_LABEL[lane]}
              <span className={styles.chipCount}>{laneCounts.get(lane) ?? 0}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <p role="status" aria-live="polite" className={styles.resultCount}>
        Showing {filtered.length} of {firms.length} firms
      </p>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No firms on the docket match this search.</p>
          <button type="button" className={styles.clearButton} onClick={clearAll}>
            Clear search and filters
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((firm) => (
            <li key={firm.id}>
              <Link href={`/firms/${firm.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={shared.docket}>{firm.docket}</span>
                  <span className={`${shared.stamp} ${QUALITY_STAMP[firm.quality]}`}>{firm.quality}</span>
                </div>
                <h2 className={styles.firmName}>{firm.name}</h2>
                <p className={styles.meta}>
                  {firm.city}, {firm.state}
                </p>
                <p className={styles.laneRow}>
                  <span className={`${shared.stamp} ${shared.stampSlate}`}>{LANE_LABEL[firm.lane]}</span>
                </p>
                <p className={styles.phone}>{firm.phone}</p>
                <p className={styles.practices}>
                  {firm.practiceAreas.slice(0, 3).join(' · ')}
                  {firm.practiceAreas.length > 3 ? ` · +${firm.practiceAreas.length - 3} more` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
