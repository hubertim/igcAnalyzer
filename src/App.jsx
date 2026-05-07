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
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const fixes = [];

  const parseLat = (raw) => {
    const deg = parseInt(raw.slice(0, 2));
    const min = parseInt(raw.slice(2, 7)) / 1000;
    return deg + min / 60;
  };

  const parseLon = (raw) => {
    const deg = parseInt(raw.slice(0, 3));
    const min = parseInt(raw.slice(3, 8)) / 1000;
    return deg + min / 60;
  };

  for (const line of lines) {
    if (!line.startsWith("B")) continue;

    const timeRaw = line.slice(1, 7);
    const latRaw = line.slice(7, 15);
    const lonRaw = line.slice(15, 24);
    const altRaw = line.slice(25, 30);

    const lat = parseLat(latRaw);
    const lon = parseLon(lonRaw);
    const alt = parseInt(altRaw);

    if (isNaN(lat) || isNaN(lon)) continue;

    fixes.push({
      latitude: lat,
      longitude: lon,
      gpsAltitude: isNaN(alt) ? 0 : alt,
      time: parseTime(timeRaw),
    });
  }

  return { fixes };
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
  const CLIMB_THRESHOLD = 0.3; // m/s
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

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const content = await file.text();
    setFlight(parseIGC(content));
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

		<input type="file" accept=".igc" onChange={handleFile} />

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
			  background: glideMode ? "#ff9800" : "#f1f1f1",
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
					{/* Start */}
					<Marker
					  position={[
						glideSegment.start.latitude,
						glideSegment.start.longitude,
					  ]}
					/>

					{/* Ende */}
					<Marker
					  position={[
						glideSegment.end.latitude,
						glideSegment.end.longitude,
					  ]}
					/>

					{/* echter Glidepfad */}
					<Polyline
					  positions={glidePath}
					  color="orange"
					  weight={4}
					/>
				  </>
				)}
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
					  boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
					}}
				  >
					<h3 style={{ marginTop: 0 }}>
					  {glideMode
						? "🟠 Glide Height Profile"
						: "Height Profile"}
					</h3>

					<ResponsiveContainer width="100%" height="85%">
					  <AreaChart data={profileData}>
						<CartesianGrid strokeDasharray="3 3" />

						<XAxis
						  dataKey="distance"
						  tickFormatter={(v) => `${v.toFixed(1)} km`}
						/>

						<YAxis
						  dataKey="altitude"
						  tickFormatter={(v) => `${v} m`}
						/>

						<Tooltip
						  formatter={(value, name) => {
							if (name === "altitude") {
							  return [`${value.toFixed(0)} m`, "Altitude"];
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
			{/* Analyse */}
			{activeMeasurement && (
			  <div style={{ marginTop: 20 }}>
				<h3>
				  {glideMode
					? "🟠 Glide Analysis"
					: "Measurement"}
				</h3>

				<p>
				  Distance:{" "}
				  {activeMeasurement.distance_km.toFixed(
					2
				  )}{" "}
				  km
				</p>

				<p>
				  Time:{" "}
				  {formatTime(
					activeMeasurement.time_s
				  )}
				</p>

				<p>
				  Speed:{" "}
				  {activeMeasurement.speed_kmh.toFixed(
					1
				  )}{" "}
				  km/h
				</p>

				<p>
				  Height diff:{" "}
				  {(
					activeMeasurement.height_m ?? 0
				  ).toFixed(0)}{" "}
				  m
				</p>

				<p>
				  Glide ratio:{" "}
				  {activeMeasurement.glide
					? `1 : ${activeMeasurement.glide.toFixed(
						1
					  )}`
					: "N/A"}
				</p>
			  </div>
			)}
		  </>
		)}
	  </div>
	);
}