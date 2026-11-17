// Date helpers every app uses. Nothing here knows about the day-start hour (that is rules.ts's dayIndex).

export const two = (n: number) => String(n).padStart(2, '0');

// The local calendar day of a moment, as "YYYY-MM-DD".
export const localDateKey = (t: Date | number = new Date()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

// Day indices count local calendar days since 1970-01-01, so UTC getters recover the date.
export const dateOf = (day: number) => new Date(day * 86_400_000);
export const dayOf = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86_400_000);
