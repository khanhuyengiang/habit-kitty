// Keeping the notes folder (Notes/ inside the backup folder, which Obsidian can open) and the app's notes in step.
// This is only the planning; src/notes/data.ts does the reading and writing.
//
// After a sync we remember, for each note, the time of both copies. A copy has changed when its time is not what we remembered:
//   only here changed  -> push to the folder      only there changed -> pull from the folder
//   both changed (or never synced and both exist) -> conflict: the executor compares the texts, and when they differ the newer wins
//   and the other is kept as "<name> (conflict)", so nothing is ever lost
// Deleting is not synced: a note deleted on one side comes back from the other, unless it is deleted in the app (then the app removes
// the folder's copy too, see data.ts). Deleting in Obsidian never deletes in the app.
export interface SyncMark { l: number; r: number }              // the local and the remote time after the last sync
export type SyncState = Record<string, SyncMark>;
export interface SyncAction { type: 'push' | 'pull' | 'conflict'; name: string }

export function planSync(local: { name: string; mtime: number }[], remote: { name: string; modified: number }[], state: SyncState): SyncAction[] {
  const here = new Map(local.map((n) => [n.name, n.mtime]));
  const there = new Map(remote.map((n) => [n.name, n.modified]));
  const out: SyncAction[] = [];
  for (const name of [...new Set([...here.keys(), ...there.keys()])].sort()) {
    const l = here.get(name), r = there.get(name);
    if (l !== undefined && r === undefined) { out.push({ type: 'push', name }); continue; }
    if (l === undefined && r !== undefined) { out.push({ type: 'pull', name }); continue; }
    const mark = state[name];
    if (!mark) { out.push({ type: 'conflict', name }); continue; }
    const lChanged = l !== mark.l, rChanged = r !== mark.r;
    if (lChanged && rChanged) out.push({ type: 'conflict', name });
    else if (lChanged) out.push({ type: 'push', name });
    else if (rChanged) out.push({ type: 'pull', name });
  }
  return out;
}
