import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

function circleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}

/**
 * Erzeugt einen MapLibre-Custom-Layer, der den Flug mit three.js zeichnet.
 * Geometrie liegt in lokalen Metern (siehe utils/track3d.js); die Model-Matrix
 * übernimmt Verschiebung und Skalierung nach Mercator-Koordinaten.
 */
export function createTrackLayer() {
  const dpr = window.devicePixelRatio || 1;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const world = new THREE.Group(); // Track, Höhe wird mit der Geländeüberhöhung skaliert
  const overlay = new THREE.Group(); // Marker, nicht skaliert
  scene.add(world, overlay);

  const lineMaterials = new Set();
  let thermalGroup = null;
  let thermalsVisible = true;

  const markerPosition = new THREE.BufferAttribute(new Float32Array(3), 3);
  const markerGeometry = new THREE.BufferGeometry();
  markerGeometry.setAttribute("position", markerPosition);
  const marker = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
    map: circleTexture(), size: 20 * dpr, sizeAttenuation: false,
    transparent: true, alphaTest: 0.3, depthTest: false,
  }));

  const dropPosition = new THREE.BufferAttribute(new Float32Array(6), 3);
  const dropGeometry = new THREE.BufferGeometry();
  dropGeometry.setAttribute("position", dropPosition);
  const drop = new THREE.Line(dropGeometry, new THREE.LineBasicMaterial({ color: 0xffe000, depthTest: false }));

  for (const object of [marker, drop]) {
    object.frustumCulled = false;
    object.renderOrder = 3;
    object.visible = false;
    overlay.add(object);
  }

  let map = null;
  let renderer = null;
  let track = null;
  let exaggeration = 1;
  let markerIndex = 0;

  function clearGroup(group) {
    for (const child of [...group.children]) {
      child.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) {
          lineMaterials.delete(object.material);
          object.material.dispose();
        }
      });
      group.remove(child);
    }
  }

  function makeLine(positions, { colors, color = 0xffffff, width, order, depthWrite = true }) {
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    if (colors) geometry.setColors(colors);
    const material = new LineMaterial({
      color, linewidth: width * dpr, vertexColors: Boolean(colors), depthWrite,
    });
    lineMaterials.add(material);
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = order;
    return line;
  }

  function placeMarker(index) {
    markerIndex = index;
    const point = track?.pts[index];
    if (!point) {
      marker.visible = false;
      drop.visible = false;
      map?.triggerRepaint();
      return;
    }
    const x = track.positions[index * 3];
    const y = track.positions[index * 3 + 1];
    const z = track.positions[index * 3 + 2] * exaggeration;
    // queryTerrainElevation liefert die Höhe bereits inkl. Überhöhung
    const ground = map?.queryTerrainElevation?.([point.lng, point.lat]) ?? 0;
    markerPosition.setXYZ(0, x, y, z);
    markerPosition.needsUpdate = true;
    dropPosition.setXYZ(0, x, y, z);
    dropPosition.setXYZ(1, x, y, ground);
    dropPosition.needsUpdate = true;
    marker.visible = true;
    drop.visible = true;
    map?.triggerRepaint();
  }

  const layer = {
    id: "flight-3d",
    type: "custom",
    renderingMode: "3d",
    onAdd(mapInstance, gl) {
      map = mapInstance;
      renderer = new THREE.WebGLRenderer({ canvas: mapInstance.getCanvas(), context: gl });
      renderer.autoClear = false;
    },
    render(gl, args) {
      if (!track || !renderer) return;
      // MapLibre 5: defaultProjectionData.mainMatrix; MapLibre 3/4: modelViewProjectionMatrix bzw. Matrix direkt
      const matrix = args?.defaultProjectionData?.mainMatrix ?? args?.modelViewProjectionMatrix ?? args;
      const projection = new THREE.Matrix4().fromArray(matrix);
      const model = new THREE.Matrix4()
        .makeTranslation(track.origin.x, track.origin.y, 0)
        .scale(new THREE.Vector3(track.scale, -track.scale, track.scale));
      camera.projectionMatrix.copy(projection).multiply(model);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      const { width, height } = map.getCanvas();
      renderer.setViewport(0, 0, width, height);
      for (const material of lineMaterials) material.resolution.set(width, height);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      clearGroup(world);
    },
  };

  return {
    layer,
    setTrack(next) {
      clearGroup(world);
      thermalGroup = null;
      track = next;
      if (!next) {
        placeMarker(-1);
        return;
      }
      world.add(makeLine(next.positions, { colors: next.colors, width: 3, order: 1 }));
      thermalGroup = new THREE.Group();
      for (const thermal of next.thermalPaths) {
        thermalGroup.add(makeLine(thermal.positions, {
          color: thermal.direction === "right" ? 0xff0000 : 0x1e40ff,
          width: 6, order: 2, depthWrite: false,
        }));
      }
      thermalGroup.visible = thermalsVisible;
      world.add(thermalGroup);
      placeMarker(Math.min(markerIndex, next.pts.length - 1));
    },
    setMarker: placeMarker,
    setExaggeration(value) {
      exaggeration = value;
      world.scale.set(1, 1, value);
      placeMarker(markerIndex);
    },
    setThermalsVisible(visible) {
      thermalsVisible = visible;
      if (thermalGroup) thermalGroup.visible = visible;
      map?.triggerRepaint();
    },
  };
}
