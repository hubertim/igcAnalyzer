import { haversine, trackDistance } from "./geo";

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
    height_m: heightDiff,
    glide,
  };
}
