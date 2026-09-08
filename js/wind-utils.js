(function (global) {
  "use strict";

  // ==================== FARBSKALA FÜR WINDGESCHWINDIGKEIT (km/h) ====================
  const WIND_COLOR_STOPS = [
    { value: 0, color: [255, 255, 255] },   // Weiß
    { value: 20, color: [70, 150, 255] },   // Blau
    { value: 40, color: [80, 200, 120] },   // Grün
    { value: 60, color: [255, 220, 60] },   // Gelb
    { value: 75, color: [255, 150, 40] },   // Orange
    { value: 90, color: [235, 60, 50] },    // Rot
    { value: 100, color: [180, 70, 220] }   // Violett
  ];

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
     * Gibt die Einheit für die Windgeschwindigkeit zurück (für die Anzeige).
     * @param {string} unit - Einheit ("m/s", "km/h", "mph", "bft").
     * @returns {string} Anzeige-String (z. B. "m/s", "km/h", "Bft").
     */
    getWindSpeedUnitLabel(unit) {
      return unit === "bft" ? "Bft" : unit;
    },

    /**
     * Konvertiert Windgeschwindigkeit in die gewünschte Einheit.
     * @param {number} speed - Windgeschwindigkeit in m/s.
     * @param {string} targetUnit - Zieleinheit ("m/s", "km/h", "mph", "bft").
     * @returns {number|null} Konvertierte Geschwindigkeit oder null bei ungültiger Eingabe.
     */
    convertWindSpeed(speed, targetUnit = "m/s") {
      const value = Number(speed);
      if (!Number.isFinite(value)) return null;

      if (targetUnit === "km/h") return value * 3.6;
      if (targetUnit === "mph") return value * 2.23694;
      if (targetUnit === "bft") {
        const beaufortUpperLimits = [0.2, 1.5, 3.3, 5.4, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
        const beaufortValue = beaufortUpperLimits.findIndex(upperLimit => value <= upperLimit);
        return beaufortValue === -1 ? 12 : beaufortValue;
      }
      return value;
    },

    /**
     * Gibt die Farbe für eine gegebene Windgeschwindigkeit zurück.
     * @param {number} speed - Windgeschwindigkeit in m/s.
     * @returns {string} Farbe als RGB-String.
     */
    getWindColor(speed) {
      const windSpeedMs = Number(speed);
      if (!Number.isFinite(windSpeedMs)) return "rgb(255, 255, 255)";

      const speedKmh = Math.max(0, windSpeedMs * 3.6);
      return MMMWeatherChartColorUtils.interpolateColorScale(speedKmh, WIND_COLOR_STOPS);
    },

    /**
     * Erstellt eine Windskala als HTML-Element.
     * @param {object} moduleInstance - Instanz des Moduls (für `this.file()` und Konfiguration).
     * @returns {HTMLElement} DOM-Element der Windskala.
     */
    createWindScale(moduleInstance) {
      const scale = document.createElement("div");
      scale.className = "weather-current-wind-scale";
      scale.setAttribute("aria-label", "Skala für Windgeschwindigkeit");

      const title = document.createElement("div");
      title.className = "weather-current-wind-scale-title";
      title.textContent = "Windgeschwindigkeit";

      const bar = document.createElement("div");
      bar.className = "weather-current-wind-scale-bar";

      const labels = document.createElement("div");
      labels.className = "weather-current-wind-scale-labels";

      const scaleKmh = [0, 10, 20, 30, 50, 80];
      const unit = moduleInstance.getWindSpeedUnitLabel();

      const formatValue = (valueKmh) => {
        const valueMs = valueKmh / 3.6;
        const converted = windUtils.convertWindSpeed(valueMs, moduleInstance.getWindSpeedUnit());
        return Math.round(converted);
      };

      scaleKmh.forEach((valueKmh, index) => {
        const label = document.createElement("span");
        label.textContent = index === scaleKmh.length - 1 ? `${formatValue(valueKmh)}+` : formatValue(valueKmh);
        labels.appendChild(label);
      });

      const unitLabel = document.createElement("span");
      unitLabel.className = "weather-current-wind-scale-unit";
      unitLabel.textContent = unit;
      labels.appendChild(unitLabel);

      scale.appendChild(title);
      scale.appendChild(bar);
      scale.appendChild(labels);

      return scale;
    }
  };

  global.MMMWeatherChartWindUtils = windUtils;
})(window);
