Module.register("MMM-WeatherChart", {
  // ==================== KONFIGURATION ====================
  defaults: {
    lat: null,
    lon: null,
    units: "metric",
    appid: null,

    updateInterval: 30 * 60 * 1000, // 30 Minuten
    cacheMaxAge: 30 * 60 * 1000,    // 30 Minuten

    locale: "de-DE",
    lang: "de",
    animationDuration: 700,
    windSpeedUnit: null, // Standardmäßig null → wird aus `units` abgeleitet

    daily: {
      days: 6
    },

    display: {
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
      showDirection: false,
      showSpeed: true
    },

    hourly: {
      intervalHours: 3,
      points: 8
    }
  },

  // ==================== LIFECYCLE-METHODEN ====================
  start() {
    // Initialisiere Eigenschaften
    this.weatherData = null;
    this.errorMessage = null;
    this.charts = {};
    this.chartDataLabelsRegistered = false;
    this.currentDateTimeDateElement = null;
    this.currentDateTimeTimeElement = null;

    // Initialisiere Date/Time-Formatter (nur einmal erstellen)
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

    // Starte Timer für Datum/Uhrzeit
    this.currentDateTimeTimer = setInterval(() => {
      this.updateCurrentDateTime();
    }, 1000);

    // Sende Konfiguration an den Backend
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
    // Räume Timer auf
    if (this.currentDateTimeTimer) {
      clearInterval(this.currentDateTimeTimer);
      this.currentDateTimeTimer = null;
    }
  },

  suspend() {
    // Räume Timer und Charts auf
    this.stop();

    if (this.charts) {
      Object.values(this.charts).forEach((chart) => {
        if (chart) chart.destroy();
      });
      this.charts = {};
    }
  },

  // ==================== ABHÄNGIGKEITEN ====================
  getScripts() {
    return [
      this.file("node_modules/chart.js/dist/chart.umd.js"),
      this.file("node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.js"),
      this.file("js/temperature-utils.js"),
      this.file("js/wind-utils.js"),
      this.file("js/current-weather-utils.js"),
      this.file("js/weather-icon-plugin.js")
    ];
  },

  getStyles() {
    return [
      this.file("css/weather-icons.min.css"),
      "../../css/font-awesome.css",
      this.file("MMM-WeatherChart.css")
    ];
  },

  // ==================== DATUM/ZEIT ====================
  formatCurrentDateTime(date = new Date()) {
    return {
      date: this.dateFormatter.format(date),
      time: this.timeFormatter.format(date)
    };
  },

  updateCurrentDateTime() {
    if (!this.currentDateTimeDateElement || !this.currentDateTimeTimeElement) return;

    const { date, time } = this.formatCurrentDateTime();
    this.currentDateTimeDateElement.textContent = date;
    this.currentDateTimeTimeElement.textContent = time;
  },

  // ==================== WETTER-ICONS ====================
  getWeatherIconClass({ iconCode, weatherId } = {}) {
    const code = String(iconCode || "01d");
    const isDay = code.endsWith("d");
    const id = Number(weatherId);

    const dayOrNight = (dayClass, nightClass) => isDay ? dayClass : nightClass;

    // OpenWeather-Kennungen (kompakt)
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

    // Fallback über Icon-Code
    const fallbackMap = {
      "01": dayOrNight("wi-day-sunny", "wi-night-clear"),
      "02": dayOrNight("wi-day-cloudy", "wi-night-alt-cloudy"),
      "03": "wi-cloud",
      "04": "wi-cloudy",
      "09": "wi-showers",
      "10": dayOrNight("wi-day-rain", "wi-night-alt-rain"),
      "11": dayOrNight("wi-day-thunderstorm", "wi-night-alt-thunderstorm"),
      "13": dayOrNight("wi-day-snow", "wi-night-alt-snow"),
      "50": dayOrNight("wi-day-fog", "wi-night-fog")
    };

    return fallbackMap[code.slice(0, 2)] || dayOrNight("wi-day-cloudy", "wi-night-alt-cloudy");
  },

  // ==================== CSS-UTILITIES ====================
  getCssVariable(variableName, fallbackValue) {
    const rootStyles = getComputedStyle(document.documentElement);
    return rootStyles.getPropertyValue(variableName).trim() || fallbackValue;
  },

  getCssFontSize(variableName, fallbackValue) {
    const probe = document.createElement("span");
    probe.style.fontSize = `var(${variableName}, ${fallbackValue})`;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    document.body.appendChild(probe);
    const fontSize = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return Number.isFinite(fontSize) ? fontSize : parseFloat(fallbackValue);
  },

  // ==================== SOCKET-KOMMUNIKATION ====================
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

  // ==================== KONFIGURATIONS-HILFEN ====================
  isCardEnabled(cardName) {
    // Explizit prüfen, ob die Eigenschaft existiert und nicht `false` ist
    return this.config.display?.[cardName] !== false;
  },

  // ==================== CHART-FUNKTIONEN ====================
  destroyChart(forecastMode) {
    const chart = this.charts?.[forecastMode];
    if (chart) {
      chart.destroy();
      delete this.charts[forecastMode];
    }
  },

  createHorizontalGridPlugin() {
    return {
      id: "horizontalGridPlugin",
      afterDraw: (chart) => {
        const { ctx, scales } = chart;
        const gridLines = scales.x._gridLineItems;
        if (!gridLines || gridLines.length < 2) return;

        const firstX = gridLines[0].x1;
        const lastX = gridLines[gridLines.length - 1].x1;

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;

        scales.y.ticks.forEach((tick) => {
          const y = scales.y.getPixelForValue(tick.value);
          ctx.beginPath();
          ctx.moveTo(firstX, y);
          ctx.lineTo(lastX, y);
          ctx.stroke();
        });

        ctx.restore();
      }
    };
  },

  createChart(canvas, forecastMode) {
    // Fehlerbehandlung: Daten prüfen
    if (!this.weatherData?.current || !Array.isArray(this.weatherData.daily) || !Array.isArray(this.weatherData.hourly)) {
      console.error("MMM-WeatherChart: Ungültige Wetterdaten für Chart-Erstellung");
      return;
    }

    if (!this.charts) this.charts = {};
    this.destroyChart(forecastMode);

    // Prüfe, ob Chart.js geladen ist
    if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") {
      console.error("MMM-WeatherChart: Chart.js oder ChartDataLabels wurde nicht geladen.");
      return;
    }

    // Registriere DataLabels-Plugin (nur einmal)
    if (!this.chartDataLabelsRegistered) {
      Chart.register(ChartDataLabels);
      this.chartDataLabelsRegistered = true;
    }

    // Chart-Thema aus CSS-Variablen
    const chartTheme = {
      colorText: this.getCssVariable("--color-text", "#999"),
      colorTextDimmed: this.getCssVariable("--color-text-dimmed", "#666"),
      colorTextBright: this.getCssVariable("--color-text-bright", "#fff"),
      fontPrimary: this.getCssVariable("--font-primary", '"Roboto Condensed"'),
      fontSecondary: this.getCssVariable("--font-secondary", '"Roboto"'),
      fontSizeXsmall: this.getCssFontSize("--font-size-xsmall", "0.75rem"),
      fontSizeSmall: this.getCssFontSize("--font-size-small", "1rem")
    };

    // Konfiguration für Vorhersage
    const useHourlyForecast = forecastMode === "hourly";
    const requestedDays = Number(this.config.daily?.days) || 6;
    const hourlyInterval = Math.max(1, Number(this.config.hourly?.intervalHours) || 3);
    const hourlyPoints = Math.max(1, Number(this.config.hourly?.points) || 8);

    // Vorbereite Vorhersagedaten
    let forecastData;
    if (useHourlyForecast) {
      // Für stündliche Vorhersage: Wähle jeden n-ten Eintrag (hourlyInterval) aus,
      // beginnend ab Index 1 (nächste Stunde), um die angezeigten Zeitpunkte zu erhalten
      forecastData = this.weatherData.hourly
        .slice(1)  // Starte ab der nächsten Stunde (Index 1 = erste Vorhersagestunde)
        .filter((_, index) => index % hourlyInterval === 0)
        .slice(0, hourlyPoints);
    } else {
      forecastData = this.weatherData.daily.slice(0, Math.min(requestedDays, 8));
    }

    // Extrahiere Daten für Chart
    const labels = forecastData.map((entry) => {
      const date = new Date(entry.dt * 1000);
      return useHourlyForecast
        ? date.toLocaleTimeString(this.config.locale, { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString(this.config.locale, { weekday: "short" });
    });

    const temperatures = forecastData.map(entry =>
      useHourlyForecast ? Math.round(entry.temp) : Math.round(entry.temp.max)
    );
    const minimumTemperatures = forecastData.map(entry =>
      useHourlyForecast ? null : Math.round(entry.temp.min)
    );
    const precipitation = useHourlyForecast
      ? forecastData.map((_, k) => {
          // Für stündliche Vorhersage mit Intervallen: Summiere Niederschlag über das gesamte Intervall
          // forecastData wurde aus this.weatherData.hourly.slice(1) gefiltert (jeder hourlyInterval-te Eintrag)
          // k ist der Index in forecastData. Der zugehörige Index in this.weatherData.hourly ist:
          // originalIndex = 1 + k * hourlyInterval
          // Für die Summierung brauchen wir die Stunden von originalIndex bis originalIndex + hourlyInterval - 1
          const originalIndex = 1 + k * hourlyInterval;
          const startIndex = originalIndex;
          const endIndex = Math.min(originalIndex + hourlyInterval - 1, this.weatherData.hourly.length - 1);
          let sum = 0;
          for (let i = startIndex; i <= endIndex; i++) {
            const entry = this.weatherData.hourly[i];
            if (!entry) break;
            const rain = Number(entry.rain?.["1h"] || 0);
            const snow = Number(entry.snow?.["1h"] || 0);
            sum += rain + snow;
          }
          return Number(sum.toFixed(1));
        })
      : forecastData.map(entry => Number(entry.rain || 0) + Number(entry.snow || 0));
    const weatherIcons = forecastData.map(entry => entry.weather?.[0]?.icon || null);
    const weatherIds = forecastData.map(entry => Number(entry.weather?.[0]?.id) || null);
    const windSpeeds = forecastData.map(entry => Number(entry.wind_speed) || null);
    const windDirections = forecastData.map(entry => Number(entry.wind_deg) || null);

    // Berechne Achsenbereiche
    const allTemperatures = [...temperatures, ...minimumTemperatures.filter(t => t !== null)];
    const temperatureAxisMin = Math.min(...allTemperatures) - 4;
    const temperatureAxisMax = Math.max(...allTemperatures) + 4;
    const precipitationAxisMax = Math.max(5, Math.ceil(Math.max(...precipitation) * 5));

    // Einheiten
    const temperatureUnit = this.getTemperatureUnit();
    const windSpeedUnit = this.getWindSpeedUnitLabel();

    // Plugins
    const horizontalGridPlugin = this.createHorizontalGridPlugin();
    const weatherIconPlugin = MMMWeatherChartIconPlugin.create({
      moduleInstance: this,
      modulePath: this.file(""),
      labels,
      weatherIcons,
      weatherIds,
      windSpeeds,
      windDirections,
      windSpeedUnit,
      chartTheme
    });

    // Chart erstellen
    this.charts[forecastMode] = new Chart(canvas.getContext("2d"), {
      type: "line",
      plugins: [weatherIconPlugin, horizontalGridPlugin],
      data: {
        labels,
        datasets: [
          {
            id: "maximumTemperature",
            type: "line",
            label: useHourlyForecast ? `Temperatur (${temperatureUnit})` : `Maximaltemperatur (${temperatureUnit})`,
            data: temperatures,
            hidden: !this.config.display.maximumTemperature,
            borderWidth: 4,
            cubicInterpolationMode: "monotone",
            tension: 0.35,
            segment: {
              borderColor: (ctx) => {
                const avgTemp = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
                return this.getTemperatureColor(avgTemp);
              }
            },
            backgroundColor: "transparent",
            pointBackgroundColor: (ctx) => this.getTemperatureColor(ctx.raw),
            pointBorderColor: chartTheme.colorTextBright,
            pointBorderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: "y"
          },
          {
            id: "minimumTemperature",
            type: "line",
            label: `Minimaltemperatur (${temperatureUnit})`,
            data: minimumTemperatures,
            hidden: useHourlyForecast || !this.config.display.minimumTemperature,
            borderWidth: 3,
            borderDash: [7, 5],
            cubicInterpolationMode: "monotone",
            tension: 0.35,
            segment: {
              borderColor: (ctx) => {
                const avgTemp = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
                return this.getTemperatureColor(avgTemp);
              }
            },
            backgroundColor: "transparent",
            pointBackgroundColor: (ctx) => this.getTemperatureColor(ctx.raw),
            pointBorderColor: chartTheme.colorTextBright,
            pointBorderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: "y"
          },
          {
            id: "precipitation",
            type: "bar",
            label: "Niederschlag (mm)",
            data: precipitation,
            hidden: !this.config.display.precipitation,
            borderWidth: 1,
            borderColor: "rgba(54, 162, 235, 1)",
            backgroundColor: "rgba(54, 162, 235, 0.65)",
            borderRadius: 4,
            barPercentage: 0.65,
            categoryPercentage: 0.75,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        font: {
          family: `${chartTheme.fontPrimary}, sans-serif`,
          size: chartTheme.fontSizeSmall,
          weight: "400"
        },
        layout: { padding: { top: 86, right: 4, bottom: 4, left: 4 } },
        animation: { duration: this.config.animationDuration },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const isTemp = ctx.dataset.id.includes("Temperature");
                const unit = isTemp ? temperatureUnit : "mm";
                return `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`;
              }
            }
          },
          datalabels: {
            anchor: (ctx) => ctx.dataset.id === "precipitation" ? "start" : "center",
            align: (ctx) => ctx.dataset.id === "precipitation" ? "end" : "top",
            offset: (ctx) => ctx.dataset.id === "precipitation" ? 4 : 7,
            color: (ctx) => {
              if (ctx.dataset.id.includes("Temperature")) {
                return this.getTemperatureColor(ctx.dataset.data[ctx.dataIndex]);
              }
              return chartTheme.colorTextBright;
            },
            font: (ctx) => ({
              family: `${chartTheme.fontPrimary}, sans-serif`,
              size: chartTheme.fontSizeXsmall,
              weight: ctx.dataset.id === "precipitation" ? "400" : "700"
            }),
            formatter: (value, ctx) => {
              if (ctx.dataset.id.includes("Temperature")) return `${value} ${temperatureUnit}`;
              if (ctx.dataset.id === "precipitation") return value > 0 ? `${value} mm` : "";
              return "";
            }
          }
        },
        scales: {
          x: {
            type: "category",
            position: "bottom",
            offset: true,
            ticks: {
              display: false,
              color: chartTheme.colorTextBright,
              font: {
                family: `${chartTheme.fontPrimary}, sans-serif`,
                size: chartTheme.fontSizeXsmall,
                weight: "700"
              }
            },
            grid: { color: "rgba(255, 255, 255, 0.07)" }
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            min: temperatureAxisMin,
            max: temperatureAxisMax,
            ticks: {
              display: this.config.display.yAxisLabels,
              stepSize: 1,
              autoSkip: false,
              color: (ctx) => this.getTemperatureColor(ctx.tick.value),
              callback: (value) => {
                const rounded = Math.round(value);
                return rounded % 5 === 0 ? `${rounded} ${temperatureUnit}` : "";
              }
            },
            grid: { drawOnChartArea: false }
          },
          y1: {
            type: "linear",
            display: this.config.display.precipitation,
            position: "right",
            beginAtZero: true,
            max: precipitationAxisMax,
            ticks: {
              display: this.config.display.yAxisLabels,
              stepSize: 1,
              autoSkip: false,
              color: "rgba(80, 180, 255, 1)",
              callback: (value) => {
                const rounded = Math.round(value);
                return rounded % 5 === 0 ? `${rounded} mm` : "";
              }
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  },

  // ==================== DOM-ERSTELLUNG ====================
  createCurrentWeatherCard() {
    const currentWeatherUtils = MMMWeatherChartCurrentWeatherUtils;
    const current = this.weatherData.current;
    const weather = current.weather?.[0] || {};

    // Hauptcontainer
    const card = document.createElement("div");
    card.className = "weather-current-container";

    // Titel und Aktualisierungsinfo
    const title = document.createElement("div");
    title.className = "weather-current-title";
    title.textContent = "Aktuelles Wetter";
    card.appendChild(title);

    const updateInfo = this.createUpdateInfo();
    card.appendChild(updateInfo);

    // Primärer Wetterbereich (links)
    const primary = document.createElement("div");
    primary.className = "weather-current-primary";

    // Datum und Uhrzeit
    const dateTime = document.createElement("div");
    dateTime.className = "weather-current-date-time";

    const dateElement = document.createElement("div");
    dateElement.className = "weather-current-date";
    const timeElement = document.createElement("div");
    timeElement.className = "weather-current-time";

    dateTime.appendChild(dateElement);
    dateTime.appendChild(timeElement);

    // Speichere Referenzen für spätere Aktualisierungen
    this.currentDateTimeDateElement = dateElement;
    this.currentDateTimeTimeElement = timeElement;
    this.updateCurrentDateTime();

    primary.appendChild(dateTime);

    // Wettersymbol und Beschreibung
    const weatherIconCode = weather.icon || "01d";
    const weatherId = Number(weather.id);
    const weatherIconClass = this.getWeatherIconClass({ iconCode: weatherIconCode, weatherId });

    const weatherIcon = document.createElement("i");
    weatherIcon.className = `weather-current-icon wi ${weatherIconClass}`;
    weatherIcon.setAttribute("aria-hidden", "true");
    weatherIcon.setAttribute("title", weather.description || "Aktuelles Wetter");

    const weatherDescription = document.createElement("div");
    weatherDescription.className = "weather-current-description";
    weatherDescription.textContent = weather.description || "–";

    // Temperatur
    const temperatureBlock = document.createElement("div");
    temperatureBlock.className = "weather-current-temperature-block";

    const temperature = document.createElement("div");
    temperature.className = "weather-current-temperature";
    temperature.textContent = currentWeatherUtils.formatTemperature(
      current.temp,
      this.getTemperatureUnit()
    );

    temperatureBlock.appendChild(temperature);

    // Füge Elemente zum primären Bereich hinzu
    primary.appendChild(weatherIcon);
    primary.appendChild(weatherDescription);
    primary.appendChild(temperatureBlock);

    // Details-Bereich (rechts)
    const details = document.createElement("div");
    details.className = "weather-current-details";

    // Hilfsfunktion zum Erstellen von Detail-Elementen
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
      labelElement.className = "weather-current-detail-label dimmed";
      labelElement.textContent = label;

      const textBlock = document.createElement("div");
      textBlock.appendChild(valueElement);
      textBlock.appendChild(labelElement);

      detail.appendChild(iconElement);
      detail.appendChild(textBlock);

      return detail;
    };

    // Wind-Richtungsicon
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

    // Füge Details hinzu
    details.appendChild(createDetail("Luftfeuchtigkeit", `${Number(current.humidity) || 0} %`, "fa-solid fa-droplet"));
    details.appendChild(createDetail("Luftdruck", `${Number(current.pressure) || 0} hPa`, "fa-solid fa-gauge-high"));

    const displayWindSpeed = this.convertWindSpeed(current.wind_speed);
    const windSpeedText = Number.isFinite(displayWindSpeed)
      ? `${Math.round(displayWindSpeed)} ${this.getWindSpeedUnitLabel()}`
      : "–";
    details.appendChild(createDetail("Wind", windSpeedText, windIcon));

    details.appendChild(createDetail(
      "Sichtweite",
      currentWeatherUtils.formatVisibility(current.visibility),
      "fa-solid fa-eye"
    ));

    // Sonnenzeiten
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
      value.appendChild(
        document.createTextNode(` ${currentWeatherUtils.formatTime(timestamp, this.config.locale)}`)
      );

      sunTime.appendChild(value);
      return sunTime;
    };

    sunTimes.appendChild(createSunTime("fa-sun", current.sunrise));
    sunTimes.appendChild(createSunTime("fa-moon", current.sunset));

    // Windskala
    const windScale = this.createWindScale();

    // Füge alle Teile zur Karte hinzu
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

    // Verzögere die Chart-Erstellung, um sicherzustellen, dass das Canvas im DOM ist
    window.setTimeout(() => this.createChart(canvas, forecastMode), 0);

    return container;
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "weather-chart-wrapper";

    // Fehlerfall
    if (this.errorMessage && !this.weatherData) {
      wrapper.innerHTML = `<div class="weather-chart-error bright small">${this.errorMessage}</div>`;
      return wrapper;
    }

    // Ladezustand
    if (!this.weatherData?.current || !Array.isArray(this.weatherData.daily) || !Array.isArray(this.weatherData.hourly)) {
      wrapper.innerHTML = '<div class="weather-chart-loading dimmed small">Wetterdaten werden geladen …</div>';
      return wrapper;
    }

    // Prüfe, welche Karten aktiviert sind
    const showCurrentWeather = this.isCardEnabled("currentWeather");
    const showDailyForecast = this.isCardEnabled("dailyForecast");
    const showHourlyForecast = this.isCardEnabled("hourlyForecast");

    // Keine Karten aktiviert
    if (!showCurrentWeather && !showDailyForecast && !showHourlyForecast) {
      wrapper.innerHTML = '<div class="weather-chart-loading dimmed small">Keine Wetterkarten aktiviert.</div>';
      return wrapper;
    }

    // Zerstöre nicht benötigte Charts
    if (!showDailyForecast) this.destroyChart("daily");
    if (!showHourlyForecast) this.destroyChart("hourly");

    // Erstelle aktivierte Karten
    if (showCurrentWeather) wrapper.appendChild(this.createCurrentWeatherCard());
    if (showHourlyForecast) wrapper.appendChild(this.createForecastCard("Stündliche Vorhersage", "hourly"));
    if (showDailyForecast) wrapper.appendChild(this.createForecastCard("Tägliche Vorhersage", "daily"));

    return wrapper;
  },

  // ==================== TEMPERATUR-FUNKTIONEN ====================
  getTemperatureColor(temperature) {
    return MMMWeatherChartTemperatureUtils.getTemperatureColor(temperature, this.config.units);
  },

  getTemperatureUnit() {
    return MMMWeatherChartTemperatureUtils.getTemperatureUnit(this.config.units);
  },

  // ==================== WIND-FUNKTIONEN ====================
  getWindSpeedUnit() {
    const configuredUnit = this.config.windSpeedUnit;
    const validUnits = ["m/s", "km/h", "mph", "bft"];
    return validUnits.includes(configuredUnit)
      ? configuredUnit
      : MMMWeatherChartWindUtils.getWindSpeedUnit(this.config.units);
  },

  getWindSpeedUnitLabel() {
    return this.getWindSpeedUnit() === "bft" ? "Bft" : this.getWindSpeedUnit();
  },

  convertWindSpeed(speed) {
    const value = Number(speed);
    if (!Number.isFinite(value)) return null;

    const unit = this.getWindSpeedUnit();
    if (unit === "km/h") return value * 3.6;
    if (unit === "mph") return value * 2.23694;
    if (unit === "bft") {
      const beaufortUpperLimits = [0.2, 1.5, 3.3, 5.4, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
      const beaufortValue = beaufortUpperLimits.findIndex(upperLimit => value <= upperLimit);
      return beaufortValue === -1 ? 12 : beaufortValue;
    }
    return value; // Standardmäßig m/s
  },

  getWindColor(speed) {
    const windSpeedMs = Number(speed);
    if (!Number.isFinite(windSpeedMs)) return "#ffffff";

    const speedKmh = Math.max(0, windSpeedMs * 3.6);
    const colorStops = [
      { speed: 0, color: [255, 255, 255] },   // Weiß
      { speed: 20, color: [70, 150, 255] },   // Blau
      { speed: 40, color: [80, 200, 120] },   // Grün
      { speed: 60, color: [255, 220, 60] },   // Gelb
      { speed: 75, color: [255, 150, 40] },   // Orange
      { speed: 90, color: [235, 60, 50] },    // Rot
      { speed: 100, color: [180, 70, 220] }   // Violett
    ];

    if (speedKmh >= 100) return "rgb(180, 70, 220)";

    for (let i = 0; i < colorStops.length - 1; i++) {
      const lower = colorStops[i];
      const upper = colorStops[i + 1];
      if (speedKmh >= lower.speed && speedKmh <= upper.speed) {
        const progress = (speedKmh - lower.speed) / (upper.speed - lower.speed);
        const red = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * progress);
        const green = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * progress);
        const blue = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * progress);
        return `rgb(${red}, ${green}, ${blue})`;
      }
    }
    return "rgb(180, 70, 220)";
  },

  createWindScale() {
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
    const unit = this.getWindSpeedUnitLabel();

    const formatValue = (valueKmh) => {
      const valueMs = valueKmh / 3.6;
      const converted = this.convertWindSpeed(valueMs);
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
  },

  // ==================== WIND-UTILITIES ====================
  getWindDirection(degrees) {
    return MMMWeatherChartWindUtils.getWindDirection(degrees);
  },

  getWindArrow(degrees) {
    return MMMWeatherChartWindUtils.getWindArrow(degrees);
  }
});
