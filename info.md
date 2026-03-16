# Worm Weather Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge&logo=homeassistantcommunitystore&logoColor=white)](https://github.com/jamesmcginnis/worm-weather-card)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=worm-weather-card&category=plugin)

A Home Assistant Lovelace card with a live animated radar map and a full atmospheric weather canvas.

![Preview 1](preview1.png)
![Preview 2](preview2.png)
![Preview 3](preview3.png)
![Preview 4](preview4.png)
![Preview 5](preview5.png)

---

## 🙏 Built on the work of shpongledsummer

The animated sky — clouds, stars, moon, sun, rain, snow, lightning, fog, birds, aurora, shooting stars, comets, planes, dust motes, wind vapor, and heat shimmer — is based almost entirely on the exceptional **[Atmospheric Weather Card](https://github.com/shpongledsummer/atmospheric-weather-card)** by **[shpongledsummer](https://github.com/shpongledsummer)**.

This card would not exist without that work. Please visit and star the original project.

---

## What's included

- Condition-accurate atmospheric canvas that switches between day and night using your `sun.sun` entity
- Depth-layered volumetric clouds with rim highlights and parallax drift
- Rain, snow, lightning, fog and heat shimmer rendered for the appropriate conditions
- Live RainViewer radar animating the past ~2 hours of precipitation — pinch to zoom, drag to pan
- Forecast tab with clickable day tabs showing hourly breakdown per day
- Weather tab with current conditions, hourly strip, and condition tiles
- **Sci-Fi Effects** — four independently toggleable animations:
  - **UFO** — alien saucer glides in, a tiny alien waves from the dome, then it zooms off
  - **USS Enterprise** — NCC-1701 cruises across the full sky with glowing nacelle trails, then warps away
  - **Borg Cube** — locks a green cone tractor beam onto the Sun or Moon, turning it red and making it wobble. *Resistance is futile.*
  - **Stargate** — SG-1 kawoosh erupts, the gate holds open with a rippling blue liquid surface and rotating chevrons, then closes
- Clean visual editor — no YAML required

---

## Requirements

- Home Assistant 2023.9 or newer (for `weather.get_forecasts`)
- A `weather.*` entity

---

## Credits

Atmospheric animation engine: [shpongledsummer/atmospheric-weather-card](https://github.com/shpongledsummer/atmospheric-weather-card)
Radar: [RainViewer](https://www.rainviewer.com/)
Maps: [Leaflet.js](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/)
