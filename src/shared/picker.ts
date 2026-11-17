// The month and year picker (Habit Kitty's heatmaps, the diary's calendar): a grid of months, or of years, in a small
// dialog (./layer.ts). Months count as y * 12 + m (m 0-based); no month after `cur`, nor before `first`, can be picked.
import { iconSvg } from '../pixelart.ts';
import { closeX } from './ui.ts';

export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }));
const YEARS = 12;   // the current year, the ten before it and next year (greyed), 4 x 3

export interface PickerView { year: number; sel: number; cur: number; first?: number }   // year: the one shown; sel: the month showing now

const cell = (cls: string, data: string, label: string, on: boolean, off: boolean, aria = label) =>
  `<button type="button" class="pick${cls}" ${data} aria-pressed="${on}" aria-label="${aria}" ${off ? 'disabled' : ''}>${label}</button>`;

// The dialog's inside and its label.
export function pickerHtml(view: 'month' | 'year', p: PickerView): { html: string; label: string } {
  const first = p.first ?? -Infinity, curY = Math.floor(p.cur / 12);
  if (view === 'month') {
    return {
      label: `Pick a month in ${p.year}`,
      html: `${closeX()}<div class="picker-head"><button class="btn small" type="button" data-action="picker-years" aria-label="Back to years">${iconSvg('prev')}Back</button><strong>${p.year}</strong></div>
      <div class="pick-grid">${MONTH_NAMES.map((name, i) => {
        const ym = p.year * 12 + i;
        return cell(ym === p.cur ? ' now' : '', `data-action="picker-month" data-m="${i}"`, name, ym === p.sel, ym > p.cur || ym < first, `${name} ${p.year}`);
      }).join('')}</div>`,
    };
  }
  return {
    label: 'Pick a year',
    html: `${closeX()}<div class="picker-head"><strong>Pick a year</strong></div>
      <div class="pick-grid">${Array.from({ length: YEARS }, (_, i) => curY - YEARS + 2 + i).map((y) =>
        cell(y === curY ? ' now' : '', `data-action="picker-year" data-y="${y}"`, String(y), y === Math.floor(p.sel / 12), y > curY || (y + 1) * 12 <= first)).join('')}</div>`,
  };
}
