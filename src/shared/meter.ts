// The stat line at the top of each screen, drawn the same everywhere (Habit Kitty's style): one row of text over one bar.
//   HP 397                97/300 to lvl 3
//   [■■■■■■■■□□]
// The look is in web/page.html (.meter); the numbers come from player.ts.
import type { StatLine } from '../player.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

// `line` is null while the number is not known yet.
export function meterHtml(kind: 'lv' | 'hp' | 'mp', tag: string, line: StatLine | null): string {
  const lit = line?.lit ?? 0;
  const bar = Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('');
  return `<div class="meter m-${kind}">
    <div class="meter-row"><span><b class="stat-tag">${tag}</b> <b class="num">${line ? esc(line.total) : '…'}</b>${line?.extra ? ` <span class="muted">· ${esc(line.extra)}</span>` : ''}</span>
      <span class="muted num">${line ? esc(line.progress) : ''}</span></div>
    <div class="bar" role="img" aria-label="${esc(line?.label ?? `${tag} not known yet`)}">${bar}</div></div>`;
}
