import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createTrackLayer } from "./trackLayer3d";

// Alle Quellen sind ohne API-Key nutzbar. Bitte die Nutzungsbedingungen der Tile-Server beachten
// (v. a. OSM/OpenTopoMap: faire Nutzung; für viel Traffic eigene Tiles oder einen Anbieter nehmen).
const BASEMAPS = {
  topo: {
    label: "OpenTopoMap",
    tiles: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    maxzoom: 17,
    attribution: "© OpenStreetMap-Mitwirkende, SRTM | © OpenTopoMap (CC-BY-SA)",
  },
  osm: {
    label: "OpenStreetMap",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    maxzoom: 19,
    attribution: "© OpenStreetMap-Mitwirkende",
  },
  sat: {
    label: "Satellit (Esri)",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    maxzoom: 19,
    attribution: "Tiles © Esri — Maxar, Earthstar Geographics u. a.",
  },
};

const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const DEM_ATTRIBUTION = "Höhendaten: Mapzen/AWS Terrain Tiles (SRTM, u. a.)";

const INITIAL_BASEMAP = "topo";
const INITIAL_EXAGGERATION = 1;

function buildStyle() {
  const sources = {};
  const layers = [];
  for (const [key, basemap] of Object.entries(BASEMAPS)) {
    sources[key] = {
      type: "raster", tiles: basemap.tiles, tileSize: 256,
      maxzoom: basemap.maxzoom, attribution: basemap.attribution,
    };
    layers.push({
      id: key, type: "raster", source: key,
      layout: { visibility: key === INITIAL_BASEMAP ? "visible" : "none" },
    });
  }
  // Getrennte Quellen für Terrain und Schummerung (so empfiehlt es die MapLibre-Doku)
  sources.dem = { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: DEM_ATTRIBUTION };
  sources["dem-shade"] = { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 15 };
  layers.push({ id: "hillshade", type: "hillshade", source: "dem-shade", paint: { "hillshade-exaggeration": 0.35 } });
  return { version: 8, sources, layers };
}

const timeLabel = (seconds) => {
  const h = String(Math.floor(seconds / 3600) % 24).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const panel = {
  background: "rgba(255,255,255,0.92)", color: "#222", borderRadius: 12, padding: "8px 12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)", fontSize: 13, zIndex: 2,
};

export default function Map3DView({ track = null, index = 0, onIndexChange, height = "100%", minHeight }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const controllerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState(INITIAL_BASEMAP);
  const [exaggeration, setExaggeration] = useState(INITIAL_EXAGGERATION);
  const [showThermals, setShowThermals] = useState(true);
  const indexRef = useRef(index);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Karte einmalig anlegen
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: [11, 47],
      zoom: 8,
      pitch: 60,
      maxPitch: 85,
      antialias: true,
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    const controller = createTrackLayer();
    mapRef.current = map;
    controllerRef.current = controller;

    map.on("load", () => {
      map.setTerrain({ source: "dem", exaggeration: INITIAL_EXAGGERATION });
      map.addLayer(controller.layer);
      setReady(true);
    });

    return () => {
      setReady(false);
      setPlaying(false);
      map.remove();
      mapRef.current = null;
      controllerRef.current = null;
    };
  }, []);

  const fit = useCallback((animate) => {
    const map = mapRef.current;
    if (!map || !track) return;
    map.fitBounds(track.bounds, { padding: 70, pitch: 62, bearing: 0, maxZoom: 14, duration: animate ? 800 : 0 });
  }, [track]);

  // Basiskarte umschalten
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const key of Object.keys(BASEMAPS)) {
      map.setLayoutProperty(key, "visibility", key === basemap ? "visible" : "none");
    }
  }, [ready, basemap]);

  // Geländeüberhöhung
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setTerrain({ source: "dem", exaggeration });
    controllerRef.current.setExaggeration(exaggeration);
  }, [ready, exaggeration]);

  useEffect(() => {
    if (ready) controllerRef.current.setThermalsVisible(showThermals);
  }, [ready, showThermals]);

  // Neuer Flug: Track setzen, Slider zurück, Kamera auf den Track
  useEffect(() => {
    if (!ready) return;
    controllerRef.current.setTrack(track);
    onIndexChange?.(0);
    setPlaying(false);
    fit(false);
  }, [ready, track, fit, onIndexChange]);

  useEffect(() => {
    if (ready) controllerRef.current.setMarker(index);
  }, [ready, track, index, exaggeration]);

  // Wiedergabe
  useEffect(() => {
    if (!playing || !track) return undefined;
    const last = track.pts.length - 1;
    const stepSize = Math.max(1, Math.round(track.pts.length / 900));
    const id = setInterval(() => onIndexChange?.(Math.min(indexRef.current + stepSize, last)), 40);
    return () => clearInterval(id);
  }, [playing, track, onIndexChange]);

  useEffect(() => {
    if (track && index >= track.pts.length - 1) setPlaying(false);
  }, [index, track]);

  const point = track?.pts[Math.min(index, track.pts.length - 1)];

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,0.12)", minHeight }}>
      <div style={{ position: "relative", height, width: "100%", textAlign: "left" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        <div style={{ ...panel, position: "absolute", top: 12, left: 12, display: "grid", gap: 6 }}>
          <select value={basemap} onChange={(e) => setBasemap(e.target.value)} style={{ fontSize: 13 }}>
            {Object.entries(BASEMAPS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
          <label style={{ display: "grid", gap: 2 }}>
            Geländeüberhöhung ×{exaggeration.toFixed(1)}
            <input type="range" min={1} max={3} step={0.1} value={exaggeration}
              onChange={(e) => setExaggeration(Number(e.target.value))} />
          </label>
          <label><input type="checkbox" checked={showThermals} onChange={(e) => setShowThermals(e.target.checked)} /> Thermik (rot/blau)</label>
          <button onClick={() => fit(true)} disabled={!track} style={{ fontSize: 13 }}>Ansicht zurücksetzen</button>
          <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            Sinken
            <span style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(90deg, hsl(220,90%,50%), hsl(120,90%,50%), hsl(0,90%,50%))" }} />
            Steigen
          </div>
        </div>

        {track && (
          <div style={{ ...panel, position: "absolute", left: 12, right: 12, bottom: 30, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => {
              if (index >= track.pts.length - 1) onIndexChange?.(0);
              setPlaying((value) => !value);
            }} style={{ fontSize: 14 }}>{playing ? "⏸" : "▶"}</button>
            <input type="range" min={0} max={track.pts.length - 1} value={Math.min(index, track.pts.length - 1)}
              onChange={(e) => { setPlaying(false); onIndexChange?.(Number(e.target.value)); }} style={{ flex: 1 }} />
            <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {timeLabel(point.time)} · {Math.round(point.alt)} m · {point.vario >= 0 ? "+" : ""}{point.vario.toFixed(1)} m/s
            </span>
          </div>
        )}

        {!track && (
          <div style={{ ...panel, position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }}>
            Noch kein Flug geladen
          </div>
        )}
      </div>
    </div>
  );
}
