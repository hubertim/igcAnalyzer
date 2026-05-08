import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// --------------------
// Leaflet Icon Fix
// --------------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --------------------
// Haversine
// --------------------
function haversine(p1, p2) {
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

// --------------------
// Time
// --------------------
function parseTime(hhmmss) {
  const h = parseInt(hhmmss.slice(0, 2));
  const m = parseInt(hhmmss.slice(2, 4));
  const s = parseInt(hhmmss.slice(4, 6));
  return h * 3600 + m * 60 + s;
}

// --------------------
// IGC Parser
// --------------------
function parseIGC(content) {
  const lines = content.split(/\r?\n/);
  const fixes = [];

  function parseLat(raw, hemi) {
    const deg = parseInt(raw.slice(0, 2), 10);
    const min = parseInt(raw.slice(2), 10) / 1000;

    let value = deg + min / 60;

    if (hemi === "S") value *= -1;

    return value;
  }

  function parseLon(raw, hemi) {
    const deg = parseInt(raw.slice(0, 3), 10);
    const min = parseInt(raw.slice(3), 10) / 1000;

    let value = deg + min / 60;

    if (hemi === "W") value *= -1;

    return value;
  }

  function parseTime(raw) {
    const h = parseInt(raw.slice(0, 2), 10);
    const m = parseInt(raw.slice(2, 4), 10);
    const s = parseInt(raw.slice(4, 6), 10);

    return h * 3600 + m * 60 + s;
  }

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

function detectThermals(fixes) {
  const thermals = [];

  const MIN_VARIO = 0.3;
  const MIN_TURN = 0.5;
  const MIN_DURATION = 30;
  const MIN_ROTATION = 360;

  let current = null;

  for (let i = 5; i < fixes.length - 5; i++) {
    // geglättetes Vario
    const v = smoothVario(i, fixes, 120);

    // geglättete Turnrate
    const tr =
      (
        turnRate(fixes[i - 3], fixes[i], fixes[i + 3]) +
        turnRate(fixes[i - 2], fixes[i], fixes[i + 2]) +
        turnRate(fixes[i - 1], fixes[i], fixes[i + 1])
      ) / 3;

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
          lastHeading: bearing(
            fixes[i - 1],
            fixes[i]
          ),
        };
      }

      current.endIdx = i;

      // echte Headingänderung
      const heading = bearing(
        fixes[i - 1],
        fixes[i]
      );

      let delta =
        heading - current.lastHeading;

      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;

      current.rotation += Math.abs(delta);

      current.lastHeading = heading;

      if (tr > 0) {
        current.right++;
      } else {
        current.left++;
      }
    } else {
      if (current) {
        const start =
          fixes[current.startIdx];

        const end =
          fixes[current.endIdx];

        const duration =
          end.time - start.time;

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
              current.endIdx
            ),
            rotation: current.rotation,
          });
        }

        current = null;
      }
    }
  }

  return thermals;
}

function getDirectionFromSegment(fixes, startIdx, endIdx) {
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

function bearing(p1, p2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(p1.latitude);
  const lat2 = toRad(p2.latitude);

  const dLon = toRad(p2.longitude - p1.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);

  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function turnRate(f1, f2, f3) {
  const h1 = bearing(f1, f2);
  const h2 = bearing(f2, f3);

  let delta = h2 - h1;

  // normalize
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  const dt = Math.max(f3.time - f1.time, 1);

  return delta / dt; // deg/sec
}

function computeThermalStats(thermals) {
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

    totalGain +=
      t.end.gpsAltitude -
      t.start.gpsAltitude;
  }

  const total = thermals.length;

  return {
    totalThermals: total,

    rightTurns: right,
    leftTurns: left,

    rightPercent:
      total > 0 ? (right / total) * 100 : 0,

    leftPercent:
      total > 0 ? (left / total) * 100 : 0,

    avgDuration:
      total > 0 ? totalDuration / total : 0,

    totalGain,

    avgGain:
      total > 0 ? totalGain / total : 0,
  };
}

// --------------------
// nearest fix
// --------------------
function findNearestFix(lat, lon, fixes) {
  let best = null;
  let bestDist = Infinity;

  for (const f of fixes) {
    const d = haversine(
      { latitude: lat, longitude: lon },
      f
    );

    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }

  return best;
}

// --------------------
// measurement
// --------------------
function computeMeasurement(a, b, fixes) {
  const [p1, p2] = a.time <= b.time ? [a, b] : [b, a];

  // Luftlinie (nur Info)
  const distDirect = haversine(p1, p2);

  const dt = Math.max(p2.time - p1.time, 1);

  // ūüüĘ REAL TRACK DISTANCE
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
    time_s: dt,
    speed_kmh: speed,
    height_m: heightDiff ?? 0,
    glide: glide ?? null,
  };
}

