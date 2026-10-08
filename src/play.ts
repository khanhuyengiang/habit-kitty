// Terminal playground for the rules engine: `npm run play`.
// State is saved to save.json; `skip` fast-forwards a fake clock so you can see days pass.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  CONFIG, newState, adoptCat, feedCat, startSitter, resumeCat, settleAll,
  addMindfulTask, doMindfulTask, dayIndex, levelProgress, hunger, sitterCooldownLeft,
  type ActionResult, type AppState, type Cat, type GameEvent,
} from './rules.ts';
import { dateOf, monthGrid, streak, type DayKind } from './calendar.ts';

const SAVE = 'save.json';
type Save = { state: AppState; offsetHours: number };

function load(): Save {
  if (!existsSync(SAVE)) return { state: newState(), offsetHours: 0 };
  const save: Save = JSON.parse(readFileSync(SAVE, 'utf8'));
  save.state.cats = save.state.cats.map((c) => {
    // saves from before feeding history existed only know the last feeding day
    if (!c.fedDays) c = { ...c, fedDays: c.lastFedDay === null ? [] : [c.lastFedDay] };
    if (!c.sitterTrips) c = { ...c, sitterTrips: guessSitterTrips(c) };
    return c;
  });
  return save;
}

// Old saves only kept the latest trip's start. A finished trip's end wasn't stored,
// so assume the cat came home on the first feeding after it left.
function guessSitterTrips(c: Cat): Cat['sitterTrips'] {
  const start = c.lastSitterStartDay;
  if (start === null) return [];
  if (c.status === 'sitter') return [{ start, end: null }];
  if (c.status === 'gone') return [{ start, end: c.endedDay }];
  const firstFedAfter = c.fedDays.find((d) => d > start) ?? c.settledDay;
  return [{ start, end: Math.min(firstFedAfter, start + CONFIG.sitterMaxDays) }];
}
const persist = () => writeFileSync(SAVE, JSON.stringify(save, null, 2));

let save = load();
const now = () => new Date(Date.now() + save.offsetHours * 3_600_000);

const describe = (e: GameEvent, s: AppState) => {
  const name = s.cats.find((c) => c.id === e.catId)?.name ?? e.catId;
  switch (e.type) {
    case 'starved': return `😿 ${name} went hungry (${e.missed} missed day${e.missed > 1 ? 's' : ''})`;
    case 'died': return `💀 ${name} died.`;
    case 'ranAway': return `🏃 ${name} ran away! Do the habit to win them back.`;
    case 'leftWithSitter': return `🧳 ${name} stayed with the sitter for good.`;
    case 'returned': return `🎉 ${name} came back!`;
    case 'leftForever': return `👋 ${name} left for good.`;
  }
};

const report = (r: ActionResult, success: string) => {
  save.state = r.state;
  for (const e of r.events) console.log(describe(e, r.state));
  console.log(r.ok ? success : `✗ can't do that: ${r.reason}`);
};

const findCat = (name: string) =>
  save.state.cats.find((c) => c.name.toLowerCase() === name.toLowerCase());

function settle() {
  const settled = settleAll(save.state, now());
  save.state = settled.state;
  for (const e of settled.events) console.log(describe(e, save.state));
}

function status() {
  settle();

  const today = dayIndex(now());
  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(save.state.xp);
  console.log(`\n📅 ${now().toLocaleString()}   ❤️  xp ${save.state.xp}  (level ${level}, ${xpIntoLevel}/${xpForNextLevel})`);
  if (!save.state.cats.length) console.log('No cats yet. Try: adopt Mochi Meditate');
  for (const c of save.state.cats) {
    const extra =
      c.status === 'alive' ? hunger(c, today)
      : c.status === 'sitter' ? `day ${today - (c.sitterStartDay ?? today)} of 7`
      : '';
    const cd = sitterCooldownLeft(c, today);
    console.log(`  🐱 ${c.name} [${c.habit}, ${c.mode}]  ${c.status} ${extra}${cd ? `  (sitter cooldown ${cd}d)` : ''}`);
  }
  for (const t of save.state.tasks) console.log(`  🧘 ${t.name} (+${t.xp} xp, every ${t.cooldownDays}d)`);
  console.log();
}

// ===================== Heatmap =====================
const px = (code: number) => `\x1b[48;5;${code}m  \x1b[0m`;
const PIXEL: Record<DayKind, string> = { fed: px(34), missed: px(124), today: px(178), sitter: px(25), none: px(236) };

