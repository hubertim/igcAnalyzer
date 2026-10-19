import {
  GLIDE_CLIMB_THRESHOLD,
  GLIDE_REQUIRED_POINTS,
} from "../constants";
import { haversine, trackDistance } from "./geo";
import { smoothVario } from "./thermalDetection";

export function findGlideSegment(index, fixes) {
  let startIdx = index;
  let endIdx = index;
  let climbCount = 0;

  for (let i = index; i > 5; i--) {
    const v = smoothVario(i, fixes);

    if (v > GLIDE_CLIMB_THRESHOLD) {
      climbCount++;

      if (climbCount >= GLIDE_REQUIRED_POINTS) {
        startIdx = i + GLIDE_REQUIRED_POINTS;
        break;
      }
    } else {
      climbCount = 0;
    }
  }

  climbCount = 0;

  for (let i = index; i < fixes.length - 5; i++) {
    const v = smoothVario(i, fixes);

    if (v > GLIDE_CLIMB_THRESHOLD) {
      climbCount++;

      if (climbCount >= GLIDE_REQUIRED_POINTS) {
        endIdx = i - GLIDE_REQUIRED_POINTS;
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

export function computeGlide(segment, fixes) {
  const [p1, p2] =
    segment.start.time <= segment.end.time
      ? [segment.start, segment.end]
      : [segment.end, segment.start];

  const distDirect = haversine(p1, p2);
  const distTrack = trackDistance(fixes, segment.start, segment.end);

  const heightDiff =
    segment.start.gpsAltitude - segment.end.gpsAltitude;

  const dt = Math.max(
    Math.abs(segment.end.time - segment.start.time),
    1,
  );

  const speed = (distDirect / dt) * 3.6;

  return {
    distance_km: distDirect / 1000,
    trackLength_km: distTrack / 1000,
    height_m: heightDiff,
    glide: heightDiff > 0 ? distTrack / heightDiff : null,
    speed_kmh: speed,
    time_s: dt,
  };
}
