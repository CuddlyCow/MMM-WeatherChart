const SUN_ARC_NS = "http://www.w3.org/2000/svg";
const SUN_ARC_WIDTH = 200;
const SUN_ARC_VIEWBOX_HEIGHT = 49;
const SUN_ARC_BASELINE_Y = 47;
const SUN_ARC_INSET_X = 33;
const SUN_ARC_SWEEP_DEG = 120;
const SUN_ARC_MARKER_RADIUS = 6;
// Breite/Abstand des Sonne-/Mond-Symbols (fa-solid, font-size-xsmall) inkl. seines margin-right.
const SUN_ARC_LABEL_ICON_HALF_WIDTH = 9;
const SUN_ARC_LABEL_ICON_MARGIN = 4;
// Die Symbolzeile liegt unterhalb der Bogen-Basislinie; damit die Symbolmitte auf dem
// gedachten, weitergeführten Kreisbogen liegt (statt auf der Sehne), müssen die Symbole
// zusätzlich nach außen rücken. Empirisch ermittelt für die aktuelle Bogengeometrie.
const SUN_ARC_LABEL_OUTWARD_SHIFT = 6;

Module.register("MMM-WeatherChart", {
  // ==================== KONFIGURATION ====================
  defaults: {
    lat: null,
    lon: null,
    units: "metric",
    appid: null,

    updateInterval: 30 * 60 * 1000,
    cacheMaxAge: 30 * 60 * 1000,

    locale: "de-DE",
    lang: "de",
    animationDuration: 700,
    windSpeedUnit: null,

    daily: {
      days: 6
    },

    display: {
      dateTime: true,
      currentWeather: true,
      dailyForecast: true,
      hourlyForecast: false,
      weatherIcons: true,
      wind: true,
      maximumTemperature: true,
      minimumTemperature: true,
      precipitation: true,
      xAxisLabels: true,
      yAxisLabels: false
    },

    wind: {
      showArrow: true,
      showSpeed: true
    },

    hourly: {
      intervalHours: 3,
      points: 8
    }
  },

  // ==================== LIFECYCLE ====================
  start() {
    this.weatherData = null;
    this.errorMessage = null;
    this.charts = {};
    this.chartDataLabelsRegistered = false;
    this.dateTimeDateElement = null;
    this.dateTimeTimeElement = null;

    this.dateFormatter = new Intl.DateTimeFormat(this.config.locale || "de-DE", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    this.timeFormatter = new Intl.DateTimeFormat(this.config.locale || "de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });

    this.scheduleDateTimeUpdate();

    MMMWeatherChartIconPlugin.preloadWeatherFont();

    this.sendSocketNotification("WEATHER_CONFIG", {
      lat: this.config.lat,
      lon: this.config.lon,
      units: this.config.units,
      lang: this.config.lang || "de",
      appid: this.config.appid,
      updateInterval: this.config.updateInterval,
      cacheMaxAge: this.config.cacheMaxAge
    });
  },

  stop() {
    if (this.currentDateTimeTimer) {
      clearInterval(this.currentDateTimeTimer);
      this.currentDateTimeTimer = null;
    }
  },

  suspend() {
    this.stop();

    if (this.charts) {
      Object.values(this.charts).forEach((chart) => {
        if (chart) chart.destroy();
      });
      this.charts = {};
    }
  },

  // ==================== DEPENDENCIES ====================
  getScripts() {
    return [
      this.file("node_modules/chart.js/dist/chart.umd.js"),
      this.file("node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.js"),
      this.file("js/color-utils.js"),
      this.file("js/temperature-utils.js"),
      this.file("js/wind-utils.js"),
      this.file("js/sun-path-utils.js"),
      this.file("js/current-weather-utils.js"),
      this.file("js/weather-icon-utils.js"),
      this.file("js/weather-icon-plugin.js"),
      this.file("js/dom-utils.js"),
      this.file("js/chart-builder.js")
    ];
  },

  getStyles() {
    return [
      this.file("css/weather-icons.min.css"),
      "../../css/font-awesome.css",
      this.file("MMM-WeatherChart.css")
    ];
  },

  // ==================== DATE/TIME ====================
  formatCurrentDateTime(date = new Date()) {
    return {
      date: this.dateFormatter.format(date),
      time: this.timeFormatter.format(date)
    };
  },

  updateCurrentDateTime() {
    if (!this.dateTimeDateElement || !this.dateTimeTimeElement) return;

    const { date, time } = this.formatCurrentDateTime();
    this.dateTimeDateElement.textContent = date;
    this.dateTimeTimeElement.textContent = time;
  },

  scheduleDateTimeUpdate() {
    this.handleMinuteTick();

    const msUntilNextMinute = 60000 - (Date.now() % 60000);
    this.currentDateTimeTimer = setTimeout(() => {
      this.handleMinuteTick();
      this.currentDateTimeTimer = setInterval(() => this.handleMinuteTick(), 60000);
    }, msUntilNextMinute);
  },

  handleMinuteTick() {
    this.updateCurrentDateTime();
    this.updateSunPosition();
  },

  // ==================== WEATHER ICONS ====================
  getWeatherIconClass(params) {
    return MMMWeatherChartWeatherIconUtils.getWeatherIconClass(params);
  },

  // ==================== CSS UTILITIES ====================
  getCssVariable(variableName, fallbackValue) {
    return MMMWeatherChartDomUtils.getCssVariable(variableName, fallbackValue);
  },

  getCssFontSize(variableName, fallbackValue) {
    return MMMWeatherChartDomUtils.getCssFontSize(variableName, fallbackValue);
  },

  // ==================== SOCKET ====================
  socketNotificationReceived(notification, payload) {
    if (notification === "WEATHER_DATA") {
      this.weatherData = payload;
      this.errorMessage = null;
      this.updateDom(300);
    } else if (notification === "WEATHER_ERROR") {
      this.errorMessage = payload.message;
      this.updateDom(300);
    }
  },

  // ==================== HELPERS ====================
  isCardEnabled(cardName) {
    return this.config.display?.[cardName] !== false;
  },

  // ==================== CHARTS ====================
  destroyChart(forecastMode) {
    const chart = this.charts?.[forecastMode];
    if (chart) {
      chart.destroy();
      delete this.charts[forecastMode];
    }
  },

  createChart(canvas, forecastMode) {
    if (!this.weatherData?.current || !Array.isArray(this.weatherData.daily) || !Array.isArray(this.weatherData.hourly)) {
      console.error("MMM-WeatherChart: Invalid weather data for chart creation");
      return;
    }

    if (!this.charts) this.charts = {};
    this.destroyChart(forecastMode);

    if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") {
      console.error("MMM-WeatherChart: Chart.js or ChartDataLabels not loaded");
      return;
    }

    if (!this.chartDataLabelsRegistered) {
      Chart.register(ChartDataLabels);
      this.chartDataLabelsRegistered = true;
    }

    this.charts[forecastMode] = MMMWeatherChartBuilder.createChart(this, canvas, forecastMode);
  },

  // ==================== DOM CREATION ====================
  createCurrentWeatherCard() {
    const current = this.weatherData.current;
    const weather = current.weather?.[0] || {};

    const card = document.createElement("div");
    card.className = "weather-current-container";

    const title = document.createElement("div");
    title.className = "weather-current-title";
    title.textContent = "Aktuelles Wetter";
    card.appendChild(title);

    card.appendChild(this.createUpdateInfo());
    card.appendChild(this.createCurrentWeatherPrimary(current, weather));
    card.appendChild(this.createCurrentWeatherDetails(current));
    card.appendChild(this.createCurrentWeatherSunTimes(current));
    card.appendChild(this.createWindScale());

    return card;
  },

  createCurrentWeatherPrimary(current, weather) {
    const currentWeatherUtils = MMMWeatherChartCurrentWeatherUtils;

    const primary = document.createElement("div");
    primary.className = "weather-current-primary";

    const symbolTempRow = document.createElement("div");
    symbolTempRow.className = "weather-current-symbol-temp-row";

    const weatherIconCode = weather.icon || "01d";
    const weatherId = Number(weather.id);
    const weatherIconClass = this.getWeatherIconClass({ iconCode: weatherIconCode, weatherId });

    const weatherIcon = document.createElement("i");
    weatherIcon.className = `weather-current-icon wi ${weatherIconClass}`;
    weatherIcon.setAttribute("aria-hidden", "true");
    weatherIcon.setAttribute("title", weather.description || "Aktuelles Wetter");

    const temperature = document.createElement("div");
    temperature.className = "weather-current-temperature";
    temperature.textContent = currentWeatherUtils.formatTemperatureShort(current.temp);

    symbolTempRow.appendChild(weatherIcon);
    symbolTempRow.appendChild(temperature);

    const weatherDescriptionText = weather.description || "–";
    const weatherDescription = document.createElement("div");
    weatherDescription.className = "weather-current-description";
    if (weatherDescriptionText.length > 20) weatherDescription.classList.add("is-long");
    weatherDescription.textContent = weatherDescriptionText;

    primary.appendChild(symbolTempRow);
    primary.appendChild(weatherDescription);
    primary.appendChild(this.createFeelsLikeIndicator(current));

    return primary;
  },

  createFeelsLikeIndicator(current) {
    const currentWeatherUtils = MMMWeatherChartCurrentWeatherUtils;

    const feelsLikeContainer = document.createElement("div");
    feelsLikeContainer.className = "weather-current-feels-like";

    const feelsLikeIcon = document.createElement("i");
    feelsLikeIcon.className = "fa-solid fa-thermometer-half weather-current-feels-like-icon";
    feelsLikeIcon.setAttribute("aria-hidden", "true");
    feelsLikeIcon.style.color = this.getTemperatureColor(current.feels_like);

    const feelsLikeLabel = document.createElement("span");
    feelsLikeLabel.className = "weather-current-feels-like-label";
    feelsLikeLabel.textContent = "Gefühlt:";

    const feelsLikeValue = document.createElement("span");
    feelsLikeValue.className = "weather-current-feels-like-value";
    feelsLikeValue.textContent = currentWeatherUtils.formatTemperatureShort(current.feels_like);

    feelsLikeContainer.appendChild(feelsLikeIcon);
    feelsLikeContainer.appendChild(feelsLikeLabel);
    feelsLikeContainer.appendChild(feelsLikeValue);

    return feelsLikeContainer;
  },

  createCurrentWeatherDetail(label, value, icon) {
    const detail = document.createElement("div");
    detail.className = "weather-current-detail";

    let iconElement;
    if (typeof icon === "string") {
      iconElement = document.createElement("i");
      iconElement.className = `weather-current-detail-icon ${icon}`;
      iconElement.setAttribute("aria-hidden", "true");
    } else {
      iconElement = icon;
      iconElement.classList.add("weather-current-detail-icon");
    }

    const valueElement = document.createElement("div");
    valueElement.className = "weather-current-detail-value";
    valueElement.textContent = value;

    const labelElement = document.createElement("div");
    labelElement.className = "weather-current-detail-label";
    labelElement.textContent = label;

    const textBlock = document.createElement("div");
    textBlock.className = "weather-current-detail-text";
    textBlock.appendChild(valueElement);
    textBlock.appendChild(labelElement);

    detail.appendChild(iconElement);
    detail.appendChild(textBlock);

    return detail;
  },

  createWindDetailIcon(current) {
    const hasWindDirection = Number.isFinite(Number(current.wind_deg));
    const windIcon = document.createElement("span");
    windIcon.className = "weather-current-wind-icon";
    windIcon.setAttribute("aria-hidden", "true");

    const windArrowUrl = this.file("icons/wind-arrow.svg");
    windIcon.style.webkitMaskImage = `url("${windArrowUrl}")`;
    windIcon.style.maskImage = `url("${windArrowUrl}")`;
    windIcon.style.backgroundColor = this.getWindColor(current.wind_speed);

    if (hasWindDirection) {
      windIcon.style.transform = `rotate(${Number(current.wind_deg) + 180}deg)`;
    }

    return windIcon;
  },

  createUviDetail(current) {
    const uvi = Math.round(Number(current.uvi || 0));
    const uviLabel = uvi <= 2 ? "niedrig"
      : uvi <= 5 ? "mäßig"
      : uvi <= 7 ? "hoch"
      : uvi <= 10 ? "sehr hoch" : "extrem";

    const uviDetail = document.createElement("div");
    uviDetail.className = "weather-current-detail";

    const uviIcon = document.createElement("i");
    uviIcon.className = "weather-current-detail-icon fa-solid fa-sun";
    uviIcon.setAttribute("aria-hidden", "true");

    const uviValueElement = document.createElement("div");
    uviValueElement.className = "weather-current-detail-value";
    uviValueElement.innerHTML = `${uvi} <span class="xsmall">(${uviLabel})</span>`;

    const uviLabelElement = document.createElement("div");
    uviLabelElement.className = "weather-current-detail-label";
    uviLabelElement.textContent = "UV-Index";

    const uviTextBlock = document.createElement("div");
    uviTextBlock.className = "weather-current-detail-text";
    uviTextBlock.appendChild(uviValueElement);
    uviTextBlock.appendChild(uviLabelElement);

    uviDetail.appendChild(uviIcon);
    uviDetail.appendChild(uviTextBlock);

    return uviDetail;
  },

  createCurrentWeatherDetails(current) {
    const details = document.createElement("div");
    details.className = "weather-current-details";

    const humidityValue = `${Number(current.humidity) || 0} %`;
    const dewPoint = Number(current.dew_point || 0);
    const dewPointLabel = this.config.units === "imperial"
      ? `Taupunkt: ${Math.round(dewPoint * 9/5 + 32)}°F`
      : `Taupunkt: ${Math.round(dewPoint)}°C`;
    details.appendChild(this.createCurrentWeatherDetail(dewPointLabel, humidityValue, "fa-solid fa-droplet"));
    details.appendChild(this.createCurrentWeatherDetail("Luftdruck", `${Number(current.pressure) || 0} hPa`, "fa-solid fa-gauge-high"));

    const displayWindSpeed = this.convertWindSpeed(current.wind_speed);
    const windSpeedText = Number.isFinite(displayWindSpeed)
      ? `${Math.round(displayWindSpeed)} ${this.getWindSpeedUnitLabel()}`
      : "–";
    const windGust = this.convertWindSpeed(current.wind_gust);
    const windGustLabel = Number.isFinite(windGust)
      ? `Böen: ${Math.round(windGust)} ${this.getWindSpeedUnitLabel()}`
      : "Böen: –";
    details.appendChild(this.createCurrentWeatherDetail(windGustLabel, windSpeedText, this.createWindDetailIcon(current)));

    details.appendChild(this.createUviDetail(current));

    return details;
  },

  createSunTimeEntry(iconClass, timestamp, iconFirst = true) {
    const currentWeatherUtils = MMMWeatherChartCurrentWeatherUtils;

    const sunTime = document.createElement("div");
    sunTime.className = "weather-current-sun-time";

    const value = document.createElement("div");
    value.className = "weather-current-sun-value";

    const icon = document.createElement("i");
    icon.className = `fa-solid ${iconClass}`;
    icon.setAttribute("aria-hidden", "true");

    const time = currentWeatherUtils.formatTime(timestamp, this.config.locale);

    if (iconFirst) {
      value.appendChild(icon);
      value.appendChild(document.createTextNode(` ${time}`));
    } else {
      value.appendChild(document.createTextNode(`${time} `));
      value.appendChild(icon);
    }

    sunTime.appendChild(value);
    return sunTime;
  },

  createCurrentWeatherSunTimes(current) {
    const sunTimes = document.createElement("div");
    sunTimes.className = "weather-current-sun-times";
    sunTimes.appendChild(this.createSunArc());

    const labels = document.createElement("div");
    labels.className = "weather-current-sun-labels";
    const labelInsetPercent = (SUN_ARC_INSET_X / SUN_ARC_WIDTH) * 100;
    labels.style.paddingLeft = `calc(${labelInsetPercent}% - ${SUN_ARC_LABEL_ICON_HALF_WIDTH + SUN_ARC_LABEL_OUTWARD_SHIFT}px)`;
    labels.style.paddingRight = `calc(${labelInsetPercent}% - ${SUN_ARC_LABEL_ICON_HALF_WIDTH + SUN_ARC_LABEL_ICON_MARGIN + SUN_ARC_LABEL_OUTWARD_SHIFT}px)`;
    labels.appendChild(this.createSunTimeEntry("fa-sun", current.sunrise));
    labels.appendChild(this.createSunTimeEntry("fa-moon", current.sunset, false));
    sunTimes.appendChild(labels);

    this.currentSunTimes = {
      sunrise: Number(current.sunrise),
      sunset: Number(current.sunset)
    };
    this.updateSunPosition();

    return sunTimes;
  },

  createSunArc() {
    const sunPathUtils = MMMWeatherChartSunPathUtils;
    const geometry = sunPathUtils.getArcGeometry(SUN_ARC_WIDTH, SUN_ARC_BASELINE_Y, SUN_ARC_INSET_X, SUN_ARC_SWEEP_DEG);

    const svg = document.createElementNS(SUN_ARC_NS, "svg");
    svg.classList.add("weather-current-sun-arc");
    svg.setAttribute("viewBox", `0 0 ${SUN_ARC_WIDTH} ${SUN_ARC_VIEWBOX_HEIGHT}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
    svg.style.aspectRatio = `${SUN_ARC_WIDTH} / ${SUN_ARC_VIEWBOX_HEIGHT}`;

    const path = document.createElementNS(SUN_ARC_NS, "path");
    path.classList.add("weather-current-sun-arc-path");
    path.setAttribute("d", sunPathUtils.getArcPath(geometry));

    const marker = document.createElementNS(SUN_ARC_NS, "circle");
    marker.classList.add("weather-current-sun-marker");
    marker.setAttribute("r", String(SUN_ARC_MARKER_RADIUS));

    svg.appendChild(path);
    svg.appendChild(marker);

    this.sunArcGeometry = geometry;
    this.sunArcPathElement = path;
    this.sunMarkerElement = marker;

    return svg;
  },

  updateSunPosition() {
    if (!this.sunMarkerElement || !this.sunArcPathElement || !this.currentSunTimes) return;

    const sunPathUtils = MMMWeatherChartSunPathUtils;
    const { sunrise, sunset } = this.currentSunTimes;
    const { progress, isDaytime } = sunPathUtils.getSunProgress(Date.now() / 1000, sunrise, sunset);

    this.sunArcPathElement.classList.toggle("is-night", !isDaytime);
    this.sunMarkerElement.classList.toggle("is-hidden", !isDaytime);

    if (isDaytime) {
      const point = sunPathUtils.getPointOnArc(this.sunArcGeometry, progress);
      this.sunMarkerElement.setAttribute("cx", point.x);
      this.sunMarkerElement.setAttribute("cy", point.y);
    }
  },

  createUpdateInfo() {
    const updateInfo = document.createElement("div");
    updateInfo.className = "weather-chart-update-info";

    const updateIcon = document.createElement("span");
    updateIcon.className = "weather-chart-update-icon";
    updateIcon.textContent = "↻";

    const updateText = document.createElement("span");
    const cachedAt = this.weatherData.cachedAt ? new Date(this.weatherData.cachedAt) : null;
    const updateTime = cachedAt
      ? cachedAt.toLocaleTimeString(this.config.locale, { hour: "2-digit", minute: "2-digit" })
      : "–";

    updateText.textContent = `Aktualisiert: ${updateTime}`;

    updateInfo.appendChild(updateIcon);
    updateInfo.appendChild(updateText);

    return updateInfo;
  },

  createForecastCard(title, forecastMode) {
    const container = document.createElement("div");
    container.className = `weather-chart-container weather-chart-container-${forecastMode}`;

    const titleElement = document.createElement("div");
    titleElement.className = "weather-chart-title";
    titleElement.textContent = title;

    const canvas = document.createElement("canvas");
    canvas.id = `weather-chart-${forecastMode}-${this.identifier}`;

    container.appendChild(titleElement);
    container.appendChild(canvas);

    window.setTimeout(() => this.createChart(canvas, forecastMode), 0);

    return container;
  },

  createDateTimeCard() {
    const container = document.createElement("div");
    container.className = "weather-datetime-container";

    const dateElement = document.createElement("div");
    dateElement.className = "weather-datetime-date";
    const timeElement = document.createElement("div");
    timeElement.className = "weather-datetime-time";

    this.dateTimeDateElement = dateElement;
    this.dateTimeTimeElement = timeElement;
    this.updateCurrentDateTime();

    const row = document.createElement("div");
    row.className = "weather-datetime-row";
    row.appendChild(dateElement);
    row.appendChild(timeElement);

    container.appendChild(row);

    return container;
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "weather-chart-wrapper";

    if (this.errorMessage && !this.weatherData) {
      wrapper.innerHTML = `<div class="weather-chart-error bright small">${this.errorMessage}</div>`;
      return wrapper;
    }

    if (!this.weatherData?.current || !Array.isArray(this.weatherData.daily) || !Array.isArray(this.weatherData.hourly)) {
      wrapper.innerHTML = '<div class="weather-chart-loading dimmed small">Wetterdaten werden geladen …</div>';
      return wrapper;
    }

    const showCurrentWeather = this.isCardEnabled("currentWeather");
    const showDailyForecast = this.isCardEnabled("dailyForecast");
    const showHourlyForecast = this.isCardEnabled("hourlyForecast");

    if (!showCurrentWeather && !showDailyForecast && !showHourlyForecast) {
      wrapper.innerHTML = '<div class="weather-chart-loading dimmed small">Keine Wetterkarten aktiviert.</div>';
      return wrapper;
    }

    if (!showDailyForecast) this.destroyChart("daily");
    if (!showHourlyForecast) this.destroyChart("hourly");

    const showDateTime = this.isCardEnabled("dateTime");

    if (showDateTime) wrapper.appendChild(this.createDateTimeCard());
    if (showCurrentWeather) wrapper.appendChild(this.createCurrentWeatherCard());
    if (showHourlyForecast) wrapper.appendChild(this.createForecastCard("Stündliche Vorhersage", "hourly"));
    if (showDailyForecast) wrapper.appendChild(this.createForecastCard("Tägliche Vorhersage", "daily"));

    return wrapper;
  },

  // ==================== TEMPERATURE ====================
  getTemperatureColor(temperature) {
    return MMMWeatherChartTemperatureUtils.getTemperatureColor(temperature, this.config.units);
  },

  getTemperatureUnit() {
    return MMMWeatherChartTemperatureUtils.getTemperatureUnit(this.config.units);
  },

  // ==================== WIND ====================
  getWindSpeedUnit() {
    const configuredUnit = this.config.windSpeedUnit;
    const validUnits = ["m/s", "km/h", "mph", "bft"];
    return validUnits.includes(configuredUnit)
      ? configuredUnit
      : MMMWeatherChartWindUtils.getWindSpeedUnit(this.config.units);
  },

  getWindSpeedUnitLabel() {
    return MMMWeatherChartWindUtils.getWindSpeedUnitLabel(this.getWindSpeedUnit());
  },

  convertWindSpeed(speed) {
    return MMMWeatherChartWindUtils.convertWindSpeed(speed, this.getWindSpeedUnit());
  },

  getWindColor(speed) {
    return MMMWeatherChartWindUtils.getWindColor(speed);
  },

  createWindScale() {
    return MMMWeatherChartWindUtils.createWindScale(this);
  },
});