function trackDistance(fixes, a, b) {
  const [start, end] = a.time <= b.time ? [a, b] : [b, a];

  const startIdx = fixes.findIndex(f => f.time === start.time);
  const endIdx = fixes.findIndex(f => f.time === end.time);

  if (startIdx === -1 || endIdx === -1) return 0;

  let dist = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const p1 = fixes[i - 1];
    const p2 = fixes[i];

    dist += haversine(p1, p2);
  }

  return dist;
}

function vario(f1, f2) {
  const dt = Math.max(f2.time - f1.time, 1);
  return (f2.gpsAltitude - f1.gpsAltitude) / dt;
}

function findGlideSegment(index, fixes) {
  const CLIMB_THRESHOLD = -0.3; // m/s
  const REQUIRED_POINTS = 5;

  let startIdx = index;
  let endIdx = index;

  // --------------------
  // backwards
  // --------------------
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

  // --------------------
  // forwards
  // --------------------
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

function smoothVario(index, fixes, window = 5) {
  const start = Math.max(0, index - window);
  const end = Math.min(fixes.length - 1, index + window);

  const p1 = fixes[start];
  const p2 = fixes[end];

  const dt = Math.max(p2.time - p1.time, 1);

  return (p2.gpsAltitude - p1.gpsAltitude) / dt;
}

function computeGlide(segment, fixes) {
  const dist = trackDistance(fixes, segment.start, segment.end);

  const heightDiff =
    segment.start.gpsAltitude - segment.end.gpsAltitude;

  const dt = Math.max(segment.end.time - segment.start.time, 1);

  const speed = (dist / dt) * 3.6;

  return {
    distance_km: dist / 1000,
    height_m: heightDiff,
    glide: heightDiff > 0 ? dist / heightDiff : null,
    speed_kmh: speed,
    time_s: dt,
  };
}

// --------------------
// MAIN APP
// --------------------
export default function App() {
  const [flight, setFlight] = useState(null);
  const [selection, setSelection] = useState([]);
  const [measurement, setMeasurement] = useState(null);
  const [glideMode, setGlideMode] = useState(false);
  const [glideSegment, setGlideSegment] = useState(null);
  const [thermals, setThermals] = useState([]);
  const [thermalStats, setThermalStats] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const content = await file.text();

    // IGC parsen
    const parsed = parseIGC(content);

    // Flight speichern
    setFlight(parsed);

    // Thermiken erkennen
    const detectedThermals =
      detectThermals(parsed.fixes);

    // States setzen
    setThermals(detectedThermals);

    setThermalStats(
      computeThermalStats(
        detectedThermals
      )
    );
  };

  // --------------------
  // Map click handler
  // --------------------
function MapClickHandler({ flight, glideMode, onSelect, onGlide }) {
  useMapEvents({
    click(e) {
      if (!flight?.fixes?.length) return;

      const snapped = findNearestFix(
        e.latlng.lat,
        e.latlng.lng,
        flight.fixes
      );

      if (glideMode) {
        const index = flight.fixes.findIndex(
          (f) => f.time === snapped.time
        );

        const segment = findGlideSegment(index, flight.fixes);
        onGlide(segment);
        return;
      }

      onSelect(snapped);
    },
  });

  return null;
}

  // --------------------
  // Snap on drag END
  // --------------------
  const handleDragEnd = (index, e) => {
    const { lat, lng } = e.target.getLatLng();

    const snapped = findNearestFix(lat, lng, flight.fixes);

    setSelection((prev) =>
      prev.map((p, i) => (i === index ? snapped : p))
    );
  };

  // --------------------
  // update measurement
  // --------------------
  useEffect(() => {
  if (selection.length === 2 && flight?.fixes?.length) {
    setMeasurement(
      computeMeasurement(
        selection[0],
        selection[1],
        flight.fixes // ‚Üź DAS ist der wichtige Fix
      )
    );
  }
}, [selection, flight]);

  const latlngs =
    flight?.fixes?.map((f) => [f.latitude, f.longitude]) || [];

  function formatTime(seconds) {
    if (seconds < 60) return `${seconds.toFixed(0)} s`;

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) return `${h} h ${m} min`;
    return `${m} min ${s} s`;
  }

  // --------------------
