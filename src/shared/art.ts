// The app's button icons, weather, calendar marks, decorations, Habit Kitty's heart and the scenes (./scene.ts), drawn on the shared grid (./pixelart.ts).
// Pure functions that return SVG strings.
import { artSvg, monoSvg } from './pixelart.ts';
import { fineSvg } from './stickers.ts';
export { PAL, artSvg } from './pixelart.ts';

// The official button icons; ICONS below has Kitty Gallery's changes put over them (src/pixel/live.ts).
export const OFFICIAL_ICONS: Readonly<Record<string, string[]>> = {
  x: ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'],
  tick: ['....o', '...oo', 'o.oo.', '.ooo.', '..o..'],
  check: ['........o', '.......oo', 'o.....oo.', 'oo...oo..', '.oo.oo...', '..ooo....', '...o.....'],
  home: ['....o....', '...ooo...', '..ooooo..', '.ooooooo.', '..ooooo..', '..oo.oo..', '..oo.oo..'],
  player: ['..ooo..', '.ooooo.', '.ooooo.', '..ooo..', 'ooooooo', 'ooooooo', 'ooooooo'],
  pencil: ['.....oo', '....o.o', '...o.o.', '..o.o..', '.o.o...', 'ooo....', 'o......'],
  rewind: ['...o...o.', '..oo..oo.', '.ooo.ooo.', 'oooooooo.', '.ooo.ooo.', '..oo..oo.', '...o...o.'],
  dice: ['ooooooooo', 'o.......o', 'o.o...o.o', 'o.......o', 'o...o...o', 'o.......o', 'o.o...o.o', 'o.......o', 'ooooooooo'],
  prev: ['..o', '.o.', 'o..', '.o.', '..o'],
  next: ['o..', '.o.', '..o', '.o.', 'o..'],
  gear: ['....o....', '.o.ooo.o.', '..ooooo..', '.ooo.ooo.', 'ooo...ooo', '.ooo.ooo.', '..ooooo..', '.o.ooo.o.', '....o....'],
  sun: [
  '....o....',
  '.o.....o.',
  '...ooo...',
  '..ooooo..',
  'o.ooooo.o',
  '..ooooo..',
  '...ooo...',
  '.o.....o.',
  '....o....',
],
  moon: [
  '...ooo..',
  '..oo..o.',
  '.oo.....',
  '.oo.....',
  '.oo.....',
  '.oo.....',
  '..oo..o.',
  '...ooo..',
  '........',
],
  clock: ['..ooooo..', '.o.....o.', 'o...o...o', 'o...o...o', 'o...ooo.o', 'o.......o', 'o.......o', '.o.....o.', '..ooooo..'],
  // tab bar
  room: ['.....o.....', '....ooo....', '...ooooo...', '..ooooooo..', '.ooooooooo.', 'ooooooooooo', '.ooooooooo.', '.ooo...ooo.', '.ooo...ooo.', '.ooo...ooo.'],
  treats: ['...ooo.....', '.ooooooo..o', 'oo.oooooooo', 'ooooooooooo', '.ooooooo..o', '...ooo.....'],
  // a calendar with two rings, a header band and a 4 x 3 grid of days
  heat: ['..oo...oo..', '..oo...oo..', 'ooooooooooo', 'ooooooooooo', 'o.........o', 'o.o.o.o.o.o', 'o.........o', 'o.o.o.o.o.o', 'o.........o', 'ooooooooooo'],
  // a closed book: two title lines on the cover, the page edge and a bookmark
  diary: ['ooooooooo', 'ooooooooo', 'oo.....oo', 'ooooooooo', 'oo.....oo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'o........', 'ooooooooo', '.oo......'],
};
export const ICONS: Record<string, string[]> = { ...OFFICIAL_ICONS };

export const iconSvg = (name: string, cls = '') => monoSvg(ICONS[name], cls);

// ---- weather, for the Meteorokinesis diary option (13 x 10, Kitty Gallery's letters: see FINE in ./stickers.ts) ----
// The official weather, in the diary's order; WEATHER has Kitty Gallery's changes and new weather put over it (src/pixel/live.ts).
export const OFFICIAL_WEATHER: Readonly<Record<string, { label: string; art: string[] }>> = {
  sunny: { label: 'Sunny', art: ['......y......', '.y....y....y.', '..y.@@@@@.y..', '....@yyy@....', '.y.@yyyyy@.y.', 'yyy@yyyyy@yyy', '.y.@yyyyy@.y.', '....@yyy@....', '..y.@@@@@.y..', '......y......'] },
  cloudy: { label: 'Cloudy', art: ['.............', '.....QQQQ....', '...QQ%%%%QQ..', '..Q%%ww%%%%Q.', '.Q%%%%%%%%%%Q', 'Q%%%%%%%%%%%Q', 'Q%%%%%%%%%%%Q', '.Q%%%%%%%%%Q.', '..QQQQQQQQQ..', '.............'] },
  windy: { label: 'Windy', art: ['.............', '.bbbbbbbbb...', '.........b.b.', '..........bb.', '.............', '..bbbbbbbb...', '..........b.b', '...........bb', '.bbbbb.......', '.............'] },
  rainy: { label: 'Rainy', art: ['.....QQQQ....', '...QQ%%%%QQ..', '..Q%%ww%%%%Q.', '.Q%%%%%%%%%%Q', 'Q%%%%%%%%%%%Q', '.QQQQQQQQQQQ.', '..b..b..b....', '.b..b..b..b..', '.b..b..b.....', '..b..b..b.b..'] },
  storm: { label: 'Storm', art: ['.....QQQQ....', '...QQLLLLQQ..', '..QLLwwLLLLQ.', '.QLLLLLLLLLLQ', 'QLLLLLLLLLLLQ', '.QQQQQQQQQQQ.', '.....yy......', '....yy.......', '...yyyy......', '.....yy......'] },
  snow: { label: 'Snow', art: ['.....QQQQ....', '...QQ%%%%QQ..', '..Q%%ww%%%%Q.', '.Q%%%%%%%%%%Q', 'Q%%%%%%%%%%%Q', '.QQQQQQQQQQQ.', '..w...w...w..', '....w...w....', '..w...w...w..', '....w...w....'] },
};
export const WEATHER: Record<string, { label: string; art: string[] }> = { ...OFFICIAL_WEATHER };
// A weather's picture; nothing for one that is not there any more (deleted in Kitty Gallery).
export const weatherSvg = (k: string) => (WEATHER[k] ? fineSvg(WEATHER[k].art, 'weather') : '');
// A weather's name; one that is not there any more keeps its id as its name.
export const weatherLabel = (k: string) => WEATHER[k]?.label ?? k.charAt(0).toUpperCase() + k.slice(1);

// ---- the petting heart ----
const HEART_ART = ['.oo..oo.', 'orroorro', 'orwrrrro', 'orrrrrro', '.orrrro.', '..orro..', '...oo...'];
export const petHeartSvg = () => artSvg(HEART_ART, 'heart-art', { o: '#c23f7c', r: '#ff7d9f', w: '#ffe3ee' });

// ---- the little symbol at the end of a thought bubble ----
export const MARKS: Record<string, string[]> = {
  dots: ['o.o.o'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  'heart-outline': ['.oo.oo.', 'o..o..o', 'o.....o', '.o...o.', '..o.o..', '...o...'],
  question: ['.ooo.', 'o...o', '....o', '..oo.', '..o..', '.....', '..o..'],
};
export const markSvg = (name: string) => artSvg(MARKS[name], 'mark');

// ---- the diary book and the trophy ----
// (Cat food is any sticker the kitties can eat: PICKER_ICONS with food: true, in ./sticker-icons.ts.)

// Decorations: the official pictures that are drawn in one place only. DECOS has Kitty Gallery's changes put over them.
// The wing beside the chosen app on the home screen (after inspo/menu.jpg): the tip up and out, three tiers of feathers
// whose tips notch the outer edge, and a round joint with a curl at the bottom, next to the key. This is the left one; the
// right is drawn mirrored. H outline (lavender400), [ white, { feather line (grey400).
export const OFFICIAL_DECOS: Readonly<Record<string, { label: string; art: string[] }>> = {
  wing: { label: 'Wing', art: [
    '.HH.........',
    'H[[HH.......',
    'H[[[[HH.....',
    '.H[[[[[HH...',
    'H{{{{[[[[H..',
    'H[[[[[[[[[H.',
    '.H{{{[[[[[[H',
    'H[[[[[HHH[[H',
    'H[[[[H[[[H[H',
    '.H{{{H[{[H[H',
    '..H[[H[[[H[H',
    '...HHHHHHHH.',
  ] },
};
export const DECOS: Record<string, { label: string; art: string[] }> = { ...OFFICIAL_DECOS };
// The diary book, the trophy, the cosy room and the garden live in ./scene.ts.
export { BOOK_ART, TROPHY_ART, ROOM_W, ROOM_H, SHELF_BOOK, SHELF_TROPHY, ROOM_SPOTS, ROOM_NIGHT_SPOTS, GARDEN_SPOTS, roomSvg, outdoorSvg, sceneVersion, type Phase } from './scene.ts';
