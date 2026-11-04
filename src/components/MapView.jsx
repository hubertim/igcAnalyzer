import L from "leaflet";
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from "react-leaflet";
import { memo, useEffect, useMemo, useState, useRef } from "react";
import MapClickHandler from "./MapClickHandler";

const compareColors = ["#fb8c00", "#43a047"];

function computeZoomFactor(zoom) {
  // At zoom 10: ~1.0, zoom 14: ~2.5, zoom 18: ~6.0
  return Math.max(0.5, Math.pow(1.35, zoom - 10));
}

function toMapPath(fixes, maxPoints = 5_000, zoom = 12) {
  const factor = computeZoomFactor(zoom);
  const adjustedMax = Math.min(fixes.length, Math.round(maxPoints * factor));
  const step = Math.max(1, Math.ceil(fixes.length / adjustedMax));
  return fixes
    .filter((_, index) => index % step === 0 || index === fixes.length - 1)
    .map((fix) => [fix.latitude, fix.longitude]);
}

function thermalPath(flight, thermal, zoom = 12) {
  const startIdx = flight.fixes.findIndex((f) => f.time === thermal.start.time);
  const endIdx = flight.fixes.findIndex((f) => f.time === thermal.end.time);
  return toMapPath(flight.fixes.slice(startIdx, endIdx + 1), 1_000, zoom);
}

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

function ComparePositionMarkers({ flights, initialTime, updaterRef }) {
  const map = useMap();

  useEffect(() => {
    const markers = flights.map((flight, index) => L.circleMarker(
      [flight.fixes[0].latitude, flight.fixes[0].longitude],
      { color: "white", weight: 3, fillColor: compareColors[index], fillOpacity: 1, radius: 9 },
    ).addTo(map));
    const updatePositions = (time) => markers.forEach((marker, index) => {
      const position = findNearestTimeFix(flights[index].fixes, time);
      marker.setLatLng([position.latitude, position.longitude]);
    });

    updatePositions(initialTime);
    updaterRef.current = updatePositions;
    return () => {
      if (updaterRef.current === updatePositions) updaterRef.current = null;
      markers.forEach((marker) => marker.remove());
    };
  }, [flights, initialTime, map, updaterRef]);

  return null;
}

function ZoomTracker({ onZoomChange }) {
  const map = useMap();
  useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

// These layers can contain thousands of points. Keep them outside the fast hover
// path so moving the time markers only updates Leaflet layers directly.
const CompareStaticLayers = memo(function CompareStaticLayers({
  compareFlights, comparePaths, compareThermalPaths, compareThermals,
  selectionPaths, glidePaths, colors, onCompareSelect,
}) {
  return <>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {compareFlights.map((item, i) => <Polyline key={i} positions={comparePaths[i]} color={colors[i]} weight={4} />)}
    {compareThermalPaths.map((items, flightIndex) => items.map((path, thermalIndex) => (
      <Polyline key={`thermal-${flightIndex}-${thermalIndex}`} positions={path} color={compareThermals[flightIndex][thermalIndex].direction === "right" ? "red" : "blue"} opacity={0.55} weight={7} />
    )))}
    {selectionPaths.map((path, i) => path && (
      <Polyline key={`measurement-${i}`} positions={path} color={colors[i]} dashArray="6 6" weight={3} />
    ))}
    {glidePaths.map((path, i) => path && (
      <Polyline key={`glide-${i}`} positions={path} color={colors[i]} weight={6} />
    ))}
    <MapClickHandler flights={compareFlights} onCompareSelect={onCompareSelect} />
  </>;
});

export default function MapView({
  flight, compareFlights, compareThermals = [], compareSelections = [], compareGlides = [], comparePositionUpdaterRef, compareStartTime, selection, glideMode,
  glideSegment, thermals, glidePath, onSelect, onGlide, onDragEnd, onCompareSelect,
  height = "100%", minHeight,
}) {
  const [zoom, setZoom] = useState(12);
  const comparePaths = useMemo(() => compareFlights?.map((item) => toMapPath(item.fixes, 5_000, zoom)) ?? [], [compareFlights, zoom]);
  const compareBounds = useMemo(() => comparePaths.flat(), [comparePaths]);
  const compareThermalPaths = useMemo(() => compareFlights?.map((flight, flightIndex) =>
    (compareThermals[flightIndex] ?? []).map((thermal) => thermalPath(flight, thermal, zoom)),
  ) ?? [], [compareFlights, compareThermals, zoom]);
  const selectionPaths = useMemo(() => compareSelections.map((points) =>
    points.length === 2 ? points.map((point) => [point.latitude, point.longitude]) : null,
  ), [compareSelections]);
  const glidePaths = useMemo(() => compareFlights?.map((flight, index) =>
    compareGlides[index] ? thermalPath(flight, compareGlides[index], zoom) : null,
  ) ?? [], [compareFlights, compareGlides, zoom]);
  const trackPath = useMemo(() => flight?.fixes ? toMapPath(flight.fixes, 5_000, zoom) : [], [flight, zoom]);
  const thermalPaths = useMemo(() => flight?.fixes ? (thermals ?? []).map((thermal) => thermalPath(flight, thermal, zoom)) : [], [flight, thermals, zoom]);
  const glideTrackPath = glideSegment && flight?.fixes ? thermalPath(flight, glideSegment, zoom) : [];

  if (compareFlights?.length) {
    return (
      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.12)", minHeight }}>
        <MapContainer bounds={compareBounds} style={{ height, width: "100%" }}>
          <ZoomTracker onZoomChange={setZoom} />
          <CompareStaticLayers compareFlights={compareFlights} comparePaths={comparePaths}
            compareThermalPaths={compareThermalPaths} compareThermals={compareThermals}
            selectionPaths={selectionPaths} glidePaths={glidePaths} colors={compareColors}
            onCompareSelect={onCompareSelect}
          />
          <ComparePositionMarkers flights={compareFlights} initialTime={compareStartTime} updaterRef={comparePositionUpdaterRef} />
        </MapContainer>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.12)", minHeight }}>
      {flight?.fixes && trackPath.length > 0 ? (
        <MapContainer bounds={trackPath} style={{ height, width: "100%" }}>
          <ZoomTracker onZoomChange={setZoom} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Polyline positions={trackPath} />
          <MapClickHandler flight={flight} glideMode={glideMode} onSelect={onSelect} onGlide={onGlide} />
          {!glideMode && selection.map((p, i) => <Marker key={i} position={[p.latitude, p.longitude]} draggable eventHandlers={{ dragend: (e) => onDragEnd(i, e) }} />)}
          {!glideMode && selection.length === 2 && <Polyline positions={selection.map((p) => [p.latitude, p.longitude])} color="red" />}
          {glideSegment && glideMode && <><Marker position={[glideSegment.start.latitude, glideSegment.start.longitude]} /><Marker position={[glideSegment.end.latitude, glideSegment.end.longitude]} /><Polyline positions={glideTrackPath} color="orange" weight={4} /></>}
          {thermalPaths.map((path, i) => <Polyline key={i} positions={path} color={thermals[i].direction === "right" ? "red" : "blue"} weight={5} />)}
        </MapContainer>
      ) : (
        <MapContainer center={[0, 0]} zoom={2} style={{ height, width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </MapContainer>
      )}
    </div>
  );
}
