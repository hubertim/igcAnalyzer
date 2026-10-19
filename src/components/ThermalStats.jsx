import { formatTime } from "../utils/time";

export default function ThermalStats({ stats }) {
  if (!stats) return null;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
      }}
    >
      <h3>🌀 Thermals</h3>

      <div style={{ display: "grid", gridTemplateColumns: "max-content auto", gap: "8px 12px", alignItems: "baseline", justifyItems: "start", textAlign: "left", whiteSpace: "nowrap" }}>
        <span>Thermals</span><strong>{stats.totalThermals}</strong>
        <span>Right</span><strong>{stats.rightTurns} ({stats.rightPercent.toFixed(1)}%)</strong>
        <span>Left</span><strong>{stats.leftTurns} ({stats.leftPercent.toFixed(1)}%)</strong>
        <span>Avg duration</span><strong>{formatTime(stats.avgDuration)}</strong>
        <span>Total gain</span><strong>{stats.totalGain.toFixed(0)} m</strong>
        <span>Avg gain</span><strong>{stats.avgGain.toFixed(0)} m</strong>
        <span>Avg climbrate</span><strong>{stats.avgClimbRate.toFixed(1)} m/s</strong>
      </div>
    </div>
  );
}
