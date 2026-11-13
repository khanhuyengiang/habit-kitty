// The rules. Pure functions: each takes the data and returns new data (never mutating the old), so the UI can
// show the change at once and storage can persist whatever comes back. Nothing here touches the browser.
import {
  PLAYER_GENDERS, RARITIES, SIDE_COLORS, isColor, isValidDate, newId,
  type Achievement, type AchievementPhoto, type Data, type MainQuest, type PlayerGender, type Rarity, type SideQuest, type Status,
} from './model.ts';
import { PICKER_ICON_NAMES } from './pixelart.ts';
import { toPalette } from '../shared/palette.ts';

export const LIMITS = { title: 80, location: 60, description: 2000, name: 30, quest: 60, tags: 10, tag: 24, goal: 100000 };

// Older saves predate tags (and may have been written before a field existed): fill in what is missing, so the
// rest of the code can trust the shape. Changes nothing that is already there.
// Side quests saved before the palette (2026-11) get their colour moved to the nearest palette colour.
export function migrate(d: Data): Data {
  const tagsOk = d.achievements.every((a) => Array.isArray(a.tags));
  const colorsOk = d.sideQuests.every((s) => toPalette(s.color) === s.color);
  if (tagsOk && colorsOk) return d;
  return {
    ...d,
    achievements: tagsOk ? d.achievements : d.achievements.map((a) => (Array.isArray(a.tags) ? a : { ...a, tags: [] })),
    sideQuests: colorsOk ? d.sideQuests : d.sideQuests.map((s) => (toPalette(s.color) === s.color ? s : { ...s, color: toPalette(s.color) })),
  };
}

export function emptyData(now = Date.now()): Data {
  return {
    version: 1,
    user: { id: newId(), displayName: 'Adventurer', avatarUrl: null, createdAt: now, gender: null, birthYear: null },
    mainQuests: [], sideQuests: [], achievements: [], photos: [],
  };
}

export type Errors = Record<string, string>;
const trim = (s: string) => s.trim().replace(/\s+/g, ' ');
const nextOrder = (items: { sortOrder: number }[]) => items.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;

// ---------- profile ----------

// Each level asks for a few more achievements than the one before: 2 to leave level 1, then 3, 3, 4, 4, 5, 5 ...
export const achievementsToLeave = (level: number) => 2 + Math.floor(level / 2);

export function levelOf(d: Data) {
  const completed = d.achievements.filter((a) => a.status === 'completed').length;
  let level = 1, into = completed;
  while (into >= achievementsToLeave(level)) { into -= achievementsToLeave(level); level++; }
  return { level, completed, into, per: achievementsToLeave(level) };
}

// The player's title changes every 10 levels: Novice Adventurer for levels 1 to 9, the next at level 10, and so on.
export const TITLES = ['Novice Adventurer', 'Eager Wanderer', 'Curious Explorer', 'Seasoned Adventurer', 'Trailblazer',
  'Veteran Voyager', 'Master Adventurer', 'Grand Explorer', 'Legendary Adventurer', 'Mythic Adventurer'];
export const titleFor = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor(level / 10))];

// Only the birth year is asked, so the age goes up by one each new year.
export const ageOf = (u: { birthYear?: number | null }, year = new Date().getFullYear()): number | null =>
  typeof u.birthYear === 'number' ? year - u.birthYear : null;

export function updateProfile(d: Data, p: { displayName: string; gender: PlayerGender | null; birthYear: number | null; avatarUrl: string | null }, year = new Date().getFullYear()): { data: Data; errors: Errors } {
  const errors: Errors = {};
  const name = trim(p.displayName);
  if (!name) errors.displayName = 'Enter a name.';
  else if (name.length > LIMITS.name) errors.displayName = `Keep the name to ${LIMITS.name} characters.`;
  if (p.birthYear !== null && (!Number.isInteger(p.birthYear) || p.birthYear < 1900 || p.birthYear > year)) {
    errors.birthYear = `Enter a year from 1900 to ${year}, or leave it empty.`;
  }
  if (p.gender !== null && !PLAYER_GENDERS.includes(p.gender)) errors.gender = 'Choose one of the options.';
  if (Object.keys(errors).length) return { data: d, errors };
  return { data: { ...d, user: { ...d.user, displayName: name, gender: p.gender, birthYear: p.birthYear, avatarUrl: p.avatarUrl } }, errors };
}

// ---------- main quests ----------

