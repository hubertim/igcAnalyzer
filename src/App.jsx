import { useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import Button from "./components/Button";
import MapView from "./components/MapView";
import HeightProfile from "./components/HeightProfile";
import CompareTimeProfile from "./components/CompareTimeProfile";
import ThermalStats from "./components/ThermalStats";
import MeasurementStats from "./components/MeasurementStats";
import { parseIGC } from "./utils/igcParser";
import { computeMeasurement } from "./utils/measurements";
import { computeGlide, findGlideSegment } from "./utils/glide";
import { detectThermals, computeThermalStats } from "./utils/thermalDetection";
import { createProfileData, createDistanceTicks, createAltitudeTicks, createSpeedTicks } from "./utils/profile";
import { findNearestFix } from "./utils/geo";
import { useResponsive } from "./hooks/useResponsive";

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const colors = ["#fb8c00", "#43a047"];
const timeLabel = (seconds) => {
  const h = String(Math.floor(seconds / 3600) % 24).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

function findNearestTimeFix(fixes, time) {
  let low = 0;
  let high = fixes.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fixes[middle].time < time) low = middle + 1;
    else high = middle;
  }

  const current = fixes[low];
  const previous = fixes[Math.max(0, low - 1)];
  return Math.abs(previous.time - time) <= Math.abs(current.time - time) ? previous : current;
}

function CompareTools({ flight, index, thermals, selection, glideSegment, glideMode, fileRef, onFileChange }) {
  const measurement = glideMode && glideSegment
    ? computeGlide(glideSegment, flight.fixes)
    : selection.length === 2
      ? computeMeasurement(selection[0], selection[1], flight.fixes)
      : null;

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <input ref={fileRef} type="file" accept=".igc" onChange={onFileChange} style={{ display: "none" }} />
      <Button onClick={() => fileRef.current?.click()} style={{ background: index === 0 ? "#fff3e0" : "#e8f5e9", color: colors[index], whiteSpace: "nowrap" }}>
        📂 Pilot {index + 1}: IGC laden
      </Button>
      <ThermalStats stats={computeThermalStats(thermals)} />
      <MeasurementStats measurement={measurement} glideMode={glideMode} compact />
    </div>
  );
}

