# Solmarina Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kroco365/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kroco365/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

**Solmarina Heat** — Rico Vega, wheelman for the Marlin Crew, takes five jobs across
the sun-soaked coastal city of Solmarina: move a package from the Portside Docks,
steal a teal Comet and lose the heat, scoop up five drops of crew cash, stop a
courier van, and pull off one last getaway at three stars.

## What is in the game

- A living city: a road grid with traffic that drives it, pedestrians on the
  sidewalks, a park, a beach and the water at the south edge.
- On foot and by car: walk, run, jack any car (E) and drive it — sedans, taxis,
  sports cars, trucks and vans, each with its own handling.
- A wanted level (0–5 stars) with police cruisers that chase, ram and bust you.
- Five story missions with markers, timers, rewards and a save in localStorage.
- Combat: punch (F) and a pistol (mouse aim, click to shoot) with ammo.
- A HUD with a minimap, health, money, wanted stars and the mission line.
- Synthesized sound (WebAudio, no audio files): engine hum, sirens, shots, jingles.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD to move and drive, E to enter or steal a car, mouse to aim, click to shoot,
F to punch, M to mute, P to pause. `?seed=N` fixes the traffic pattern;
`?shot=cover|mission|foot|title` stages a screenshot scene.

## How it is built

Plain static files under `game/` (no build step, no network request), a Node 22
`main.ts` at the root that hands the game in with the vendored make.fun library,
and four real in-browser screenshots in `screenshots/`. Everything — the city,
the characters, the cars, the story, the art and the sounds — is original.
