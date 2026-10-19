import { bearing } from './math.js';
// import { smoothVario, MIN_VARIO, MIN_TURN, MIN_DURATION, MIN_ROTATION } from './constants.js';

// --------------------
// Detect Thermal Segments in Flight Track
// --------------------
export function detectThermals(fixes) {
  const thermals = [];
  
  // Minimum climb rate in m/s
  const MIN_VARIO = 0.2;

  // Minimum turn rate in deg/sec
  const MIN_TURN = 0.3;

  // Minimum thermal duration in seconds
  const MIN_DURATION = 30;

  // Minimum accumulated rotation:
  // 720° = at least 2 full circles
  const MIN_ROTATION = 720;

  // Skip edges because smoothing needs neighbors
  for (let i = 5; i < fixes.length - 5; i++) {

    // Smoothed vario calculation.
    const v = smoothVario(i, fixes, 120);

    /**
     * Smoothed turn rate calculation.
     * Multiple turn rate samples are averaged to stabilize circling detection.
     */
    let tr = 0;
    let count = 0;

    for (let k = -5; k <= 5; k++) {
      tr += turnRate(
        fixes[i + k - 1],
        fixes[i + k],
        fixes[i + k + 1]
      );
      count++;
    }

    tr /= count;

    // Is the pilot circling?
    const circling = Math.abs(tr) >= MIN_TURN;

    // Is the pilot climbing?
    const climbing = v > MIN_VARIO;

    /**
     * THERMAL ACTIVE
     */
    if (circling && climbing) {

      // Start a new thermal
      if (!currentThermal) {
        currentThermal = {
          startIdx: i,
          endIdx: i,

          // Accumulated heading change
          rotation: 0,

          // Statistics
          right: 0,
          left: 0,

          // Previous heading
          lastHeading: bearing(
            fixes[i - 1],
            fixes[i]
          ),
        };
      }

      // Continuously update thermal endpoint
      currentThermal.endIdx = i;

      /**
       * Calculate current heading
       */
      const heading = bearing(fixes[i - 1], fixes[i]);

      /**
       * Heading change relative to previous heading
       */
      let delta = heading - currentThermal.lastHeading;

      /**
       * Normalize angle into range:
       * -180° ... +180°
       *
       * Prevents jumps like:
       * 359° -> 0°
       */
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;

      /**
       * Accumulate total rotation.
       *
       * Example:
       * 360° = one full circle
       */
      currentThermal.rotation += Math.abs(delta);

      // Store current heading
      currentThermal.lastHeading = heading;

      // Count turn direction statistics
      if (tr > 0) {
        currentThermal.right++;
      } else {
        currentThermal.left++;
      }

    /**
     * THERMAL ENDED
     */
    } else {

      // Only finalize if a thermal was active
      if (currentThermal) {

        const start = fixes[currentThermal.startIdx];
        const end = fixes[currentThermal.endIdx];
        
        // Thermal duration
        const duration = end.time - start.time;

        /**
         * Quality filters:
         * - long enough
         * - enough accumulated rotation
         */
        if (duration >= MIN_DURATION && currentThermal.rotation >= MIN_ROTATION) {

          thermals.push({
            start,
            end,
            duration,

            // Determine left/right circling
            direction: getDirectionFromSegment(
              fixes,
              currentThermal.startIdx,
              currentThermal.endIdx
            ),

            rotation: currentThermal.rotation,
          });
        }

        // Reset current thermal
        currentThermal = null;
      }
    }
  }

  return thermals;
}

let currentThermal = null;

// --------------------
// Determine Dominant Turn Direction
// Returns: "right", "left", or "unknown"
// --------------------
export function getDirectionFromSegment(fixes, startIdx, endIdx) {
  let total = 0;

  for (let i = startIdx + 1; i <= endIdx; i++) {

    const h1 = bearing(fixes[i - 1], fixes[i]);
    const h0 = bearing(
      fixes[i - 2] || fixes[i - 1],
      fixes[i - 1]
    );

    let delta = h1 - h0;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    total += delta;
  }

  /**
   * Too little overall turning:
   * direction unclear
   */
  if (Math.abs(total) < 90) {
    return "unknown";
  }

  // Positive sum = right turn
  return total > 0 ? "right" : "left";
}

// --------------------
// Compute Thermal Statistics
// --------------------
export function computeThermalStats(thermals) {
  let right = 0;
  let left = 0;

  let totalDuration = 0;
  let totalGain = 0;

  for (const t of thermals) {
    if (t.direction === "right") {
      right++;
    } else {
      left++;
    }

    totalDuration += t.duration;
    totalGain += t.end.gpsAltitude - t.start.gpsAltitude;
  }

  const total = thermals.length;

  return {
    totalThermals: total,
    rightTurns: right,
    leftTurns: left,
    rightPercent: total > 0 ? (right / total) * 100 : 0,
    leftPercent: total > 0 ? (left / total) * 100 : 0,
    avgDuration: total > 0 ? totalDuration / total : 0,
    totalGain,
    avgGain: total > 0 ? totalGain / total : 0,
    avgClimbRateFligh: totalDuration > 0 ? totalGain / totalDuration : 0,
  };
}