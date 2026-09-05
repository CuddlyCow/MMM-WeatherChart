(function (global) {
  "use strict";

  // ==================== KONSTANTEN ====================
  // Himmelsrichtungen (deutsch, im Uhrzeigersinn ab Nord)
  const DIRECTIONS = [
    "N",  // 0°
    "NO", // 45°
    "O",  // 90°
    "SO", // 135°
    "S",  // 180°
    "SW", // 225°
    "W",  // 270°
    "NW"  // 315°
  ];

  // ==================== HILFSFUNKTIONEN ====================
  /**
   * Berechnet den Index für eine Windrichtung basierend auf Grad.
   * @param {number} degrees - Windrichtung in Grad (0° = Nord, 90° = Ost, etc.).
   * @returns {number|null} Index (0-7) oder null bei ungültiger Eingabe.
   */
  const getDirectionIndex = (degrees) => {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return null;

    const normalizedDegrees = (value + 360) % 360;
    return Math.floor((normalizedDegrees + 22.5) / 45) % 8;
  };

  // ==================== WIND-UTILITIES ====================
  const windUtils = {
    /**
     * Gibt die Windgeschwindigkeitseinheit zurück.
     * @param {string} units - Einheitensystem ("metric", "imperial", "standard").
     * @returns {string} Einheit ("m/s" oder "mph").
     */
    getWindSpeedUnit(units = "metric") {
      return units === "imperial" ? "mph" : "m/s";
    },

    /**
     * Gibt die Himmelsrichtung als Text zurück (z. B. "N", "NO").
     * @param {number} degrees - Windrichtung in Grad.
     * @returns {string} Himmelsrichtung oder leerer String bei ungültiger Eingabe.
     */
    getWindDirection(degrees) {
      const index = getDirectionIndex(degrees);
      return index === null ? "" : DIRECTIONS[index];
    }
  };

  global.MMMWeatherChartWindUtils = windUtils;
})(window);
