// The diary's emotions are little cats, drawn with the same pixel sprites as everything else. Their fur follows the rainbow:
// warm for good feelings, cool for bad ones.
import { miniSvg, type Face } from '../shared/pixelcat.ts';
import { monoSvg } from '../shared/pixelart.ts';
import type { Mood, Star, Weather } from '../store.ts';

export const MOODS: Record<Mood, { label: string; face: Face; fur: string }> = {
  joyful:   { label: 'Joyful',   face: 'happy',    fur: '#ffb3d0' },
  calm:     { label: 'Calm',     face: 'open',     fur: '#ffe9a0' },
  tired:    { label: 'Tired',    face: 'sleepy',   fur: '#b6e6c0' },
  sad:      { label: 'Sad',      face: 'sad',      fur: '#8fd0fa' },
  stressed: { label: 'Stressed', face: 'starving', fur: '#b9a3f0' },
};
export const MOOD_KEYS = Object.keys(MOODS) as Mood[];
export const WEATHER: Record<Weather, string> = { sunny: 'Sunny', cloudy: 'Cloudy', windy: 'Windy', rainy: 'Rainy', storm: 'Storm', snow: 'Snow' };

export type MoodNames = Partial<Record<Mood, string>>;
export const moodName = (m: Mood, names: MoodNames = {}) => names[m]?.trim() || MOODS[m].label;
// What a page calls its feeling: the user's own words if they wrote any, else the emotion names ("Joyful + Tired").
export const feelingText = (e: { mood?: Mood; mood2?: Mood; feeling?: string }, names: MoodNames = {}) =>
  e.feeling?.trim() || [e.mood, e.mood2].filter((m): m is Mood => !!m).map((m) => moodName(m, names)).join(' + ');

const moodFace = (m: Mood) => miniSvg(MOODS[m].face, { fur: MOODS[m].fur, pattern: 'plain' });
export const moodSprite = (m: Mood) => moodFace(m).replace('class="sprite', 'class="sprite mood');
// Two emotions share one kitty: the left half of the first face beside the right half of the second.
export const moodsSprite = (a: Mood, b?: Mood) => b && b !== a
  ? `<span class="mood mood-split">${moodFace(a)}${moodFace(b)}</span>` : moodSprite(a);

// Teleportation: a map pin for the page's location.
export const pinSvg = () => `<span class="pin">${monoSvg(['..ooo..', '.ooooo.', 'oo...oo', 'oo...oo', 'oo...oo', '.ooooo.', '.ooooo.', '..ooo..', '..ooo..', '...o...'])}</span>`;

// Starry Nights: a day to remember is a yellow star (an exceptionally good day) or an upside-down blue one (an exceptionally bad one).
const STAR = ['...o...', '..ooo..', 'ooooooo', '.ooooo.', '..ooo..', '.oo.oo.', '.o...o.'];
export const STAR_LABEL: Record<Star, string> = { happy: 'Happy memory', sad: 'Sad memory' };
export const starSvg = (k: Star, cls = '') => `<span class="star ${k} ${cls}">${monoSvg(k === 'sad' ? [...STAR].reverse() : STAR)}</span>`;
