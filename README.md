# 🌤️ Worm Weather Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge&logo=homeassistantcommunitystore&logoColor=white)](https://github.com/jamesmcginnis/worm-weather-card)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=worm-weather-card&category=plugin)

A custom Home Assistant Lovelace card combining a beautiful atmospheric weather animation with a live radar map and detailed forecast views.

![Preview 1](preview1.png)
![Preview 2](preview2.png)
![Preview 3](preview3.png)
![Preview 4](preview4.png)
![Preview 5](preview5.png)

---

## 🙏 Attribution

The atmospheric animation engine at the heart of this card — including the sky gradients, organic cloud system, stars, moon, sun, rain, snow, lightning, fog, birds, wind vapor, aurora, shooting stars, comets, planes with contrails, dust motes, and heat shimmer — is based almost entirely on the outstanding work of **[shpongledsummer](https://github.com/shpongledsummer)** and their [Atmospheric Weather Card](https://github.com/shpongledsummer/atmospheric-weather-card).

Without that project, this card would not exist in anything close to its current form. Please go and star their repository.

---

## ✨ Features

- **Animated atmospheric canvas** — condition-accurate sky with birds, aurora, shooting stars, comets, planes with contrails, dust motes, heat shimmer, rain, snow, lightning and more
- **Live radar map** — powered by [RainViewer](https://www.rainviewer.com/), with smooth crossfade animation and a vivid TITAN colour scheme
- **Forecast tab** — day tabs with hourly breakdown per day; tap any day to see that day's hourly forecast
- **Weather tab** — compact current conditions with hourly strip and condition tiles (humidity, wind, pressure, UV, visibility, dew point, cloud cover, precipitation)
- **iOS-style visual editor** — configure everything without touching YAML
- **Light theme animation** — mini card always renders the bright daytime Atmospheric Weather Card look

---

## 📦 Installation

### HACS (recommended)

1. Open HACS → Frontend → Custom Repositories
2. Add `https://github.com/YOUR_USERNAME/worm-weather-card` as a **Lovelace** repository
3. Install **Worm Weather Card**
4. Reload your browser

### Manual

1. Copy `worm-weather-card.js` to `/config/www/`
2. In Home Assistant go to **Settings → Dashboards → Resources** and add:
   ```
   /local/worm-weather-card.js
   ```
   as a **JavaScript Module**
3. Reload your browser

---

## 🔧 Configuration

Add the card via the visual editor, or paste YAML directly:

```yaml
type: custom:worm-weather-card
weather_entity: weather.home
postcode: HU1 1AB          # optional — centres the radar map
country_code: GB            # optional — improves postcode geocoding
accent_color: "#5AC8FA"     # optional — highlight colour
temp_unit: "°C"             # °C or °F
wind_unit: km/h             # km/h, mph or m/s
default_view: compact       # compact, radar or weather
compact_height: 160         # height of the mini card in pixels
zoom_level: 7               # radar map default zoom (4–14)
radar_opacity: 0.7          # 0.0–1.0
animation_speed: 600        # milliseconds per radar frame
auto_animate: true          # start radar animation automatically
show_hourly: true           # hourly strip on Weather tab
show_details: true          # condition tiles on Weather tab
show_wind_on_compact: false # wind speed on mini card
```

---

## 🗺️ Radar

The radar layer is provided by [RainViewer](https://www.rainviewer.com/) and is free for personal use. The TITAN 2020 colour scheme is used for maximum contrast. Precipitation intensity runs from light green through yellow to deep red.

Postcode / ZIP geocoding is provided by the [Nominatim](https://nominatim.org/) service (OpenStreetMap). Without a postcode the map defaults to London.

---

## 📡 Forecast

This card uses the `weather.get_forecasts` WebSocket service introduced in Home Assistant 2023.9. Both hourly and daily forecasts are fetched simultaneously. If your integration only provides daily forecasts, each day tab will show a single summary row.

---

## 🤝 Credits

| | |
|---|---|
| **Atmospheric animations** | [shpongledsummer](https://github.com/shpongledsummer) — [atmospheric-weather-card](https://github.com/shpongledsummer/atmospheric-weather-card) |
| **Radar tiles** | [RainViewer](https://www.rainviewer.com/) |
| **Map tiles** | [OpenStreetMap](https://www.openstreetmap.org/) / [CartoCDN](https://carto.com/) |
| **Geocoding** | [Nominatim / OSM](https://nominatim.org/) |
| **Map library** | [Leaflet.js](https://leafletjs.com/) |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

The atmospheric animation code is derived from [atmospheric-weather-card](https://github.com/shpongledsummer/atmospheric-weather-card) by shpongledsummer, used with gratitude.
