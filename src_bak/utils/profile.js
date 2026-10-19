import { haversine } from './math.js';

// --------------------
// Compute Height & Speed Profile Data
// Used for chart rendering
// --------------------
export function computeProfileData(segment, fixes) {
  if (!fixes?.length || !segment) return [];

  const startIdx = fixes.findIndex(
    (f) => f.time === segment.start.time
  );
  const endIdx = fixes.findIndex(
    (f) => f.time === segment.end.time
  );

  if (startIdx === -1 || endIdx === -1) return [];

  const dataSegment = fixes.slice(startIdx, endIdx + 1);

  let cumulativeDistance = 0;
  let speed = 0;

  return dataSegment.map((f, i) => {
    if (i > 0) {
      cumulativeDistance += haversine(
        dataSegment[i - 1],
        dataSegment[i]
      );
    }
    const speedVal = smoothSpeed(dataSegment, i, 3);

    return {
      distance: cumulativeDistance / 1000,
      altitude: f.gpsAltitude,
      speed: speedVal,
    };
  });
}

// --------------------
// Smooth Speed Calculation for Profile Data
// Returns average speed in km/h over window
// --------------------
export function smoothSpeed(segment, index, window = 5) {
  let totalDist = 0;
  let totalTime = 0;

  const start = Math.max(1, index - window);
  const end = Math.min(
    segment.length - 1,
    index + window
  );

  for (let i = start; i <= end; i++) {
    const ds = haversine(segment[i - 1], segment[i]);
    const dt = Math.max(
      segment[i].time - segment[i - 1].time,
      1
    );

    totalDist += ds;
    totalTime += dt;
  }

  return totalTime > 0
    ? (totalDist / totalTime) * 3.6
    : 0;
}

// --------------------
// Compute Chart Axis Ticks
// --------------------
export function computeXTicks(profileData, step = 1) {
  if (!profileData.length) return [];

  const max = profileData[profileData.length - 1].distance;
  const ticks = [];

  for (let i = 0; i <= max; i += step) {
    ticks.push(i);
  }

  return ticks;
}

export function computeAltitudeTicks(profileData, step = 100) {
  if (!profileData.length) return [];

  const values = profileData.map(p => p.altitude);
  const min = Math.floor(Math.min(...values) / step) * step;
  const max = Math.ceil(Math.max(...values) / step) * step;

  const ticks = [];
  for (let v = min; v <= max; v += step) {
    ticks.push(v);
  }

  return ticks;
}

export function computeSpeedTicks(profileData, step = 10) {
  if (!profileData.length) return [];

  const values = profileData.map(p => p.speed || 0);
  const max = Math.ceil(Math.max(...values) / step) * step;

  const ticks = [];
  for (let v = 0; v <= max; v += step) {
    ticks.push(v);
  }

  return ticks;
}