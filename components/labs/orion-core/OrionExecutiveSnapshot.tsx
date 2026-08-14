import type { OrionExecutiveSnapshot } from "@/lib/labs/orion-core";

type OrionExecutiveSnapshotProps = {
  snapshot: OrionExecutiveSnapshot;
};

export function OrionExecutiveSnapshot({ snapshot }: OrionExecutiveSnapshotProps) {
  return (
    <section aria-label="Executive snapshot" className="oc-snapshot">
      <p className="oc-eyebrow">Executive Snapshot</p>
      <dl className="oc-snapshot-grid">
        <div>
          <dt>Company state</dt>
          <dd>{snapshot.companyHealth}</dd>
        </div>
        <div>
          <dt>Top priority</dt>
          <dd>{snapshot.topPriority}</dd>
        </div>
        <div>
          <dt>Why it matters</dt>
          <dd>{snapshot.whyItMatters}</dd>
        </div>
        <div>
          <dt>Evidence quality</dt>
          <dd>{snapshot.evidenceQuality}</dd>
        </div>
        <div>
          <dt>Data freshness</dt>
          <dd>{snapshot.freshness}</dd>
        </div>
      </dl>

      <div className="oc-counts" aria-label="Supporting counts">
        <span>Signals: {snapshot.supportingSignalCount}</span>
        <span>Memory matches: {snapshot.memoryMatchCount}</span>
        <span>Relationships: {snapshot.graphRelationshipCount}</span>
      </div>

      <div className="oc-review-order">
        <p className="oc-eyebrow">Recommended review order</p>
        <ol>
          {snapshot.recommendedReviewOrder.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
