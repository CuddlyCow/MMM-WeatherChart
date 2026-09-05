(function (global) {
  "use strict";

  // ==================== KONSTANTEN ====================
  // Farbskala für Temperaturen in °C (von -20°C bis 50°C)
  // Jede Stufe repräsentiert 10°C, mit Übergängen zwischen den Farben.
  const COLOR_STOPS = [
    { temperature: -20, color: "#4b1f6f" }, // Dunkelviolett
    { temperature: -10, color: "#813d9c" }, // Violett
    { temperature: 0,   color: "#1a5fb4" }, // Blau
    { temperature: 10,  color: "#0ead1a" }, // Grün
    { temperature: 20,  color: "#f5c211" }, // Gelb
    { temperature: 30,  color: "#c64600" }, // Orange
    { temperature: 40,  color: "#a51d2d" }, // Rot
    { temperature: 50,  color: "#7a1020" }  // Dunkelrot
  ];

  // ==================== TEMPERATUR-UTILITIES ====================
  const temperatureUtils = {
    /**
     * Konvertiert eine Temperatur in Celsius (für die Farbskala).
     * @param {number} temperature - Temperatur im gegebenen Einheitensystem.
     * @param {string} units - Einheitensystem ("metric", "imperial", "standard").
     * @returns {number} Temperatur in °C oder 0 bei ungültiger Eingabe.
     */
    convertToCelsius(temperature, units) {
      const value = Number(temperature);
      if (!Number.isFinite(value)) return 0;

      if (units === "imperial") {
        // Fahrenheit zu Celsius: (F - 32) * 5/9
        // Verwendung von 5/9 für bessere numerische Genauigkeit
        return (value - 32) * (5 / 9);
      }
      if (units === "standard") {
        // Kelvin zu Celsius: K - 273.15
        return value - 273.15;
      }
      // Metrisch ist bereits Celsius
      return value;
    },

    /**
     * Interpoliert zwischen zwei RGB-Farben basierend auf einem Temperaturwert.
     * @param {object} lower - Untere Farbstufe { temperature, color }.
     * @param {object} upper - Obere Farbstufe { temperature, color }.
     * @param {number} value - Aktuelle Temperatur in °C.
     * @returns {string} RGB-Farbe als String (z. B. "rgb(255, 0, 0)").
     */
    interpolateColor(lower, upper, value) {
      const lowerRgb = this.hexToRgb(lower.color);
      const upperRgb = this.hexToRgb(upper.color);

      const ratio = (value - lower.temperature) / (upper.temperature - lower.temperature);

      // Lineare Interpolation für jede Farbkomponente
      const red = Math.round(lowerRgb.r + (upperRgb.r - lowerRgb.r) * ratio);
      const green = Math.round(lowerRgb.g + (upperRgb.g - lowerRgb.g) * ratio);
      const blue = Math.round(lowerRgb.b + (upperRgb.b - lowerRgb.b) * ratio);

      return `rgb(${red}, ${green}, ${blue})`;
    },

    /**
     * Gibt die Farbe für eine gegebene Temperatur zurück.
     * @param {number} temperature - Temperatur im gegebenen Einheitensystem.
     * @param {string} units - Einheitensystem ("metric", "imperial", "standard").
     * @returns {string} Farbe als Hex- oder RGB-String. Fallback: "#ffffff" (weiß).
     */
    getTemperatureColor(temperature, units = "metric") {
      const value = this.convertToCelsius(temperature, units);

      if (!Number.isFinite(value)) {
        return "#ffffff"; // Fallback bei ungültiger Eingabe
      }

      // Prüfe, ob die Temperatur außerhalb des definierten Bereichs liegt
      if (value <= COLOR_STOPS[0].temperature) {
        return COLOR_STOPS[0].color;
      }
      if (value >= COLOR_STOPS[COLOR_STOPS.length - 1].temperature) {
        return COLOR_STOPS[COLOR_STOPS.length - 1].color;
      }

      // Finde die passende Farbstufe und interpolieren
      for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
        const current = COLOR_STOPS[i];
        const next = COLOR_STOPS[i + 1];

        if (value >= current.temperature && value <= next.temperature) {
          return this.interpolateColor(current, next, value);
        }
      }

      // Fallback (sollte nie erreicht werden)
      return "#ffffff";
    },

    /**
     * Konvertiert einen Hex-Farbcode in ein RGB-Objekt.
     * Unterstützt 3- und 6-stellige Hex-Codes (mit oder ohne #).
     * @param {string} hex - Hex-Farbcode (z. B. "#ff0000", "f00", "#f00").
     * @returns {object} RGB-Objekt mit r, g, b (0-255).
     */
    hexToRgb(hex) {
      if (!hex) return { r: 255, g: 255, b: 255 }; // Fallback: Weiß

      // Entferne # und ergänze auf 6 Zeichen (z. B. "f00" → "ff0000")
      const cleanHex = hex.replace("#", "");
      const fullHex = cleanHex.length === 3
        ? cleanHex.split("").map(c => c + c).join("")
        : cleanHex;

      // Falls der Hex-Code zu kurz oder zu lang ist, Fallback zurückgeben
      if (fullHex.length !== 6) {
        return { r: 255, g: 255, b: 255 }; // Weiß
      }

      return {
        r: parseInt(fullHex.substring(0, 2), 16) || 0,
        g: parseInt(fullHex.substring(2, 4), 16) || 0,
        b: parseInt(fullHex.substring(4, 6), 16) || 0
      };
    },

    /**
     * Gibt die Temperatureinheit für ein gegebenes Einheitensystem zurück.
     * @param {string} units - Einheitensystem ("metric", "imperial", "standard").
     * @returns {string} Temperatureinheit ("°C", "°F" oder "K").
     */
    getTemperatureUnit(units = "metric") {
      const unitMap = {
        imperial: "°F",
        standard: "K",
        metric: "°C"
      };
      return unitMap[units] || "°C";
    }
  };

  global.MMMWeatherChartTemperatureUtils = temperatureUtils;
})(window);