export const activeMainQuests = (d: Data) => d.mainQuests.filter((q) => !q.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
export const archivedMainQuests = (d: Data) => d.mainQuests.filter((q) => q.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);

function questErrors(title: string): Errors {
  const t = trim(title);
  if (!t) return { title: 'Give the quest a name.' };
  if (t.length > LIMITS.quest) return { title: `Keep the name to ${LIMITS.quest} characters.` };
  return {};
}

export function saveMainQuest(d: Data, input: { title: string; description: string }, id?: string, now = Date.now()): { data: Data; id: string; errors: Errors } {
  const errors = questErrors(input.title);
  if (input.description.length > LIMITS.description) errors.description = `Keep the description under ${LIMITS.description} characters.`;
  if (id && !d.mainQuests.some((q) => q.id === id)) errors.title = 'That quest no longer exists.';
  if (Object.keys(errors).length) return { data: d, id: id ?? '', errors };
  const fields = { title: trim(input.title), description: input.description.trim(), updatedAt: now };
  if (id) return { data: { ...d, mainQuests: d.mainQuests.map((q) => (q.id === id ? { ...q, ...fields } : q)) }, id, errors };
  const q: MainQuest = { id: newId(), userId: d.user.id, coverImageUrl: null, sortOrder: nextOrder(d.mainQuests), createdAt: now, archivedAt: null, ...fields };
  return { data: { ...d, mainQuests: [...d.mainQuests, q] }, id: q.id, errors };
}

export const setMainQuestArchived = (d: Data, id: string, archived: boolean, now = Date.now()): Data =>
  ({ ...d, mainQuests: d.mainQuests.map((q) => (q.id === id ? { ...q, archivedAt: archived ? now : null, updatedAt: now } : q)) });

// Deleting a main quest takes its side quests and achievements (and their photos) with it.
export function deleteMainQuest(d: Data, id: string): { data: Data; removedPhotos: string[] } {
  const gone = new Set(d.achievements.filter((a) => a.mainQuestId === id).map((a) => a.id));
  const removed = d.photos.filter((p) => gone.has(p.achievementId)).map((p) => p.imageUrl);
  return {
    data: {
      ...d,
      mainQuests: d.mainQuests.filter((q) => q.id !== id),
      sideQuests: d.sideQuests.filter((s) => s.mainQuestId !== id),
      achievements: d.achievements.filter((a) => a.mainQuestId !== id),
      photos: d.photos.filter((p) => !gone.has(p.achievementId)),
    },
    removedPhotos: removed,
  };
}

// ---------- side quests ----------

export const sideQuestsOf = (d: Data, mainId: string, withArchived = false) =>
  d.sideQuests.filter((s) => s.mainQuestId === mainId && (withArchived || !s.archivedAt)).sort((a, b) => a.sortOrder - b.sortOrder);

export function saveSideQuest(d: Data, input: { mainQuestId: string; title: string; color: string; icon: string }, id?: string, now = Date.now()): { data: Data; id: string; errors: Errors } {
  const errors: Errors = {};
  const title = trim(input.title);
  if (!title) errors.title = 'Give the side quest a name.';
  else if (title.length > LIMITS.quest) errors.title = `Keep the name to ${LIMITS.quest} characters.`;
  if (!isColor(input.color)) errors.color = 'Pick a colour.';
  if (!PICKER_ICON_NAMES.includes(input.icon)) errors.icon = 'Pick an icon.';
  if (!d.mainQuests.some((q) => q.id === input.mainQuestId)) errors.title = 'That main quest no longer exists.';
  if (!errors.title && d.sideQuests.some((s) => s.mainQuestId === input.mainQuestId && s.id !== id && s.title.toLowerCase() === title.toLowerCase())) {
    errors.title = 'This quest already has a side quest with that name.';
  }
  if (id && !d.sideQuests.some((s) => s.id === id && s.mainQuestId === input.mainQuestId)) errors.title = 'That side quest no longer exists.';
  if (Object.keys(errors).length) return { data: d, id: id ?? '', errors };
  const fields = { title, color: input.color.toLowerCase(), icon: input.icon, updatedAt: now };
  if (id) return { data: { ...d, sideQuests: d.sideQuests.map((s) => (s.id === id ? { ...s, ...fields } : s)) }, id, errors };
  const s: SideQuest = {
    id: newId(), mainQuestId: input.mainQuestId, sortOrder: nextOrder(d.sideQuests.filter((x) => x.mainQuestId === input.mainQuestId)),
    createdAt: now, archivedAt: null, ...fields,
  };
  return { data: { ...d, sideQuests: [...d.sideQuests, s] }, id: s.id, errors };
}

// Swap with the neighbour among the quest's visible side quests.
export function moveSideQuest(d: Data, id: string, dir: -1 | 1): Data {
  const side = d.sideQuests.find((s) => s.id === id);
  if (!side) return d;
  const list = sideQuestsOf(d, side.mainQuestId);
  const i = list.findIndex((s) => s.id === id);
  const other = list[i + dir];
  if (i < 0 || !other) return d;
  return { ...d, sideQuests: d.sideQuests.map((s) => (s.id === side.id ? { ...s, sortOrder: other.sortOrder } : s.id === other.id ? { ...s, sortOrder: side.sortOrder } : s)) };
}

export const setSideQuestArchived = (d: Data, id: string, archived: boolean, now = Date.now()): Data =>
  ({ ...d, sideQuests: d.sideQuests.map((s) => (s.id === id ? { ...s, archivedAt: archived ? now : null, updatedAt: now } : s)) });

// Deleting a side quest takes its achievements with it (archive keeps them).
export function deleteSideQuest(d: Data, id: string): { data: Data; removedPhotos: string[] } {
  const gone = new Set(d.achievements.filter((a) => a.sideQuestId === id).map((a) => a.id));
  return {
    data: {
      ...d,
      sideQuests: d.sideQuests.filter((s) => s.id !== id),
      achievements: d.achievements.filter((a) => a.sideQuestId !== id),
      photos: d.photos.filter((p) => !gone.has(p.achievementId)),
    },
    removedPhotos: d.photos.filter((p) => gone.has(p.achievementId)).map((p) => p.imageUrl),
  };
}

// ---------- achievements ----------

export interface PhotoInput { id?: string; imageUrl: string }
export interface AchievementInput {
  title: string; description: string; location: string; icon: string; tags: string[];
  mainQuestId: string; sideQuestId: string;   // '' for none: directly in the main quest
  status: Status; rarity: Rarity;
  date: string;   // the planned date while planned, the completion date once completed
  photos: PhotoInput[];
  goal?: number | null;   // null: a one-off achievement; left out: keep what the card had
  progress?: number;      // how many so far (only with a goal)
}

// A counted achievement's numbers, or null for a one-off.
export function progressOf(a: Pick<Achievement, 'goal' | 'progress'>): { n: number; goal: number; done: boolean } | null {
  if (!a.goal) return null;
  const n = a.progress ?? 0;
  return { n, goal: a.goal, done: n >= a.goal };
}

// Counts a counted achievement up (or back down, never below 0). `reached` is true when this step met the goal of a
// locked card, which is the moment to offer unlocking it.
export function stepProgress(d: Data, id: string, by: number, now = Date.now()): { data: Data; reached: boolean } {
  const a = d.achievements.find((x) => x.id === id);
  const p = a && progressOf(a);
  if (!a || !p) return { data: d, reached: false };
  const n = Math.min(LIMITS.goal, Math.max(0, p.n + by));
  if (n === p.n) return { data: d, reached: false };
  return {
    data: { ...d, achievements: d.achievements.map((x) => (x.id === id ? { ...x, progress: n, updatedAt: now } : x)) },
    reached: a.status === 'planned' && p.n < p.goal && n >= p.goal,
  };
}

export const photosOf = (d: Data, achievementId: string): AchievementPhoto[] =>
  d.photos.filter((p) => p.achievementId === achievementId).sort((a, b) => a.sortOrder - b.sortOrder);

export function validateAchievement(d: Data, i: AchievementInput, opts: { requireDate?: boolean } = {}): Errors {
  const errors: Errors = {};
  const title = trim(i.title);
  if (!title) errors.title = 'Give the achievement a title.';
  else if (title.length > LIMITS.title) errors.title = `Keep the title to ${LIMITS.title} characters.`;
  if (i.description.length > LIMITS.description) errors.description = `Keep the description under ${LIMITS.description} characters.`;
  if (i.location.length > LIMITS.location) errors.location = `Keep the location to ${LIMITS.location} characters.`;
  if (!PICKER_ICON_NAMES.includes(i.icon)) errors.icon = 'Pick an icon.';
  if (i.status !== 'planned' && i.status !== 'completed') errors.status = 'Choose planned or completed.';
  if (!d.mainQuests.some((q) => q.id === i.mainQuestId)) errors.mainQuestId = 'Choose a main quest.';
  if (i.sideQuestId) {
    const side = d.sideQuests.find((s) => s.id === i.sideQuestId);
    if (!side) errors.sideQuestId = 'That side quest no longer exists.';
    else if (side.mainQuestId !== i.mainQuestId) errors.sideQuestId = 'That side quest belongs to a different main quest.';
  }
  const tags = normalizeTags(i.tags);
  if (tags.length > LIMITS.tags) errors.tags = `Keep it to ${LIMITS.tags} tags.`;
  else if (tags.some((t) => t.length > LIMITS.tag)) errors.tags = `Keep each tag to ${LIMITS.tag} characters.`;
  if (!RARITIES.includes(i.rarity)) errors.rarity = 'Choose a rarity.';
  const whole = (n: number) => Number.isInteger(n) && n >= 0 && n <= LIMITS.goal;
  if (i.goal != null && (!whole(i.goal) || i.goal < 1)) errors.goal = `Enter a whole number from 1 to ${LIMITS.goal}, or leave it empty.`;
  else if (i.goal != null && i.progress != null && !whole(i.progress)) errors.progress = `Enter a whole number from 0 to ${LIMITS.goal}.`;
  if (i.date ? !isValidDate(i.date) : opts.requireDate) {
    errors.date = i.date ? 'Enter a valid date.' : 'Set the date it happened.';
  }
  return errors;
}

// Creates or updates (when `id` is given: same record, same id, so completing a planned card never duplicates it).
export function saveAchievement(d: Data, i: AchievementInput, id?: string, opts: { requireDate?: boolean } = {}, now = Date.now()):
  { data: Data; id: string; errors: Errors; removedPhotos: string[] } {
  const errors = validateAchievement(d, i, opts);
  const old = id ? d.achievements.find((a) => a.id === id) : undefined;
  if (id && !old) errors.title = 'That achievement no longer exists.';
  if (Object.keys(errors).length) return { data: d, id: id ?? '', errors, removedPhotos: [] };

  const completed = i.status === 'completed';
  const base = {
    title: trim(i.title), description: i.description.trim(), location: trim(i.location), icon: i.icon,
    mainQuestId: i.mainQuestId, sideQuestId: i.sideQuestId || null, tags: normalizeTags(i.tags), status: i.status,
    rarity: completed ? i.rarity : 'normal' as Rarity,
    plannedDate: completed ? old?.plannedDate ?? null : i.date || null,
    completionDate: completed ? i.date || null : null,
    ...(i.goal === undefined ? {} : { goal: i.goal, progress: i.goal ? i.progress ?? old?.progress ?? 0 : 0 }),
    updatedAt: now,
  };
  const achievement: Achievement = old
    ? { ...old, ...base }
    : { id: newId(), userId: d.user.id, createdAt: now, ...base };

  const keep = new Map(photosOf(d, achievement.id).map((p) => [p.id, p]));
  const photos: AchievementPhoto[] = i.photos.map((p, n) => {
    const existing = p.id ? keep.get(p.id) : undefined;
    return existing ? { ...existing, sortOrder: n } : { id: newId(), achievementId: achievement.id, imageUrl: p.imageUrl, sortOrder: n, createdAt: now };
  });
  const kept = new Set(photos.map((p) => p.id));
  const removedPhotos = [...keep.values()].filter((p) => !kept.has(p.id)).map((p) => p.imageUrl);

  return {
    data: {
      ...d,
      achievements: old ? d.achievements.map((a) => (a.id === achievement.id ? achievement : a)) : [...d.achievements, achievement],
      photos: [...d.photos.filter((p) => p.achievementId !== achievement.id), ...photos],
    },
    id: achievement.id, errors, removedPhotos,
  };
}

export function deleteAchievement(d: Data, id: string): { data: Data; removedPhotos: string[] } {
  return {
    data: { ...d, achievements: d.achievements.filter((a) => a.id !== id), photos: d.photos.filter((p) => p.achievementId !== id) },
    removedPhotos: d.photos.filter((p) => p.achievementId === id).map((p) => p.imageUrl),
  };
}

// Tags as typed: trimmed, without a leading #, one space between words, no repeats (ignoring case; the first spelling wins).
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw.map((t) => trim(t).replace(/^#+/, '').trim()).filter((t) => {
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Every tag in use, the most used first (then A to Z).
export function allTags(d: Data, mainId?: string): string[] {
  const n = new Map<string, number>();
  for (const a of d.achievements) if (!mainId || a.mainQuestId === mainId) for (const t of a.tags) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// The month a card belongs to (YYYY-MM): when it was unlocked, or when it is planned for; '' when it has no date.
export const monthOf = (a: Achievement) => ((a.status === 'completed' ? a.completionDate : a.plannedDate) ?? '').slice(0, 7);

export type Sort = 'time' | 'name' | 'rarity';
export type Group = 'side' | 'quest' | 'month' | 'none';
// side: 'all', a side quest's id, or 'none' for the cards directly in the main quest. tag: 'all' or a tag.
export interface Filter { side: string; status: Status | 'all'; sort?: Sort; tag?: string; group?: Group }

// By time (the default): completed cards first (newest first), then planned goals (soonest first, undated last).
// By name: A to Z. By rarity: the rarest completed cards first, then the rest by time; planned goals come last.
// mainId '' is every quest that is not archived (the page with all achievements).
export function collection(d: Data, mainId: string, f: Filter = { side: 'all', status: 'all' }): Achievement[] {
  const rank = (a: Achievement) => (a.status === 'completed' ? 0 : 1);
  const when = (a: Achievement) => (a.status === 'completed' ? a.completionDate : a.plannedDate);
  const byTime = (a: Achievement, b: Achievement) => rank(a) - rank(b)
    || (a.status === 'completed' ? (when(b) ?? '').localeCompare(when(a) ?? '') : (when(a) ?? '9999').localeCompare(when(b) ?? '9999'))
    || b.createdAt - a.createdAt;
  const power = (a: Achievement) => (a.status === 'completed' ? RARITIES.indexOf(a.rarity) : -1);
  const order = f.sort === 'name' ? (a: Achievement, b: Achievement) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || byTime(a, b)
    : f.sort === 'rarity' ? (a: Achievement, b: Achievement) => power(b) - power(a) || byTime(a, b)
    : byTime;
  const live = new Set(d.mainQuests.filter((q) => !q.archivedAt).map((q) => q.id));
  return d.achievements
    .filter((a) => (mainId ? a.mainQuestId === mainId : live.has(a.mainQuestId)) && (f.side === 'all' || (f.side === 'none' ? !a.sideQuestId : a.sideQuestId === f.side))
      && (f.status === 'all' || a.status === f.status) && (!f.tag || f.tag === 'all' || a.tags.some((t) => t.toLowerCase() === f.tag!.toLowerCase())))
    .sort(order);
}

// sideId: leave it out for the whole quest, null for the cards directly in the main quest.
export const counts = (d: Data, mainId: string, sideId?: string | null) => {
  const list = d.achievements.filter((a) => a.mainQuestId === mainId && (sideId === undefined || a.sideQuestId === sideId));
  return { done: list.filter((a) => a.status === 'completed').length, planned: list.filter((a) => a.status === 'planned').length };
};

// Every reference must point at something that exists, and a side quest (when there is one) must sit under the
// achievement's main quest.
export function checkIntegrity(d: Data): string[] {
  const problems: string[] = [];
  const mains = new Set(d.mainQuests.map((q) => q.id));
  const sides = new Map(d.sideQuests.map((s) => [s.id, s]));
  const achs = new Set(d.achievements.map((a) => a.id));
  for (const s of d.sideQuests) if (!mains.has(s.mainQuestId)) problems.push(`side quest ${s.id} has no main quest`);
  for (const a of d.achievements) {
    const s = a.sideQuestId ? sides.get(a.sideQuestId) : undefined;
    if (!mains.has(a.mainQuestId)) problems.push(`achievement ${a.id} has no main quest`);
    if (a.sideQuestId && !s) problems.push(`achievement ${a.id} points at a missing side quest`);
    else if (s && s.mainQuestId !== a.mainQuestId) problems.push(`achievement ${a.id} sits in another main quest than its side quest`);
    if (a.status === 'planned' && (a.rarity !== 'normal' || a.completionDate)) problems.push(`planned achievement ${a.id} looks completed`);
  }
  for (const p of d.photos) if (!achs.has(p.achievementId)) problems.push(`photo ${p.id} has no achievement`);
  return problems;
}

export const pickColor = (d: Data, mainId: string) => SIDE_COLORS[sideQuestsOf(d, mainId, true).length % SIDE_COLORS.length];
