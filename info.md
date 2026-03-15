# Worm Weather Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge&logo=homeassistantcommunitystore&logoColor=white)](https://github.com/jamesmcginnis/worm-weather-card)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=worm-weather-card&category=plugin)

![Preview 1](preview1.png)
![Preview 2](preview2.png)
![Preview 3](preview3.png)
![Preview 4](preview4.png)
![Preview 5](preview5.png)

A Home Assistant Lovelace card with a live radar map and atmospheric weather animations.

---

## 🙏 Built on the work of shpongledsummer

The animated sky — clouds, stars, moon, sun, rain, snow, lightning, fog, birds, aurora, shooting stars, comets, planes, dust motes, wind vapor, and heat shimmer — is based almost entirely on the exceptional **[Atmospheric Weather Card](https://github.com/shpongledsummer/atmospheric-weather-card)** by **[shpongledsummer](https://github.com/shpongledsummer)**.

This card would not exist without that work. Please visit and star the original project.

---

## What's included

- Condition-accurate animated canvas (light theme, matching the original Atmospheric Weather Card)
- Live RainViewer radar with smooth crossfade animation
- Forecast tab with clickable day tabs — tap any day for its hourly breakdown
- Weather tab with hourly strip and condition tiles
- Postcode / ZIP geocoding to centre the radar map on your location
- iOS-style visual editor — no YAML required

---

## Requirements

- Home Assistant 2023.9 or newer (for `weather.get_forecasts`)
- A `weather.*` entity (the built-in Home Assistant weather integration works perfectly)

---

## Credits

Atmospheric animation engine: [shpongledsummer/atmospheric-weather-card](https://github.com/shpongledsummer/atmospheric-weather-card)
Radar: [RainViewer](https://www.rainviewer.com/)
Maps: [Leaflet.js](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/)
