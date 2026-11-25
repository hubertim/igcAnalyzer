import { smoothVario } from "./thermalDetection";

// Gleicher Erdradius wie MapLibre, damit Meter (Höhe) und Mercator-Einheiten zusammenpassen.
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6371008.8;

function mercator(lng, lat) {
  const x = (180 + lng) / 360;
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
  return { x, y };
}

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// Sinken = blau, ~0 = grün, Steigen = rot (Bereich ±3 m/s)
export function varioColor(v) {
  const t = Math.max(-1, Math.min(1, v / 3));
  const hue = t < 0 ? 120 + -t * 100 : 120 - t * 120;
  return hslToRgb(hue, 0.9, 0.5);
}

const altitudeOf = (fix) => fix.gpsAltitude || fix.pressureAltitude || 0;

/**
 * Bereitet Fixes für die 3D-Darstellung vor.
 * Koordinaten sind lokale Meter relativ zum ersten Fix (x = Ost, y = Nord, z = Höhe ü. NN),
 * damit Float32 auf der GPU keine Sprünge erzeugt. origin/scale gehören in die Model-Matrix.
 */
export function prepareTrack3D(fixes, thermals = [], maxPoints = 6000) {
  const usable = fixes.filter((fix) => fix.valid !== false);
  if (usable.length < 2) return null;

  const step = Math.max(1, Math.ceil(usable.length / maxPoints));
  const picked = [];
  for (let i = 0; i < usable.length; i += step) picked.push(i);
  if (picked[picked.length - 1] !== usable.length - 1) picked.push(usable.length - 1);

  const first = usable[0];
  const origin = mercator(first.longitude, first.latitude);
  const scale = 1 / EARTH_CIRCUMFERENCE / Math.cos((first.latitude * Math.PI) / 180);

  const positions = new Float32Array(picked.length * 3);
  const colors = new Float32Array(picked.length * 3);
  const pts = new Array(picked.length);
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

  picked.forEach((fixIndex, i) => {
    const fix = usable[fixIndex];
    const m = mercator(fix.longitude, fix.latitude);
    positions[i * 3] = (m.x - origin.x) / scale;
    positions[i * 3 + 1] = (origin.y - m.y) / scale;
    positions[i * 3 + 2] = altitudeOf(fix);

    const v = smoothVario(fixIndex, usable, 5);
    const [r, g, b] = varioColor(v);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    pts[i] = { lng: fix.longitude, lat: fix.latitude, alt: altitudeOf(fix), time: fix.time, vario: v };

    minLng = Math.min(minLng, fix.longitude);
    maxLng = Math.max(maxLng, fix.longitude);
    minLat = Math.min(minLat, fix.latitude);
    maxLat = Math.max(maxLat, fix.latitude);
  });

  const thermalPaths = [];
  for (const thermal of thermals) {
    const from = pts.findIndex((p) => p.time >= thermal.start.time);
    let to = -1;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].time <= thermal.end.time) { to = i; break; }
    }
    if (from === -1 || to - from < 1) continue;
    thermalPaths.push({
      positions: positions.slice(from * 3, (to + 1) * 3),
      direction: thermal.direction,
    });
  }

  return {
    origin,
    scale,
    positions,
    colors,
    pts,
    thermalPaths,
    bounds: [[minLng, minLat], [maxLng, maxLat]],
  };
}
