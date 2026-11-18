# Palmera Bay — 3D open-world crime: 10 story jobs, roadblocks, helicopter police, radio, shops & saves

[![Make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/adhityanaufal26/gta6-01-v4/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/adhityanaufal26/gta6-01-v4/reward.svg)](https://make.fun/bounty/gta6-01)

Palmera Bay is a 3D open-world crime game that runs in a desktop browser from static files, played with keyboard and mouse. You are Jax Marlow, a newcomer driver in a sun-soaked coastal city. Fixer Marla Voss and the Bayline Crew have 10 story jobs for you — from a first getaway drive to a two-stage heist finale — across 16 named districts, with traffic, pedestrians, a 0–5 star wanted system, helicopter police, roadblocks, a car radio, weapon shops, a garage, and a safehouse that saves your game.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network request at runtime.

## Controls

- **WASD** move / drive · **Shift** run · **E** enter, exit & steal car
- **Mouse aim, click** shoot · **Q / 1–5** switch weapon
- **R** cycle radio stations · **Space** handbrake · **N** nitro (after buying the kit)
- **C** camera · **M** minimap zoom · **F** interact at shops / safehouse / garage
- **J** next story job · **X** mute · **Esc** pause

## Systems

- **World:** 16 named districts, grid streets with sidewalks, procedural low-poly buildings, palm trees, beach and boardwalk, a port with containers and cranes, Solano Park.
- **Driving:** 6 car classes (compact, sedan, muscle, SUV, sports, van) with arcade physics, handbrake and nitro; dense traffic with lane following; pedestrians who flee gunfire and crashes.
- **Stealing:** walk up to any parked or traffic car and press E to take it.
- **Wanted 0–5 stars:** stealing, hitting pedestrians and shooting raise it. Police cars chase and ram, foot officers pursue, a police helicopter with a searchlight joins at 4–5 stars, and police set up roadblocks ahead of you at 4–5 stars. Heat decays when you break line of sight; the safehouse and Spray Works clear it.
- **10 story jobs:** First Wheels, Sunset Run, Tail the Courier, Three for the Shop (chop-shop chain), Fare Game (taxi), Package Run, Dragnet, Roadblock Breaker (5-star escape), Dockside Score, and The Big One (two-stage heist finale). Each has a briefing, waypoints, pass/fail and a payout with an S–D grade.
- **Side content:** taxi fares, 25 collectible packages, 8 stunt jumps.
- **Combat:** 5 weapons (P9 Sidearm, Vesper SMG, Street Sweeper, Longshot Rifle, Hawkeye Marksman), ammo and health pickups.
- **Radio:** 3 switchable in-car stations (synthwave, latin groove, talk/news) with procedural WebAudio loops and DJ lines.
- **Shops:** Harbor Arms sells weapons, ammo, medkits and armor; Voss Garage sells engine tunes, car armor, paint and a nitro kit; the Marina Safehouse saves and clears wanted.
- **HUD:** cash, health, armor, wanted stars, weapon + ammo, speed, mission objective, clock, live minimap, radio display, collectibles count.
- **Save:** localStorage save (story progress, cash, garage, collectibles, best score, settings) with CONTINUE on the title screen.

## Files

- `game/index.html` — page, HUD and menus
- `game/src/main.js` — game loop, player, camera, input, shot modes
- `game/src/city.js` — districts, buildings, palms, beach, port, markers
- `game/src/vehicles.js` — car classes, physics, traffic
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — chase, helicopter, roadblocks
- `game/src/missions.js` — 10 story jobs, taxi, collectibles, jumps
- `game/src/combat.js` — weapons
- `game/src/radio.js` — radio stations
- `game/src/shops.js` — shop, garage, safehouse, spray
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — procedural WebAudio
- `game/src/save.js` — localStorage save/load
- `game/vendor/three.min.js` — vendored three.js

Built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01). All names, characters, places and music are original.
