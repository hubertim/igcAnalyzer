export function haversine(p1, p2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(p2.latitude - p1.latitude);
  const dLon = toRad(p2.longitude - p1.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.latitude)) *
      Math.cos(toRad(p2.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(p1, p2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(p1.latitude);
  const lat2 = toRad(p2.latitude);
  const dLon = toRad(p2.longitude - p1.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function turnRate(f1, f2, f3) {
  const h1 = bearing(f1, f2);
  const h2 = bearing(f2, f3);

  let delta = h2 - h1;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  const dt = Math.max(f3.time - f1.time, 1);
  return delta / dt;
}

export function findNearestFix(lat, lon, fixes) {
  let best = null;
  let bestDist = Infinity;

  for (const f of fixes) {
    const d = haversine({ latitude: lat, longitude: lon }, f);

    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }

  return best;
}

export function trackDistance(fixes, a, b) {
  const [start, end] = a.time <= b.time ? [a, b] : [b, a];

  const startIdx = fixes.findIndex((f) => f.time === start.time);
  const endIdx = fixes.findIndex((f) => f.time === end.time);

  if (startIdx === -1 || endIdx === -1) return 0;

  let dist = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    dist += haversine(fixes[i - 1], fixes[i]);
  }

  return dist;
}
