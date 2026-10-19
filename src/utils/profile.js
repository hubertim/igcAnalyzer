import { haversine } from "./geo";

export function smoothSpeed(segment, index, window = 5) {
  let totalDist = 0;
  let totalTime = 0;

  const start = Math.max(1, index - window);
  const end = Math.min(segment.length - 1, index + window);

  for (let i = start; i <= end; i++) {
    const ds = haversine(segment[i - 1], segment[i]);
    const dt = Math.max(segment[i].time - segment[i - 1].time, 1);

    totalDist += ds;
    totalTime += dt;
  }

  return totalTime > 0 ? (totalDist / totalTime) * 3.6 : 0;
}

export function createProfileData({
  flight,
  selection,
  glideMode,
  glideSegment,
}) {
  if (!flight?.fixes?.length) return [];

  let segment = [];

  if (glideMode && glideSegment) {
    const startIdx = flight.fixes.findIndex(
      (f) => f.time === glideSegment.start.time,
    );
    const endIdx = flight.fixes.findIndex(
      (f) => f.time === glideSegment.end.time,
    );

    if (startIdx === -1 || endIdx === -1) return [];

    segment = flight.fixes.slice(startIdx, endIdx + 1);
  } else if (selection.length === 2) {
    const [a, b] =
      selection[0].time <= selection[1].time
        ? selection
        : [selection[1], selection[0]];

    const startIdx = flight.fixes.findIndex(
      (f) => f.time === a.time,
    );
    const endIdx = flight.fixes.findIndex(
      (f) => f.time === b.time,
    );

    if (startIdx === -1 || endIdx === -1) return [];

    segment = flight.fixes.slice(startIdx, endIdx + 1);
  } else {
    return [];
  }

  let cumulativeDistance = 0;

  return segment.map((fix, i) => {
    if (i > 0) {
      cumulativeDistance += haversine(
        segment[i - 1],
        segment[i],
      );
    }

    return {
      distance: cumulativeDistance / 1000,
      altitude: fix.gpsAltitude,
      speed: smoothSpeed(segment, i, 3),
    };
  });
}

export function createDistanceTicks(profileData) {
  if (!profileData.length) return [];

  const max = profileData[profileData.length - 1].distance;
  const ticks = [];

  for (let i = 0; i <= max; i += 1) {
    ticks.push(i);
  }

  return ticks;
}

export function createAltitudeTicks(profileData) {
  if (!profileData.length) return [];

  const values = profileData.map((p) => p.altitude);
  const min = Math.floor(Math.min(...values) / 100) * 100;
  const max = Math.ceil(Math.max(...values) / 100) * 100;
  const ticks = [];

  for (let v = min; v <= max; v += 100) {
    ticks.push(v);
  }

  return ticks;
}

export function createSpeedTicks(profileData) {
  if (!profileData.length) return [];

  const values = profileData.map((p) => p.speed || 0);
  const max = Math.ceil(Math.max(...values) / 10) * 10;
  const ticks = [];

  for (let v = 0; v <= max; v += 10) {
    ticks.push(v);
  }

  return ticks;
}
