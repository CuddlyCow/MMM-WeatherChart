(function (global) {
  "use strict";

  // ==================== KONSTANTEN ====================
  // Farbskala für Temperaturen in °C (von -20°C bis 50°C)
  // Jede Stufe repräsentiert 10°C, mit Übergängen zwischen den Farben.
  const COLOR_STOPS = [
    { value: -20, color: MMMWeatherChartColorUtils.hexToRgb("#4b1f6f") }, // Dunkelviolett
    { value: -10, color: MMMWeatherChartColorUtils.hexToRgb("#813d9c") }, // Violett
    { value: 0,   color: MMMWeatherChartColorUtils.hexToRgb("#1a5fb4") }, // Blau
    { value: 10,  color: MMMWeatherChartColorUtils.hexToRgb("#0ead1a") }, // Grün
    { value: 20,  color: MMMWeatherChartColorUtils.hexToRgb("#f5c211") }, // Gelb
    { value: 30,  color: MMMWeatherChartColorUtils.hexToRgb("#c64600") }, // Orange
    { value: 40,  color: MMMWeatherChartColorUtils.hexToRgb("#a51d2d") }, // Rot
    { value: 50,  color: MMMWeatherChartColorUtils.hexToRgb("#7a1020") }  // Dunkelrot
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
     * Gibt die Farbe für eine gegebene Temperatur zurück.
     * @param {number} temperature - Temperatur im gegebenen Einheitensystem.
     * @param {string} units - Einheitensystem ("metric", "imperial", "standard").
     * @returns {string} Farbe als RGB-String. Fallback: "rgb(255, 255, 255)" (weiß).
     */
    getTemperatureColor(temperature, units = "metric") {
      const value = this.convertToCelsius(temperature, units);
      return MMMWeatherChartColorUtils.interpolateColorScale(value, COLOR_STOPS);
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
