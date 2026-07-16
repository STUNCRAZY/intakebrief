/** @jsxRuntime automatic */
/**
 * ResearchRecord — the verified research dossier for one firm.
 * Server-renderable (no client JS); used by the firm profile page and tests.
 */
import shared from '@/app/shared.module.css';
import type { FirmProfile } from '@/lib/firms/types';
import { FACTOR_LABELS } from './labels';
import styles from './profile-sections.module.css';

const NOT_VERIFIED = 'not publicly verified';

export function ResearchRecord({ firm }: { firm: FirmProfile }) {
  return (
    <>
      <section aria-labelledby="rr-location">
        <h2 id="rr-location" className={styles.ruledHeading}>
          Location &amp; contact
        </h2>
        <p className={styles.meta}>
          {firm.location.address}, {firm.location.city}, {firm.location.state} {firm.location.zip} ·{' '}
          {firm.location.county} County
        </p>
        <p className={styles.meta}>
          Email: {firm.email?.trim() ? firm.email : NOT_VERIFIED} · Established:{' '}
          {firm.yearEstablished ?? NOT_VERIFIED}
        </p>
      </section>

      <section aria-labelledby="rr-attorneys">
        <h2 id="rr-attorneys" className={styles.ruledHeading}>
          Attorneys
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Practice began</th>
              </tr>
            </thead>
            <tbody>
              {firm.attorneys.map((attorney) => (
                <tr key={attorney.name}>
                  <td>{attorney.name}</td>
                  <td>{attorney.role}</td>
                  <td className={styles.mono}>{attorney.yearBeganPractice ?? NOT_VERIFIED}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rr-practice-areas">
        <h2 id="rr-practice-areas" className={styles.ruledHeading}>
          Practice areas
        </h2>
        <ul className={styles.practiceList}>
          {firm.practiceAreas.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rr-notable-cases">
        <h2 id="rr-notable-cases" className={styles.ruledHeading}>
          Notable cases
        </h2>
        {firm.notableCases.length === 0 ? (
          <p className={styles.muted}>No notable cases located in public sources.</p>
        ) : (
          <ul className={styles.caseList}>
            {firm.notableCases.map((notableCase) => (
              <li key={notableCase.name}>
                <strong>{notableCase.name}</strong> — {notableCase.outcome} (
                <a href={notableCase.sourceUrl} rel="noreferrer">
                  source
                </a>
                )
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rr-website-quality">
        <h2 id="rr-website-quality" className={styles.ruledHeading}>
          Website quality — {firm.websiteQuality.classification}
        </h2>
        <p>{firm.websiteQuality.rationale}</p>
        <dl className={styles.factorList}>
          {Object.entries(firm.websiteQuality.factors).map(([key, value]) => (
            <div key={key} className={styles.factor}>
              <dt>{FACTOR_LABELS[key] ?? key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="rr-sources">
        <h2 id="rr-sources" className={styles.ruledHeading}>
          Sources
        </h2>
        <ul className={styles.sourceList}>
          {firm.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noreferrer">
                {source.url}
              </a>
              <p className={styles.sourceSupports}>{source.supports}</p>
            </li>
          ))}
        </ul>
      </section>

      {firm.unverified.length > 0 ? (
        <section aria-labelledby="rr-unverified" className={styles.unverified}>
          <h2 id="rr-unverified" className={styles.ruledHeading}>
            Not publicly verified
          </h2>
          <ul>
            {firm.unverified.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {firm.notes ? (
        <section aria-labelledby="rr-notes">
          <h2 id="rr-notes" className={styles.ruledHeading}>
            Research notes
          </h2>
          <p className={styles.notes}>{firm.notes}</p>
          <p className={styles.meta}>Researched {firm.researchedAt}</p>
        </section>
      ) : null}
    </>
  );
}
