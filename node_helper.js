const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  // ==================== LIFECYCLE ====================
  start() {
    console.log("[MMM-WeatherChart] Node helper gestartet.");

    this.config = null;
    this.updateTimer = null;
    this.cacheFile = path.join(__dirname, "weather-cache.json");
  },

  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  },

  // ==================== SOCKET-KOMMUNIKATION ====================
  socketNotificationReceived(notification, payload) {
    if (notification !== "WEATHER_CONFIG") {
      return;
    }

    console.log("[MMM-WeatherChart] Konfiguration erhalten.");

    // Beende bestehenden Timer, falls vorhanden
    this.stop();

    this.config = payload;
    this.fetchWeatherData();

    // Starte neuen Timer für regelmäßige Aktualisierungen
    this.updateTimer = setInterval(() => {
      this.fetchWeatherData();
    }, this.config.updateInterval);
  },

  // ==================== CACHE-HILFSFUNKTIONEN ====================
  /**
   * Prüft, ob die Wetterdaten alle benötigten Felder enthalten.
   * @param {object} weatherData - Die zu prüfenden Wetterdaten.
   * @returns {boolean} True, wenn die Daten gültig sind.
   */
  hasRequiredWeatherData(weatherData) {
    return Boolean(
      weatherData?.current &&
      Array.isArray(weatherData.daily) &&
      Array.isArray(weatherData.hourly)
    );
  },

  /**
   * Prüft, ob die Cache-Konfiguration mit der aktuellen Konfiguration übereinstimmt.
   * @param {object} cachedData - Die gecachten Wetterdaten.
   * @returns {boolean} True, wenn die Konfigurationen übereinstimmen.
   */
  cacheMatchesConfig(cachedData) {
    if (!cachedData?.cacheConfig || !this.config) {
      return false;
    }

    const { cacheConfig } = cachedData;

    return (
      cacheConfig.units === this.config.units &&
      cacheConfig.lat === this.config.lat &&
      cacheConfig.lon === this.config.lon &&
      (cacheConfig.lang || "de") === (this.config.lang || "de")
    );
  },

  /**
   * Prüft, ob der Cache noch gültig ist (Alter und Konfiguration).
   * @param {object} cachedData - Die gecachten Wetterdaten.
   * @returns {boolean} True, wenn der Cache gültig ist.
   */
  isCacheValid(cachedData) {
    if (
      !cachedData?.cachedAt ||
      !this.hasRequiredWeatherData(cachedData) ||
      !this.cacheMatchesConfig(cachedData)
    ) {
      return false;
    }

    const cachedTimestamp = Date.parse(cachedData.cachedAt);

    // Falls cachedAt kein gültiges Datum ist
    if (Number.isNaN(cachedTimestamp)) {
      return false;
    }

    const cacheAge = Date.now() - cachedTimestamp;
    const maximumAge = Number(this.config.cacheMaxAge) || 30 * 60 * 1000; // Standard: 30 Minuten

    return cacheAge <= maximumAge;
  },

  // ==================== CACHE-VERWALTUNG ====================
  /**
   * Schreibt die Wetterdaten in den Cache.
   * @param {object} weatherData - Die zu cachenden Wetterdaten.
   */
  writeCache(weatherData) {
    try {
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(weatherData, null, 2),
        "utf8"
      );
      console.log(`[MMM-WeatherChart] Cache geschrieben: ${this.cacheFile}`);
    } catch (error) {
      console.error(
        "[MMM-WeatherChart] Cache konnte nicht geschrieben werden:",
        error.message
      );
    }
  },

  /**
   * Liest die Wetterdaten aus dem Cache.
   * @returns {object|null} Die gecachten Wetterdaten oder null.
   */
  readCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.cacheFile, "utf8"));
    } catch (error) {
      console.error(
        "[MMM-WeatherChart] Cache konnte nicht gelesen werden:",
        error.message
      );
      return null;
    }
  },

  // ==================== DATEN-ABRUF ====================
  /**
   * Ruft Wetterdaten von der OpenWeather API ab oder verwendet den Cache.
   */
  async fetchWeatherData() {
    try {
      if (!this.config?.appid) {
        throw new Error(
          "Kein OpenWeather-API-Key in der config.js angegeben."
        );
      }

      // Prüfe, ob gültiger Cache existiert
      const cachedData = this.readCache();

      if (cachedData && this.isCacheValid(cachedData)) {
        console.log("[MMM-WeatherChart] Cache ist noch gültig. Keine API-Anfrage.");

        cachedData.fromCache = true;
        this.sendSocketNotification("WEATHER_DATA", cachedData);
        return;
      }

      // Baue API-URL
      const parameters = new URLSearchParams({
        lat: this.config.lat,
        lon: this.config.lon,
        units: this.config.units,
        lang: this.config.lang || "de",
        appid: this.config.appid,
        exclude: "minutely,alerts"
      });

      const apiUrl = `https://api.openweathermap.org/data/3.0/onecall?${parameters.toString()}`;
      console.log("[MMM-WeatherChart] Rufe Wetterdaten ab ...");

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`OpenWeather-Fehler: HTTP ${response.status}`);
      }

      const weatherData = await response.json();

      if (!this.hasRequiredWeatherData(weatherData)) {
        throw new Error(
          "Die API-Antwort enthält nicht alle benötigten Wetterdaten."
        );
      }

      // Füge Metadaten hinzu
      weatherData.cachedAt = new Date().toISOString();
      weatherData.fromCache = false;
      weatherData.cacheConfig = {
        lat: this.config.lat,
        lon: this.config.lon,
        units: this.config.units,
        lang: this.config.lang || "de"
      };

      // Speichere im Cache
      this.writeCache(weatherData);
      console.log("[MMM-WeatherChart] Wetterdaten erfolgreich gespeichert.");

      // Sende Daten an das Frontend
      this.sendSocketNotification("WEATHER_DATA", weatherData);

    } catch (error) {
      console.error("[MMM-WeatherChart] Fehler beim Abrufen:", error.message);
      this.sendFallbackCacheOrError(error);
    }
  },

  /**
   * Sendet Fallback-Cache oder eine Fehlermeldung, falls keine gültigen Daten verfügbar sind.
   * @param {Error} error - Der aufgetretene Fehler.
   */
  sendFallbackCacheOrError(error) {
    const cachedData = this.readCache();

    if (
      cachedData &&
      this.hasRequiredWeatherData(cachedData) &&
      this.cacheMatchesConfig(cachedData)
    ) {
      console.log("[MMM-WeatherChart] Verwende passenden Wetter-Cache als Fallback.");

      cachedData.fromCache = true;
      this.sendSocketNotification("WEATHER_DATA", cachedData);
      return;
    }

    // Kein gültiger Cache verfügbar → sende Fehlermeldung
    this.sendSocketNotification("WEATHER_ERROR", {
      message: `Wetterdaten konnten nicht geladen werden: ${error.message}`
    });
  }
});
