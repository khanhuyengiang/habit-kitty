# Itty Bitty Kitty

A cozy pixel-cat app with a few mini-apps: Habit Kitty, Kitty Journal, Kitty Achievement, Kitty Mart and Kitty Gallery.

**Habit Kitty** is a habit tracker where every habit is a pixel cat. Do the habit, feed the cat. Skip it and the cat goes hungry.
It lives in a cozy pastel pixel world (pink, baby blue and lavender, with a pixel grid behind everything) and runs as a
single web page and as an offline Android app (via Capacitor).

| Room | Today | Treats | Heatmap |
|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/room.png" width="170"> | <img src="docs/screenshots/today.png" width="170"> | <img src="docs/screenshots/treats.png" width="170"> | <img src="docs/screenshots/heatmap.png" width="170"> |

## How it works

- Each cat stands for one habit. Feed it once a day for **+5 affection**. A day runs from **2am to 2am** by default; you can move its start (up to noon) in Settings → Your day.
- Every missed day costs **−15**. After 3 missed days in a row a *classic* cat **dies** (affection resets to 0);
  a *light-hearted* one **runs away** and can be won back once.
- Going away? Press and hold a cat to leave it with the **pet sitter** for up to 7 days
  (−5 a day, once every 30 days). Bring it home in time or it stays there.
- No longer want a habit? Press and hold the cat and **return it to the shelter**, with no penalty.
- Below 0 affection, cats only trust you with one cat at a time.
- You can keep up to **9 kitties**. From the 6th the app nags you to be responsible, and the 10th is blocked.
  **Settings → Unlimited kitty** lifts the limit, but every extra kitty needs three different "are you sure?" dialogs.
- **Treats** are one-off jobs worth up to 15 XP. Do them once, tick them off.
- **Stray kitties** (mindful habits) repeat (daily, weekly, custom) and keep a history, worth up to 10 XP a day. You feed a stray by doing its habit,
  and nothing bad happens when you skip a day. A daily stray can be **adopted** as a kitty: it keeps its history, shown in teal.
- Changed your mind? Press and hold a kitty, then **Release to the stray colony**: it becomes a daily stray again, with no penalty, and can be adopted back as the same kitty.
- Treats and strays can always be done, but each kind pays out at most its cap per day.
- Everything is drawn on one pixel grid, so kitties, icons, food and the room share a single pixel size.
- Every cat gets a different food each day, picked from the sticker icons marked as cat food (draw your own in Kitty Gallery and tick **Can kitty eat this?**).
  Each cat has its own look, which you can randomise when adopting.

- Every kitty is a girl or a boy (chosen when you adopt). Feeding earns a warm message, with special ones for first meals, streaks and milestones.
- **Accomplishments** (trophy in the Room): meals served, weeks of raising kitties, streaks, strays fed and treats done, levels, diary pages.
- **Kitty diary** (book in the Room): what all your kitties got up to, day by day. Press and hold one kitty for its own.
- **Time travel** (Settings → Habit Kitty → Game options): mark or unmark kitties, stray kitties and treats on any past day. Affection and hunger are worked out again from the record.
- Reminders mention the habit, and on Android the notification icon is the kitty's face in its mood and fur colour
  (`npm run icons` redraws them after changing the pixel cats).
- **Sound** (Settings → Sound): background music, kitties meowing in the room, and purrs or meows when you pet one. Each has its own volume.
- See [CHANGELOG.md](CHANGELOG.md). The app shows what's new once after an update, and lists it in Settings → Change log.

## Habit Kitty's sections

A row of buttons at the top: **Kitty**, **Stray**, **Treats**, and, only while they apply, **Pet sitter** (a kitty is with the sitter) and **Memory** (a kitty died, ran away or went to the shelter).

