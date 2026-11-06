// The diary's emotions are little cats, drawn with the same pixel sprites as everything else. Their fur follows the rainbow:
// warm for good feelings, cool for bad ones.
import { miniSvg, type Face } from '../shared/pixelcat.ts';
import type { Mood, Weather } from '../store.ts';

export const MOODS: Record<Mood, { label: string; face: Face; fur: string }> = {
  joyful:   { label: 'Joyful',   face: 'happy',    fur: '#ffb8cf' },
  calm:     { label: 'Calm',     face: 'open',     fur: '#ffe58a' },
  tired:    { label: 'Tired',    face: 'sleepy',   fur: '#a9dfb0' },
  sad:      { label: 'Sad',      face: 'sad',      fur: '#9cc7f0' },
  stressed: { label: 'Stressed', face: 'starving', fur: '#c3a9ee' },
};
export const MOOD_KEYS = Object.keys(MOODS) as Mood[];
export const WEATHER: Record<Weather, string> = { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rainy', storm: 'Storm', snow: 'Snow' };

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
