(function (global) {
  "use strict";

  // ==================== KONSTANTEN ====================
  const ICON_SIZE = 22;
  const LABEL_OFFSET = 74;
  const ICON_OFFSET = 57;
  const WIND_OFFSET = 14;
  const MINIMUM_FONT_SIZE = 11;

  // Unicode-Zeichen der Weather-Icons-Schrift
  const WEATHER_ICON_GLYPHS = {
    "wi-day-sunny": "\uf00d",
    "wi-night-clear": "\uf02e",
    "wi-day-cloudy": "\uf002",
    "wi-night-alt-cloudy": "\uf086",
    "wi-cloud": "\uf041",
    "wi-cloudy": "\uf013",
    "wi-day-sprinkle": "\uf00b",
    "wi-night-alt-sprinkle": "\uf02b",
    "wi-showers": "\uf01c",
    "wi-day-showers": "\uf01a",
    "wi-night-alt-showers": "\uf029",
    "wi-day-rain": "\uf008",
    "wi-night-alt-rain": "\uf028",
    "wi-day-thunderstorm": "\uf010",
    "wi-night-alt-thunderstorm": "\uf02d",
    "wi-day-snow": "\uf00a",
    "wi-night-alt-snow": "\uf02a",
    "wi-sleet": "\uf0b5",
    "wi-day-fog": "\uf003",
    "wi-night-fog": "\uf04a"
  };

  // ==================== GLOBALER CACHE ====================
  // Wind-Pfeil-Bild (wird einmalig geladen)
  let windArrowImage = null;
  let windArrowImagePromise = null;

  // Weather-Font-Load-Promise (wird einmalig geladen)
  let weatherFontPromise = null;

  // ==================== HILFSFUNKTIONEN ====================
  const loadWindArrowImage = (modulePath) => {
    if (windArrowImagePromise) {
      return windArrowImagePromise;
    }

    windArrowImagePromise = new Promise((resolve) => {
      windArrowImage = new Image();
      windArrowImage.src = `${modulePath}icons/wind-arrow.svg`;
      windArrowImage.onload = () => resolve(windArrowImage);
      windArrowImage.onerror = () => {
        console.error("MMM-WeatherChart: Wind-Pfeil-Bild konnte nicht geladen werden.");
        resolve(null);
      };
    });

    return windArrowImagePromise;
  };

  const ensureWeatherFont = (fontSize) => {
    if (weatherFontPromise) {
      return weatherFontPromise;
    }

    if (document.fonts && typeof document.fonts.load === "function") {
      weatherFontPromise = document.fonts
        .load(`${fontSize}px weathericons`)
        .then(() => true)
        .catch(() => {
          console.warn("MMM-WeatherChart: Weather-Icons-Schriftart konnte nicht geladen werden.");
          return false;
        });
    } else {
      weatherFontPromise = Promise.resolve(true);
    }

    return weatherFontPromise;
  };

  // ==================== PLUGIN-FACTORY ====================
  const weatherIconPluginFactory = {
    create({
      moduleInstance,
      modulePath,
      labels,
      weatherIcons,
      weatherIds = [],
      windSpeeds,
      windDirections,
      windSpeedUnit,
      chartTheme
    }) {
      // Lade Wind-Pfeil-Bild (einmalig pro Modul)
      loadWindArrowImage(modulePath);

      // Lade Weather-Font (einmalig pro Modul)
      ensureWeatherFont(ICON_SIZE);

      // Cache für die Schriftart
      const fontCache = {
        label: null,
        weatherIcon: null,
        windInfo: null
      };

      // Hilfsfunktion zum Cachen der Schriftart
      const getCachedFont = (key, fontSize, fontFamily) => {
        if (!fontCache[key]) {
          fontCache[key] = `${fontSize}px ${fontFamily}, sans-serif`;
        }
        return fontCache[key];
      };

      // ==================== ZEICHNEN-FUNKTIONEN ====================
      const drawLabel = (chart, label, x, chartAreaTop, font) => {
        if (!moduleInstance.config.display.xAxisLabels || !label) {
          return;
        }

        chart.ctx.save();
        chart.ctx.fillStyle = chartTheme.colorTextBright;
        chart.ctx.font = font;
        chart.ctx.textAlign = "center";
        chart.ctx.textBaseline = "middle";
        chart.ctx.fillText(label, x, chartAreaTop - LABEL_OFFSET);
        chart.ctx.restore();
      };

      const drawWeatherIcon = (chart, iconCode, weatherId, x, chartAreaTop, font) => {
        if (!moduleInstance.config.display.weatherIcons || !iconCode) {
          return;
        }

        const iconClass = moduleInstance.getWeatherIconClass({ iconCode, weatherId });
        const glyph = WEATHER_ICON_GLYPHS[iconClass];

        if (!glyph) {
          return;
        }

        ensureWeatherFont(ICON_SIZE).then((fontReady) => {
          if (!fontReady) {
            return;
          }

          chart.ctx.save();
          chart.ctx.fillStyle = chartTheme.colorTextBright;
          chart.ctx.font = `${ICON_SIZE}px weathericons`;
          chart.ctx.textAlign = "center";
          chart.ctx.textBaseline = "middle";
          chart.ctx.fillText(glyph, x, chartAreaTop - ICON_OFFSET + ICON_SIZE / 2);
          chart.ctx.restore();
        });
      };

      const drawPreciseWindArrow = (chart, x, y, windDirection, windColor) => {
        const direction = Number(windDirection);

        if (!Number.isFinite(direction) || !windArrowImage || !windArrowImage.complete) {
          return;
        }

        // Windrichtung: +180°, damit der Pfeil in die Windrichtung zeigt
        const angle = (direction + 180) * Math.PI / 180;
        const arrowWidth = 11;
        const arrowHeight = 17;

        // Erstelle temporäres Canvas für die Farbänderung
        const arrowCanvas = document.createElement("canvas");
        arrowCanvas.width = arrowWidth;
        arrowCanvas.height = arrowHeight;

        const arrowContext = arrowCanvas.getContext("2d");
        arrowContext.drawImage(windArrowImage, 0, 0, arrowWidth, arrowHeight);
        arrowContext.globalCompositeOperation = "source-in";
        arrowContext.fillStyle = windColor;
        arrowContext.fillRect(0, 0, arrowWidth, arrowHeight);

        // Zeichne den Pfeil auf das Chart
        chart.ctx.save();
        chart.ctx.translate(x, y);
        chart.ctx.rotate(angle);
        chart.ctx.drawImage(
          arrowCanvas,
          -arrowWidth / 2,
          -arrowHeight / 2,
          arrowWidth,
          arrowHeight
        );
        chart.ctx.restore();
      };

      const drawWindInfo = (chart, x, windSpeed, windDirection, chartAreaTop, font) => {
        if (!moduleInstance.config.display.wind) {
          return;
        }

        const speed = Number(windSpeed);
        const direction = Number(windDirection);

        if (!Number.isFinite(speed) || !Number.isFinite(direction)) {
          return;
        }

        const windConfig = moduleInstance.config.wind || {};
        const windColor = moduleInstance.getWindColor(speed);
        const windParts = [];

        // Windrichtung (z. B. "N", "NO")
        if (windConfig.showDirection) {
          const directionText = moduleInstance.getWindDirection(direction);
          if (directionText) windParts.push(directionText);
        }

        // Windgeschwindigkeit (z. B. "15 km/h")
        if (windConfig.showSpeed) {
          const displaySpeed = moduleInstance.convertWindSpeed(speed);
          if (Number.isFinite(displaySpeed)) {
            windParts.push(`${Math.round(displaySpeed)} ${windSpeedUnit}`);
          }
        }

        const windText = windParts.join(" ");
        const hasArrow = windConfig.showArrow === true;
        const hasText = windText.length > 0;

        if (!hasArrow && !hasText) {
          return;
        }

        // Berechne Textbreite und Position
        chart.ctx.save();
        chart.ctx.font = font;
        chart.ctx.textAlign = "center";
        chart.ctx.textBaseline = "middle";

        const textWidth = hasText ? chart.ctx.measureText(windText).width : 0;
        const arrowBoxWidth = 14;
        const arrowGap = 6;
        const arrowYOffset = 3;
        const y = chartAreaTop - WIND_OFFSET;

        const groupWidth = (hasArrow ? arrowBoxWidth : 0) +
                          (hasArrow && hasText ? arrowGap : 0) +
                          (hasText ? textWidth : 0);
        const groupLeft = x - groupWidth / 2;

        // Zeichne Text
        if (hasText) {
          const textX = groupLeft + (hasArrow ? arrowBoxWidth + arrowGap : 0) + textWidth / 2;
          chart.ctx.fillStyle = chartTheme.colorTextDimmed;
          chart.ctx.fillText(windText, textX, y);
        }

        chart.ctx.restore();

        // Zeichne Pfeil
        if (hasArrow) {
          const arrowX = groupLeft + arrowBoxWidth / 2;
          drawPreciseWindArrow(chart, arrowX, y - arrowYOffset, direction, windColor);
        }
      };

      // ==================== PLUGIN-DEFINITION ====================
      return {
        id: "weatherIconPlugin",

        afterDraw(chart) {
          const xScale = chart.scales.x;
          const chartAreaTop = chart.chartArea.top;

          // Cache Schriftarten
          const labelFont = getCachedFont(
            "label",
            Math.max(MINIMUM_FONT_SIZE, chartTheme.fontSizeXsmall),
            chartTheme.fontPrimary
          );
          const windInfoFont = getCachedFont(
            "windInfo",
            Math.max(MINIMUM_FONT_SIZE, chartTheme.fontSizeXsmall - 1),
            chartTheme.fontPrimary
          );

          // Zeichne alle Icons, Labels und Wind-Infos
          weatherIcons.forEach((iconCode, index) => {
            const x = xScale.getPixelForValue(index);

            drawLabel(chart, labels[index], x, chartAreaTop, labelFont);
            drawWeatherIcon(chart, iconCode, weatherIds[index], x, chartAreaTop);
            drawWindInfo(
              chart,
              x,
              windSpeeds[index],
              windDirections[index],
              chartAreaTop,
              windInfoFont
            );
          });
        }
      };
    }
  };

  // ==================== GLOBALER EXPORT ====================
  global.MMMWeatherChartIconPlugin = weatherIconPluginFactory;
})(window);
