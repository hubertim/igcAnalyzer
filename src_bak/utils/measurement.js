// Import from math utilities
import { haversine, trackDistance } from './math.js';

// --------------------
// Compute Measurement Between Two Points
// --------------------
export function computeMeasurement(a, b, fixes) {
  const [p1, p2] = a.time <= b.time ? [a, b] : [b, a];

  const distDirect = haversine(p1, p2);
  const dt = Math.max(p2.time - p1.time, 1);
  const distTrack = trackDistance(fixes, p1, p2);
  
  const heightDiff =
    (p1.gpsAltitude ?? 0) - (p2.gpsAltitude ?? 0);

  const speed = (distDirect / dt) * 3.6;

  let glide = null;

  if (heightDiff > 1) {
    glide = distTrack / heightDiff;
  }

  return {
    distance_km: distDirect / 1000, 
    trackLength_km: distTrack / 1000,
    time_s: dt,
    speed_kmh: speed,
    height_m: heightDiff ?? 0,
    glide: glide ?? null,
  };
}

// --------------------
// Find Glide Segment Around Given Index
// --------------------
export function findGlideSegment(index, fixes) {
  const CLIMB_THRESHOLD = -0.3; // m/s
  const REQUIRED_POINTS = 20;

  let startIdx = index;
  let endIdx = index;

  // Backwards search for climb segment
  let climbCount = 0;

  for (let i = index; i > 5; i--) {
    const v = smoothVario(i, fixes);

    if (v > CLIMB_THRESHOLD) {
      climbCount++;

      if (climbCount >= REQUIRED_POINTS) {
        startIdx = i + REQUIRED_POINTS;
        break;
      }
    } else {
      climbCount = 0;
    }
  }

  // Forwards search for descent segment
  climbCount = 0;

  for (let i = index; i < fixes.length - 5; i++) {
    const v = smoothVario(i, fixes);

    if (v > CLIMB_THRESHOLD) {
      climbCount++;

      if (climbCount >= REQUIRED_POINTS) {
        endIdx = i - REQUIRED_POINTS;
        break;
      }
    } else {
      climbCount = 0;
    }
  }

  return {
    start: fixes[startIdx],
    end: fixes[endIdx],
  };
}

// --------------------
// Compute Glide Performance Between Two Points
// --------------------
export function computeGlide(segment, fixes) {
  const [p1, p2] = segment.start.time <= segment.end.time 
    ? [segment.start, segment.end] 
    : [segment.end, segment.start];

  const distDirect = haversine(p1, p2);
  const distTrack = trackDistance(fixes, segment.start, segment.end);
  
  const heightDiff =
    segment.start.gpsAltitude - segment.end.gpsAltitude;
    
  const dt = Math.max(segment.end.time - segment.start.time, 1);

  const speed = (distDirect / dt) * 3.6;

  return {
    distance_km: distDirect / 1000,
    trackLength_km: distTrack/1000,
    height_m: heightDiff,
    glide: heightDiff > 0 ? distTrack / heightDiff : null,
    speed_kmh: speed,
    time_s: dt,
  };
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
    const dt = Math.max(segment[i].time - segment[i - 1].time, 1);

    totalDist += ds;
    totalTime += dt;
  }

  return totalTime > 0
    ? (totalDist / totalTime) * 3.6
    : 0;
}
