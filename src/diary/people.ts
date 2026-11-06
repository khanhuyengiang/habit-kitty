// Birthdays, pure so they can be tested. Days are calendar-day indices (see ../calendar.ts), so there are no time zones in here.
import { dateOf, dayOf } from '../calendar.ts';
import type { Person } from '../store.ts';

export const MAX_PEOPLE = 200;
const NAME_MAX = 40, NOTE_MAX = 200;
const daysIn = (month: number) => new Date(Date.UTC(2024, month, 0)).getUTCDate();   // a leap year, so 29 February is allowed

export interface PersonInput { name: string; month: number; day: number; year: number | null; note: string }

// Errors by field; an empty object when the person is fine.
export function personErrors(p: PersonInput, thisYear: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = p.name.trim();
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > NAME_MAX) errors.name = `Keep the name to ${NAME_MAX} characters.`;
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) errors.month = 'Choose a month.';
  else if (!Number.isInteger(p.day) || p.day < 1 || p.day > daysIn(p.month)) errors.day = `Choose a day from 1 to ${daysIn(p.month)}.`;
  if (p.year !== null && (!Number.isInteger(p.year) || p.year < 1900 || p.year > thisYear)) errors.year = `Enter a year from 1900 to ${thisYear}, or leave it empty.`;
  if (p.note.trim().length > NOTE_MAX) errors.note = `Keep the note to ${NOTE_MAX} characters.`;
  return errors;
}

export const personFrom = (p: PersonInput, id: string): Person => ({
  id, name: p.name.replace(/\s+/g, ' ').trim(), month: p.month, day: p.day,
  ...(p.year !== null && { year: p.year }), ...(p.note.trim() && { note: p.note.trim() }),
});

// A 29 February birthday is kept on 28 February in a year that has no 29th.
function dayIn(year: number, p: Person): number {
  const leap = daysIn(2) === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  return dayOf(year, p.month - 1, p.month === 2 && p.day === 29 && !leap ? 28 : p.day);
}

// Who has a birthday on this day (a day index), by name.
export function birthdaysOn(people: Person[], day: number): Person[] {
  const year = dateOf(day).getUTCFullYear();
  return people.filter((p) => dayIn(year, p) === day).sort((a, b) => a.name.localeCompare(b.name));
}

// Days until the next birthday: 0 today, 1 tomorrow...
export function daysUntil(p: Person, today: number): number {
  const year = dateOf(today).getUTCFullYear();
  const this_ = dayIn(year, p);
  return this_ >= today ? this_ - today : dayIn(year + 1, p) - today;
}

// The age they turn on the next birthday, or null when the birth year is not known.
export function turning(p: Person, today: number): number | null {
  if (p.year === undefined) return null;
  const year = dateOf(today).getUTCFullYear();
  return (dayIn(year, p) >= today ? year : year + 1) - p.year;
}

// The next birthdays first, up to `limit`.
export function upcoming(people: Person[], today: number, limit = 5): { person: Person; in: number; turning: number | null }[] {
  return people.map((person) => ({ person, in: daysUntil(person, today), turning: turning(person, today) }))
    .sort((a, b) => a.in - b.in || a.person.name.localeCompare(b.person.name))
    .slice(0, limit);
}

export const whenText = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);
