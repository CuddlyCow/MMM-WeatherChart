(function (global) {
  "use strict";

  // ==================== ÜBERSETZUNGEN ====================
  // Gesteuert über config.locale (z. B. "de-DE", "en-US"), unabhängig von der
  // globalen MagicMirror-Sprache. Neue Sprache: Sprachcode (erste 2 Zeichen von
  // locale) als weiteren Schlüssel ergänzen.
  const TRANSLATIONS = {
    de: {
      currentWeatherTitle: "Aktuelles Wetter",
      feelsLike: "Gefühlt:",
      dewPoint: "Taupunkt: {value}",
      pressure: "Luftdruck",
      gust: "Böen: {value}",
      gustUnknown: "Böen: –",
      uvIndex: "UV-Index",
      uviLow: "niedrig",
      uviModerate: "mäßig",
      uviHigh: "hoch",
      uviVeryHigh: "sehr hoch",
      uviExtreme: "extrem",
      updated: "Aktualisiert: {time}",
      hourlyForecast: "Stündliche Vorhersage",
      dailyForecast: "Tägliche Vorhersage",
      loading: "Wetterdaten werden geladen …",
      noCardsEnabled: "Keine Wetterkarten aktiviert.",
      windScaleAriaLabel: "Skala für Windgeschwindigkeit",
      windScaleTitle: "Windgeschwindigkeit",
      temperature: "Temperatur ({unit})",
      maximumTemperature: "Maximaltemperatur ({unit})",
      minimumTemperature: "Minimaltemperatur ({unit})",
      precipitation: "Niederschlag (mm)",
      errorMissingApiKey: "Kein OpenWeather-API-Key in der config.js angegeben.",
      errorInvalidCoordinates: "Keine gültigen Koordinaten (lat/lon) in der config.js angegeben.",
      errorHttp: "OpenWeather-Fehler: HTTP {status}",
      errorIncompleteData: "Die API-Antwort enthält nicht alle benötigten Wetterdaten.",
      errorGeneric: "Wetterdaten konnten nicht geladen werden: {reason}"
    },
    en: {
      currentWeatherTitle: "Current Weather",
      feelsLike: "Feels like:",
      dewPoint: "Dew point: {value}",
      pressure: "Pressure",
      gust: "Gusts: {value}",
      gustUnknown: "Gusts: –",
      uvIndex: "UV Index",
      uviLow: "low",
      uviModerate: "moderate",
      uviHigh: "high",
      uviVeryHigh: "very high",
      uviExtreme: "extreme",
      updated: "Updated: {time}",
      hourlyForecast: "Hourly Forecast",
      dailyForecast: "Daily Forecast",
      loading: "Loading weather data …",
      noCardsEnabled: "No weather cards enabled.",
      windScaleAriaLabel: "Wind speed scale",
      windScaleTitle: "Wind Speed",
      temperature: "Temperature ({unit})",
      maximumTemperature: "Maximum temperature ({unit})",
      minimumTemperature: "Minimum temperature ({unit})",
      precipitation: "Precipitation (mm)",
      errorMissingApiKey: "No OpenWeather API key specified in config.js.",
      errorInvalidCoordinates: "No valid coordinates (lat/lon) specified in config.js.",
      errorHttp: "OpenWeather error: HTTP {status}",
      errorIncompleteData: "The API response does not contain all required weather data.",
      errorGeneric: "Weather data could not be loaded: {reason}"
    }
  };

  const FALLBACK_LANGUAGE = "de";

  const resolveLanguage = (locale) => {
    const languageCode = String(locale || FALLBACK_LANGUAGE).slice(0, 2).toLowerCase();
    return TRANSLATIONS[languageCode] ? languageCode : FALLBACK_LANGUAGE;
  };

  const translationUtils = {
    /**
     * Übersetzt einen Textbaustein für die gegebene Locale.
     * @param {string} locale - z. B. "de-DE" oder "en-US" (config.locale).
     * @param {string} key - Schlüssel aus TRANSLATIONS.
     * @param {object} [vars] - Platzhalter, die im Format {name} ersetzt werden.
     * @returns {string} Der übersetzte (und interpolierte) Text.
     */
    translate(locale, key, vars) {
      const dictionary = TRANSLATIONS[resolveLanguage(locale)];
      const template = dictionary[key] || TRANSLATIONS[FALLBACK_LANGUAGE][key] || key;

      if (!vars) return template;

      return Object.keys(vars).reduce(
        (result, varName) => result.replace(`{${varName}}`, vars[varName]),
        template
      );
    }
  };

  global.MMMWeatherChartTranslations = translationUtils;
})(window);
