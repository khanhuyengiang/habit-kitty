# Habit Kitty

A habit tracker where every habit is a pixel cat. Do the habit, feed the cat. Skip it and the cat goes hungry.
Runs as a single web page and as an offline Android app (via Capacitor).

| Today | Room | Heatmap | Combined heatmap |
|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/today.png" width="200"> | <img src="docs/screenshots/room.png" width="200"> | <img src="docs/screenshots/heatmap.png" width="200"> | <img src="docs/screenshots/heatmap-combined.png" width="200"> |

| Memories | Mindful habits | Press and hold a cat | Adopt a cat |
|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/memories.png" width="200"> | <img src="docs/screenshots/habits.png" width="200"> | <img src="docs/screenshots/cat-menu.png" width="200"> | <img src="docs/screenshots/adopt.png" width="200"> |

## How it works

- Each cat stands for one habit. Feed it once a day for **+5 affection**. A day runs from **2am to 2am**.
- Every missed day costs **−15**. After 3 missed days in a row a *classic* cat **dies** (affection resets to 0);
  a *light-hearted* one **runs away** and can be won back once.
- Going away? Press and hold a cat to leave it with the **pet sitter** for up to 7 days
  (−5 a day, once every 30 days). Bring it home in time or it stays there.
- No longer want a habit? Press and hold the cat and **return it to the shelter**, with no penalty.
- Below 0 affection, cats only trust you with one cat at a time.
- You can keep up to **9 kitties**. From the 6th the app nags you to be responsible, and the 10th is blocked.
  **Settings → Unlimited kitty** lifts the limit, but every extra kitty needs three different "are you sure?" dialogs.
- **Kibbles** are one-off jobs worth up to 15 xp. Do them once, tick them off.
- **Mindful habits** repeat (daily, weekly, custom) and keep a history, worth up to 10 xp a day.
  A daily habit can become a kitty: it keeps its history, shown in teal.
- Kibbles and habits can always be done, but each kind pays out at most its cap per day.
- Every cat gets a different food each day (kibbles, wet food, fish, chicken, shrimp or meat).
  Each cat has its own look, which you can randomise when adopting.

- Every kitty is a girl or a boy (chosen when you adopt). Feeding earns a warm message, with special ones for first meals, streaks and milestones.
- **Achievements** (trophy in the Room): meals served, weeks of raising kitties, streaks, treats done, levels, diary pages.
- **Kitty diary** (book in the Room): what all your kitties got up to, day by day. Press and hold one kitty for its own.
- **Time travel** (Settings → Game options): mark or unmark treats and kibbles as done on any past day. Edits the record only, no xp.
- Reminders mention the habit, and on Android the notification icon is the kitty's face in its mood and fur colour
  (`npm run icons` redraws them after changing the pixel cats).
- See [CHANGELOG.md](CHANGELOG.md). The app shows what's new once after an update, and lists it in Settings → Change log.

## Tabs

1. **Room**: a cosy room that follows the clock. Awake cats wander and climb the cat tree, and sleep at night.
   Double-tap an awake cat for a heart. Cats with the sitter are away from home.
2. **Mindful**: switch between one-off **Kibbles** and repeating **Habits**. Press and hold an item to delete it.
3. **Today**: your cats, sorted into **Home**, **Sitter** and **Memories** (cats that died, ran away or went to the shelter, each with a condensed all-time heatmap from adoption to departure). Press and hold a cat for the sitter, its heatmap or the shelter.
4. **Heatmap**: a switch toggles between all kitties on one calendar (each day split into a slice per kitty) and one calendar per kitty. Habits are listed below. Dead and runaway cats are not shown.
5. **Diary**: a monthly calendar. Tap a day to write a page, pick a mood (a little pixel cat) and attach a photo from your gallery.
   Days with a page turn pink and the mood shows inside the day. Photos are shrunk to roughly 100-200 KB and kept on the device (not in saved text).

**Settings** is the gear icon at the top right. It holds feeding reminders, save and load, unlimited kitty, and how to use.

### Feeding reminders

Settings → Feeding reminders sends one notification a day at the time you pick (local time, follows time zone changes
whenever the app opens). A kitty that hasn't been fed today is named at random ("Mochi is hungry! Can you feed them?"),
not the same one two days running if others are hungry; if everyone is fed you get "All cats are fed and happy!".
Reminders are Android local notifications (permission asked when you switch it on), re-planned for 14 days ahead on every
app open and every change, with one id per date so they never duplicate, and they survive restarts and reboots.
In a browser they only fire while the page is open.

### Thoughts

In the room, a cat at home sometimes thinks of one that is with the sitter (more often the longer it is away), and rarely of
cats that passed away, ran away or recently came home. One bubble at a time, with rests between them, and always based on
the cat's current status.

Progress is stored on the device. Use **Settings → Save & load** to back it up (on Android, *Save to file*
opens the share sheet) or move it to another device.

## Development

Requires Node 22+.

```sh
npm install
npm test                # rules engine tests (vitest)
npm run build:web       # bundle the page to dist/habit-kitty.html and app-www/index.html
npm run play            # play the rules engine in the terminal
```

### Android app

Requires Android Studio (for the SDK and its bundled JDK).

```sh
npm run app:sync        # build the page and copy it into the Android project
npm run app:apk         # clean build, then copy the debug APK to dist/HabitKitty.apk
adb install -r dist/HabitKitty.apk
```

You can also open the `android/` folder in Android Studio and press Run after `npm run app:sync`.

### Project layout

| Path | What it is |
|---|---|
| `src/rules.ts` | Game rules: feeding, starvation, sitter, shelter, mindful tasks, levels. Pure functions, no UI. |
| `src/calendar.ts` | Week and month data for the dots and heatmaps. |
| `src/reminders.ts` | What each daily reminder says and when (pure, tested). |
| `src/thoughts.ts` | Who a cat thinks about, and how often (pure, tested). |
| `src/web/app.ts` | The UI: tabs, pixel sprites, room, dialogs, save and load. |
| `web/page.html` | Page markup and styles. |
| `web/build.js` | Bundles the page for the web and for the Android app. |
| `src/play.ts` | Terminal playground for the rules. |
| `android/` | Capacitor Android project. |

Build output (`dist/`, `app-www/`, the APK) and local files (`save.json`, `node_modules/`) are git-ignored.

### Playtesting time

**Settings → Playtest clock** skips ahead 3 hours or a day so you can see hunger, the sitter and cat deaths
without waiting. Tap **Now** to go back to real time; the skipped days still count.
