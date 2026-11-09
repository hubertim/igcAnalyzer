import { useCallback, useEffect, useRef } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function CompareTimeProfile({
  data,
  initialTime,
  onTimeChange,
  formatTime,
  onBrushChange,
  brushRange,
  fullDataLength,
  minAltitude,
}) {
  const frameRef = useRef(null);
  const pendingTimeRef = useRef(null);
  const selectedTimeRef = useRef(initialTime);

  useEffect(() => {
    selectedTimeRef.current = initialTime;
  }, [initialTime]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const handleMouseMove = useCallback((state) => {
    if (state?.activeLabel == null) return;

    pendingTimeRef.current = Number(state.activeLabel);
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const nextTime = pendingTimeRef.current;
      if (nextTime !== selectedTimeRef.current) {
        selectedTimeRef.current = nextTime;
        onTimeChange(nextTime);
      }
    });
  }, [onTimeChange]);

  const handleBrushChange = useCallback((range) => {
    if (range.startIndex !== null && range.endIndex !== null && data.length > 0) {
      const startTime = data[Math.max(0, range.startIndex)]?.time;
      const endTime = data[Math.min(data.length - 1, range.endIndex)]?.time;
      if (startTime != null && endTime != null) {
        onBrushChange([startTime, endTime]);
      }
    } else {
      onBrushChange(null);
    }
  }, [onBrushChange, data]);

  const isZoomed = brushRange != null;
  const pointCount = isZoomed ? data.length : fullDataLength;
  const zoomLabel = isZoomed ? ` (Zoom: ${pointCount} Punkte)` : ` (Übersicht: ${pointCount} Punkte)`;

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "6px 12px", boxShadow: "0 4px 18px rgba(0,0,0,0.12)" }}>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 6, bottom: 8 }} onMouseMove={handleMouseMove}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatTime} />
          <YAxis
			  domain={[minAltitude, "dataMax"]}
			  tickFormatter={(value) => `${Math.round(value)} m`}
			  width={58}
			/>
          <Tooltip labelFormatter={formatTime} formatter={(value, name) => [`${Math.round(value)} m`, name]} />
          <Line type="monotone" dataKey="pilot1" name="Pilot 1" stroke="#fb8c00" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="pilot2" name="Pilot 2" stroke="#43a047" strokeWidth={2.5} dot={false} />
          
        </LineChart>
      </ResponsiveContainer>
      {isZoomed && (
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <button
            onClick={() => onBrushChange(null)}
            style={{
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ← Zurück zur Übersicht
          </button>
        </div>
      )}
    </div>
  );
}