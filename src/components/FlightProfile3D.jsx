import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";

const MAX_CHART_POINTS = 800; // reicht für die Breite des Diagramms und hält die Wiedergabe flüssig

const pad = (n) => String(n).padStart(2, "0");
const clockLabel = (seconds) => `${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor((seconds % 3600) / 60))}`;
const clockLabelSeconds = (seconds) => `${clockLabel(seconds)}:${pad(Math.floor(seconds % 60))}`;

function nearestIndex(pts, time) {
  let low = 0;
  let high = pts.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (pts[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const previous = Math.max(0, low - 1);
  return Math.abs(pts[previous].time - time) <= Math.abs(pts[low].time - time) ? previous : low;
}

function timeTicks(start, end) {
  const span = end - start;
  const interval = [300, 600, 900, 1800, 3600, 7200].find((value) => span / value <= 8) ?? 7200;
  const ticks = [];
  for (let t = Math.ceil(start / interval) * interval; t <= end; t += interval) ticks.push(t);
  return ticks;
}

export default function FlightProfile3D({ track, index, onIndexChange, height = 230 }) {
  const data = useMemo(() => {
    const step = Math.max(1, Math.ceil(track.pts.length / MAX_CHART_POINTS));
    return track.pts
      .filter((_, i) => i % step === 0 || i === track.pts.length - 1)
      .map((p) => ({ time: p.time, altitude: p.alt }));
  }, [track]);

  const ticks = useMemo(
    () => timeTicks(track.pts[0].time, track.pts[track.pts.length - 1].time),
    [track],
  );

  const current = track.pts[Math.min(index, track.pts.length - 1)];

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 10,
        boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
        cursor: "pointer",
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 20, right: 10, left: 25, bottom: 12 }}
          onClick={(state) => {
            const raw = state?.activeLabel;
            if (raw == null) return;
            const time = Number(raw);
            if (Number.isFinite(time)) onIndexChange?.(nearestIndex(track.pts, time));
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={ticks}
            tickFormatter={clockLabel}
          />

          <YAxis
            domain={["dataMin - 50", "dataMax + 50"]}
            tickFormatter={(v) => `${Math.round(v)}`}
            tick={{ fill: "#ff9800" }}
            label={{
              value: "height in m",
              angle: -90,
              position: "insideLeft",
              fill: "#ff9800",
              style: { textAnchor: "middle" },
              offset: -10,
            }}
          />

          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(0)} m`, "Altitude"]}
            labelFormatter={(v) => clockLabelSeconds(Number(v))}
          />

          <Area
            type="monotone"
            dataKey="altitude"
            stroke="#ff9800"
            fill="#ffcc80"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          <ReferenceLine x={current.time} stroke="#e53935" strokeWidth={2} />
          <ReferenceDot
            x={current.time}
            y={current.alt}
            r={6}
            fill="#e53935"
            stroke="white"
            strokeWidth={2}
            isFront
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
