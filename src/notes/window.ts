// The little program window's title bar (a kitty, the name, three window keys) and the note colours. Shared by the Notes cards
// and by the Diary (a linked note shows as one of these bars). Styled in web/notes.html (.nwin, .nwin-bar).
import { monoSvg } from '../shared/pixelart.ts';
import { miniSvg } from '../shared/pixelcat.ts';
import { esc } from '../shared/html.ts';
import type { NoteColor, NoteFace } from './model.ts';

export const COLOR: Record<NoteColor, [string, string]> = {
  pink: ['#ff8fb8', 'Pink'], lavender: ['#b9a3f0', 'Lavender'], blue: ['#8fd0fa', 'Blue'],
  mint: ['#8fe0c8', 'Mint'], lemon: ['#ffd36e', 'Lemon'], peach: ['#ffb98a', 'Peach'],
};
export const tint = (c: NoteColor) => `--nc: ${COLOR[c][0]}`;
// The title bar's cat is the outline of one of Habit Kitty's mini moods.
export const faceSvg = (f: NoteFace) => miniSvg(f, { fur: '#fff', pattern: 'plain' }, false, true);
const WIN = [['.....', '.....', '.....', '.....', 'ooooo'], ['ooooo', 'o...o', 'o...o', 'o...o', 'ooooo'], ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o']];
export const winBar = (name: string, face: NoteFace) => `<span class="nwin-bar"><span class="nwin-cat">${faceSvg(face)}</span><span class="nwin-name">${esc(name)}</span>
  <span class="nwin-btns" aria-hidden="true">${WIN.map((a) => `<span>${monoSvg(a)}</span>`).join('')}</span></span>`;
