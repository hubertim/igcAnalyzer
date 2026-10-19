import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Import components
import FlightPath from './components/FlightPath';
import Profile from './components/Profile';
import StatsPanel from './components/StatsPanel';
import Button from './components/Button';

// Import utilities
import { parseIGC } from './utils/igcParser.js';
import { detectThermals, computeThermalStats } from './utils/thermalDetector.js';
import { computeMeasurement, findGlideSegment, computeGlide } from './utils/measurement.js';
import { formatTime } from './utils/formatTime.js';


// --------------------
// Leaflet Icon Fix
// --------------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
  const fileInputRef = React.useRef(null);

  // Handle file upload
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const content = await file.text();
    const parsed = parseIGC(content);
    setFlight(parsed);

    const detectedThermals = detectThermals(parsed.fixes);
    setThermals(detectedThermals);

    setThermalStats(computeThermalStats(detectedThermals));
  };

  // Update measurement when selection changes
  useEffect(() => {
    if (selection.length === 2 && flight?.fixes?.length) {
      setMeasurement(
        computeMeasurement(selection[0], selection[1], flight.fixes)
      );
    } else {
      setMeasurement(null);
    }
  }, [selection, flight]);

  // Active measurement (glide mode takes precedence)
  const activeMeasurement =
    glideMode && glideSegment && flight
      ? computeGlide(glideSegment, flight.fixes)
      : measurement;

  // Flight path coordinates
  const latlngs = flight?.fixes?.map((f) => [f.latitude, f.longitude]) || [];

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        padding: 16,
        boxSizing: "border-box",
        gap: 12,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".igc"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        <Button onClick={() => fileInputRef.current.click()}>
          📂 Load IGC File
        </Button>

        <h2>IGC Analyzer</h2>

        {flight && (
          <Button onClick={() => setGlideMode((v) => !v)}>
            {glideMode ? "🟠 Glide ON" : "Glide Mode"}
          </Button>
        )}
      </div>

      {/* MAIN AREA */}
      {flight && (
        <>
          {/* WIDE LAYOUT */}
          {(window.innerWidth || 1000) > 800 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "4fr minmax(250px, 1fr)",
                gap: 12,
                minHeight: 0,
                width: "100%",
              }}
            >
              {/* LEFT SIDE - MAP & PROFILE */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: "minmax(300px, 3fr) 260px",
                  gap: 12,
                  minHeight: 0,
                }}
              >
                {/* MAP */}
                <FlightPath
                  flight={flight}
                  glideMode={glideMode}
                  selection={selection}
                  glideSegment={glideSegment}
                  thermals={thermals}
                  onSelectionChange={setSelection}
                  onGlideChange={setGlideSegment}
                />

                {/* PROFILE */}
                <Profile flight={flight} segment={glideSegment} />
              </div>

              {/* RIGHT SIDE - STATS */}
              <StatsPanel
                thermalStats={thermalStats}
                activeMeasurement={activeMeasurement}
                glideMode={glideMode}
              />
            </div>
          ) : (
            /* NARROW / MOBILE LAYOUT */
            <div style={{ display: "grid", gap: 12 }}>
              {/* MAP */}
              <FlightPath
                flight={flight}
                glideMode={glideMode}
                selection={selection}
                glideSegment={glideSegment}
                thermals={thermals}
                onSelectionChange={setSelection}
                onGlideChange={setGlideSegment}
              />

              {/* PROFILE */}
              <Profile flight={flight} segment={glideSegment} />

              {/* STATS */}
              <StatsPanel
                thermalStats={thermalStats}
                activeMeasurement={activeMeasurement}
                glideMode={glideMode}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
