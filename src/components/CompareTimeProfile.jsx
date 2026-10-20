import { useCallback, useEffect, useRef } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function CompareTimeProfile({ data, initialTime, onTimeChange, formatTime }) {
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
  return (
    <div style={{ background: "white", borderRadius: 16, padding: "12px 18px", boxShadow: "0 4px 18px rgba(0,0,0,0.12)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>⛰️ Höhenprofil über Zeit</div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 6, bottom: 8 }} onMouseMove={handleMouseMove}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatTime} />
          <YAxis tickFormatter={(value) => `${Math.round(value)} m`} width={58} />
          <Tooltip labelFormatter={formatTime} formatter={(value, name) => [`${Math.round(value)} m`, name]} />
          <Legend />
          <Line type="monotone" dataKey="pilot1" name="Pilot 1" stroke="#fb8c00" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="pilot2" name="Pilot 2" stroke="#43a047" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
