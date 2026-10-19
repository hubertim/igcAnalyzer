
// --------------------
// Parse Latitude
// Returns decimal degrees (negative for S/W)
// --------------------
export function parseLat(raw, hemi) {
  const deg = parseInt(raw.slice(0, 2), 10);
  const min = parseInt(raw.slice(2), 10) / 1000;

  let value = deg + min / 60;

  if (hemi === "S") value *= -1;

  return value;
}

// --------------------
// Parse Longitude
// Returns decimal degrees (negative for S/W)
// --------------------
export function parseLon(raw, hemi) {
  const deg = parseInt(raw.slice(0, 3), 10);
  const min = parseInt(raw.slice(3), 10) / 1000;

  let value = deg + min / 60;

  if (hemi === "W") value *= -1;

  return value;
}

// --------------------
// Parse IGC Time Format (HHMMSS) to Seconds
// --------------------
export function parseTime(hhmmss) {
  const h = parseInt(hhmmss.slice(0, 2), 10);
  const m = parseInt(hhmmss.slice(2, 4), 10);
  const s = parseInt(hhmmss.slice(4, 6), 10);

  return h * 3600 + m * 60 + s;
}

// --------------------
// Parse Full IGC File Content
// Returns { fixes: Array of fix objects }
// --------------------
export function parseIGC(content) {
  const lines = content.split(/\r?\n/);
  const fixes = [];

  for (const line of lines) {
    if (!line.startsWith("B")) continue;
    if (line.length < 35) continue;

    const timeRaw = line.slice(1, 7);

    const latRaw = line.slice(7, 14);
    const latHem = line.slice(14, 15);

    const lonRaw = line.slice(15, 23);
    const lonHem = line.slice(23, 24);

    const validity = line.slice(24, 25);

    const pressureAltRaw = line.slice(25, 30);
    const gpsAltRaw = line.slice(30, 35);

    const latitude = parseLat(latRaw, latHem);
    const longitude = parseLon(lonRaw, lonHem);

    const pressureAltitude = parseInt(pressureAltRaw, 10);
    const gpsAltitude = parseInt(gpsAltRaw, 10);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      continue;
    }

    fixes.push({
      latitude,
      longitude,
      gpsAltitude: Number.isNaN(gpsAltitude) ? 0 : gpsAltitude,
      pressureAltitude: Number.isNaN(pressureAltitude)
        ? 0
        : pressureAltitude,
      valid: validity === "A",
      time: parseTime(timeRaw),
    });
  }

  return { fixes };
}