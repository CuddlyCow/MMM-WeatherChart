(function (global) {
  "use strict";

  const toFiniteNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  };

  const currentWeatherUtils = {
    formatTime(timestamp, locale = "de-DE") {
      const seconds = toFiniteNumber(timestamp);

      if (seconds === null) {
        return "–";
      }

      return new Date(seconds * 1000).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    formatTemperature(value, unit = "°C") {
      const temperature = toFiniteNumber(value);

      if (temperature === null) {
        return "–";
      }

      return `${temperature.toFixed(1)}${unit}`;
    },

    formatWindSpeed(value, unit = "m/s") {
      const windSpeed = toFiniteNumber(value);

      if (windSpeed === null) {
        return "–";
      }

      return `${windSpeed.toFixed(1)} ${unit}`;
    },

    formatVisibility(value) {
      const visibilityMeters = toFiniteNumber(value);

      if (visibilityMeters === null) {
        return "–";
      }

      return `${(visibilityMeters / 1000).toFixed(1)} km`;
    }
  };

  global.MMMWeatherChartCurrentWeatherUtils =
    currentWeatherUtils;
})(window);
