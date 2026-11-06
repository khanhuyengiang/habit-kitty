// The Notes options, drawn into the Settings screen under "Notes": the Obsidian folder, and export and import.
// They listen on their own container, so they work whichever screen is showing.
import { strToU8, zipSync } from 'fflate';
import { saveToDevice } from '../shared/backupfolder.ts';
import { allNotes, importNotes, notesInitialised, notesReady, onNotes } from './data.ts';
import { notesSyncStatus, onNotesSyncStatus, setNotesSync, syncNotes } from './folder.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

export function mountNotesSettings(el: HTMLElement, notify: (text: string) => void) {
  const draw = () => {
    const st = notesSyncStatus();
    const n = notesReady() ? allNotes().length : 0;
    el.innerHTML = `<details class="panel fold" open><summary>Obsidian folder</summary><div class="fold-body">
        <p class="muted">Keeps a copy of every note as a <b>.md</b> file in the <b>Notes</b> folder inside your backup folder (Settings → Backup), and picks up changes made there. Open that folder as a vault in Obsidian. Deleting a note in the app deletes it there too; deleting it in Obsidian does not delete it here.</p>
        ${st.available
          ? `<label class="check"><input type="checkbox" id="notes-sync" ${st.on ? 'checked' : ''}><span><b>Sync with the notes folder</b><br><span class="muted">${st.on ? (st.running ? 'Syncing…' : st.last ? `Last sync ${ago(st.last)}${st.summary ? `: ${esc(st.summary)}` : ''}.` : 'Not synced yet.') : 'Off.'}</span></span></label>
             ${st.error ? `<p class="form-error">${esc(st.error)}</p>` : ''}
             ${st.on ? `<div class="btns"><button class="btn" type="button" data-action="notes-sync-now" ${st.running ? 'disabled' : ''}>Sync now</button></div>` : ''}`
          : '<p class="muted">The notes folder is for the Android app. Here, use Export and Import below.</p>'}
      </div></details>
      <details class="panel fold"><summary>Export and import</summary><div class="fold-body">
        <p class="muted">Export saves all ${n} ${n === 1 ? 'note' : 'notes'} as a .zip of .md files. Import adds .md or .txt files as notes (a name that is taken gets a number; nothing is overwritten).</p>
        <div class="btns"><button class="btn" type="button" data-action="notes-export" ${n ? '' : 'disabled'}>Export notes…</button>
          <button class="btn" type="button" data-action="notes-import">Import notes…</button></div>
        <input type="file" id="notes-import-file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden>
      </div></details>`;
  };

  el.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    if (btn.dataset.action === 'notes-sync-now') { await syncNotes(); const e = notesSyncStatus().error; if (e) notify(e); }
    else if (btn.dataset.action === 'notes-import') el.querySelector<HTMLInputElement>('#notes-import-file')?.click();
    else if (btn.dataset.action === 'notes-export') {
      try {
        const files: Record<string, Uint8Array> = {};
        for (const note of allNotes()) files[`${note.name}.md`] = strToU8(note.text);
        const where = await saveToDevice(`kitty-notes-${new Date().toISOString().slice(0, 10)}.zip`, zipSync(files));
        if (where !== null) notify(where ? `Notes saved: ${where}` : 'Notes downloaded.');
      } catch { notify("Couldn't save the notes. Try again."); }
    }
  });
  el.addEventListener('change', async (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'notes-sync') { await setNotesSync(t.checked); return; }
    if (t.id === 'notes-import-file') {
      const files = [...(t.files ?? [])].slice(0, 200);
      t.value = '';
      const items = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const added = await importNotes(items);
      notify(added ? `Imported ${added} ${added === 1 ? 'note' : 'notes'}.` : 'Nothing was imported. The files must be .md or .txt and under 200 KB.');
    }
  });
  // Redraw when something changes, but never under the cursor.
  const redraw = () => { if (!el.contains(document.activeElement) || (document.activeElement as HTMLElement).tagName === 'BODY') draw(); };
  onNotesSyncStatus(redraw);
  onNotes(redraw);
  notesInitialised.then(draw);
  draw();
}
