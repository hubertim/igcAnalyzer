import { MIN_VARIO, MIN_TURN, MIN_DURATION, MIN_ROTATION } from "../constants";
import { bearing, turnRate } from "./geo";

export function smoothVario(index, fixes, window = 5) {
  const start = Math.max(0, index - window);
  const end = Math.min(fixes.length - 1, index + window);

  const p1 = fixes[start];
  const p2 = fixes[end];
  const dt = Math.max(p2.time - p1.time, 1);

  return (p2.gpsAltitude - p1.gpsAltitude) / dt;
}

export function vario(f1, f2) {
  const dt = Math.max(f2.time - f1.time, 1);
  return (f2.gpsAltitude - f1.gpsAltitude) / dt;
}

export function getDirectionFromSegment(fixes, startIdx, endIdx) {
  let total = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const h1 = bearing(fixes[i - 1], fixes[i]);
    const h0 = bearing(fixes[i - 2] || fixes[i - 1], fixes[i - 1]);

    let delta = h1 - h0;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    total += delta;
  }

  if (Math.abs(total) < 90) return "unknown";

  return total > 0 ? "right" : "left";
}

export function detectThermals(fixes) {
  const thermals = [];
  let current = null;

  for (let i = 10; i < fixes.length - 10; i++) {
    const v = smoothVario(i, fixes, 120);

    let tr = 0;
    let count = 0;

    for (let k = -5; k <= 5; k++) {
      tr += turnRate(
        fixes[i + k - 1],
        fixes[i + k],
        fixes[i + k + 1],
      );
      count++;
    }

    tr /= count;

    const circling = Math.abs(tr) > MIN_TURN;
    const climbing = v > MIN_VARIO;

    if (circling && climbing) {
      if (!current) {
        current = {
          startIdx: i,
          endIdx: i,
          rotation: 0,
          right: 0,
          left: 0,
          lastHeading: bearing(fixes[i - 1], fixes[i]),
        };
      }

      current.endIdx = i;

      const heading = bearing(fixes[i - 1], fixes[i]);
      let delta = heading - current.lastHeading;

      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;

      current.rotation += Math.abs(delta);
      current.lastHeading = heading;

      if (tr > 0) {
        current.right++;
      } else {
        current.left++;
      }
    } else if (current) {
      const start = fixes[current.startIdx];
      const end = fixes[current.endIdx];
      const duration = end.time - start.time;

      if (
        duration >= MIN_DURATION &&
        current.rotation >= MIN_ROTATION
      ) {
        thermals.push({
          start,
          end,
          duration,
          direction: getDirectionFromSegment(
            fixes,
            current.startIdx,
            current.endIdx,
          ),
          rotation: current.rotation,
        });
      }

      current = null;
    }
  }

  return thermals;
}

export function computeThermalStats(thermals) {
  let right = 0;
  let left = 0;
  let totalDuration = 0;
  let totalGain = 0;

  for (const t of thermals) {
    if (t.direction === "right") {
      right++;
    } else {
      left++;
    }

    totalDuration += t.duration;
    totalGain += t.end.gpsAltitude - t.start.gpsAltitude;
  }

  const total = thermals.length;

  return {
    totalThermals: total,
    rightTurns: right,
    leftTurns: left,
    rightPercent: total > 0 ? (right / total) * 100 : 0,
    leftPercent: total > 0 ? (left / total) * 100 : 0,
    avgDuration: total > 0 ? totalDuration / total : 0,
    totalGain,
    avgGain: total > 0 ? totalGain / total : 0,
    avgClimbRate:
      totalDuration > 0 ? totalGain / totalDuration : 0,
  };
}
