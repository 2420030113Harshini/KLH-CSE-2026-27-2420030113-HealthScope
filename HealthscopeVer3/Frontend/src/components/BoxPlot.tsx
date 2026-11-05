type BoxDatum = {
  group: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
};

export default function BoxPlot({
  data,
  height = 260,
  yLabel,
}: {
  data: BoxDatum[];
  height?: number;
  yLabel?: string;
}) {
  if (!data.length) return null;

  const allValues = data.flatMap((d) => [d.min, d.max]);
  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);
  const range = maxY - minY || 1;
  const pad = range * 0.08;
  const lo = minY - pad;
  const hi = maxY + pad;

  const padding = { top: 20, right: 20, bottom: 46, left: 56 };
  const width = Math.max(520, data.length * 90);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const y = (v: number) => padding.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const bandW = innerW / data.length;
  const boxW = Math.min(60, bandW * 0.55);

  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => lo + ((hi - lo) * i) / (ticks - 1));

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img">
        {/* y grid + labels */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={padding.left + innerW}
              y1={y(v)}
              y2={y(v)}
              stroke="#E2E8F0"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#64748B"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padding.left + bandW * i + bandW / 2;
          const x0 = cx - boxW / 2;
          const x1 = cx + boxW / 2;
          return (
            <g key={d.group}>
              {/* whiskers */}
              <line x1={cx} x2={cx} y1={y(d.max)} y2={y(d.q3)} stroke="#4169E1" strokeWidth="1.5" />
              <line x1={cx} x2={cx} y1={y(d.min)} y2={y(d.q1)} stroke="#4169E1" strokeWidth="1.5" />
              <line
                x1={x0 + 8}
                x2={x1 - 8}
                y1={y(d.max)}
                y2={y(d.max)}
                stroke="#4169E1"
                strokeWidth="1.5"
              />
              <line
                x1={x0 + 8}
                x2={x1 - 8}
                y1={y(d.min)}
                y2={y(d.min)}
                stroke="#4169E1"
                strokeWidth="1.5"
              />
              {/* box */}
              <rect
                x={x0}
                y={y(d.q3)}
                width={boxW}
                height={Math.max(1, y(d.q1) - y(d.q3))}
                fill="#EAF2FF"
                stroke="#4169E1"
                strokeWidth="1.5"
                rx="3"
              />
              {/* median */}
              <line
                x1={x0}
                x2={x1}
                y1={y(d.median)}
                y2={y(d.median)}
                stroke="#101A35"
                strokeWidth="2.5"
              />
              {/* x label */}
              <text
                x={cx}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fontSize="11"
                fill="#334155"
              >
                {d.group.length > 12 ? d.group.slice(0, 11) + "…" : d.group}
              </text>
              <text
                x={cx}
                y={height - padding.bottom + 32}
                textAnchor="middle"
                fontSize="10"
                fill="#94A3B8"
              >
                n={d.n}
              </text>
            </g>
          );
        })}

        {yLabel && (
          <text
            x={16}
            y={padding.top + innerH / 2}
            textAnchor="middle"
            fontSize="11"
            fill="#64748B"
            transform={`rotate(-90, 16, ${padding.top + innerH / 2})`}
          >
            {yLabel}
          </text>
        )}
      </svg>
    </div>
  );
}