- **Kitty** has three views: **List** (your cats at home, with the week and a feed button), the **Cosy Room** (a room that follows the clock: awake cats wander and climb the cat tree, and sleep at night; double-tap an awake cat for a heart) and **Heatmap** (all kitties on one calendar, each day split into a slice per kitty).
- **Stray** has **List** (repeating stray kitties, which are habits), the **Garden** (a stray that is due to be fed today turns up with an 80% chance, and the others with 30%, every 6 hours; a stray you feed in the garden has a 50% chance of wandering off again) and **Heatmap** (all strays on one calendar).
- **Treats** are one-off jobs.
- **Pet sitter** lists the kitties away with the sitter, and **Memory** the ones that left, each with a condensed all-time heatmap from adoption to departure.
- **Press and hold** a kitty, a stray or a treat for its menu: the same layout for all three, with its **Heatmap** (and a kitty's **Diary**) and **Options** (the main action, renames, **Time travel**, then the way out: pet sitter, shelter or release for a kitty; adopt or delete for a stray; delete for a treat).
- With **Time travel** on (Settings → Habit Kitty → Game options), a kitty, a stray and a treat each get the same rewind button under their card, and the same Time travel in their menu.

### Notes

**Notes** (the **Notes** tab of the **Journal** on the home page): a list of notes with a search box, and an editor that saves as you type, with a Markdown preview (headings, bold and italic, lists and tasks, quotes, code, links). Each note is one `.md` file named after its title.
On Android, **Settings → Notes → Sync with the notes folder** keeps a copy of every note in the **Notes** folder of your backup folder and picks up changes made there, so you can open that folder as a vault in Obsidian
(a note changed on both sides keeps both versions; deleting a note in the app deletes it from the folder, but deleting it in Obsidian does not delete it in the app). Notes can also be exported as a .zip and imported from .md files, and they are part of the backup.

### Diary

The **Diary** is the first tab of the **Journal** button on the home page (the other tab is **Notes**). It is no longer a tab in Habit Kitty.

- **Calendar:** a monthly calendar. Tap a day to write a page, pick one or two moods (little pixel cats) and attach a photo from your gallery, or pick a sticker icon instead.
  Days with a page turn pink and the mood shows inside the day. Photos are shrunk to at most 60 KB (900 px on the long side) and kept on the device (not in saved text).
- **Reflection:** one note for each month, with a tally of the moods you picked that month.
- **Birthdays:** add the people whose birthdays you want to remember (the year is optional). A cake marks the day on the calendar and on that day's page, and the next ones are listed at the top.
- **Settings** (the gear in the Diary): Meteorokinesis (a weather choice on every page, including any weather you draw in Kitty Gallery), Teleportation, Photographer, Titles, Starry Nights, and your own names for the five emotions.
- The days you have written fill your **MP** bar (10 days to leave level 1, 20 for level 2, and so on).

**Settings** is the gear icon at the top right of every screen, and opens the same screen everywhere. It holds the shared options (sound, your day start, backup, change log) and a button for each mini-app with its own options: Habit Kitty (feeding reminders, game options, unlimited kitty, how to use), Diary (Meteorokinesis and the other page options, emotion names), Achievements (load achievements) and Kitty Gallery (reset to original).

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

### Kitty Achievement

Quests, side quests and achievement cards. An achievement can have a **Goal (times)** ("Run 10 marathons"): count it up
with **+1** on its page, and the card shows a pixel bar with the count. When a locked card reaches its goal, the app offers to unlock it.

### Kitty Gallery

Draw the app's pixel art yourself. Each tab is one kind: **Sticker** (18 × 18, used on notes, achievement cards, side quests and
Kitty Mart categories), **Mini sticker** (the card friends), **Button** (one-colour button icons), **Weather** (for Meteorokinesis),
**Decoration** (such as the wings on the home page) and **Scene** (Habit Kitty's cosy room and garden, 240 × 320).
New icons and changes are used everywhere in the app straight away, and official stickers and weather can be deleted (and brought back).
A sticker can be marked as cat food. A scene can be drawn on, made from a photo (**Use a photo…**), and given its **Kitty spots**.
**Export icons** writes your icons to a file, which can be merged into the code to make them official; **Import icons** reads one back.

### Backup and settings

Everything is stored on the device. **Settings → Backup** saves one **.kitty** file with everything: kitties, diary pages and photos,
notes, Kitty Mart, Kitty Gallery icons and Kitty Achievement. Save it on the device, share it (Android), or pick a backup folder for daily auto-backups.
**Settings only** saves a small **.kittyset** file with just the look and options (and Kitty Gallery icons), with nothing personal in it,
to give someone else the same setup. Loading one asks which parts to take.

## Development

Requires Node 22+.

```sh
npm install
npm test                # rules engine tests (vitest)
npm run build:web       # bundle the page to dist/habit-kitty.html and app-www/index.html
npm run play            # play the rules engine in the terminal
npm run editor          # pixel editor for the cat art and coat patterns
```

### Android app

Requires Android Studio (for the SDK and its bundled JDK). `npm run app:apk` uses `$JAVA_HOME` if it is set, and otherwise
falls back to a JDK path on the author's machine, so set `JAVA_HOME` to your JDK (for example Android Studio's `jbr` folder) first.

```sh
npm run app:sync        # build the page and copy it into the Android project
npm run app:apk         # clean build, then copy the debug APK to dist/IttyBittyKitty.apk
adb install -r dist/IttyBittyKitty.apk
```

You can also open the `android/` folder in Android Studio and press Run after `npm run app:sync`.

### Project layout

