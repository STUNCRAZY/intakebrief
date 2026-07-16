/** @jsxRuntime automatic */
'use client';

/**
 * PipelineTracker — per-firm pipeline stage controls for the operator.
 * The current stage is persisted in the operator's browser only
 * (localStorage key `pipeline:${firmId}`); nothing is sent to a server.
 */
import { useCallback, useEffect, useState } from 'react';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/firms/types';
import styles from './pipeline-tracker.module.css';

const STAGE_LABEL: Record<PipelineStage, string> = {
  'research-complete': 'Research complete',
  'ready-for-review': 'Ready for review',
  approved: 'Approved',
  contacted: 'Contacted',
  replied: 'Replied',
  'demo-scheduled': 'Demo scheduled',
  closed: 'Closed',
};

function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function PipelineTracker({ firmId }: { firmId: string }) {
  const storageKey = `pipeline:${firmId}`;
  const [stage, setStage] = useState<PipelineStage>(PIPELINE_STAGES[0]);

  // Restore the saved stage after mount (localStorage is browser-only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && isPipelineStage(saved)) setStage(saved);
    } catch {
      // localStorage unavailable (private mode etc.) — session-only state.
    }
  }, [storageKey]);

  const select = useCallback(
    (next: PipelineStage) => {
      setStage(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore persistence failures; the in-memory stage still updates
      }
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setStage(PIPELINE_STAGES[0]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return (
    <div>
      <div className={styles.stageRow} role="group" aria-label="Pipeline stage">
        {PIPELINE_STAGES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={styles.stageButton}
            aria-pressed={stage === candidate}
            onClick={() => select(candidate)}
          >
            {STAGE_LABEL[candidate]}
          </button>
        ))}
      </div>
      <p className={styles.status} role="status">
        Current stage: <strong>{stage}</strong>
      </p>
      <button type="button" className={styles.resetButton} onClick={reset}>
        Reset stage
      </button>
      <p className={styles.note}>
        Stages are stored locally in this operator&apos;s browser (localStorage key <code>{storageKey}</code>) and are
        not shared or synced.
      </p>
    </div>
  );
}
