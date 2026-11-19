// Habit Kitty's sound: Strawberry Walk loops in the background, kitties in the room meow now and then, and a petted kitty may purr or meow.
// Browsers only play sound after the first tap or key press, so the music starts then. It pauses while the app is hidden.
// The volumes live in the save (ctx.save()); the user's own music file stays on this device only.
import { Filesystem } from '@capacitor/filesystem';
import { $ } from '../shared/html.ts';
import { at, fileBytes, removeFile, toBase64, writeOk } from '../shared/files.ts';
import { readJson, setLocal, writeJson } from '../shared/local.ts';
import { provideMusic } from '../shared/music.ts';

export interface SoundSettings { sound?: Partial<Record<SoundKind, number>>; muted?: boolean }
interface SoundContext {
  save: () => SoundSettings;     // the live save (it is replaced on a restore, so it is asked for each time)
  persist: () => void;
  toast: (text: string) => void;
  roomAwake: () => boolean;      // the room is showing and the kitties are up: they may meow
}
let ctx: SoundContext;

declare const __SOUNDS__: Record<SoundKind, string>;   // file paths in the app, data URLs on the website (web/build.js)
export type SoundKind = 'bgm' | 'meow' | 'purr';
const SOUND_DEFAULTS: Record<SoundKind, number> = { bgm: 40, meow: 70, purr: 70 };
const MEOW_EVERY_MS = 15_000, MEOW_CHANCE = 0.12;      // a random meow about every two minutes in the room
const levelOf = (k: SoundKind) => Math.min(100, Math.max(0, ctx.save().sound?.[k] ?? SOUND_DEFAULTS[k]));   // the slider
const volumeOf = (k: SoundKind) => (ctx.save().muted ? 0 : levelOf(k));                                     // what plays
let soundOk = false;
let music: HTMLAudioElement | null = null;
let purring: HTMLAudioElement | null = null;

// The user's own music replaces Strawberry Walk. The file stays on this device only (not in the save or a backup),
// so what it is lives in localStorage like the theme. Its gain turns a loud song down to about as loud as the meows.
interface OwnMusic { name: string; type: string; gain: number }
const MUSIC_KEY = 'hk-music', MUSIC_DIR = 'habit-kitty-music', MUSIC_FILE = 'bgm';
const MUSIC_MAX_BYTES = 20_000_000;
const MUSIC_TARGET_DB = -20;   // RMS level of Strawberry Walk, which matches the meows and purrs
let ownMusic = readJson<OwnMusic>(MUSIC_KEY);
let musicUrl: string | null = null;   // what plays: an object URL for the user's own file, else Strawberry Walk; null while loading

export function syncMusic() {
  const v = volumeOf('bgm') / 100;
  if (!soundOk || !v || document.hidden || !musicUrl) { music?.pause(); return; }
  if (!music) { music = new Audio(); music.loop = true; }
  if (music.dataset.src !== musicUrl) { music.dataset.src = musicUrl; music.src = musicUrl; }
  music.volume = v * (ownMusic && musicUrl !== __SOUNDS__.bgm ? ownMusic.gain : 1);
  if (music.paused) music.play().catch(() => { /* not allowed yet: the next tap tries again */ });
}

async function loadMusic() {
  const bytes = ownMusic ? await fileBytes(MUSIC_FILE, MUSIC_DIR) : undefined;
  if (musicUrl?.startsWith('blob:')) URL.revokeObjectURL(musicUrl);
  musicUrl = bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: ownMusic?.type })) : __SOUNDS__.bgm;
  syncMusic();
  renderSound();
}

// How much to turn a song down so it plays about as loud as Strawberry Walk (never up: an audio element can't go past 1).
// Decoding also checks the file is music this device can play.
async function musicGain(file: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    let sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i += 4) { sum += d[i] * d[i]; n++; }
    }
    const db = 10 * Math.log10(sum / Math.max(1, n) || 1e-10);
    return Math.min(1, 10 ** ((MUSIC_TARGET_DB - db) / 20));
  } finally { ctx.close().catch(() => {}); }
}

