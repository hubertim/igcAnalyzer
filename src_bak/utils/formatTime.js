// --------------------
// Format Time Helper Function
// Converts seconds to human-readable format
// --------------------
export function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${s} s`;
}