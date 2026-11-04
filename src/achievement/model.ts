// The data model. Everything is plain JSON with stable ids, shaped like database rows so the storage layer
// (storage.ts) can later be swapped for a server without touching the rules (ops.ts) or the UI.
//
// Photos are never inside these records: an `imageUrl` is a reference ("idb:<id>" for a photo kept on this device,
// or any normal URL once a server hosts them).

export const RARITIES = ['normal', 'uncommon', 'rare', 'mythical', 'legendary'] as const;
export type Rarity = typeof RARITIES[number];
export const RARITY_LABEL: Record<Rarity, string> = {
  normal: 'Normal', uncommon: 'Uncommon', rare: 'Rare', mythical: 'Mythical', legendary: 'Legendary',
};

// Shown as locked (planned) and unlocked (completed): they are achievements, after all.
export type Status = 'planned' | 'completed';

export const PLAYER_GENDERS = ['girl', 'boy', 'other'] as const;
export type PlayerGender = typeof PLAYER_GENDERS[number];
export const PLAYER_GENDER_LABEL: Record<PlayerGender, string> = { girl: 'Girl', boy: 'Boy', other: 'Other' };

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  gender?: PlayerGender | null;     // optional; missing in older saves
  birthYear?: number | null;        // the age is worked out from it each year (see ageOf in ops.ts); missing in older saves
  achievementsPerLevel?: number;    // no longer used: the level now needs more achievements each time (see levelOf in ops.ts); old saves still carry it
}

export interface MainQuest {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverImageUrl: string | null;   // reserved: the first version has no cover pictures
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

export interface SideQuest {
  id: string;
  mainQuestId: string;
  title: string;
  color: string;   // #rrggbb
  icon: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

export interface Achievement {
  id: string;
  userId: string;
  mainQuestId: string;
  sideQuestId: string | null;   // null: it sits directly in the main quest
  title: string;
  description: string;
  location: string;   // where it happened (or will); optional, may be missing in older saves
  tags: string[];     // free words to find it by (at most LIMITS.tags); missing in older saves until migrate() runs
  icon: string;
  status: Status;
  rarity: Rarity;   // only meaningful (and only shown) while completed; planned cards keep 'normal'
  plannedDate: string | null;      // YYYY-MM-DD
  completionDate: string | null;   // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface AchievementPhoto {
  id: string;
  achievementId: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: number;
}

export interface Data {
  version: 1;
  user: User;
  mainQuests: MainQuest[];
  sideQuests: SideQuest[];
  achievements: Achievement[];
  photos: AchievementPhoto[];
}

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Colours people can pick for a side quest (they can also choose any colour). Mid tones, so an icon in this colour
// reads on both the light and the dark page.
export const SIDE_COLORS = [
  '#ff6fa5', '#f0584f', '#ff9a3d', '#f2b705', '#45c27a', '#2fb8b0', '#4a9bea', '#6a6de8', '#a45be0', '#b07a4f',
];

export const todayStr = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export const isColor = (s: string): boolean => /^#[0-9a-f]{6}$/i.test(s);

// Black or white, whichever reads better on this colour.
export function inkFor(color: string): '#2a2147' | '#ffffff' {
  if (!isColor(color)) return '#2a2147';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#2a2147' : '#ffffff';
}
