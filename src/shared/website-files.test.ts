// On the website Capacitor's Filesystem keeps a file as the string it was written with (see browser in fsmock.ts), so text
// written as UTF-8 has to be read as UTF-8. These pages and notes used to vanish after a reload there.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/filesystem', async () => (await import('../test/fsmock.ts')).fsModule);
const { browser, fsModule } = await import('../test/fsmock.ts');
const { Filesystem } = fsModule;
const notes = await import('../notes/data.ts');
const diary = await import('../diary/data.ts');
const { dayOf } = await import('./dates.ts');

describe('text files on the website', () => {
  it('reads back the notes, diary pages, reflections and diary settings written before a reload', async () => {
    browser.on = true;
    const utf8 = (path: string, data: string) => Filesystem.writeFile({ path, data, encoding: 'utf8' });
    await utf8('habit-kitty-notes/Ideas.md', '# Ideas\nCafé ☕ and more');
    await utf8('habit-kitty/diary/2026-10-01.md', '---\nmood: calm\nupdated: 1\n---\nA good day ☀\n');
    await utf8('habit-kitty/reflections/2026-10.md', '---\nupdated: 2\n---\nA calm month\n');
    await utf8('habit-kitty/diary.json', JSON.stringify({ starry: true }));
    await notes.initNotes();
    await diary.initDiary();
    expect(notes.noteOf('Ideas')?.text).toBe('# Ideas\nCafé ☕ and more');
    expect(diary.entryOf(dayOf(2026, 9, 1))).toMatchObject({ mood: 'calm', text: 'A good day ☀' });
    expect(diary.reflectionOf('2026-10')?.text).toBe('A calm month');
    expect(diary.diaryExtras()).toEqual({ starry: true });   // the saved choice, not a new diary's every option on
  });
});