// aktive Messung bestimmen
// --------------------
const activeMeasurement =
  glideMode && glideSegment && flight
    ? computeGlide(glideSegment, flight.fixes)
    : measurement;

// --------------------
// Glide-Pfad für Darstellung
// --------------------
const glidePath =
  glideSegment && flight
    ? flight.fixes
        .slice(
          flight.fixes.findIndex(
            (f) => f.time === glideSegment.start.time
          ),
          flight.fixes.findIndex(
            (f) => f.time === glideSegment.end.time
          ) + 1
        )
        .map((f) => [f.latitude, f.longitude])
    : [];

// --------------------
// Höhenprofil-Daten
// --------------------
const profileData = (() => {
  if (!flight?.fixes?.length) return [];

  // --------------------
  // Glide Mode
  // --------------------
  if (glideMode && glideSegment) {
    const startIdx = flight.fixes.findIndex(
      (f) => f.time === glideSegment.start.time
    );

    const endIdx = flight.fixes.findIndex(
      (f) => f.time === glideSegment.end.time
    );

    if (startIdx === -1 || endIdx === -1) return [];

    const segment = flight.fixes.slice(startIdx, endIdx + 1);

    let cumulativeDistance = 0;

    return segment.map((f, i) => {
      if (i > 0) {
        cumulativeDistance += haversine(
          segment[i - 1],
          segment[i]
        );
      }

      return {
        distance: cumulativeDistance / 1000,
        altitude: f.gpsAltitude,
      };
    });
  }

  // --------------------
  // Measurement Mode
  // --------------------
  if (selection.length === 2) {
    const [a, b] =
      selection[0].time <= selection[1].time
        ? selection
        : [selection[1], selection[0]];

    const startIdx = flight.fixes.findIndex(
      (f) => f.time === a.time
    );

    const endIdx = flight.fixes.findIndex(
      (f) => f.time === b.time
    );

    if (startIdx === -1 || endIdx === -1) return [];

    const segment = flight.fixes.slice(startIdx, endIdx + 1);

    let cumulativeDistance = 0;

    return segment.map((f, i) => {
      if (i > 0) {
        cumulativeDistance += haversine(
          segment[i - 1],
          segment[i]
        );
      }

      return {
        distance: cumulativeDistance / 1000,
        altitude: f.gpsAltitude,
      };
    });
  }

  return [];
})();

	// --------------------
	// RETURN
	// --------------------
