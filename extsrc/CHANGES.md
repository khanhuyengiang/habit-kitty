# Changes made so far

## Setup and bug fixes
- Pulled the latest side branch (`origin/test/kitty-gallery-icons-apk`, later the upstream with the real source). Nothing was merged.
- Android Studio showed the old app because the gitignored `app-www/` was stale. Fix: run `npm run app:sync` after every pull or code change. `npm install` was also needed (missing `html-to-image`).
- **Music autoplay** (`src/habit/sound.ts`): imports `Capacitor` and starts with `soundOk = Capacitor.isNativePlatform()`, so music plays when the app opens, not only after a tap.

## Running and jumping cats (from this folder's files)
- `extsrc/cats.ts`, `coats-run.ts`, `moves.ts` are your source art and engine, left untouched here.
- **Art** (`src/shared/coats-run.ts`, `src/shared/pixelcat.ts`)
  - `coats-run.ts` is copied from here (adds the `COAT_JUMP_*` coats).
  - `pixelcat.ts` gains 5-frame jump sprites per style (crouch, take-off, flight, descent, landing), `jumpSvg()`, and `spriteBox()` to place the paws on a point. Run sprites use the same helper. The old `RUN_POSE` is gone.
- **Engine** (`src/habit/moves.ts`): your `moves.ts` plus two changes:
  1. `high.maxRise` 56 -> 76, so the room's upper spots (y 107, 153, 172) are reachable (the biggest step is 74 px).
  2. New `speed` multiplier on `RUN_SPEED` (default 1).
- **Surfaces** (`src/habit/surfaces.ts`, new): groups kitty spots at similar heights (within 12 px) into walkable surfaces, so it follows spots edited in Kitty Gallery.
- **Room** (`src/habit/app.ts`)
  - Cats are moved per frame with `CatMover`: they run along a surface and jump between surfaces (low/medium/high picked automatically).
  - Wander only picks spots the cat can reach.
  - Zoomies run at 2.5x speed (`ZOOM_SPEED`).
  - The earlier CSS-transition movement is replaced.
- **CSS** (`web/page.html`): `.sprite.run, .sprite.jump` width rule; `.room .pet.running` has no animation or transition.
- **Removed:** my first attempt, `src/habit/gait.ts` and `gait.test.ts`.

## Tests
- New `src/habit/moves.test.ts`: jump mode choice, running, jumping, frame order, no-route, speed, forced mode, every room spot reachable from every other, surface grouping.
- `src/shared/pixelcat.test.ts`: run and jump sprite checks (frame counts, flip, paw line, centre).
- 346 tests pass.

## Not done / open
- Verified only in headless Edge, not on a device.
- Phone bug (Garden -> Kitty keeps showing outdoors; Stray tab not updating): not reproduced, no fix yet.
- Nothing committed. `android/*.gradle` changes came from sync, not intentional.
- The folder was renamed `outsrc` -> `extsrc`.