export default function App() {
  const [flight, setFlight] = useState(null);
  const [selection, setSelection] = useState([]);
  const [glideMode, setGlideMode] = useState(false);
  const [glideSegment, setGlideSegment] = useState(null);
  const [thermals, setThermals] = useState([]);
  const [thermalStats, setThermalStats] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareFlights, setCompareFlights] = useState([null, null]);
  const [compareSelections, setCompareSelections] = useState([[], []]);
  const [compareGlides, setCompareGlides] = useState([null, null]);
  const [compareTime, setCompareTime] = useState(null);

  const fileInputRef = useRef(null);
  const compareFileRef1 = useRef(null);
  const compareFileRef2 = useRef(null);
  const isWide = useResponsive();
  const isCompareWide = useResponsive(1200);

  const handleFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const parsed = parseIGC(await file.text());
    setFlight(parsed);
    const detected = detectThermals(parsed.fixes);
    setThermals(detected);
    setThermalStats(computeThermalStats(detected));
    setSelection([]);
    setGlideSegment(null);
    setGlideMode(false);
  };

  const handleCompareFile = async (index, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const parsed = { ...parseIGC(await file.text()), name: file.name };
    setCompareFlights((current) => current.map((item, itemIndex) => itemIndex === index ? parsed : item));
    setCompareSelections([[], []]);
    setCompareGlides([null, null]);
    setCompareTime(null);
  };

  const handleSelect = (snapped) => setSelection((previous) => [...previous, snapped].slice(-2));
  const handleDragEnd = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    const snapped = findNearestFix(lat, lng, flight.fixes);
    setSelection((previous) => previous.map((point, pointIndex) => pointIndex === index ? snapped : point));
  };

  const measurement = flight?.fixes?.length && selection.length === 2
    ? computeMeasurement(selection[0], selection[1], flight.fixes)
    : null;
  const activeMeasurement = glideMode && glideSegment && flight ? computeGlide(glideSegment, flight.fixes) : measurement;
  const glidePath = glideSegment && flight
    ? flight.fixes.slice(
      flight.fixes.findIndex((fix) => fix.time === glideSegment.start.time),
      flight.fixes.findIndex((fix) => fix.time === glideSegment.end.time) + 1,
    ).map((fix) => [fix.latitude, fix.longitude])
    : [];
  const profileData = createProfileData({ flight, selection, glideMode, glideSegment });

  const loadedCompareFlights = useMemo(() => compareFlights.filter(Boolean), [compareFlights]);
  const canCompare = useMemo(
    () => loadedCompareFlights.length === 2 && loadedCompareFlights.every((item) => item.fixes.length),
    [loadedCompareFlights],
  );
  const compareThermals = useMemo(
    () => loadedCompareFlights.map((item) => detectThermals(item.fixes)),
    [loadedCompareFlights],
  );
  const compareRange = useMemo(() => canCompare ? {
    start: Math.max(...loadedCompareFlights.map((item) => item.fixes[0].time)),
    end: Math.min(...loadedCompareFlights.map((item) => item.fixes[item.fixes.length - 1].time)),
  } : null, [canCompare, loadedCompareFlights]);
  const selectedTime = compareRange ? Math.max(compareRange.start, Math.min(compareTime ?? compareRange.start, compareRange.end)) : null;
  const comparePositions = useMemo(() => canCompare
    ? loadedCompareFlights.map((item) => findNearestTimeFix(item.fixes, selectedTime))
    : [], [canCompare, loadedCompareFlights, selectedTime]);
  const compareTimeProfile = useMemo(() => canCompare && compareRange.end >= compareRange.start
    ? (() => {
      const secondFlightFixes = loadedCompareFlights[1].fixes;
      let secondIndex = 0;
      return loadedCompareFlights[0].fixes
        .filter((fix) => fix.time >= compareRange.start && fix.time <= compareRange.end)
        .map((fix) => {
          while (secondIndex < secondFlightFixes.length - 1
            && Math.abs(secondFlightFixes[secondIndex + 1].time - fix.time) <= Math.abs(secondFlightFixes[secondIndex].time - fix.time)) {
            secondIndex += 1;
          }
          return { time: fix.time, pilot1: fix.gpsAltitude, pilot2: secondFlightFixes[secondIndex].gpsAltitude };
        });
    })()
    : [], [canCompare, compareRange, loadedCompareFlights]);

  const handleCompareMapSelect = ({ lat, lng }) => {
    const snapped = loadedCompareFlights.map((item) => findNearestFix(lat, lng, item.fixes));
    if (glideMode) {
      setCompareGlides(loadedCompareFlights.map((item, index) =>
        findGlideSegment(item.fixes.findIndex((fix) => fix.time === snapped[index].time), item.fixes),
      ));
    } else {
      setCompareSelections((previous) => previous.map((items, index) => [...items, snapped[index]].slice(-2)));
    }
  };

  const comparePanel = (
    <div
      style={{
        display: "grid",
        gridAutoRows: "max-content",
        alignContent: "start",
        gap: 12,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "2px 4px 20px",
      }}
    >
      {canCompare && <>
        <div style={{ justifySelf: "start" }}>
          <Button onClick={() => setGlideMode((value) => !value)}>{glideMode ? "🟠 Glide ON" : "Glide Mode"}</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isCompareWide ? "280px minmax(0, 1fr) 280px" : "1fr", gap: 12, alignItems: "start" }}>
          {isCompareWide && <CompareTools flight={loadedCompareFlights[0]} index={0} thermals={compareThermals[0]} selection={compareSelections[0]} glideSegment={compareGlides[0]} glideMode={glideMode} fileRef={compareFileRef1} onFileChange={(event) => handleCompareFile(0, event)} />}
          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            <MapView
              compareFlights={loadedCompareFlights}
              compareThermals={compareThermals}
              comparePositions={comparePositions}
              compareSelections={compareSelections}
              compareGlides={compareGlides}
              onCompareSelect={handleCompareMapSelect}
              height={580}
              minHeight={580}
            />
            {compareRange.end >= compareRange.start
              ? <CompareTimeProfile data={compareTimeProfile} selectedTime={selectedTime} onTimeChange={setCompareTime} formatTime={timeLabel} />
              : <div>Die beiden Flüge haben keine überlappende Uhrzeit.</div>}
            <div style={{ fontSize: 14 }}>Orange: Pilot 1 · Grün: Pilot 2</div>
          </div>
          {isCompareWide && <CompareTools flight={loadedCompareFlights[1]} index={1} thermals={compareThermals[1]} selection={compareSelections[1]} glideSegment={compareGlides[1]} glideMode={glideMode} fileRef={compareFileRef2} onFileChange={(event) => handleCompareFile(1, event)} />}
        </div>
        {!isCompareWide && <div style={{ display: "grid", gap: 12 }}>
          {loadedCompareFlights.map((item, index) => <CompareTools key={item.name} flight={item} index={index} thermals={compareThermals[index]} selection={compareSelections[index]} glideSegment={compareGlides[index]} glideMode={glideMode} fileRef={index === 0 ? compareFileRef1 : compareFileRef2} onFileChange={(event) => handleCompareFile(index, event)} />)}
        </div>}
      </>}
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", padding: 16, gap: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
        <div style={{ justifySelf: compareMode ? "end" : "start" }}>
          {compareMode ? !canCompare && <>
            <input ref={compareFileRef1} type="file" accept=".igc" onChange={(event) => handleCompareFile(0, event)} style={{ display: "none" }} />
            <Button onClick={() => compareFileRef1.current?.click()}>{compareFlights[0] ? `↻ ${compareFlights[0].name}` : "📂 Pilot 1: IGC laden"}</Button>
          </> : <>
            <input ref={fileInputRef} type="file" accept=".igc" onChange={handleFile} style={{ display: "none" }} />
            <Button onClick={() => fileInputRef.current?.click()}>📂 Load IGC File</Button>
          </>}
        </div>
        <h2>IGC Analyzer</h2>
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 12 }}>
          {compareMode && !canCompare && <>
            <input ref={compareFileRef2} type="file" accept=".igc" onChange={(event) => handleCompareFile(1, event)} style={{ display: "none" }} />
            <Button onClick={() => compareFileRef2.current?.click()}>{compareFlights[1] ? `↻ ${compareFlights[1].name}` : "📂 Pilot 2: IGC laden"}</Button>
          </>}
          <Button onClick={() => { setCompareMode((value) => !value); setGlideMode(false); }}>{compareMode ? "← Einzelansicht" : "⇄ Compare Mode"}</Button>
        </div>
      </div>
      {compareMode ? comparePanel : flight && (
        isWide ? <div style={{ display: "grid", gridTemplateColumns: "4fr minmax(250px, 1fr)", gap: 12, minHeight: 0, width: "100%" }}><div style={{ display: "grid", gridTemplateRows: "minmax(300px, 3fr) 260px", gap: 12, minHeight: 0 }}><MapView flight={flight} selection={selection} glideMode={glideMode} glideSegment={glideSegment} thermals={thermals} glidePath={glidePath} onSelect={handleSelect} onGlide={setGlideSegment} onDragEnd={handleDragEnd} height="100%" minHeight={300} /><HeightProfile profileData={profileData} xTicks={createDistanceTicks(profileData)} altitudeTicks={createAltitudeTicks(profileData)} speedTicks={createSpeedTicks(profileData)} height={230} /></div><div style={{ display: "grid", gap: 12, alignContent: "start" }}><ThermalStats stats={thermalStats} /><MeasurementStats measurement={activeMeasurement} glideMode={glideMode} /></div></div>
        : <div style={{ display: "grid", gap: 12, overflowY: "auto", minHeight: 0 }}><MapView flight={flight} selection={selection} glideMode={glideMode} glideSegment={glideSegment} thermals={thermals} glidePath={glidePath} onSelect={handleSelect} onGlide={setGlideSegment} onDragEnd={handleDragEnd} height="80vh" minHeight="60vh" /><HeightProfile profileData={profileData} xTicks={createDistanceTicks(profileData)} altitudeTicks={createAltitudeTicks(profileData)} speedTicks={createSpeedTicks(profileData)} height={120} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}><ThermalStats stats={thermalStats} /><MeasurementStats measurement={activeMeasurement} glideMode={glideMode} compact /></div></div>
      )}
    </div>
  );
}
