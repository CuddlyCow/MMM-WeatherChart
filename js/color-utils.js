(function (global) {
  "use strict";

  // ==================== FARBSKALA-UTILITIES ====================
  // Gemeinsame Interpolationslogik für Temperatur- und Wind-Farbskalen.
  const colorUtils = {
    /**
     * Konvertiert einen Hex-Farbcode in ein RGB-Array.
     * Unterstützt 3- und 6-stellige Hex-Codes (mit oder ohne #).
     * @param {string} hex - Hex-Farbcode (z. B. "#ff0000", "f00", "#f00").
     * @returns {number[]} RGB-Array [r, g, b] (0-255).
     */
    hexToRgb(hex) {
      if (!hex) return [255, 255, 255]; // Fallback: Weiß

      const cleanHex = hex.replace("#", "");
      const fullHex = cleanHex.length === 3
        ? cleanHex.split("").map(c => c + c).join("")
        : cleanHex;

      if (fullHex.length !== 6) {
        return [255, 255, 255]; // Weiß
      }

      return [
        parseInt(fullHex.substring(0, 2), 16) || 0,
        parseInt(fullHex.substring(2, 4), 16) || 0,
        parseInt(fullHex.substring(4, 6), 16) || 0
      ];
    },

    /**
     * Interpoliert eine Farbe entlang einer Skala von Wertstufen.
     * Werte außerhalb der Skala werden auf die jeweils äußerste Farbstufe geklemmt.
     * @param {number} value - Aktueller Wert (z. B. Temperatur oder Windgeschwindigkeit).
     * @param {{value: number, color: number[]}[]} stops - Aufsteigend sortierte Stufen mit RGB-Farben.
     * @returns {string} Farbe als RGB-String (z. B. "rgb(255, 0, 0)").
     */
    interpolateColorScale(value, stops) {
      if (!Number.isFinite(value) || !Array.isArray(stops) || stops.length === 0) {
        return "rgb(255, 255, 255)";
      }

      const toRgbString = ([red, green, blue]) => `rgb(${red}, ${green}, ${blue})`;

      if (value <= stops[0].value) {
        return toRgbString(stops[0].color);
      }
      if (value >= stops[stops.length - 1].value) {
        return toRgbString(stops[stops.length - 1].color);
      }

      for (let i = 0; i < stops.length - 1; i++) {
        const lower = stops[i];
        const upper = stops[i + 1];

        if (value >= lower.value && value <= upper.value) {
          const ratio = (value - lower.value) / (upper.value - lower.value);
          const red = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * ratio);
          const green = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * ratio);
          const blue = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * ratio);
          return toRgbString([red, green, blue]);
        }
      }

      return toRgbString(stops[stops.length - 1].color);
    }
  };

  global.MMMWeatherChartColorUtils = colorUtils;
})(window);