| Path | What it is |
|---|---|
| `src/web/shell.ts` | The page's entry, a small router: opens on the home page and shows one screen at a time. |
| `src/habit/` | Habit Kitty: the screen (`app.ts`), with its sound and music (`sound.ts`), reminder notifications (`notify.ts`) the Android home-screen widget (`widget.ts`) and Settings → Look (`look.ts`); the game rules (`rules.ts`: feeding, starvation, sitter, shelter, mindful tasks, levels; pure), week and month data for the dots and heatmaps (`calendar.ts`), accomplishments, each cat's own diary (`catdiary.ts`), what reminders say (`reminders.ts`), who a cat thinks about (`thoughts.ts`), encouragement, the in-app changelog, and `play.ts`, a terminal playground for the rules (`npm run play`). |
| `src/home/app.ts`, `web/home.html` | The home page: the pinned player card (name, picture, ID, Level / HP / MP) and the menu. |
| `src/diary/` | The Diary screen (`app.ts`), its model (`model.ts`: pages, moods, people, reflections and their file names; pure), its data (`data.ts`: one file per day, per month's reflection, and `diary.json`), the emotions (`moods.ts`), birthdays (`people.ts`, pure and tested) and options (`settings.ts`). `web/diary.html` has its markup and styles. |
| `src/notes/` | The Notes screen (`app.ts`), its data (`data.ts`: one `.md` file per note), the folder sync (`folder.ts`, with the pure planning in `sync.ts`), the Markdown renderer and search (`model.ts`, pure and tested) and its options (`settings.ts`). `web/notes.html` has its markup and styles. |
| `src/achievement/` | Kitty Achievement: the screen (`app.ts`), its data model, rules (`ops.ts`), storage (`storage.ts` in the browser, `filerepo.ts` on the phone), its save read and written while the app is closed (`save.ts`), and backup. |
| `src/shopping/` | Kitty Mart: the screen (`app.ts`), its lists, pantry, recipes and aisle orders (`model.ts`, pure and tested) and storage (`data.ts`). `web/shopping.html` has its markup and styles. |
| `src/pixel/` | Kitty Gallery: the screen (`app.ts`), its icon model, import and export (`model.ts`, pure and tested), storage (`data.ts`), and `live.ts`, which puts your icons over the official ones app-wide. `web/pixel.html` has its markup and styles. |
| `src/backup.ts` | The `.kitty` backup: packing every app's data into one file and reading it back. |
| `src/settings-file.ts` | The `.kittyset` settings file: what goes in it, and cleaning one that is read back. |
| `src/shared/pixelart.ts` | The pixel grid and pastel palette every picture is drawn with. |
| `src/shared/art.ts`, `src/shared/scene.ts` | Button icons, weather, calendar marks and decorations; the cosy room and the garden (240 × 320), their kitty spots, and the diary book and trophy. |
| `src/shared/stickers.ts`, `src/shared/sticker-icons.ts` | The stickers (icons on achievements, notes, diary pages, Kitty Mart), the interface icons and the achievement card pictures. |
| `src/shared/pixelcat.ts`, `src/shared/coats.ts` | The pixel cats and the per-coat pattern layers (edit them with `npm run editor`). |
| `src/shared/layer.ts`, `src/shared/picker.ts`, `src/shared/ui.ts` | Every app's small dialogs, the month and year picker, and the title bar, look and toast. |
| `src/shared/stat-lines.ts`, `src/shared/player.ts`, `src/shared/stats.ts` | The player's levels and stat lines (pure, tested); reading and saving the shared player; what Habit Kitty tells the home page (affection, diary days). |
| `src/shared/backupfolder.ts`, `src/shared/backup-schedule.ts` | Saving backups to the phone, the auto-backup folder, and its rules (pure, tested). |
| `src/shared/files.ts`, `src/shared/jsonfile.ts`, `src/shared/local.ts` | Reading and writing the app's private files, one-JSON-file app data, and localStorage. |
| `src/shared/dates.ts`, `src/shared/id.ts`, `src/shared/html.ts` | Date keys and day numbers, new ids, and HTML string helpers. |
| `src/shared/apps.ts`, `src/shared/backdrop.ts`, `src/shared/music.ts` | The home button and navigation events, the dithered pixel background, and the music volume. |
| `src/shared/photo.ts` | Every photo is scaled down to fit under 60 KB. |
| `src/test/fsmock.ts` | An in-memory Capacitor file system for tests. |
| `web/page.html` | Page markup and styles. |
| `web/build.js` | Bundles the page, font and sounds for the web and for the Android app. |
| `web/achievement.html` | Kitty Achievement's part of the page (its markup and styles); the build puts it into `web/page.html`. |
| `web/editor.js`, `web/pixel-editor.html` | The pixel editor for the cat art. |
| `scripts/notify-icons.ts` | Draws the Android notification icons (`npm run icons`). |
| `sounds/` | Background music, meow and purr. |
| `android/` | Capacitor Android project. |

Build output (`dist/`, `app-www/`, the APK) and local files (`save.json`, `node_modules/`) are git-ignored.

### Playtesting time

**Settings → Playtest clock** skips ahead 3 hours or a day so you can see hunger, the sitter and cat deaths
without waiting. Tap **Now** to go back to real time; the skipped days still count.

## Credits

- Background music: Strawberry Walk 【BGM： IchinoseSound】 https://www.youtube.com/@IchinoseSound