function heatmap(cat: Cat, year: number, month: number, today: number) {
  const { title, lead, days, count, tracked } = monthGrid(cat, year, month, today);
  console.log(`\n🐱 ${cat.name} · ${cat.habit} · ${title}`);
  console.log('Mo Tu We Th Fr Sa Su');
  const cells = [...Array(lead).fill('  '), ...days.map((d) => PIXEL[d.kind])];
  for (let i = 0; i < cells.length; i += 7) console.log(cells.slice(i, i + 7).join(' '));

  // only days you were expected to feed count; sitter days and today-so-far don't
  const away = count.sitter ? ` · ${count.sitter} day${count.sitter > 1 ? 's' : ''} with sitter` : '';
  if (!tracked) { console.log(count.sitter ? `with the sitter all month` : 'not tracked this month'); return; }
  const pct = Math.round((100 * count.fed) / tracked);
  console.log(`fed ${count.fed}/${tracked} days (${pct}%)${away} · current streak ${streak(cat, today)}`);
}

function heatmapCommand(args: string[]) {
  const today = dayIndex(now());
  const monthArg = args.find((a) => /^\d{4}-\d{1,2}$/.test(a));
  const name = args.filter((a) => a !== monthArg).join(' ');
  const [year, month] = monthArg
    ? monthArg.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n))
    : [dateOf(today).getUTCFullYear(), dateOf(today).getUTCMonth()];

  const cats = name ? save.state.cats.filter((c) => c.name.toLowerCase() === name.toLowerCase()) : save.state.cats;
  if (!cats.length) { console.log(name ? `no cat called "${name}"` : 'No cats yet.'); return; }
  for (const c of cats) heatmap(c, year, month, today);
  console.log(`\n${PIXEL.fed} fed  ${PIXEL.missed} missed  ${PIXEL.today} today, not yet  ${PIXEL.sitter} with sitter  ${PIXEL.none} not tracked\n`);
}

const HELP = `commands:
  adopt <name> <habit> [light]   adopt a cat (add "light" for light-hearted mode)
  feed <name>                    you did the habit today
  sitter <name> / resume <name>  send to / bring back from the pet sitter
  task <name> <xp 1-3>           add a mindful task;   do <name>   to complete it
  skip [days]                    fast-forward time (default 1 day; "skip 3h" for hours)
  heatmap [name] [YYYY-MM]       feeding calendar (default: all cats, this month)
  status, help, reset, quit`;

console.log('🐾 habit-kitty playground\n' + HELP);
status();

const rl = createInterface({ input: stdin, output: stdout, prompt: '> ' });
rl.prompt();
for await (const line of rl) {
  const [cmd, ...args] = line.trim().split(/\s+/);
  const cat = args[0] ? findCat(args[0]) : undefined;
  const catId = cat?.id ?? args[0] ?? '';

  switch (cmd?.toLowerCase()) {
    case 'adopt': {
      if (args.length < 2) { console.log('usage: adopt <name> <habit> [light]'); break; }
      const light = args.at(-1) === 'light';
      const habit = args.slice(1, light ? -1 : undefined).join(' ');
      report(
        adoptCat(save.state, { id: crypto.randomUUID(), name: args[0], habit, mode: light ? 'lighthearted' : 'classic' }, now()),
        `Welcome home, ${args[0]}!`,
      );
      break;
    }
    case 'feed': report(feedCat(save.state, catId, now()), `🍣 Fed ${args[0]}.`); break;
    case 'sitter': report(startSitter(save.state, catId, now()), `🧳 ${args[0]} is with the sitter.`); break;
    case 'resume': report(resumeCat(save.state, catId, now()), `🏠 ${args[0]} is back home.`); break;
    case 'task': {
      const xp = Number(args.at(-1));
      if (args.length < 2 || Number.isNaN(xp)) { console.log('usage: task <name> <xp 1-3>'); break; }
      const name = args.slice(0, -1).join(' ');
      save.state = addMindfulTask(save.state, { id: crypto.randomUUID(), name, xp }, now());
      console.log(`Added task "${name}".`);
      break;
    }
    case 'do': {
      const name = args.join(' ').toLowerCase();
      const task = save.state.tasks.find((t) => t.name.toLowerCase() === name);
      report(doMindfulTask(save.state, task?.id ?? name, now()), `✨ Did "${args.join(' ')}".`);
      break;
    }
    case 'skip': {
      const m = /^(\d+)(h?)$/.exec(args[0] ?? '1');
      if (!m) { console.log('usage: skip [days] or skip <n>h'); break; }
      save.offsetHours += Number(m[1]) * (m[2] ? 1 : 24);
      status();
      break;
    }
    case 'heatmap': case 'map': settle(); heatmapCommand(args); break;
    case 'status': case undefined: case '': status(); break;
    case 'reset': save = { state: newState(), offsetHours: 0 }; console.log('Fresh start.'); break;
    case 'help': console.log(HELP); break;
    case 'quit': case 'exit': persist(); rl.close(); process.exit(0);
    default: console.log(`unknown command "${cmd}". Type help.`);
  }
  persist();
  rl.prompt();
}
persist();
