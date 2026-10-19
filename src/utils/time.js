export function parseTime(hhmmss) {
  const h = parseInt(hhmmss.slice(0, 2), 10);
  const m = parseInt(hhmmss.slice(2, 4), 10);
  const s = parseInt(hhmmss.slice(4, 6), 10);

  return h * 3600 + m * 60 + s;
}

export function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${s} s`;
}
