import { useState } from 'react';
import Button from './Button';

// Import utilities
import { formatTime } from '../utils/formatTime.js';

export default function StatsPanel({ thermalStats, activeMeasurement, glideMode }) {
  return (
    <div style={{
      display: "grid",
      gap: 12,
      alignContent: "start",
    }}>
      {/* THERMALS */}
      {thermalStats && (
        <div style={{
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
        }}>
          <h3>🌀 Thermals</h3>

          <div style={{ display: "grid", gap: 8 }}>
            <p>Thermals: {thermalStats.totalThermals}</p>
            <p>Right: {thermalStats.rightTurns} ({thermalStats.rightPercent.toFixed(1)}%)</p>
            <p>Left: {thermalStats.leftTurns} ({thermalStats.leftPercent.toFixed(1)}%)</p>
            <p>Avg duration: {formatTime(thermalStats.avgDuration)}</p>
            <p>Total gain: {thermalStats.totalGain.toFixed(0)} m</p>
            <p>Avg gain: {thermalStats.avgGain.toFixed(0)} m</p>
            <p>Avg climbrate: {thermalStats.avgClimbRateFligh.toFixed(1)} m/s</p>
          </div>
        </div>
      )}

      {/* MEASUREMENT */}
      {activeMeasurement && (
        <div style={{
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
        }}>
          <h3>
            {glideMode ? "🟠 Glide" : "📊 Measurement"}
          </h3>

          <div style={{ display: "grid", gap: 8 }}>
            <p>Distance: {activeMeasurement.distance_km.toFixed(2)} km</p>
            <p>Tracklength: {activeMeasurement.trackLength_km.toFixed(2)} km</p>
            <p>Height diff: {activeMeasurement.height_m.toFixed(0)} m</p>
            <p>Time: {formatTime(activeMeasurement.time_s)}</p>
            <p>Speed: {activeMeasurement.speed_kmh.toFixed(1)} km/h</p>
            <p>Glide: {activeMeasurement.glide ? `1:${activeMeasurement.glide.toFixed(1)}` : "N/A"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
