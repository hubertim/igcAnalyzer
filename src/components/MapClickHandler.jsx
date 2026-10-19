import { useMapEvents } from "react-leaflet";
import { findNearestFix } from "../utils/geo";
import { findGlideSegment } from "../utils/glide";

export default function MapClickHandler({ flight, flights, glideMode, onSelect, onGlide, onCompareSelect }) {
  useMapEvents({
    click(e) {
      if (flights?.length) {
        onCompareSelect?.(e.latlng);
        return;
      }
      if (!flight?.fixes?.length) return;
      const snapped = findNearestFix(e.latlng.lat, e.latlng.lng, flight.fixes);
      if (glideMode) {
        const index = flight.fixes.findIndex((f) => f.time === snapped.time);
        onGlide(findGlideSegment(index, flight.fixes));
        return;
      }
      onSelect(snapped);
    },
  });
  return null;
}
