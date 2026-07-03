// Minimal inline-SVG line chart. No external dependencies so it works fully offline.
const Charts = {
  // points: [{ x: label, y: number }]
  lineChart(points, { width = 320, height = 160, padding = 24 } = {}) {
    if (points.length === 0) {
      return '<p class="empty-state">No data yet.</p>';
    }
    if (points.length === 1) {
      const p = points[0];
      return `<svg viewBox="0 0 ${width} ${height}" class="chart">
        <circle cx="${width / 2}" cy="${height / 2}" r="4" class="chart-dot" />
        <text x="${width / 2}" y="${height / 2 - 12}" class="chart-label" text-anchor="middle">${p.y}</text>
      </svg>`;
    }

    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeY = maxY - minY || 1;

    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    const coords = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * plotW;
      const y = padding + plotH - ((p.y - minY) / rangeY) * plotH;
      return { x, y, value: p.y };
    });

    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const dots = coords
      .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" class="chart-dot" />`)
      .join('');
    const last = coords[coords.length - 1];

    return `<svg viewBox="0 0 ${width} ${height}" class="chart">
      <path d="${pathD}" class="chart-line" fill="none" />
      ${dots}
      <text x="${last.x.toFixed(1)}" y="${(last.y - 10).toFixed(1)}" class="chart-label" text-anchor="end">${last.value}</text>
    </svg>`;
  },
};

window.Charts = Charts;
