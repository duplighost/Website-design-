Qualiacology site package — toys homepage + No Moon v313 sun-only patch

UPLOAD CONTENTS TO SITE ROOT.
This package uses qualiacology-with-toys.zip as the base site so the homepage keeps the Little Toys section and includes:
  - /glide/
  - /luma/
  - existing Qualiacology pages

No Moon was replaced with no_moon_v313_sun_only_from_deployed.zip, made from the currently deployed No Moon base.

No Moon v313 sun-only scope:
  - fixes sunlight only
  - ordinary Sun-route rooms use steady open-light brightness (0.85)
  - cleared Sun-route rooms still burn in open sunlight
  - shade remains safe and drains heat
  - entry rooms and post-Sun victory/crater/sigil states remain safe
  - sun overlays/heat meter render from current room sun flags, not only stale _v39MoonPathActive
  - adds console helper: noMoonSunAudit()

What this package intentionally does NOT include:
  - no door coating fix
  - no minimap rewrite
  - no boss marker/circle change
  - no max-HP pressure change
  - no draft/boss HUD-map fix
  - no route/ending redesign

Structure notes:
  - /index.html is the toys homepage from qualiacology-with-toys.zip
  - /no-moon/index.html and /no-moon/game_inline.js are from v313
  - /glide/ is present and matches the provided glide-v10.zip
  - /luma/ is preserved from qualiacology-with-toys.zip
  - _redirects preserves the toy routes /glide, /fly, /luma, and /visualizer

Quick checks after upload:
  1. Visit / and confirm Little Toys shows Glide and LUMA.
  2. Visit /glide/ and /luma/.
  3. Visit /no-moon/.
  4. In a sunny No Moon room, test: light -> shade -> light again.
  5. In console, run noMoonSunAudit() while standing in sunlight.