async function useOwnMusic(file: File) {
  if (file.size > MUSIC_MAX_BYTES) { ctx.toast('That song is too big. Pick one under 20 MB.'); return; }
  ctx.toast('Loading your music…');
  const gain = await musicGain(file).catch(() => null);
  if (gain === null) { ctx.toast("Couldn't play that file. Try an MP3."); return; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ok = await writeOk(() => Filesystem.writeFile({ ...at(MUSIC_FILE, MUSIC_DIR), data: toBase64(bytes), recursive: true }));
  if (!ok) { ctx.toast("Couldn't store that song on the device. Try again."); return; }
  ownMusic = { name: file.name.replace(/\.[^.]+$/, '') || 'Your music', type: file.type || 'audio/mpeg', gain };
  writeJson(MUSIC_KEY, ownMusic);   // not stored: plays until the app closes
  await loadMusic();
  ctx.toast(`Now playing ${ownMusic.name}.`);
}

export async function useDefaultMusic() {
  ownMusic = null;
  setLocal(MUSIC_KEY, null);
  await removeFile(MUSIC_FILE, MUSIC_DIR);
  await loadMusic();
  ctx.toast('Back to Strawberry Walk.');
}

export function playSound(k: 'meow' | 'purr') {
  const v = volumeOf(k) / 100;
  if (!soundOk || !v || document.hidden) return;
  if (k === 'purr' && purring && !purring.ended) return;   // one purr at a time, however fast the petting
  const a = new Audio(__SOUNDS__[k]);
  a.volume = v;
  if (k === 'purr') purring = a;
  a.play().catch(() => {});
}

const allowSound = () => { soundOk = true; if (music?.paused !== false) syncMusic(); };


export function renderSound() {
  for (const k of ['bgm', 'meow', 'purr'] as const) {
    const v = levelOf(k), input = $<HTMLInputElement>(`vol-${k}`);
    input.value = String(v);
    input.style.setProperty('--fill', `${ctx.save().muted ? 0 : v}%`);
    $(`vol-${k}-out`).textContent = ctx.save().muted ? 'Muted' : v ? `${v}%` : 'Off';
  }
  const mute = $('mute-all');
  mute.textContent = ctx.save().muted ? 'Unmute all' : 'Mute all';
  mute.setAttribute('aria-pressed', String(!!ctx.save().muted));
  $('music-now').textContent = `Playing: ${ownMusic ? ownMusic.name : 'Strawberry Walk'}`;
  $('music-reset').hidden = !ownMusic;
}
export function toggleMute() {
  ctx.save().muted = !ctx.save().muted;
  ctx.persist(); renderSound(); syncMusic();
  if (ctx.save().muted) purring?.pause();
  ctx.toast(ctx.save().muted ? 'Every sound is off.' : 'Sound is back on.');
}

// Starts the sound: the sliders and the music file input in Settings, the first-tap unlock and the room's meows.
export function initSound(c: SoundContext) {
  ctx = c;
  document.addEventListener('click', allowSound, true);
  document.addEventListener('keydown', allowSound, true);
  document.addEventListener('visibilitychange', syncMusic);
  setInterval(() => {
    if (!ctx.roomAwake() || Math.random() > MEOW_CHANCE) return;
    if ([...document.querySelectorAll<HTMLElement>('#room .pet')].some((el) => el.dataset.nap !== '1')) playSound('meow');
  }, MEOW_EVERY_MS);
  $('music-file').addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) useOwnMusic(f);
  });
  for (const k of ['bgm', 'meow', 'purr'] as const) {
    const input = $<HTMLInputElement>(`vol-${k}`);
    input.addEventListener('input', () => {
      ctx.save().sound = { ...ctx.save().sound, [k]: Number(input.value) };
      ctx.save().muted = false;   // moving a slider means you want to hear it
      renderSound();
      if (k === 'bgm') syncMusic();
    });
    input.addEventListener('change', () => { ctx.persist(); if (k !== 'bgm') playSound(k); });   // let go of a slider: hear how loud it is
  }
  provideMusic({
    volume: () => volumeOf('bgm'),
    setVolume: (v, keep) => { ctx.save().sound = { ...ctx.save().sound, bgm: v }; ctx.save().muted = false; renderSound(); syncMusic(); if (keep) ctx.persist(); },
    playing: () => (ownMusic ? ownMusic.name : 'Strawberry Walk'),
  });
  loadMusic();
}
