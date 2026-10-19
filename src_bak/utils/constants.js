// --------------------
// THRESHOLDS & CONFIG
// --------------------
export const MIN_VARIO = 0.2;        // m/s - Minimum Steigrate für Thermik-Erkennung
export const MIN_TURN = 0.3;          // deg/sec - Minimum Drehrate
export const MIN_DURATION = 30;       // Sekunden
export const MIN_ROTATION = 720;      // Grad - Mindestrotation für Thermik

// --------------------
// CLIMB DETECTION
// --------------------
export const CLIMB_THRESHOLD = -0.3;  // m/s - Threshold for climb segment detection
export const REQUIRED_POINTS = 20;     // Punkte für Glide-Modus

// --------------------
// PROFILING
// --------------------
export const PROFILE_WINDOW = 5;      // Fenstergröße für smoothVario

// --------------------
// UI
// --------------------
export const MAP_HEIGHT_DESKTOP = 300;
export const MAP_HEIGHT_MOBILE = '60vh';
export const PROFILE_HEIGHT_DESKTOP = 230;
export const PROFILE_HEIGHT_MOBILE = 120;