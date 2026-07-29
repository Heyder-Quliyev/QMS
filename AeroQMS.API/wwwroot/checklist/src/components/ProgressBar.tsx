interface Props {
  complete: number;
  total: number;
}

export function ProgressBar({ complete, total }: Props) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  return (
    <div className="progress-card">
      <div className="progress-header">
        <span className="progress-label">Progress</span>
        <span className="progress-count">
          <strong>{complete}</strong>
          <span className="progress-sep">/</span>
          <span>{total} items complete</span>
          <span className="progress-pct">({pct}%)</span>
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
