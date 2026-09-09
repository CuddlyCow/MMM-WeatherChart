# MMM-WeatherChart

A [MagicMirror²](https://magicmirror.builders/) module that shows current weather conditions together with interactive hourly and daily forecast charts, powered by the [OpenWeather One Call API 3.0](https://openweathermap.org/api/one-call-3).

## Features

- **Current weather card** — icon, temperature, "feels like", weather description, humidity, dew point, pressure, wind speed/gusts with a colored direction arrow, UV index, and sunrise/sunset times drawn on a sun-position arc.
- **Wind speed legend** — a color scale that matches the colors used throughout the module (current weather, charts) to the wind speed.
- **Hourly forecast chart** — temperature, precipitation, wind speed/direction and weather icons per data point (built with [Chart.js](https://www.chartjs.org/)).
- **Daily forecast chart** — max/min temperature, precipitation and wind, one point per day.
- **Date/time card** with locale-aware formatting.
- Every card and chart series can be switched on or off individually.
- Local disk cache between updates, so the module reuses the last response instead of hitting the API again, and automatically falls back to the last known good data if a request fails.
- Metric, imperial or standard units, with a wind speed unit that can be set independently (m/s, km/h, mph or Beaufort).
- A single `locale` setting controls date/time formatting, the module's own UI text, **and** the language OpenWeather uses for weather descriptions — see [Localization](#localization).

## Prerequisites

- A working MagicMirror² installation.
- An OpenWeather account with **One Call API 3.0** enabled. This is a separate subscription from the classic weather API key — it has a free tier (1,000 calls/day), but you have to explicitly subscribe to it at [openweathermap.org/api/one-call-3](https://openweathermap.org/api/one-call-3). Requests will fail with an authorization error until that subscription is active (it can take a few minutes after signup to activate).
- The latitude/longitude of the location you want to display.

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/CuddlyCow/MMM-WeatherChart.git
cd MMM-WeatherChart
npm install
```

Then add the module to `config/config.js` (see [Configuration](#configuration)) and restart MagicMirror.

## Configuration

Minimal example:

```js
{
  module: "MMM-WeatherChart",
  position: "top_center",
  config: {
    lat: 52.30,
    lon: 7.16,
    appid: "YOUR_OPENWEATHER_API_KEY",
    units: "metric",
    locale: "en-US"
  }
}
```

A more complete example, showing hourly forecasts and trimming the daily forecast down to 4 days:

```js
{
  module: "MMM-WeatherChart",
  position: "top_center",
  config: {
    lat: 52.30,
    lon: 7.16,
    appid: "YOUR_OPENWEATHER_API_KEY",
    units: "metric",
    windSpeedUnit: "bft",
    locale: "en-US",

    display: {
      hourlyForecast: true
    },
    daily: {
      days: 4
    },
    hourly: {
      intervalHours: 3,
      points: 6
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `lat` | number | `null` (required) | Latitude of the location. |
| `lon` | number | `null` (required) | Longitude of the location. |
| `appid` | string | `null` (required) | Your OpenWeather API key (see [Prerequisites](#prerequisites)). |
| `units` | `"metric"` \| `"imperial"` \| `"standard"` | `"metric"` | Unit system passed to OpenWeather. Controls temperature (°C/°F/K) and the default wind speed unit. |
| `windSpeedUnit` | `"m/s"` \| `"km/h"` \| `"mph"` \| `"bft"` | `null` | Overrides the wind speed unit shown in the module. When `null`, the unit follows `units` (`m/s` for metric/standard, `mph` for imperial). |
| `updateInterval` | number (ms) | `1800000` (30 min) | How often to request fresh weather data. |
| `cacheMaxAge` | number (ms) | `1800000` (30 min) | Maximum age of a cached response before a new API request is made. |
| `locale` | BCP 47 locale string | `"de-DE"` | Drives date/time formatting, the module's own UI text and (unless `lang` is set) the language of OpenWeather's weather descriptions. See [Localization](#localization). |
| `lang` | string | `null` | Explicit OpenWeather description language (e.g. `"fr"`, `"es"`). Overrides the language derived from `locale`. Only affects the text coming from the API, not the module's own UI text. |
| `animationDuration` | number (ms) | `700` | Chart.js animation duration for the forecast charts. |
| `daily.days` | number | `6` | Number of days shown in the daily forecast chart (capped at 8, OpenWeather's maximum). |
| `hourly.intervalHours` | number | `3` | Spacing between shown hourly data points, in hours (e.g. `3` shows every third hour). |
| `hourly.points` | number | `8` | Number of points shown in the hourly forecast chart. |
| `display.dateTime` | boolean | `true` | Show the date/time card. |
| `display.currentWeather` | boolean | `true` | Show the current weather card. |
| `display.dailyForecast` | boolean | `true` | Show the daily forecast chart. |
| `display.hourlyForecast` | boolean | `false` | Show the hourly forecast chart. |
| `display.weatherIcons` | boolean | `true` | Show weather icons above the forecast chart data points. |
| `display.wind` | boolean | `true` | Show wind speed/direction above the forecast chart data points. |
| `display.maximumTemperature` | boolean | `true` | Show the (maximum) temperature line in the forecast charts. |
| `display.minimumTemperature` | boolean | `true` | Show the minimum temperature line in the daily forecast chart. |
| `display.precipitation` | boolean | `true` | Show the precipitation bars in the forecast charts. |
| `display.xAxisLabels` | boolean | `true` | Show the hour/weekday labels below the forecast chart data points. |
| `display.yAxisLabels` | boolean | `false` | Show numeric labels on the charts' Y axes. |
| `wind.showArrow` | boolean | `true` | Show the wind direction arrow above forecast chart data points. |
| `wind.showSpeed` | boolean | `true` | Show the wind speed text above forecast chart data points. |

## Localization

The module's own UI text (card titles, labels, error messages) is translated independently of MagicMirror²'s global `language` setting — it follows this module's own `locale` option instead. That means you can, for example, run your mirror with `language: "de"` globally while this module displays in English, simply by setting `locale: "en-US"` in its config.

The language is derived from the first two letters of `locale` (e.g. `"en-US"` → `en`, `"de-DE"` → `de`). Bundled translations currently cover German (`de`, the default) and English (`en`); an unsupported language code falls back to German. The same `locale` value is also used to:

- format the date/time card and sunrise/sunset times (`Intl.DateTimeFormat`, so it automatically follows the locale's usual 12-/24-hour convention),
- pick the language OpenWeather uses for its weather descriptions (e.g. "clear sky" vs. "Klarer Himmel"), unless you set `lang` explicitly.

To add another UI language, add a new dictionary object (copy the `en` block) to [`js/translations.js`](js/translations.js).

## Caching and error handling

`node_helper.js` fetches weather data on the configured `updateInterval` and writes the response to `weather-cache.json`. Before making a new request, it checks whether the cached data is still younger than `cacheMaxAge` and was fetched with the same `lat`/`lon`/`units`/language — if so, the cache is reused and no API call is made. If a request fails (missing API key, invalid coordinates, an HTTP error from OpenWeather, or an incomplete response) and no matching cache is available, the module shows a translated error message instead of stale or missing data.

## Module structure

| Path | Purpose |
|---|---|
| `MMM-WeatherChart.js` | Front-end module: builds the DOM, formats date/time, triggers chart creation, resolves translations. |
| `node_helper.js` | Back end: talks to the OpenWeather API and manages the on-disk cache. |
| `js/chart-builder.js` | Builds the Chart.js configuration for the forecast charts. |
| `js/weather-icon-plugin.js`, `js/weather-icon-utils.js` | Chart.js plugin that draws weather icons/wind info above data points, and weather-code → icon mapping. |
| `js/temperature-utils.js`, `js/wind-utils.js`, `js/color-utils.js` | Unit conversion and color-scale helpers shared across the UI and the charts. |
| `js/current-weather-utils.js`, `js/sun-path-utils.js` | Formatting helpers and sun-arc geometry for the current weather card. |
| `js/translations.js` | UI text dictionaries, keyed by language (see [Localization](#localization)). |
| `css/`, `font/`, `icons/` | The bundled [Weather Icons](https://erikflowers.github.io/weather-icons/) webfont and a custom wind-arrow icon. |

## Dependencies

- [Chart.js](https://www.chartjs.org/) and [chartjs-plugin-datalabels](https://chartjs-plugin-datalabels.netlify.app/) (installed via `npm install`).
- MagicMirror² core's bundled Font Awesome icons.
- The [Weather Icons](https://erikflowers.github.io/weather-icons/) webfont, bundled with this module.