return (
  <div style={{ padding: 20 }}>
    <h2>XC Measurement Tool</h2>

    <input
      type="file"
      accept=".igc"
      onChange={handleFile}
    />

    {/* Toolbar */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => setGlideMode((v) => !v)}
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
          transition: "0.2s",
          background: glideMode
            ? "#ff9800"
            : "#f1f1f1",
          color: glideMode ? "white" : "#333",
          boxShadow: glideMode
            ? "0 2px 8px rgba(255,152,0,0.35)"
            : "0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        {glideMode
          ? "🟠 Glide Mode ON"
          : "Glide Mode"}
      </button>

      {glideMode && (
        <div
          style={{
            color: "#ff9800",
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          Klick auf die Strecke zur Glide-Analyse
        </div>
      )}
    </div>

    {flight && (
      <>
        {/* Karte */}
        <div
          style={{
            height: 450,
            marginTop: 20,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow:
              "0 4px 18px rgba(0,0,0,0.12)",
          }}
        >
          <MapContainer
            center={latlngs[0] || [0, 0]}
            zoom={10}
            style={{ height: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* kompletter Track */}
            <Polyline positions={latlngs} />

            {/* Klick-Handling */}
            <MapClickHandler
              flight={flight}
              glideMode={glideMode}
              onSelect={(snapped) => {
                setSelection((prev) => {
                  const next = [...prev, snapped];

                  if (next.length > 2)
                    next.shift();

                  return next;
                });
              }}
              onGlide={(segment) =>
                setGlideSegment(segment)
              }
            />

            {/* normale Messmarker */}
            {!glideMode &&
              selection.map((p, i) => (
                <Marker
                  key={i}
                  position={[
                    p.latitude,
                    p.longitude,
                  ]}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) =>
                      handleDragEnd(i, e),
                  }}
                />
              ))}

            {/* normale Messlinie */}
            {!glideMode &&
              selection.length === 2 && (
                <Polyline
                  positions={[
                    [
                      selection[0].latitude,
                      selection[0].longitude,
                    ],
                    [
                      selection[1].latitude,
                      selection[1].longitude,
                    ],
                  ]}
                  color="red"
                />
              )}

            {/* Glide Segment */}
            {glideSegment && glideMode && (
              <>
                <Marker
                  position={[
                    glideSegment.start.latitude,
                    glideSegment.start.longitude,
                  ]}
                />

                <Marker
                  position={[
                    glideSegment.end.latitude,
                    glideSegment.end.longitude,
                  ]}
                />

                <Polyline
                  positions={glidePath}
                  color="orange"
                  weight={4}
                />
              </>
            )}

            {/* Thermiken */}
            {thermals.map((t, i) => {
              const startIdx =
                flight.fixes.findIndex(
                  (f) =>
                    f.time === t.start.time
                );

              const endIdx =
                flight.fixes.findIndex(
                  (f) =>
                    f.time === t.end.time
                );

              const thermalPath =
                flight.fixes
                  .slice(startIdx, endIdx + 1)
                  .map((f) => [
                    f.latitude,
                    f.longitude,
                  ]);

              return (
                <Polyline
                  key={i}
                  positions={thermalPath}
                  color={
                    t.direction === "right"
                      ? "red"
                      : "blue"
                  }
                  weight={5}
                />
              );
            })}
          </MapContainer>
        </div>

        {/* Höhenprofil */}
        {profileData.length > 1 && (
          <div
            style={{
              marginTop: 20,
              height: 220,
              background: "white",
              borderRadius: 16,
              padding: 12,
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.12)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {glideMode
                ? "🟠 Glide Height Profile"
                : "Height Profile"}
            </h3>

            <ResponsiveContainer
              width="100%"
              height="85%"
            >
              <AreaChart data={profileData}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="distance"
                  tickFormatter={(v) =>
                    `${v.toFixed(1)} km`
                  }
                />

                <YAxis
                  dataKey="altitude"
                  tickFormatter={(v) =>
                    `${v} m`
                  }
                />

                <Tooltip
                  formatter={(value, name) => {
                    if (name === "altitude") {
                      return [
                        `${value.toFixed(0)} m`,
                        "Altitude",
                      ];
                    }

                    return value;
                  }}
                  labelFormatter={(v) =>
                    `${v.toFixed(2)} km`
                  }
                />

                <Area
                  type="monotone"
                  dataKey="altitude"
                  stroke="#ff9800"
                  fill="#ffcc80"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {flight && (
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 20,
              alignItems: "flex-start",
            }}
          >
                {/* LEFT */}
            <div style={{ flex: 1 }}>
              {thermalStats && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "white",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
                  }}
                >
                  <h3>🌀 Thermal Statistics</h3>

                  <p>
                    Thermals: {thermalStats.totalThermals}
                  </p>

                  <p>
                    Right: {thermalStats.rightTurns} (
                    {thermalStats.rightPercent.toFixed(1)}%)
                  </p>

                  <p>
                    Left: {thermalStats.leftTurns} (
                    {thermalStats.leftPercent.toFixed(1)}%)
                  </p>

                  <p>
                    Avg duration:{" "}
                    {formatTime(thermalStats.avgDuration)}
                  </p>

                  <p>
                    Total gain:{" "}
                    {thermalStats.totalGain.toFixed(0)} m
                  </p>

                  <p>
                    Avg gain:{" "}
                    {thermalStats.avgGain.toFixed(0)} m
                  </p>
                </div>
              )}
            </div>
              {/* RIGHT */}
            <div style={{ flex: 1 }}>
              {activeMeasurement && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "white",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
                  }}
                >
                  <h3>
                    {glideMode
                      ? "🟠 Glide Analysis"
                      : "📊 Measurement"}
                  </h3>

                  <p>
                    Distance:{" "}
                    {activeMeasurement.distance_km.toFixed(2)} km
                  </p>

                  <p>
                    Time: {formatTime(activeMeasurement.time_s)}
                  </p>

                  <p>
                    Speed:{" "}
                    {activeMeasurement.speed_kmh.toFixed(1)} km/h
                  </p>

                  <p>
                    Height diff:{" "}
                    {activeMeasurement.height_m.toFixed(0)} m
                  </p>

                  <p>
                    Glide ratio:{" "}
                    {activeMeasurement.glide
                      ? `1:${activeMeasurement.glide.toFixed(1)}`
                      : "N/A"}
                  </p>
                </div>
              )}
            </div>    



          </div>
        )}
      </>
    )}
  </div>
);
}