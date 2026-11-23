// Ideas for chores, to pick from (the dialog behind "Ideas"). Nothing is added until it is ticked and confirmed.
import { addChore, approxDays, defaultLead, defaultRepeat, firstDue, keyOfName, type Every, type LitterData, type Prefer } from './model.ts';

export interface Starter { name: string; cat: string; every: Every; prefer?: Prefer; pile?: boolean; buy?: string }

const W: Every = { n: 1, unit: 'week' }, W2: Every = { n: 2, unit: 'week' }, M: Every = { n: 1, unit: 'month' }, M2: Every = { n: 2, unit: 'month' },
  M3: Every = { n: 3, unit: 'month' }, M6: Every = { n: 6, unit: 'month' }, Y: Every = { n: 1, unit: 'year' };

export const STARTERS: Starter[] = [
  { name: 'Change the bedsheets', cat: 'bedroom', every: W2 },
  { name: 'Wash the pillows', cat: 'bedroom', every: M3 },
  { name: 'Wash the duvet', cat: 'bedroom', every: M6 },
  { name: 'Flip the mattress', cat: 'bedroom', every: M6 },
  { name: "Wash the cat's bedding", cat: 'home', every: W2 },
  { name: 'Laundry', cat: 'home', every: W, pile: true },
  { name: 'Vacuum', cat: 'home', every: W, prefer: { weekday: 5 } },
  { name: 'Clean the washing machine', cat: 'home', every: M },
  { name: 'Test the smoke alarm', cat: 'home', every: M },
  { name: 'Replace the smoke alarm batteries', cat: 'home', every: Y, buy: 'Batteries' },
  { name: 'Clean the bathroom', cat: 'bathroom', every: W, prefer: { weekday: 6 } },
  { name: 'Clean the dishwasher filter', cat: 'kitchen', every: M },
  { name: 'Replace the kitchen sponge', cat: 'kitchen', every: W2, buy: 'Kitchen sponges' },
  { name: 'Descale the kettle', cat: 'kitchen', every: M3, buy: 'Descaler' },
  { name: 'Clean the fridge', cat: 'kitchen', every: M3 },
  { name: 'Replace the water filter', cat: 'kitchen', every: M2, buy: 'Water filter' },
  { name: 'Replace the toothbrush', cat: 'health', every: M6, buy: 'Toothbrush' },
  { name: 'Dentist check-up', cat: 'health', every: M6 },
  { name: 'Flea and worm treatment for the cat', cat: 'health', every: M3, buy: 'Flea treatment' },
  { name: 'Check the tyre pressure', cat: 'car', every: M },
  { name: 'Service the car', cat: 'car', every: Y },
  { name: 'Back up the photos', cat: 'digital', every: M3 },
  { name: 'Review subscriptions and insurance', cat: 'admin', every: Y },
];

export const hasStarter = (d: Pick<LitterData, 'chores'>, s: Pick<Starter, 'name'>) => d.chores.some((c) => keyOfName(c.name) === keyOfName(s.name));

// Adds the chosen ideas (not the ones that are already there). Each is first due a little way ahead, the longer its interval the
// further, so a handful of new chores don't all land on the same day; every date can be changed afterwards.
export function addStarters(d: LitterData, picks: Starter[], today: number): { data: LitterData; added: number } {
  let data = d, added = 0;
  for (const s of picks) {
    if (hasStarter(data, s)) continue;
    const start = firstDue(today + Math.min(30, Math.round(approxDays(s.every) / 4)) + added % 3, s.prefer ?? null);
    const r = addChore(data, {
      name: s.name, cat: s.cat, note: '', every: s.every, prefer: s.prefer ?? null, early: false, rolling: false, pile: !!s.pile, lead: defaultLead(s.every),
      remind: true, repeat: defaultRepeat(s.every), buy: s.buy ?? '', next: start,
    });
    if (!r) break;
    data = r.data;
    added++;
  }
  return { data, added };
}
