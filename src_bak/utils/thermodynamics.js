import { smoothVario, turnRate, PROFILE_WINDOW } from './math.js';

// --------------------
// Smoothed Vario Calculation
// Returns smoothed climb rate at given index (m/s)
// --------------------
export function getSmoothedVario(index, fixes, window = PROFILE_WINDOW) {
  const start = Math.max(0, index - window);
  const end = Math.min(fixes.length - 1, index + window);

  const p1 = fixes[start];
  const p2 = fixes[end];

  const dt = Math.max(p2.time - p1.time, 1);

  return (p2.gpsAltitude - p1.gpsAltitude) / dt;
}

