# Change log

Newest first. The app bundles this file: it shows the latest entry once after an update, and the whole list under Settings → Change log.

## 0.4.2 - 2026-11-05

### New
- **One backup for both apps.** The .kitty file now also holds Achievement Kitty's quests, achievements and photos. Restoring it brings both back (the app reloads once). Older Habit Kitty files and Achievement Kitty save files still load.
- **Save to device.** Settings → Backup → **Save to device…** (in both Habit Kitty and Achievement Kitty) opens the phone's own save dialog, so you choose the folder (Downloads, Documents, an SD card…). **Share…** is still there for Drive, Bluetooth and mail.
- **Auto-backup.** Pick a backup folder once (Settings → Backup → **Choose backup folder**) and one fresh dated file is saved there whenever you leave the app after changing something, plus once when the app opens if the last one is a day old. The newest 7 days are kept. **Back up now** and **Restore from folder…** are next to it.
- If the folder can't be reached (deleted, or the card is out), the app tells you instead of failing quietly.

## 0.4.1 - 2026-10-29

### New
- **Diary: previous and next day.** Arrows at the top of every diary page step through the days.
- **Two emotions.** Pick up to two emotions for a day; the kitty on the calendar is split down the middle, one half each.
- **Your own word for a feeling.** A text box under the emotions replaces the emotion name on the page.
- **Emotion names.** Settings → Emotion names lets you rename the five emotions.
- **Trackamaniac.** A new option in Game options that adds a pixel-art weather choice (sunny, cloudy, rainy, storm, snow) to diary pages.
- **Done treats.** Finished treats now sit in a "Done" drop-down on the Treats tab, with a **Delete all done** button (it asks first).
- **Fix affection.** Game options → **Fix affection…** works out your affection again from the heatmaps (every meal, missed day, sitter day, stray and treat) and shows the new number before changing it.
- **Time travel for kitties.** With Time travel on, a kitty's long-press menu has a Time travel button for marking past days as fed or not fed. Time travel now works out affection and hunger again to match, so a forgotten meal can even bring back a kitty you lost.
- **Amnesia.** A new game option: the first time you open the app on a new day, it asks whether you fed a kitty yesterday and forgot to log it, and counts it if you did.
- **Kitty alarms switch.** The feeding alarm for each kitty now has its own on/off switch, and the list folds away so it stays short with many kitties.
- **Your own music.** Settings → Sound → **Use my own music…** plays a song of your choice instead of Strawberry Walk, turned down to match the meows. It stays on this device and isn't part of backups.

### Changed
- **Quieter music.** The background music now plays at about the same loudness as the meows and purrs, and takes up half as much space.
- **Playtest clock going back.** −1 day (or Now, after skipping ahead) really goes back: anything logged after that day is undone, and every kitty is as hungry as it was then.
- **Deleting strays and treats** no longer loses the affection they earned when affection is worked out again.

## 0.4.0 - 2026-10-26

### New
- **Release to the stray colony.** Press and hold a kitty, open Options and release it: it becomes a daily stray kitty with its whole history, no penalty, and can be adopted again as the same kitty.
- **Outdoors.** The Room tab now has a second room, a garden where your strays hang out. A stray that is due to be fed today turns up with an 80% chance, first in line; the others turn up with a 30% chance every 6 hours, so you will not always see everyone. Feed one in the garden and it may wander off again (50%).
- **Stray menu.** Press and hold a stray (in the list or outdoors) for a card with a feed button, a heatmap, and options to adopt, rename, time travel or delete.
- **Stray names.** Give a new stray kitty a name when you add it. Strays you don't name get one of their own, and a released kitty keeps its name.

### Changed
- **A tidier Room tab.** The top of the room is gone: the tabs now read **Bunker | Garden**, and the diary and achievements are real objects on the shelf in the Bunker (a book and a trophy). Tap the book for the kitty diary, the trophy for achievements. Rename lives under the room, and the garden can be renamed too.
- **Today** only shows Home / Sitter / Memories once a cat is actually away or gone.
- **Treats are now Stray kitties, and Kibbles are now Treats.** The behaviour is the same: stray kitties are repeating habits, treats are one-off jobs. Your saves are untouched.
- The Stray kitties list now shows one card per stray, with its week and streak, like the Today tab.
- The close button (✕) on the long-press menus and other cards now works wherever you tap it. Before, tapping the icon itself did nothing.
- "Make it a kitty" is now **Adopt the kitty**, and the button to do a stray's habit says **Feed**.
- The Mindful achievements now count strays fed as well as treats done.

## 0.3.0 - 2026-10-19

### Changed
- **A whole new look: a cozy pastel pixel world.** Pink, baby blue and lavender throughout, with a pixel grid behind everything. This is a cosmetic update: nothing about how the game plays has changed.
- **One pixel size everywhere.** Kitties, icons, food, hearts and the cozy room are all drawn on the same pixel grid, so nothing is scaled to a different pixel size.
- **A redrawn cozy room** with a striped wall, a window that follows the time of day, a garland, a plant, a cushion, a rug and a cat tree.
- Cards, buttons, inputs and tabs now have pixel borders and stepped corners, and every icon is pixel art.
- A new, easier-to-read pixel font (Jersey 15).
- A smaller kitty face for thought bubbles, moods and legends, with pointy ears.
- The feed button on the Today page is just the food icon now, so it takes less room.
- The heatmap's day dividers are thin again.

## 0.2.1 - 2026-10-19

### New
- **Time travel mode** (Settings → Game options). While it is on, every treat and kibble gets a ⏪ button to mark or unmark it as done on any day, past or present. It fixes your record only: no XP is paid or taken away.
- **Achievements.** A trophy in the cozy room shows meals served, weeks of raising kitties, feeding streaks, treats done, levels and diary pages. New ones pop up when you earn them.
- **Everyone's diary.** A book in the cozy room collects what all your kitties did, day by day.
- **Gender.** Choose girl or boy when you adopt a kitty. Older kitties get one too.
- **Kitty reminders** now mention the habit and show how the kitty is doing: the notification icon is the kitty's face (waiting, sad, starving or happy), in its own fur colour.

### Changed
- Press and hold a kitty now opens its diary first.
- Feeding a kitty gets a warmer message, with special ones for the first meal, streaks and meal milestones.
- Playtest clock: new **−1 day** button.
- Change log: you see what's new once after each update.

## 0.2.0 - 2026-10-12

### New
- Per-kitty diary, personalities, a calendar diary with moods and photos, backups as a single .kitty file.
- Cozy room with a home-screen widget, thought bubbles and a pet sitter.
- Feeding reminders, last-call alerts and per-kitty alarms.
- Treats and kibbles, weekday habits, and turning a daily treat into a kitty.
