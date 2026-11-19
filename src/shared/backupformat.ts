// The few facts about the combined .kitty backup that both Habit Kitty (src/backup.ts, which writes it) and Kitty Achievement
// (achievement/backup.ts, which can read its own save back out of one) need. Kept apart so neither pulls in the other.
export const COMBINED_APP = 'habit-kitty';                 // manifest.json's `app` in a combined backup
export const ACHIEVEMENT_ENTRY = 'achievement.achkitty';   // Kitty Achievement's whole save, as one entry
export const ACHIEVEMENT_MAX = 128_000_000;                // a bigger entry is refused (zip bomb)

export const isZip = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
