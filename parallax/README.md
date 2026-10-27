# PARALLAX: The Room That Remembers

A cinematic first-person 3D escape room for the browser, built with **three.js + TypeScript + Vite**.
Everything — geometry, textures, shaders, music and sound — is generated procedurally at runtime, so the
game has no image or audio assets and needs no network access once installed.

You wake inside the Memory Engine hall. The room exists twice: **PRESENT** (2026, a damaged, abandoned
chamber) and **ECHO** (1956, the same chamber in its original operating state). Switch between them with
`Q`. What you change in one timeline carries into the other, and every puzzle depends on how the two relate.

## Run it

Requires Node.js 18 or newer.

```bash
cd parallax
npm install
npm run dev          # http://localhost:5173
```

Production build and local preview:

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Look | Mouse (click the view to capture the pointer) | Drag on the right side |
| Move | `W` `A` `S` `D` or arrow keys, `Shift` to walk faster | Drag on the left side |
| Interact | `E` (or `Enter`) | `E` button |
| Shift between Present and Echo | `Q` | `Q` button |
| Journal (clues, items, symbols) | `Tab` or `J` | `J` button |
| Pause / release the mouse | `Esc` | Pause button |

If the browser refuses pointer lock (some embedded frames do), the game falls back to click-and-drag looking.

## The five puzzles

| | Puzzle | What the two timelines contribute |
|---|---|---|
| A | **The Shadow Archive** — three cut-metal plates on turntables and three half-engraved figures on the west wall | The engravings exist only in the present; the archive lamp works only in the echo. Turn each plate so its shadow completes its figure, then look in the echo. |
| B | **The Memory Engine** — three rings with eight stations each, suspended above the dais | The echo shows the original calibration of two rings and a plate stating the law that relates them; the hidden third ring must be inferred. Rings can only be turned in the present, after the missing segment from A is fitted. |
| C | **The Impossible Bridge** — a span that is rubble in the present and whole in the echo | The phase anchor locks the bridge to "the moment of engagement": it must be engaged in the echo. The echo's quarantine field still blocks the far end, so the crossing happens in the present. |
| D | **The Voice That Arrived Early** — a 1956 recording of five sound signatures | Two machines only run in the echo, two only exist as damage in the present, and one sound is the keepsake you chose at the start. Each signature has a distinct rhythm and pitch contour, shown visually and in captions as well as heard. |
| E | **The Final Parallax** — the steering console for the engine | Seat your keepsake in the core, enter the four symbols as the past holds them (the reverse of the order you learned them), turn the engine towards what the room kept (visible only in the echo), and activate it in the present. |

Shifting is refused where the target timeline has no floor or something solid, so the player can never fall
off the bridge or get stuck in the quarantine field. Wrong answers change the machines' state and explain
what happened; nothing is random and nothing can be bypassed.

Documented solutions live next to the rules in `src/game/puzzles/*.ts`.

## Project layout

```
src/
  game/        rules only, no rendering — fully unit-tested
    puzzles/   one module per puzzle: data, checks and the documented solution
    logic.ts   GameLogic: every action, precondition and event
    layout.ts  floor plan, collision and safe-shift rules
    state.ts   initial state, versioned save/load with validation
    texts.ts   all in-world writing (present and echo versions)
  world/       three.js scene: architecture, engine, archive, bridge, north platform
    temporal.ts  data-driven Present/Echo system (poses, fades, materials, lights)
    effects.ts   renderer, quality presets, bloom + grading shader (ripple, heat haze, vignette, grain)
  player/      first-person controller (pointer lock, drag-look fallback, touch)
  audio/       procedural Web Audio engine with positional sound and reverb
  cinema/      camera director: intro, close-ups, shake, ending
  ui/          HUD, journal and puzzle panels
e2e/playthrough.cjs   Playwright playthrough from a fresh save to the completion screen
```

## Tests

```bash
npm test             # Vitest: puzzle rules, invalid inputs, timeline safety, saves, full logical playthroughs
npm run typecheck
npm run build && npm run test:e2e   # browser playthrough (needs Playwright with Chromium)
```

The browser test starts `vite preview` itself and plays the whole game through the real input path:
crosshair raycasts, `E`, `Q`, `W`, panels, a reload with Continue, the ending and the completion screen.
It also checks that audio is audible and that the ambience cross-fades between timelines.
Options: `QUALITY=low|medium|high`, `SHOTS=<dir>` to save screenshots, `TIMESCALE` to speed up simulated
time on slow software renderers.

## Settings and quality

The settings menu has master, music, ambience and effects volume, mouse sensitivity, invert-Y, sound
captions, reduce motion and a graphics preset:

- **High** — full resolution, bloom, grading pass, shadows from the archive lamp and the engine downlight.
- **Medium** — lower resolution, bloom, grading pass, archive shadows only.
- **Low** — no post-processing; the archive shadows are drawn as deterministic decals and the timeline
  ripple becomes a CSS overlay. Chosen automatically when WebGL 2 is unavailable.

`?quality=low|medium|high` in the URL overrides the saved preset for one session.
Progress saves automatically to `localStorage` and survives reloads.

## Known limitations

- Collision is a custom floor-plan system rather than a physics engine; it covers everything the
  puzzles need (walls, props, gate, chasm, bridge, quarantine field) but there is no jumping or physics props.
- Reflections come from an environment map, not real-time screen-space reflections.
- The game is in Arabic (right-to-left interface, Arabic writing in the world). The Amiri and IBM Plex
  Sans Arabic fonts load from Google Fonts; offline, the system's Arabic fonts are used instead.
