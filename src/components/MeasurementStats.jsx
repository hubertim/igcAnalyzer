import { formatTime } from "../utils/time";

export default function MeasurementStats({
  measurement,
  glideMode,
  compact = false,
}) {
  if (!measurement) return null;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
        height: compact ? "100%" : undefined,
      }}
    >
      <h3>{glideMode ? "🟠 Glide" : "📊 Measurement"}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "max-content auto", gap: "8px 12px", alignItems: "baseline", justifyItems: "start", textAlign: "left", whiteSpace: "nowrap" }}>
        <span>Distance</span><strong>{measurement.distance_km.toFixed(2)} km</strong>
        {!compact && <><span>Tracklength</span><strong>{measurement.trackLength_km.toFixed(2)} km</strong></>}
        <span>Height diff</span><strong>{measurement.height_m.toFixed(0)} m</strong>
        <span>Time</span><strong>{formatTime(measurement.time_s)}</strong>
        <span>Speed</span><strong>{measurement.speed_kmh.toFixed(1)} km/h</strong>
        <span>Glide</span><strong>{measurement.glide ? `1:${measurement.glide.toFixed(1)}` : "N/A"}</strong>
      </div>
    </div>
  );
}
