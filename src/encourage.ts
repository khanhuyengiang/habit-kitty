// What a kitty says (well, what the app says for it) when it has been fed. Pure: pass `rand` for a fixed roll.
import { lookOf } from './pixelcat.ts';
import { genderOf, CONFIG, type Cat } from './rules.ts';

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
const FEEDING_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

const pronoun = (c: Cat) => (genderOf(c) === 'girl' ? { sub: 'she', obj: 'her', poss: 'her' } : { sub: 'he', obj: 'him', poss: 'his' });

const GENERIC = [
  (n: string, p: ReturnType<typeof pronoun>) => `${n} purrs happily. You showed up today, and that counts!`,
  (n: string, p: ReturnType<typeof pronoun>) => `${n} is so glad you came. Small steps add up!`,
  (n: string, p: ReturnType<typeof pronoun>) => `${n} gobbles it up and rubs against your leg. Great job!`,
  (n: string, p: ReturnType<typeof pronoun>) => `Look at ${p.poss} little tail swish. ${n} is proud of you!`,
  (n: string, p: ReturnType<typeof pronoun>) => `${n} thinks you are the best. Keep it up!`,
  (n: string, p: ReturnType<typeof pronoun>) => `Another good day with ${n}. You're doing wonderfully!`,
];

const BY_TRAIT: Record<string, (n: string, p: ReturnType<typeof pronoun>) => string> = {
  playful: (n) => `${n} does a happy zoomie after dinner. Thanks for the energy!`,
  curious: (n) => `${n} sniffs every bite, then purrs. Good job!`,
  cuddly: (n, p) => `${n} curls up on you and purrs. ${p.sub[0].toUpperCase() + p.sub.slice(1)} loves you!`,
  lazy: (n) => `${n} eats, then yawns happily. Well done, you!`,
  shy: (n) => `${n} peeks out and nibbles happily. You're earning ${n}'s trust!`,
  grumpy: (n) => `${n} pretends not to care, but the purr gives it away. Nice work!`,
};

const milestone = (cat: Cat, streak: number): string | null => {
  const n = cat.name;
  if (cat.totalFeedings === 1) return `First meal together! ${n} has found a home with you.`;
  if (STREAK_MILESTONES.includes(streak)) return `${streak} days in a row! ${n} is amazed by you.`;
  if (FEEDING_MILESTONES.includes(cat.totalFeedings)) return `${cat.totalFeedings} meals with ${n}! What a team.`;
  return null;
};

// `cat` is the cat after it was fed (totalFeedings already counts this meal); `streak` is its fed-day streak.
export function fedMessage(cat: Cat, food: string, streak: number, rand: () => number = Math.random): string {
  const p = pronoun(cat);
  const special = milestone(cat, streak);
  const trait = rand() < 0.4 ? BY_TRAIT[lookOf(cat).trait ?? 'curious'] : undefined;
  const line = special ?? (trait ?? GENERIC[Math.min(GENERIC.length - 1, Math.floor(rand() * GENERIC.length))])(cat.name, p);
  return `${cat.name} ate ${food}. +${CONFIG.xpPerFeeding} XP. ${line}`;
}
