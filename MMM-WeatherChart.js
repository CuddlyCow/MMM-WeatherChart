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
      second: "2-digit",
      hourCycle: "h23"
    });

    this.currentDateTimeTimer = setInterval(() => {
      this.updateCurrentDateTime();
    }, 1000);

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
      this.file("js/temperature-utils.js"),
      this.file("js/wind-utils.js"),
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
    const currentWeatherUtils = MMMWeatherChartCurrentWeatherUtils;
    const current = this.weatherData.current;
    const weather = current.weather?.[0] || {};

    const card = document.createElement("div");
    card.className = "weather-current-container";

    const title = document.createElement("div");
    title.className = "weather-current-title";
    title.textContent = "Aktuelles Wetter";
    card.appendChild(title);

    const updateInfo = this.createUpdateInfo();
    card.appendChild(updateInfo);

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
    const tempValue = currentWeatherUtils.formatTemperature(current.temp, this.getTemperatureUnit());
    temperature.textContent = tempValue.replace(/°[CF]/, '°');

    symbolTempRow.appendChild(weatherIcon);
    symbolTempRow.appendChild(temperature);

    const weatherDescription = document.createElement("div");
    weatherDescription.className = "weather-current-description";
    weatherDescription.textContent = weather.description || "–";

    primary.appendChild(symbolTempRow);
    primary.appendChild(weatherDescription);

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
    const feelsLikeTemp = currentWeatherUtils.formatTemperature(current.feels_like, this.getTemperatureUnit());
    feelsLikeValue.textContent = feelsLikeTemp.replace(/°[CF]/, '°');

    feelsLikeContainer.appendChild(feelsLikeIcon);
    feelsLikeContainer.appendChild(feelsLikeLabel);
    feelsLikeContainer.appendChild(feelsLikeValue);

    primary.appendChild(feelsLikeContainer);

    const details = document.createElement("div");
    details.className = "weather-current-details";

    const createDetail = (label, value, icon) => {
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
    };

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

    const humidityValue = `${Number(current.humidity) || 0} %`;
    const dewPoint = Number(current.dew_point || 0);
    const dewPointLabel = this.config.units === "imperial"
      ? `Taupunkt: ${Math.round(dewPoint * 9/5 + 32)}°F`
      : `Taupunkt: ${Math.round(dewPoint)}°C`;
    details.appendChild(createDetail(dewPointLabel, humidityValue, "fa-solid fa-droplet"));
    details.appendChild(createDetail("Luftdruck", `${Number(current.pressure) || 0} hPa`, "fa-solid fa-gauge-high"));

    const displayWindSpeed = this.convertWindSpeed(current.wind_speed);
    const windSpeedText = Number.isFinite(displayWindSpeed)
      ? `${Math.round(displayWindSpeed)} ${this.getWindSpeedUnitLabel()}`
      : "–";
    const windGust = this.convertWindSpeed(current.wind_gust);
    const windGustLabel = Number.isFinite(windGust)
      ? `Böen: ${Math.round(windGust)} ${this.getWindSpeedUnitLabel()}`
      : "Böen: –";
    details.appendChild(createDetail(windGustLabel, windSpeedText, windIcon));

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
    details.appendChild(uviDetail);

    const sunTimes = document.createElement("div");
    sunTimes.className = "weather-current-sun-times";

    const createSunTime = (iconClass, timestamp) => {
      const sunTime = document.createElement("div");
      sunTime.className = "weather-current-sun-time";

      const value = document.createElement("div");
      value.className = "weather-current-sun-value";

      const icon = document.createElement("i");
      icon.className = `fa-solid ${iconClass}`;
      icon.setAttribute("aria-hidden", "true");

      value.appendChild(icon);
      value.appendChild(document.createTextNode(` ${currentWeatherUtils.formatTime(timestamp, this.config.locale)}`));

      sunTime.appendChild(value);
      return sunTime;
    };

    sunTimes.appendChild(createSunTime("fa-sun", current.sunrise));
    sunTimes.appendChild(createSunTime("fa-moon", current.sunset));

    const windScale = this.createWindScale();

    card.appendChild(primary);
    card.appendChild(details);
    card.appendChild(sunTimes);
    card.appendChild(windScale);

    return card;
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
