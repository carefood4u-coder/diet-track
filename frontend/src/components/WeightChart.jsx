/**
 * Minimal dependency-free line chart for weight history, rendered as
 * inline SVG so we don't need an extra charting library.
 */
export default function WeightChart({ logs }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-500">No weight entries yet.</p>;
  }

  const width = 600;
  const height = 200;
  const padding = 30;

  const weights = logs.map((l) => l.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const points = logs.map((log, i) => {
    const x = logs.length === 1 ? width / 2 : padding + (i * (width - 2 * padding)) / (logs.length - 1);
    const y = height - padding - ((log.weightKg - minW) / range) * (height - 2 * padding);
    return { x, y, log };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
        <path d={pathD} fill="none" stroke="#16a34a" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#16a34a">
            <title>
              {new Date(p.log.loggedAt).toLocaleDateString()} - {p.log.weightKg} kg
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{new Date(logs[0].loggedAt).toLocaleDateString()}</span>
        <span>
          min {minW}kg / max {maxW}kg
        </span>
        <span>{new Date(logs[logs.length - 1].loggedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
