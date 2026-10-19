import React from 'react';
import { MapContainer, Polyline, Marker, TileLayer } from 'react-leaflet';
import { useMapEvents } from './useMapEvents.js';
import 'leaflet/dist/leaflet.css';

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
// Glides Component
// Displays flight path with markers and paths
// --------------------
export default function FlightPath({ 
  flight, 
  glideMode, 
  selection, 
  glideSegment, 
  thermals,
  onSelectionChange,
  onGlideChange 
}) {
  const latlngs = flight?.fixes?.map((f) => [f.latitude, f.longitude]) || [];

  return (
    <MapContainer bounds={latlngs} style={{ height: "100%", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Flight Path */}
      <Polyline positions={latlngs} />

      {/* Normal Measurement Markers */}
      {!glideMode && flight?.fixes && (
        selection.map((p, i) => (
          <Marker
            key={i}
            position={[p.latitude, p.longitude]}
            draggable={true}
            eventHandlers={{
              dragend: () => handleDragEnd(i, p),
            }}
          />
        ))
      )}

      {/* Normal Measurement Line */}
      {!glideMode && selection.length === 2 && (
        <Polyline
          positions={[
            [selection[0].latitude, selection[0].longitude],
            [selection[1].latitude, selection[1].longitude],
          ]}
          color="red"
        />
      )}

      {/* Glide Segment */}
      {glideMode && glideSegment && flight && (
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
          {/* Glide Path would be displayed here */}
        </>
      )}

      {/* Thermals on Map */}
      {flight && thermals.map((t, i) => {
        const startIdx = flight.fixes.findIndex(
          (f) => f.time === t.start.time
        );
        const endIdx = flight.fixes.findIndex(
          (f) => f.time === t.end.time
        );

        const thermalPath = flight.fixes
          .slice(startIdx, endIdx + 1)
          .map((f) => [f.latitude, f.longitude]);

        return (
          <Polyline
            key={i}
            positions={thermalPath}
            color={t.direction === "right" ? "red" : "blue"}
            weight={5}
          />
        );
      })}

      {/* Map Click Handler */}
      <MapClickHandler
        flight={flight}
        glideMode={glideMode}
        onSelect={(snapped) => {
          if (onSelectionChange) {
            const next = [...selection, snapped];
            if (next.length > 2) next.shift();
            onSelectionChange(next);
          }
        }}
        onGlide={(segment) => {
          if (onGlideChange) {
            onGlideChange(segment);
          }
        }}
      />

      {/* Drag Handlers for Measurement */}
      {!glideMode && selection.map((_, i) => (
        <Marker
          key={`drag-${i}`}
          draggable={true}
          eventHandlers={{
            dragend: () => handleDragEnd(i, null),
          }}
        />
      ))}
    </MapContainer>
  );
}

// --------------------
// Drag Handler for Markers
// --------------------
function handleDragEnd(index, point) {
  // Implementation needed - findNearestFix would be called here
  console.log(`Handle drag end for marker ${index}`);
}