import { MapContainer, TileLayer, Polyline, Marker, CircleMarker } from "react-leaflet";
import { useMemo } from "react";
import MapClickHandler from "./MapClickHandler";

function thermalPath(flight, thermal) {
  const startIdx = flight.fixes.findIndex((f) => f.time === thermal.start.time);
  const endIdx = flight.fixes.findIndex((f) => f.time === thermal.end.time);
  return flight.fixes.slice(startIdx, endIdx + 1).map((f) => [f.latitude, f.longitude]);
}

export default function MapView({
  flight, compareFlights, compareThermals = [], comparePositions = [], compareSelections = [], compareGlides = [], selection, glideMode,
  glideSegment, thermals, glidePath, onSelect, onGlide, onDragEnd, onCompareSelect,
  height = "100%", minHeight,
}) {
  const comparePaths = useMemo(() => compareFlights?.map((item) => item.fixes.map((fix) => [fix.latitude, fix.longitude])) ?? [], [compareFlights]);
  const compareBounds = useMemo(() => comparePaths.flat(), [comparePaths]);
  const compareThermalPaths = useMemo(() => compareFlights?.map((flight, flightIndex) =>
    (compareThermals[flightIndex] ?? []).map((thermal) => thermalPath(flight, thermal)),
  ) ?? [], [compareFlights, compareThermals]);
  const selectionPaths = useMemo(() => compareSelections.map((points) =>
    points.length === 2 ? points.map((point) => [point.latitude, point.longitude]) : null,
  ), [compareSelections]);
  const glidePaths = useMemo(() => compareFlights?.map((flight, index) =>
    compareGlides[index] ? thermalPath(flight, compareGlides[index]) : null,
  ) ?? [], [compareFlights, compareGlides]);

  if (compareFlights?.length) {
    const colors = ["#fb8c00", "#43a047"];
    return (
      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.12)", minHeight }}>
        <MapContainer bounds={compareBounds} style={{ height, width: "100%" }}>
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
          {comparePositions.map((position, i) => position && (
            <CircleMarker key={i} center={[position.latitude, position.longitude]} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: colors[i], fillOpacity: 1 }} />
          ))}
          <MapClickHandler flights={compareFlights} onCompareSelect={onCompareSelect} />
        </MapContainer>
      </div>
    );
  }

  const latlngs = flight.fixes.map((f) => [f.latitude, f.longitude]);
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.12)", minHeight }}>
      <MapContainer bounds={latlngs} style={{ height, width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={latlngs} />
        <MapClickHandler flight={flight} glideMode={glideMode} onSelect={onSelect} onGlide={onGlide} />
        {!glideMode && selection.map((p, i) => <Marker key={i} position={[p.latitude, p.longitude]} draggable eventHandlers={{ dragend: (e) => onDragEnd(i, e) }} />)}
        {!glideMode && selection.length === 2 && <Polyline positions={selection.map((p) => [p.latitude, p.longitude])} color="red" />}
        {glideSegment && glideMode && <><Marker position={[glideSegment.start.latitude, glideSegment.start.longitude]} /><Marker position={[glideSegment.end.latitude, glideSegment.end.longitude]} /><Polyline positions={glidePath} color="orange" weight={4} /></>}
        {thermals.map((thermal, i) => <Polyline key={i} positions={thermalPath(flight, thermal)} color={thermal.direction === "right" ? "red" : "blue"} weight={5} />)}
      </MapContainer>
    </div>
  );
}
