(function (global) {
  "use strict";

  // ==================== FALLBACK-MAPPING (OpenWeather Icon-Code) ====================
  const ICON_CODE_FALLBACK_MAP = {
    "01": ["wi-day-sunny", "wi-night-clear"],
    "02": ["wi-day-cloudy", "wi-night-alt-cloudy"],
    "03": ["wi-cloud", "wi-cloud"],
    "04": ["wi-cloudy", "wi-cloudy"],
    "09": ["wi-showers", "wi-showers"],
    "10": ["wi-day-rain", "wi-night-alt-rain"],
    "11": ["wi-day-thunderstorm", "wi-night-alt-thunderstorm"],
    "13": ["wi-day-snow", "wi-night-alt-snow"],
    "50": ["wi-day-fog", "wi-night-fog"]
  };

  // ==================== WETTERSYMBOL-UTILITIES ====================
  const weatherIconUtils = {
    /**
     * Ermittelt die Weather-Icons-CSS-Klasse für einen OpenWeather Icon-Code/Weather-ID.
     * @param {object} params
     * @param {string} params.iconCode - OpenWeather Icon-Code (z. B. "01d", "10n").
     * @param {number} params.weatherId - OpenWeather Weather-ID (z. B. 800).
     * @returns {string} Weather-Icons-CSS-Klasse (z. B. "wi-day-sunny").
     */
    getWeatherIconClass({ iconCode, weatherId } = {}) {
      const code = String(iconCode || "01d");
      const isDay = code.endsWith("d");
      const id = Number(weatherId);

      const dayOrNight = (dayClass, nightClass) => isDay ? dayClass : nightClass;

      if (id >= 200 && id <= 232) return dayOrNight("wi-day-thunderstorm", "wi-night-alt-thunderstorm");
      if (id >= 300 && id <= 321) return dayOrNight("wi-day-sprinkle", "wi-night-alt-sprinkle");
      if (id >= 500 && id <= 504) return dayOrNight("wi-day-rain", "wi-night-alt-rain");
      if (id === 511) return "wi-sleet";
      if (id >= 520 && id <= 531) return dayOrNight("wi-day-showers", "wi-night-alt-showers");
      if (id >= 600 && id <= 622) return dayOrNight("wi-day-snow", "wi-night-alt-snow");
      if (id >= 700 && id <= 781) return dayOrNight("wi-day-fog", "wi-night-fog");
      if (id === 800) return dayOrNight("wi-day-sunny", "wi-night-clear");
      if (id === 801 || id === 802) return dayOrNight("wi-day-cloudy", "wi-night-alt-cloudy");
      if (id === 803 || id === 804) return "wi-cloudy";

      const fallback = ICON_CODE_FALLBACK_MAP[code.slice(0, 2)];
      if (fallback) return dayOrNight(fallback[0], fallback[1]);

      return dayOrNight("wi-day-cloudy", "wi-night-alt-cloudy");
    }
  };

  global.MMMWeatherChartWeatherIconUtils = weatherIconUtils;
})(window);
