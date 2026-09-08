(function (global) {
  "use strict";

  // ==================== CHART-PLUGINS ====================
  const createHorizontalGridPlugin = () => ({
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
  });

  // ==================== CHART-BUILDER ====================
  const chartBuilder = {
    /**
     * Baut das Vorhersage-Diagramm (Chart.js) für den gegebenen Modus.
     * Erwartet, dass Wetterdaten geprüft, Chart.js/ChartDataLabels geladen
     * und ein evtl. vorhandenes Diagramm für `forecastMode` bereits zerstört wurden.
     * @param {object} moduleInstance - Instanz des Moduls (für Konfiguration, `this.file()` und Delegations-Methoden).
     * @param {HTMLCanvasElement} canvas - Ziel-Canvas für das Diagramm.
     * @param {string} forecastMode - "daily" oder "hourly".
     * @returns {Chart} Die erstellte Chart.js-Instanz.
     */
    createChart(moduleInstance, canvas, forecastMode) {
      const chartTheme = {
        colorText: moduleInstance.getCssVariable("--color-text", "#999"),
        colorTextDimmed: moduleInstance.getCssVariable("--color-text-dimmed", "#666"),
        colorTextBright: moduleInstance.getCssVariable("--color-text-bright", "#fff"),
        fontPrimary: moduleInstance.getCssVariable("--font-primary", '"Roboto Condensed"'),
        fontSecondary: moduleInstance.getCssVariable("--font-secondary", '"Roboto"'),
        fontSizeXsmall: moduleInstance.getCssFontSize("--font-size-xsmall", "0.75rem"),
        fontSizeSmall: moduleInstance.getCssFontSize("--font-size-small", "1rem")
      };

      const useHourlyForecast = forecastMode === "hourly";
      const requestedDays = Number(moduleInstance.config.daily?.days) || 6;
      const hourlyInterval = Math.max(1, Number(moduleInstance.config.hourly?.intervalHours) || 3);
      const hourlyPoints = Math.max(1, Number(moduleInstance.config.hourly?.points) || 8);

      let forecastData;
      if (useHourlyForecast) {
        forecastData = moduleInstance.weatherData.hourly
          .slice(1)
          .filter((_, index) => index % hourlyInterval === 0)
          .slice(0, hourlyPoints);
      } else {
        forecastData = moduleInstance.weatherData.daily.slice(0, Math.min(requestedDays, 8));
      }

      const labels = forecastData.map((entry) => {
        const date = new Date(entry.dt * 1000);
        return useHourlyForecast
          ? date.toLocaleTimeString(moduleInstance.config.locale, { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString(moduleInstance.config.locale, { weekday: "short" });
      });

      const temperatures = forecastData.map(entry =>
        useHourlyForecast ? Math.round(entry.temp) : Math.round(entry.temp.max)
      );
      const minimumTemperatures = forecastData.map(entry =>
        useHourlyForecast ? null : Math.round(entry.temp.min)
      );
      const precipitation = useHourlyForecast
        ? forecastData.map((_, k) => {
            const originalIndex = 1 + k * hourlyInterval;
            const startIndex = originalIndex;
            const endIndex = Math.min(originalIndex + hourlyInterval - 1, moduleInstance.weatherData.hourly.length - 1);
            let sum = 0;
            for (let i = startIndex; i <= endIndex; i++) {
              const entry = moduleInstance.weatherData.hourly[i];
              if (!entry) break;
              const rain = Number(entry.rain?.["1h"] || 0);
              const snow = Number(entry.snow?.["1h"] || 0);
              sum += rain + snow;
            }
            return Number(sum.toFixed(1));
          })
        : forecastData.map(entry => Number((Number(entry.rain || 0) + Number(entry.snow || 0)).toFixed(1)));

      const weatherIcons = forecastData.map(entry => entry.weather?.[0]?.icon || null);
      const weatherIds = forecastData.map(entry => Number(entry.weather?.[0]?.id) || null);
      const windSpeeds = forecastData.map(entry => Number(entry.wind_speed) || null);
      const windDirections = forecastData.map(entry => Number(entry.wind_deg) || null);

      const allTemperatures = [...temperatures, ...minimumTemperatures.filter(t => t !== null)];
      const temperatureAxisMin = Math.min(...allTemperatures) - 4;
      const temperatureAxisMax = Math.max(...allTemperatures) + 4;
      const precipitationAxisMax = Math.max(5, Math.ceil(Math.max(...precipitation) * 5));

      const temperatureUnit = moduleInstance.getTemperatureUnit();
      const windSpeedUnit = moduleInstance.getWindSpeedUnitLabel();

      const horizontalGridPlugin = createHorizontalGridPlugin();
      const weatherIconPlugin = MMMWeatherChartIconPlugin.create({
        moduleInstance,
        modulePath: moduleInstance.file(""),
        labels,
        weatherIcons,
        weatherIds,
        windSpeeds,
        windDirections,
        windSpeedUnit,
        chartTheme
      });

      return new Chart(canvas.getContext("2d"), {
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
              hidden: !moduleInstance.isCardEnabled("maximumTemperature"),
              borderWidth: 4,
              cubicInterpolationMode: "monotone",
              tension: 0.35,
              segment: {
                borderColor: (ctx) => {
                  const avgTemp = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
                  return moduleInstance.getTemperatureColor(avgTemp);
                }
              },
              backgroundColor: "transparent",
              pointBackgroundColor: (ctx) => moduleInstance.getTemperatureColor(ctx.raw),
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
              hidden: useHourlyForecast || !moduleInstance.isCardEnabled("minimumTemperature"),
              borderWidth: 3,
              borderDash: [7, 5],
              cubicInterpolationMode: "monotone",
              tension: 0.35,
              segment: {
                borderColor: (ctx) => {
                  const avgTemp = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
                  return moduleInstance.getTemperatureColor(avgTemp);
                }
              },
              backgroundColor: "transparent",
              pointBackgroundColor: (ctx) => moduleInstance.getTemperatureColor(ctx.raw),
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
              hidden: !moduleInstance.isCardEnabled("precipitation"),
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
          animation: { duration: moduleInstance.config.animationDuration },
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
                  return moduleInstance.getTemperatureColor(ctx.dataset.data[ctx.dataIndex]);
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
                display: moduleInstance.isCardEnabled("yAxisLabels"),
                stepSize: 1,
                autoSkip: false,
                color: (ctx) => moduleInstance.getTemperatureColor(ctx.tick.value),
                callback: (value) => {
                  const rounded = Math.round(value);
                  return rounded % 5 === 0 ? `${rounded} ${temperatureUnit}` : "";
                }
              },
              grid: { drawOnChartArea: false }
            },
            y1: {
              type: "linear",
              display: moduleInstance.isCardEnabled("precipitation"),
              position: "right",
              beginAtZero: true,
              max: precipitationAxisMax,
              ticks: {
                display: moduleInstance.isCardEnabled("yAxisLabels"),
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
    }
  };

  global.MMMWeatherChartBuilder = chartBuilder;
})(window);
