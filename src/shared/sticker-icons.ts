// The icons people can put on an achievement or a side quest, drawn at 18×18 on the fine grid (see fineSvg in ./stickers.ts).
// Letters: s the side-quest colour (lit and shaded at the edges for you; l and d paint it lit or shaded by hand), o a dark line, w white, y/Y yellow/gold,
// r pink, R red, g/G green, b/B blue, n/N brown, k/K grey, c cream, v lavender, f peach, x lime; each note colour lit/shaded:
// p/P pink, a/A lavender, i/I sky, m/M mint, j/J sun, u/U peach, z/Z lime; '.' is empty. The dark outline is part of the
// art (draw it with o); the side-quest colour's edges that touch the outside are lit and shaded for you. Icon names are stored with the data: rename none, only add.
// `group` sorts the icons in Kitty Gallery and the pickers; without one an icon is in the "default" group. Order here doesn't
// matter: each group is listed A to Z by label.
// These are the OFFICIAL icons. The app draws from PICKER_ICONS below, which is these with Kitty Gallery's drawings put over
// them (see src/pixel/live.ts), so an icon drawn there can be picked everywhere as if it had always been here.

// `food`: the kitties can eat it (Habit Kitty's feed button gives each kitty a different one every day).
export interface PickerIcon { label: string; art: string[]; group?: string; food?: boolean }
export const OFFICIAL_PICKER_ICONS: Readonly<Record<string, PickerIcon>> = {
  star: { label: 'Star', group: 'nature n weather', art: [
    '........oo........', '.......ollo.......', '.......oldo.......', '......olwslo......', '......olssdo......', '.ooooolwssslooooo.',
    'olllllsssssslllllo', '.olssssssssssssdo.', '..olsssossosssdo..', '...olrssssssrdo...', '....olssssssdo....', '....olssssssdo....',
    '...olsssddssslo...', '...olssdoolssdo...', '..olssdo..olsslo..', '..olddo....olddo..', '.oldoo......oollo.', '..oo..........oo..'] },
  heart: { label: 'Heart', art: [
    '..................', '...oooo....oooo...', '..ollllo..ollllo..', '.olssssloolsssslo.', 'olswwsssllsssssslo', 'olwwssssssssssssdo',
    'olwsssssssssssssdo', 'olssssssssssssssdo', '.olssssssssssssdo.', '.olssssssssssssdo.', '..olssssssssssdo..', '...olssssssssdo...',
    '....olssssssdo....', '.....olssssdo.....', '......olssdo......', '.......oldo.......', '........oo........', '..................'] },
  food: { label: 'Food', group: 'food', food: true, art: [
    '.............o.o..', '............oNoNo.', '...........oNoNo..', '.....o.o..oNoNo...', '....owowooNoNo....', '...ooowooNoNooo...',
    '..occcccNcNcccco..', '.ocyycccgccRccgco.', 'oooooooooooooooooo', 'olssssssssssssssdo', 'olwsssssssssssssdo', '.olssssssssssssdo.',
    '.olssssssssssssdo.', '..olssssssssssdo..', '...oldssssssddo...', '....oolssssdoo....', '....olddddddlo....', '.....oooooooo.....'] },
  coffee: { label: 'Drink 1', group: 'food', art: [
    '..................', '.....o...o........', '....owo.owo.......', '.....owo.owo......', '....owo.owo.......', '..ooooooooooo.....',
    '.olllllllllllo....', '.olNNNNNNNNNdooo..', '.olsssssssssslllo.', '.olwssssssssdoolo.', '.olwssssssssdoolo.', '.olsssssssssslldo.',
    '.olsssssssssdooo..', '.oolsssssssdooo...', 'okkkkkkkkkkkkkko..', '.okkkkkkkkkkkko...', '..oooooooooooo....', '..................'] },
  cake: { label: 'Cake', group: 'food', food: true, art: [
    '........o.........', '.......oYo........', '......oyYyo.......', '.......oyo........', '.......oro........', '..ooooooroooooo...',
    '.owwwwwwwwwwwwwo..', '.owwwwwwwwwwwwwwo.', '.owswwwswwwwswwwo.', '.odsrsssssrssssdo.', '.odssssssssssssdo.', '.occcccccccccccco.',
    '.odssssssssssssdo.', '.odssssssssssssdo.', '.odssssssssssssdo.', 'okkkkkkkkkkkkkkkko', '.oooooooooooooooo.', '..................'] },
  fish: { label: 'Fish', group: 'animal', food: true, art: [
    '..................', '..................', '.....ooooo.....oo.', '...oollllloo..ollo', '..ollssssslloolsdo', '.olssssssssslolsdo',
    'olsowssssssssldddo', 'olsoossssssssdooo.', 'olsssssssssssdo...', 'olsssssssssssdooo.', 'olsssssssssssdlllo', '.olsssssssssdolsdo',
    '..oldsssssddoolsdo', '...oolddddoo..oldo', '.....ooooo.....oo.', '..................', '..................', '..................'] },
  camera: { label: 'Camera', group: 'object', art: [
    '..................', '..................', '...oo..oooo.......', '..okkoollllooooo..', '.olssllsssslllllo.', '.olwsssssssssRRdo.',
    '.olssssoooossssdo.', '.olsssoBBBBosssdo.', '.olssoBbwBBBossdo.', '.olssoBwBBBBossdo.', '.olssoBBBBBBossdo.', '.olsssoBBBBosssdo.',
    '.olssssoooossssdo.', '.oldddddddddddddo.', '..oooooooooooooo..', '..................', '..................', '..................'] },
  mountain: { label: 'Mountain', group: 'nature n weather', art: [
    '..................', '..................', '.......o..........', '......owo.........', '.....owwwo...o....', '....owlwlwo.owo...',
    '....ollllloowwwo..', '...olssssslowlwwo.', '...olsssssslllllo.', '..olsssssssssssllo', '..olssssssssssssdo', '.olsssssssssssssdo',
    '.olsssssssssssssdo', 'olssssssssssssssdo', 'oggggggggggggggggo', 'oGgGgGgGgGgGgGgGgo', '.oooooooooooooooo.', '..................'] },
  tree: { label: 'Tree', group: 'nature n weather', art: [
    '.......oooo.......', '.....oolllloo.....', '....ollssssllo....', '...olwwsssssslo...', '..olwssssssssslo..', '.olsssssrsssssslo.',
    '.olssssssssssssdo.', '.olsrssssssssrsdo.', '..olssssssssssdo..', '...oldssssssddo...', '....oolsnnsdoo....', '......onnnno......',
    '......onnnno......', '......onnnno......', '....oonnnnnnoo....', '...oggggggggggo...', '....oooooooooo....', '..................'] },
  wave: { label: 'Parasol', group: 'object', art: [
    '..................', '.......oooo.......', '.....oolllloo.....', '...oolwsssslloo...', '..ollwssswsssllo..', '.olwsssswsssswslo.',
    'olwddssdwsdssdwslo', 'oldooldonnoldooldo', '.oo..ooonnooo..oo.', '.......onno.......', '.......onno.......', '.......onno.......',
    '.......onno.......', '.ooooooonnooooooo.', 'occcccccnnccccccco', 'occcccccccccccccco', '.oooooooooooooooo.', '..................'] },
  sun: { label: 'Sun', group: 'nature n weather', art: [
    '........o.........', '...o...oyo...o....', '..oyo..oyo..oyo...', '...oyooooooooyo...', '....oolllllloo....', '....olsssssslo....',
    '...olswsssssslo...', '.ooolssssssssdooo.', 'oyyolsosssossdoyyo', '.ooolrssssssrdooo.', '...olsssoosssdo...', '....olssssssdo....',
    '....ooldddddoo....', '...oyooooooooyo...', '..oyo..oyo..oyo...', '...o...oyo...o....', '........o.........', '..................'] },
  temple: { label: 'Temple', group: 'housing', art: [
    '........oo........', '.......oyyo.......', '.......oldo.......', '......olsslo......', '...ooolsssslooo...', '.ooyyyyyyyyyyyyoo.',
    'oyoolssssssssdooyo', '.ooolsossssosdooo.', '.oyyyyyyyyyyyyyyo.', 'oyolssssssssssdoyo', '.oolsoossssoosdoo.', '..olsoossssoosdo..',
    '..olssssoossssdo..', '..olssssoossssdo..', '.okkkkkkkkkkkkkko.', 'okkkkkkkkkkkkkkkko', '.oooooooooooooooo.', '..................'] },
  plane: { label: 'Plane', group: 'transport', art: [
    '........oo........', '.......ollo.......', '......olsslo......', '......olBBdo......', '......olssdo......', '......olssdo......',
    '....oolssssloo....', '..oollsssssslloo..', '.ollssssssssssllo.', 'oRssdddssssdddssRo', 'olddooolssdooolddo', '.ooo..olssdo..ooo.',
    '......olssdo......', '.....olsssslo.....', '....olssddsslo....', '....olddoolddo....', '.....ooo..ooo.....', '..................'] },
  boot: { label: 'Hiking boots', group: 'object', art: [
    '..................', '...oooooo.........', '..ollllllo........', '..olsswwdo........', '..olssssdo........', '..olsswwdo........',
    '..olssssdo........', '..olsswwslooo.....', '..olsssssslllo....', '..olsssssssssloo..', '.olsssssssssssllo.', '.olssssssssssssdo.',
    'oNNNNNNNNNNNNNNNNo', 'oNoNoNoNoNoNoNoNo.', '.o.o.o.o.o.o.o.o..', '..................', '..................', '..................'] },
  pin: { label: 'Place', art: [
    '.....oooooooo.....', '....ollllllllo....', '...olsssssssslo...', '..olswsssssssslo..', '..olwssoooosssdo..', '..olssowwwwossdo..',
    '..olssowwwwossdo..', '..olsssoooosssdo..', '..olssssssssssdo..', '...olssssssssdo...', '....olssssssdo....', '.....olssssdo.....',
    '......olssdo......', '.....oooldooo.....', '....okkkkkkkko....', '.....oooooooo.....', '..................', '..................'] },
  home: { label: 'Home', group: 'housing', art: [
    '............oo....', '........oo.onno...', '.......oRRoonno...', '......oRRRRonno...', '.....oRRRRRRnno...', '....oRRRRRRRRo....',
    '...oRRRRRRRRRRo...', '..oRRRRRRRRRRRRo..', '.oRRRRRRRRRRRRRRo.', '..olssssssssssdo..', '..olBBssssssBBdo..', '..olBBsnnnnsBBdo..',
    '..olsssnnnnsssdo..', '..olsssnnynsssdo..', '.oolsssnnnnsssdoo.', 'oggggggggggggggggo', '.oooooooooooooooo.', '..................'] },
  book: { label: 'Book', group: 'object', art: [
    '..................', '..................', '..oooooo..oooooo..', '.owwwwwwoowwwwwwo.', 'olwkkkkwwwwkkkkwlo', 'olwwwwwwwwwwwwwwdo',
    'olwkkkkwwwwkkkkwdo', 'olwwwwwwwwwwwwwwdo', 'olwkkkkwwwwkkkkwdo', 'olwwwwwwwwwwwwwwdo', 'olwkkkkwwwwkkkkwdo', 'olwwwwwwsswwwwwwdo',
    'olssssssddssssssdo', '.oldddddooldddddo.', '..oooooo..oooooo..', '..................', '..................', '..................'] },
  music: { label: 'Music', art: [
    '..................', '......ooooooooooo.', '.....olllllllllllo', '.....olsdddddddsdo', '.....oldoooooooldo', '.....oldo.....oldo',
    '.....oldo.....oldo', '.....oldo.....oldo', '.....oldo.....oldo', '...oooldo...oooldo', '..olllsdo..olllsdo', '.olwsssdo.olwsssdo',
    '.olssssdo.olssssdo', '..oldddo...oldddo.', '...oooo.....oooo..', '..................', '..................', '..................'] },
  flag: { label: 'Flag pole', group: 'object', art: [
    '..................', '..ooooooooooo.....', '.onllllllllllo....', '.onsssssssssslo...', '.onsssswsssssslo..', '.onssswwwsssssdo..',
    '.onsssswsssssdo...', '.onsssssssssddlo..', '.ondddddddddooo...', '.onooooooooo......', '.ono..............', '.ono..............',
    '.ono..............', '.ono..............', '.ono..............', 'okkko.............', '.ooo..............', '..................'] },
  trophy: { label: 'Trophy', group: 'object', art: [
    '....oooooooooo....', '..oolllllllllloo..', '.oyyyyyyyyyyyyyyo.', 'oyyoyyyyyyyyyyoyyo', 'oyooyyyylsyyyyooyo', 'oyyoyyyssssyyyoyyo',
    '.oyyyyyysdyyyyyyo.', '..oooyyyyyyyyooo..', '....oyyyyyyyyo....', '.....oyyyyyyo.....', '.....oyyyyyyo.....', '......olssdo......',
    '......oyyyyo......', '.......oyyo.......', '......ooyyoo......', '.....ollssllo.....', '....olddddddlo....', '.....oooooooo.....'] },
  gem: { label: 'Gem', group: 'object', art: [
    '..................', '..................', '....oooooooooo....', '...ollllllllllo...', '..olwwsssssssslo..', '.olwwsssssssssslo.',
    'oddddddddddddddddo', '.olssssssssssssdo.', '..olswssssssssdo..', '...olssssssssdo...', '....olssssssdo....', '.....olssssdo.....',
    '......olssdo......', '.......oldo.......', '........oo........', '..................', '..................', '..................'] },
  fire: { label: 'Fire', art: [
    '........o.........', '.......oRo........', '......oRRo....o...', '......oRRRo..oRo..', '.....oRRRRo.oRRo..', '....oRRRRRRooRRRo.',
    '...oRRRRYRRRRRRRo.', '..oRRRRYYRRRRRRRo.', '..oRRRYYYYRRRRRRo.', '.oRRRYYyyYYRRRRRo.', '.oRRYYyyyyYYRRRRo.', '.oRRYyyyyyyYRRRRo.',
    '.oRRYyyywyyYRRRo..', '..oRRYyyyyyYRRo...', '...oRRYYYYYRRo....', '....ooRRRRRRo.....', '......oooooo......', '..................'] },
  paw: { label: 'Paw', group: 'animal', art: [
    '..................', '.....oo....oo.....', '....ollo..ollo....', '...olssloolsslo...', '...olssdoolssdo...', '..oooldo..oldooo..',
    '.ollooo....ooollo.', 'olsslo.oooo.olsslo', 'olssdoolllloolssdo', '.oldoolsssslooldo.', '..ooolsssssslooo..', '...olsssssssslo...',
    '...olssssssssdo...', '...olsssddsssdo...', '....olddoolddo....', '.....ooo..ooo.....', '..................', '..................'] },
  bag: { label: 'Shopping Bag', group: 'object', art: [
    '..................', '.......oooo.......', '......ollllo......', '.....oloooolo.....', '...oooloooolooo...', '..olllsllllslllo..',
    '..olwwssssssssdo..', '..olwsssssssssdo..', '..olssssssssssdo..', '.olsssswsswsssslo.', '.olssswwwwwwsssdo.', '.olsssswwwwssssdo.',
    '.olssssswwsssssdo.', '.olssssssssssssdo.', '.oldddddddddddddo.', '..oooooooooooooo..', '..................', '..................'] },
  cat: { label: 'Cat', group: 'animal', art: [
    '....o........o....', '...olo......olo...', '..olslo....olslo..', '..olssloooolssdo..', '..olsssllllsssdo..', '.olsssssssssssslo.',
    '.olssssssssssssdo.', 'olsswosssssswosslo', 'olssoossssssoossdo', 'olssssssrrssssssdo', 'oooossssoossssoooo', 'olssssoossoossssdo',
    'oooossssssssssoooo', '.oolssssssssssddo.', '...oldssssssddoo..', '....ooldddddoo....', '......oooooo......', '..................'] },
  dog: { label: 'Dog', group: 'animal', art: [
    '..................', '...oo........oo...', '..onnoooooooonno..', '.onnnllllllllnnno.', '.onnssssssssssnno.', '.onnssssssssssnno.',
    '.onnsowssssowsnno.', '.onnsoossssoosnno.', '..onssssssssssno..', '...olwwwNNwwwdo...', '....olwwwwwwdo....', '.....olswwsdo.....',
    '......oldddo......', '.......oooo.......', '..................', '..................', '..................', '..................'] },
  flower: { label: 'Flower', group: 'nature n weather', art: [
    '..................', '.......oooo.......', '......ollllo......', '...ooolsssslooo...', '..ollolssssdollo..', '.olsslolssdolsslo.',
    '.olssslyyyylsssdo.', '..olssyywyyyssdo..', '...olsyyyyyysdo...', '..olssyyyyyysslo..', '.olsssdyyyydssslo.', '.olssdolssdolssdo.',
    '..oldolssssloldo..', '...oooldssddooo...', '.....oooGGooo.....', '....ogggGGgggo....', '.....oooooooo.....', '..................'] },
  icecream: { label: 'Ice cream', group: 'food', food: true, art: [
    '......oooooo......', '.....ollllllo.....', '....olwwsssslo....', '...olwssssssslo...', '...olsRsssbssdo...', '..olsssssssssslo..',
    '..olssysssssRsdo..', '..olssssssssssdo..', '...onnnnnnnnnno...', '...onNnnnNnnnNo...', '....onnnnnnnno....', '....onnNnnnNno....',
    '.....onnnnnno.....', '.....onNnnNno.....', '......onnnno......', '.......onno.......', '.......onno.......', '........oo........'] },
  gift: { label: 'Gift', group: 'object', art: [
    '..................', '....oo......oo....', '...oyyo....oyyo...', '..oyooyo..oyooyo..', '..oyoooyooyoooyo..', '..ooyyyyyyyyyyoo..',
    '.ollssssyyssssllo.', '.olwssssyysssssdo.', '.oddddddyyddddddo.', '..olssssyyssssdo..', '..olwsssyyssssdo..', '..olssssyyssssdo..',
    '..olssssyyssssdo..', '..olssssyyssssdo..', '..olddddyydddddo..', '...oooooooooooo...', '..................', '..................'] },
  tent: { label: 'Tent', group: 'housing', art: [
    '..................', '........oo........', '.......onno.......', '.......oldo.......', '......olsslo......', '.....olsssslo.....',
    '....olsssssslo....', '...olsssoossslo...', '..olssssoosssslo..', '..olsssoKKosssdo..', '.olssssoKKosssslo.', '.olsssoKKKKosssdo.',
    'olssssoKKKKosssslo', 'olsssoKKKKKKosssdo', 'oggggggggggggggggo', 'oGgGgGgGgGgGgGgGgo', '.oooooooooooooooo.', '..................'] },
  ticket: { label: 'Ticket', group: 'object', art: [
    '..................', '..................', '..................', '.oooooooooooooooo.', 'ollllllllllllllllo', 'olsssssssssyssssdo',
    'olsssswsssyyysssdo', '.olssssssyyyyysdo.', '.olssswsssyyyssdo.', '.olsssssssysyssdo.', 'olsssswssssssssslo', 'oldddddddddddddddo',
    '.oooooooooooooooo.', '..................', '..................', '..................', '..................', '..................'] },
  game: { label: 'Controller', group: 'object', art: [
    '..................', '..................', '..................', '....oooooooooo....', '..oolllllllllloo..', '.ollwsssssssssllo.',
    'olssKssssssssysslo', 'olsKKKssssssBsBsdo', 'olssKssssssssgssdo', 'olsssssddddsssssdo', 'olssssdoooolssssdo', '.olssdo....olssdo.',
    '..oldo......oldo..', '...oo........oo...', '..................', '..................', '..................', '..................'] },
  dumbbell: { label: 'Dumbbell', group: 'object', art: [
    '..................', '..................', '..................', '..oo..........oo..', '.ollo........ollo.', 'olwslo......olwslo',
    'olwsdo......olwsdo', 'olssdoooooooolssdo', 'olssskkkkkkkksssdo', 'olssskkkkkkkksssdo', 'olssdoooooooolssdo', 'olssdo......olssdo',
    'olssdo......olssdo', '.oldo........oldo.', '..oo..........oo..', '..................', '..................', '..................'] },
  night: { label: 'Night', group: 'nature n weather', art: [
    '..................', '.....oooo.........', '....ollllo....o...', '...olsssdo...oyo..', '..olsssdo...oyyyo.', '.olsssdo.....oyo..',
    '.olsssdo......o...', 'olsssdo...........', 'olsssdo......o....', 'olsosdo.....oyo...', 'olsssrlo.....o....', '.olssssloo........',
    '.olsssssllooo.....', '..olsssssslllo....', '...oldssssddo.....', '....ooldddoo......', '......oooo........', '..................'] },
  rainbow: { label: 'Rainbow', group: 'nature n weather', art: [
    '..................', '..................', '..................', '..................', '.......oooo.......', '.....ooRRRRoo.....',
    '....oRRYYYYRRo....', '...oRYYyyyyYYRo...', '...oRYyggggyYRo...', '..oRYygBBBBgyYRo..', '..oRYygBooBgyYRo..', '..oRYygBooBgyYRo..',
    '.owwwwwwoowwwwwwo.', '.owwwwwwoowwwwwwo.', '..owwwwo..owwwwo..', '...oooo....oooo...', '..................', '..................'] },
  cheers: { label: 'Cocktail', group: 'food', art: [
    '.............o....', '............oyo...', '..ooooooooooyyyo..', '.owwwwwwwwwwwwwwo.', '.olssssssssssssdo.', '..olssssssssRsdo..',
    '...olssssssssdo...', '....olssssssdo....', '.....olssssdo.....', '......olssdo......', '.......okko.......', '.......okko.......',
    '......ookkoo......', '.....okkkkkko.....', '......oooooo......', '..................', '..................', '..................'] },
  rocket: { label: 'Rocket', group: 'transport', art: [
    '........oo........', '.......ollo.......', '......olsslo......', '.....olsssslo.....', '.....olssssdo.....', '.....olsBBsdo.....',
    '.....olsBBsdo.....', '.....olssssdo.....', '.....olssssdo.....', '....olsssssslo....', '...oRssssssssRo...', '..oRRdssssssdRRo..',
    '..oRRolssssdoRRo..', '...oooyyyyyyooo...', '......oyyyyo......', '......orYYro......', '.......oyyo.......', '........oo........'] },
  balloon: { label: 'Hot Air Balloon', group: 'transport', art: [
    '....oooooooooo....', '...ollllllllllo...', '..olsssssssssslo..', '.olsssssssssssslo.', '.olssssYYYYssssdo.', '.olssssYYYYssssdo.',
    '.olssssYYYYssssdo.', '..olsssYYYYsssdo..', '...olssYYYYssdo...', '....olsYYYYsdo....', '.....oooooooo.....', '.....ooo..ooo.....',
    '.....ooo..ooo.....', '.....oooooooo.....', '....onnnnnnnno....', '....onNNNNNNno....', '....onnnnnnnno....', '.....oooooooo.....'] },
  umbrella: { label: 'Rain', group: 'nature n weather', art: [
    '....ooo...........', '...olllo..oooo....', '..olsssloollllo...', '.olsssssllsssslo..', 'olssssssssssssslo.', 'olsssssssssssssdo.',
    'olsdssdssssdssddo.', '.ololdoldddoldoo..', '..o.oo.oooo.oo....', '...o..o....o..o...', '..oBooBo..oBooBo..', '.oBooBo..oBooBo...',
    '..o..o....o..o....', '..................', '..................', '..................', '..................', '..................'] },
  snow: { label: 'Snow', group: 'nature n weather', art: [
    '..................', '........oo........', '.......ollo.......', '....o.olsslo.o....', '...olo.oldo.olo...', '....olooldoolo....',
    '...o.ololdolo.o...', '..olooolsslooolo..', '.olslllswwslllslo.', '.olsdddswwsdddsdo.', '..olooolssdooolo..', '...o.ololdolo.o...',
    '....olooldoolo....', '...olo.oldo.olo...', '....o.olsslo.o....', '.......oldo.......', '........oo........', '..................'] },
  cloud: { label: 'Cloud', group: 'nature n weather', art: [
    '..........ooo.....', '....ooo..owwwo....', '...owwloolwwwwo...', '..owwlswwlswwwo...', '..ollswwwwwssdo...', '..olsswwwwwswwoo..',
    '.owwwwwwwwwwwwwwo.', 'owwwwwwwwwwwwwwwwo', 'owwwwwwwwwwwwwwwwo', 'owwwwwwwwwwwwwwwwo', 'olwwwwwwwwwwwwwwlo', 'ollwlsslwwlsslwldo',
    '.oldddddddddddddo.', '..oooooooooooooo..', '..................', '..................', '..................', '..................'] },
  sparkle: { label: 'Sparkle', art: [
    '........oo........', '.......ollo.......', '.......oldo.......', '.......oldo.......', '.......oldo.......', '.......oldo.......',
    '......olsslo......', '.ooooolsssslooooo.', 'olllllsswwsslllllo', 'olddddsswwssdddddo', '.ooooolssssdooooo.', '......olssdo......',
    '.......oldo.......', '.......oldo.......', '.......oldo.......', '.......oldo.......', '........oo........', '..................'] },
  leaf: { label: 'Leaf', group: 'nature n weather', art: [
    '............ooooo.', '.........ooolllllo', '.......oolllsdssdo', '......ollssdsdssdo', '.....olssssdsdssdo', '....olssdssddddddo',
    '...olsssdssdssssdo', '..olsdssddddsssdo.', '..olsdssddddddsdo.', '..olsdssdsssssdo..', '..olsdsddsssssdo..', '..olsddddssssdo...',
    '...odddddddddo....', '..oNddssssdoo.....', '.oNNolddddo.......', 'oNNo.ooooo........', 'oNo...............', '.o................'] },
  cactus: { label: 'Cactus', group: 'nature n weather', art: [
    '........oo........', '.......orro.......', '......olsslo......', '...oo.olssdo.oo...', '..olloolssdoollo..', '..oldoolssdooldo..',
    '..oldoolssdooldo..', '..olsllssssllsdo..', '..oldddssssddddo..', '...oooolssdoooo...', '......olssdo......', '......olssdo......',
    '....ooolssdooo....', '...onnnnnnnnnno...', '....onnnnnnnno....', '....onNNNNNNno....', '.....oooooooo.....', '..................'] },
  butterfly: { label: 'Butterfly', group: 'animal', art: [
    '......o....o......', '.....odo..odo.....', '......odoodo......', '..oo..ooddoo..oo..', '.olloollddlloollo.', 'olssllssddssllsslo',
    'olsswlssddsswlssdo', 'olsswwssddsswwssdo', 'olssssssddssssssdo', '.olsssssddsssssdo.', '..olssssddssssdo..', '.olsssddddddssslo.',
    '.olsslssddsslssdo.', '..olsssddddsssdo..', '...olddoddolddo...', '....ooooddoooo....', '........oo........', '..................'] },
  chick: { label: 'Chick', group: 'animal', art: [
    '......oooooo......', '.....oyyyyyyo.....', '...ooyyyyyyyyoo...', '..oyyyyyyysysyyo..', '.oyyyyyyyyysyyyyo.', '.oyyyyyyyyyyyyyyo.',
    'oyyyoyyyyyyyyoyyyo', 'oyyyyyyyyyyyyyyyyo', 'oyyyyyyyRRyyyyyyyo', 'oyyyyyyyRRyyyyyyyo', '.oyyyyyyyyyyyyyyo.', '.oyyyyyyyyyyyyyyo.',
    '..oyyyyyyyyyyyyo..', '...oyyyyyyyyyyo...', '...oRooRooRooRo...', '..oRRoRRooRRoRRo..', '...oo.oo..oo.oo...', '..................'] },
  burger: { label: 'Burger', group: 'food', food: true, art: [
    '..................', '.....oooooooo.....', '...oonnnnnnnnoo...', '..onnnnnnnnnnnno..', '.onnnwnnnnnnwnnno.', 'onnnnnnnnnnnnnnnno',
    'oggggggggggggggggo', 'olssssssssssssssdo', 'oyyyyyyyyyyyyyyyyo', 'oNNNNNNNNNNNNNNNNo', 'oNNNNNNNNNNNNNNNNo', 'oggggggggggggggggo',
    'onnnnnnnnnnnnnnnno', '.onnnnnnnnnnnnnno.', '..onnnnnnnnnnnno..', '.oooooooooooooooo.', 'oddddddddddddddddo', '.oooooooooooooooo.'] },
  apple: { label: 'Fruit', group: 'food', food: true, art: [
    '............oo....', '........oo.oGGo...', '.......onnoGGGo...', '.......onnoGGo....', '...oooooooooooo...', '..ollllloolllllo..',
    '.olsssssllssssslo.', 'olswsssssssssssslo', 'olswssssssssssssdo', 'olssssssssssssssdo', 'olssssssssssssssdo', 'olssssssssssssssdo',
    'olssssssssssssssdo', '.olssssssssssssdo.', '..olssssssssssdo..', '...olsssddsssdo...', '....olddoolddo....', '.....ooo..ooo.....'] },
  headphones: { label: 'Headphone', group: 'object', art: [
    '.....oooooooo.....', '...oolllllllloo...', '..olldoooooolllo..', '.oldoo......oollo.', '.olo..........olo.', 'oldo..........ollo',
    'oldoo........ooldo', 'olsllo......ollsdo', 'olssko......okssdo', 'olssko......okssdo', 'olssko......okssdo', 'olssko......okssdo',
    'olssdo......olssdo', '.oldo........oldo.', '..oo..........oo..', '..................', '..................', '..................'] },
  cap: { label: 'Study', group: 'object', art: [
    '..................', '........oo........', '.....ooollooo.....', '...oolllssllloo...', '.oollsssssssslloo.', 'ollssssssssssssllo',
    '.oolssssssssssdoyo', '...oKssssssssKooyo', '...oKKKKssKKKKooyo', '...oKKKKKKKKKKooyo', '...oKKKKKKKKKKooYo', '...oKKKKKKKKKKo.o.',
    '...oKKKKKKKKKKo...', '...oKKKKKKKKKKo...', '....oKKKKKKKKo....', '.....oooooooo.....', '..................', '..................'] },
  laptop: { label: 'Laptop', group: 'object', art: [
    '..................', '...oooooooooooo...', '..ollllllllllllo..', '..olssssssssssdo..', '..olBwBBBBBBBBdo..', '..olBwBBBBBBBBdo..',
    '..olBBBBBBBBBBdo..', '..olBBBBBBBBBBdo..', '..olBBBBBBBBBBdo..', '..oldddddddddddo..', '.oooooooooooooooo.', 'okkkkkkkkkkkkkkkko',
    '.okkkkkkkkkkkkkko.', '..oooooooooooooo..', '..................', '..................', '..................', '..................'] },
  bulb: { label: 'Light bulb', group: 'object', art: [
    '......oooooo......', '....ooyyyyyyoo....', '...oyyyyyyyyyyo...', '..oyyyyyyyyyyyyo..', '..oywyyyyyyyyyyo..', '.oyywyyyyyyyyyyyo.',
    '.oyyyyyyyyyyyyyyo.', '.oyyyyyyyyyyyyyyo.', '.oyyyyyyyyyyyyyyo.', '..oyyyyyyyyyyyyo..', '...oyyyyyyyyyyo...', '....oyyyyyyyyo....',
    '....olssssssdo....', '....oddddddddo....', '....olssssssdo....', '.....olssssdo.....', '......oldddo......', '.......oooo.......'] },
  medal: { label: 'Medal', group: 'object', art: [
    '...oo........oo...', '..ollo......ollo..', '..olslo....olsdo..', '...olslo..olsdo...', '....olsloolsdo....', '.....olsllsdo.....',
    '.....oolssdoo.....', '....oyyyyyyyyo....', '...oyyyyyyyyyyo...', '..oyyyyyyyyyyyyo..', '..oyyyyYYYYyyyyo..', '..oyyyYYYYYYyyyo..',
    '..oyyyYYYYYYyyyo..', '..oyyyyYYYYyyyyo..', '...oyyyyyyyyyyo...', '....oyyyyyyyyo....', '.....oooooooo.....', '..................'] },
  crown: { label: 'Crown', group: 'object', art: [
    '.o..............o.', 'oyo.....oo.....oyo', 'oyyo...oyyo...oyyo', 'oyyyo..oyyo..oyyyo', 'oyyyyooyyyyooyyyyo', 'oyyyyooyyyyooyyyyo',
    'oyyyyyyyyyyyyyyyyo', 'oyyyyyyyyyyyyyyyyo', 'oyyyyyyyyyyyyyyyyo', 'oyyyssyyssyyssyyyo', 'oyyyssyyssyyssyyyo', 'oyyyyyyyyyyyyyyyyo',
    'oddddddddddddddddo', 'oddddddddddddddddo', 'oddddddddddddddddo', '.oooooooooooooooo.', '..................', '..................'] },
  clock: { label: 'Clock', group: 'object', art: [
    '.....oooooooo.....', '...oolllllllloo...', '..ollssssssssllo..', '.olsssssssssssslo.', '.olsswwwwwwwwssdo.', 'olsswwwwowwwwwsslo',
    'olsswwwwowwwwwssdo', 'olsswwwwowwwwwssdo', 'olsswwwwowwwwwssdo', 'olsswwwwooooowssdo', 'olsswwwwwwwwwwssdo', 'olsswwwwwwwwwwssdo',
    '.olsswwwwwwwwssdo.', '.olssssssssssssdo.', '..oldssssssssddo..', '...ooldddddddoo...', '.....oooooooo.....', '..................'] },
  bell: { label: 'Bell', group: 'object', art: [
    '........oo........', '.......oyyo.......', '......olsslo......', '.....ollssslo.....', '....olllsssslo....', '....ollsssssdo....',
    '...olllsssssslo...', '...ollsssssssdo...', '...olssssssssdo...', '..olsssssssssslo..', '.olsssssssssssslo.', 'olsssssssssssssslo',
    'oldddddddddddddddo', '.oooooooooooooooo.', '.....oyyyyyyo.....', '......oyyyyo......', '.......oooo.......', '..................'] },
  ball: { label: 'Ball', group: 'object', art: [
    '.....oooooooo.....', '...oollloollloo...', '..oolsssoosssloo..', '.olossssoossssolo.', '.olossssoossssodo.', 'olsossssoossssoslo',
    'olsossssoossssosdo', 'olsossssoossssosdo', 'oooooooooooooooooo', 'oooooooooooooooooo', 'olsossssoossssosdo', 'olsossssoossssosdo',
    'olsossssoossssosdo', '.olossssoossssodo.', '.olossssoossssodo.', '..oodsssoosssdoo..', '...oolddoodddoo...', '.....oooooooo.....'] },
  train: { label: 'Train', group: 'transport', art: [
    '..................', '...oooooooooooo...', '..ollllllllllllo..', '.olsssssssssssslo.', '.olsBBBBBBBBBBsdo.', '.olsBBBBBBBBBBsdo.',
    '.olsBBBBBBBBBBsdo.', '.olssssssssssssdo.', '.olssssssssssssdo.', '.olsyssssssssysdo.', '.olssssssssssssdo.', '.olssddssssddssdo.',
    '..oKKooKKKKooKKo..', '...oo..oooo..oo...', '.oooooooooooooooo.', 'oKKKKKKKKKKKKKKKKo', '.oooooooooooooooo.', '..................'] },
  backpack: { label: 'Backpack', group: 'object', art: [
    '...oo..oooo..oo...', '..oddooKKKKooddo..', '..oddllssssllddo..', '..olssssssssssdo..', '.olssllllllllsslo.', '.olssssssssssssdo.',
    '.olssssssssssssdo.', '.olssddddddddssdo.', '.olssdKdKKdKdssdo.', '.olssddddddddssdo.', '.olssddddddddssdo.', '.olssddddddddssdo.',
    '.olssddddddddssdo.', '.olssssssssssssdo.', '..olsddddddddsdo..', '..oddooooooooddo..', '..oddo......oddo..', '...oo........oo...'] },
  compass: { label: 'Compass', group: 'object', art: [
    '.....oooooooo.....', '...oolllllllloo...', '..ollssssssssllo..', '.olsslllRRlllsslo.', '.olsllllRRRlllsdo.', 'olsllllRRRRllllslo',
    'olslllRRRRRRlllsdo', 'olslllRRRRRRlllsdo', 'olsllllloolllllsdo', 'olsllllloolllllsdo', 'olslllkkkkkklllsdo', 'olslllkkkkkklllsdo',
    'olsllllkkkkllllsdo', '.olsllllkkllllsdo.', '.olssllllllllssdo.', '..oldssssssssddo..', '...ooldddddddoo...', '.....oooooooo.....'] },
  key: { label: 'Key', group: 'object', art: [
    '..................', '..................', '..................', '..................', '..................', '...oooo...........',
    '..ollllo..........', '.olsddslooooooooo.', 'olsdoolslllllllllo', 'olsdoolsdddssdssdo', '.olsllsdoooldoldo.', '..oldddo..oldoldo.',
    '...oooo....oo.oo..', '..................', '..................', '..................', '..................', '..................'] },
  car: { label: 'Car', group: 'transport', art: [
    '..................', '..................', '..................', '......oooooo......', '....oollllllo.....', '...ollBBsBBBlo....',
    '..olsBBBsBBBBlo...', '..olsBBBsBBBBdo...', '.olsssssssssssloo.', 'olsssssssssssssllo', 'olssKKKKssKKKKsyyo', 'olddKkkKddKkkKdddo',
    '.oooKkkKooKkkKooo.', '...oKKKKooKKKKo...', '....oooo..oooo....', '..................', '..................', '..................'] },
  boat: { label: 'Boat', group: 'transport', art: [
    '........o.........', '.......oNo........', '.......oNwo.......', '.......oNwwo......', '.......oNwwwo.....', '.......oNwwwwo....',
    '.......oNwwwwwo...', '.......oNwwwwwwo..', '.......oNwwwwwwwo.', '.oooooooNoooooooo.', 'olllllllsllllllllo', '.olssssssssssssdo.',
    '..olssssssssssdo..', '.ooolssssssssdooo.', 'obbbbbbbbbbbbbbbbo', '.obboobboobboobbo.', '..oo..oo..oo..oo..', '..................'] },
  strawberrycake: { label: 'Strawberry cake', group: 'cute dessert', art: [
    '..................', '.......oooo.......', '......oRRlloo.....', '.....oRRrRsllo....', '.....oRoRRssllo...', '....ollRRlsssllo..',
    '...olllllllllslo..', '..ollllllcccccco..', '..occccccllRRllo..', '..ollRRlllRrrRlo..', '.oYlRrrRllRrrRlYo.', 'owYlRrrRlccccccYwo',
    'owYccccccccccccYwo', 'owYccccccYYYYYYwwo', 'owwYYYYYYwwwwwwwwo', '.owwwwwwwwwwwwwwo.', '..oowwwwwwwwwwoo..', '....oooooooooo....'] },
  strawberrymacaron: { label: 'Strawberry macaron', group: 'cute dessert', art: [
    '..................', '......oooooo......', '....oollllwwoo....', '...ollssslwwllo...', '..olssssssllsslo..', '..olssssssssssdo..',
    '.odssssssssssssdo.', '.oddssssssssssddo.', '.odsllssssssllsdo.', '.owdsssslsllssdwo.', '.owRddssssssddRwo.', '.oRrrRwwRRwwRrrRo.',
    '..olrRwRrrRwRrlo..', '..olslwRrrRwlsdo..', '...oldssssssddo...', '....ooldddddoo....', '......oooooo......', '..................'] },
  chocolate: { label: 'Chocolate', group: 'cute dessert', art: [
    '...oooooooooooo...', '..owwwccnnnnnNNo..', '..owoonoonoonNNo..', '..owNNnNNnNNnNNo..', '..ocNNnNNnNNnNNo..', '..onnnnnnnnnnNNo..',
    '..onoonoonoonNNo..', '..onNNnNNnNNnNNo..', '..onNNnNNnNNnNNo..', '.oKKKnnnnnnKKKKKo.', '.okkkKKNNKKkkkkko.', '.okkkkkKKkkkkkkko.',
    '.okkkkkkKkkkkkkko.', '..oddddddddddddo..', '..olsssssssssddo..', '..oldddddddddddo..', '...oooooooooooo...', '..................'] },
  flavouredchocolate: { label: 'Flavoured Chocolate', group: 'cute dessert', art: [
    '...oooooooooooo...', '..owwwlllllllddo..', '..owoosoosoosddo..', '..owddsddsddsddo..', '..olddsddsddsddo..', '..olsssssssssddo..',
    '..oloosoosoosddo..', '..olddsddsddsddo..', '..olddsddsddsddo..', '.oKKKssssssKKKKKo.', '.okkkKKddKKkkkkko.', '.okkkkkKKkkkkkkko.',
    '.okkkkkkKkkkkkkko.', '..oKKKKKKKKKKKKo..', '..okkkkkkkkkkKKo..', '..okkkkkkkkkkKKo..', '...oooooooooooo...', '..................'] },
  strawberrysundae: { label: 'Strawberry Sundae', group: 'cute dessert', art: [
    '........oo.....oo.', '.......occo...oGgo', '.....oowcwcooogGgo', '...oocwwcwwcwGgGo.', '..oRRwwwcwwcwRRo..', '.owRrRwcRRccRrRwo.',
    '.owRRRcRRrRcRRRwo.', '..owwdcRRRRcdwwo..', '..owswwwwwwwwswo..', '...owsssssssswo...', '...owsdsdsdsdwo...', '...owddddddddwo...',
    '....owddddddwo....', '....oBwwwwwwBo....', '....owBBBBBBwo....', '....owwbwwbwwo....', '.....owwwwwwo.....', '......oooooo......'] },
  strawberrypankcake: { label: 'Strawberry Pancake', group: 'cute dessert', art: [
    '..................', '.......ooo........', '......owwwoooo....', '....oowwwwwlGGo...', '...ollwcwwwRRGGo..', '..ollswccwRRrRGo..',
    '..olllswwwRrRRlo..', '..olwwlllloRRllo..', '..odlllwlllllldo..', '..oyddllllllldyo..', '..occcsssllldcco..', '.onycccyydlldcyno.',
    '.oncyycccdlldycno.', '..onccyycyddccno..', '...onnccccccnno...', '....oonnnnnnoo....', '......oooooo......', '..................'] },
  strawberryflan: { label: 'Strawberry Flan', group: 'cute dessert', art: [
    '..........oo......', '......oo.oRRo.....', '.....oRRoRRrRo....', '....oRrrRRRRRo....', '....oRrrrgggRo....', '...olRrrGgggGlo...',
    '...olsRRGggGGdo...', '...ollsssGGssdo...', '..oclssllsssslco..', '..occlsssssslcco..', '..occcccccccccco..', '..occcccccccccco..',
    '.ownccccccccccnwo.', '.owwnnccccccnnwwo.', '.owwwwYYYYYYwwwwo.', '..owwwwwwwwwwwwo..', '...oowwwwwwwwoo...', '.....oooooooo.....'] },
  pawcoffee: { label: 'Paw Coffee', group: 'cute dessert', art: [
    '....oooooooo......', '..oowwwwwwwwoo....', '.owwcnnnnnncwwo...', 'owcnnNNwwNNnncwo..', 'ownncwNccNwcnnwo..', 'ownnwNwwwwNwnnwoo.',
    'ownnNwwwwwwNnnwwwo', 'owcnncwwwwcnncwlwo', 'owwwcnnnnnncwwwdwo', 'owwwwwwwwwwwwwwdwo', 'olwwwlswwslwwwwlwo', 'olwwwsssssswwwwwo.',
    '.owwwsssssswwwoo..', '.olwwwsssswwwlo...', '..olwwwsswwwlo....', '...oowwwwwwoo.....', '.....oooooo.......', '..................'] },
  honeyjar: { label: 'Honey jar', group: 'cute dessert', art: [
    '.....ooooooo......', '...ooYycccyYoo....', '..occyYYcYYycco...', '..occcyyyyyccco...', '.oYYYyccyccyYYYo..', '.occyYYYYYYYycco..',
    '..ooccocccoccoo...', '..oYooYoooYooYo...', '.oyYYYYyywwwwwYo..', '.oyyYYwwwwYYwwwo..', '.oYYYwwwwycYwwwo..', '.oYyywwwwyyYYwwo..',
    '.oYyywwwycYcYwwo..', '.oYYYwwwyyYYwwwo..', '..ooYwwwwwwwwwyo..', '...oYYwwwwwwYyo...', '....ooYYyyYYoo....', '......oooooo......'] },
  rabbittanghulu: { label: 'Rabbit Tanghulu', group: 'cute dessert', art: [
    '............ooo...', '...........orrwo..', '.........oorrwwoo.', '........owwwwwswwo', '........olwowwwwro', '.......owwowwwwrro',
    '......oolwwwwowro.', '.....owwwswwowwo..', '....owwwwwswwlwo..', '...oowwwwwwdwwo...', '..oldwwlllwooo....', '.olssdwlllwo......',
    '.olsssdwwwo.......', '.olssssdoo........', '..olsssdo.........', '.onolddo..........', 'ono.ooo...........', '.o................'] },
  drink: { label: 'Drink 2', group: 'cute dessert', art: [
    '.......ooooooo....', '.....oowwwwwwwoo..', '....owwssllwllwwo.', '...owwsllwlwwllwwo', '...oksswlwwllllswo', '.ooKkdswllwwwlsdwo',
    'owwwwkdwwwssssdwwo', 'owoKKwwdddddddwwKo', 'okoKKkwwwwwwwwwkKo', 'okoKKkkkkkkkkkkkKo', 'okoKKkkwwwwwwwwkKo', 'okoKKkkwwwwwwwwkKo',
    'okkKKkkwwwwwwwwkKo', '.okKKkkwwwwwwwwkdo', '..oodkkwwwwwwwwdo.', '....odkwwwwwwwdo..', '.....oddddddddo...', '......oooooooo....'] },
  rabbit: { label: 'Rabbit', group: 'animal', art: [
    '..................', '.....ooooooo..o...', '...oowwwwwwwoowo..', '..owwwwooowwwowwo.', '.owwwwwowwowwwowo.', '.owwwwwocwwowwowo.',
    'owwwwwwoccwowwwwwo', 'owwwwwwwocwwwwwwwo', 'owwwwwwwwwwwwwwwwo', 'owcwwwwwwwwwwwwwwo', '.owcwwwwwwwldwwwwo', '.owccwwwwwwddwwowo',
    'oldwwwwwwccwwwwwdo', 'olsdddwwwwwwwwddlo', 'ollsssddddddddsslo', '.ollllssssssssllo.', '..ooldllllldlloo..', '....oooooooooo....'] },
  chicken2: { label: 'Chicken', group: 'animal', art: [
    '.....ooo..........', '....olllo.........', '...olssslo........', '..olsswwwwo.......', '..olwwwwwwwo...oo.', '.olwwwwwwwwo..owco',
    '.owwwowwwwwwoowwco', 'oyyyworrwwwwccwwco', 'oYYYwwrrwwwwwwwwno', 'ocwwwwwwwwwwwwwnco', 'ocwwwwwwwwcwwcnwco', 'ocwwwwwwwwwcwwwnco',
    'ocwwwwwwwwwwccnwno', '.ocwwwwwwwwwwwwco.', '.ocwwwwwwwwwwwwno.', '..occwwwwwwwccno..', '...oocccccccooo...', '.....ooooooo......'] },
  chicken: { label: 'Chicken (Cream)', group: 'animal', art: [
    '.....ooo..........', '....olllo.........', '...olddddo........', '..olddcccco.......', '..odccccccco...oo.', '.odcccccccco..ocyo',
    '.occcoccccccooccyo', 'oyyycorrccccyyccyo', 'oYYYccrrccccccccno', 'oycccccccccccccnyo', 'oyccccccccyccynwyo', 'oycccccccccycccnyo',
    'oyccccccccccyynwno', '.oyccccccccccccyo.', '.oyccccccccccccno.', '..oyycccccccyyno..', '...ooyyyyyyyooo...', '.....ooooooo......'] },
  bee: { label: 'Bee', group: 'animal', art: [
    '....ooo...........', '...owwwoo.........', '...owwwwwo........', '...olllwwwo...o...', '.ooooolllwlo.oNo..', 'owwwwloolllNoNo...',
    'ollwwwllolNooNo...', 'ollllwllnYNyyNo...', '.olllllnYyNyyyyo..', 'oyYnYYnyyyyyyyoyo.', 'oynyynnyyyyyyyoyo.', 'oYnyynnyyyyoyyyro.',
    'oYnyynnYyyyoyyyyo.', 'oYnYynnnyyrryyyyo.', '.oonYYnnYYyyyyyo..', '..onnYYnnnYYYYo...', '...ooYYYnnnnoo....', '.....ooooooo......'] },
  pie: { label: 'Pie', group: 'cute dessert', art: [
    '........ooo.......', '.......occcoo.....', '.......oYYYccoo...', '......oYYYYYYccoo.', '.....oYddccYYYYcYo', '....occddYYddccYco',
    '...oYccYYccddccYco', '...oYYYddccYYYYcco', '..oYYccddYYYYccdco', '.oYddccYYYccddddco', 'oYYddYYccdddssddYo', 'occYccdddsddssddYo',
    'occssdlsddssdYYYo.', 'oddssdssddYYYooo..', 'odddddddYYooo.....', 'olsddddooo........', 'olddooo...........', '.ooo..............'] },
  densepie: { label: 'Dense Pie', group: 'cute dessert', art: [
    '........ooo.......', '.......owlloo.....', '......owcwwlloo...', '.....owccwwwslloo.', '....owwwwwwwwssllo', '....owwwwwcwwssslo',
    '...olcwwwccwcssslo', '...olscwwwwcsslslo', '..olssssssssssldlo', '.olsssssssllddddlo', 'olsssslllddddddddo', 'olsllldddddddddddo',
    'olldddddddddddddo.', 'oddddddddddddooo..', 'odddddddddooo.....', 'oddddddooo........', 'odddooo...........', '.ooo..............'] },
  brightmoon: { label: 'Bright Moon', group: 'nature n weather', art: [
    '......oooo........', '....ooYyyYo...o...', '...oYyyyoo...olo..', '..oYyyyo...oolwlo.', '.oYyyyYo..oloolo..', '.oyyYyo...olo.o...',
    'oYyyyyo..olwlo....', 'oyyYyyo...olo...o.', 'oyylyyo...olo..oYo', 'oylclyyo...o...oyo', 'oyylyyyYo....ooyyo', 'oYyYyyyyyooooYyyYo',
    '.oyyyylyyyyyyyyyo.', '.oYyyYcYyyyyyyyYo.', '..oYyylyyYyyyyYo..', '...oYyyyyyyyyYo...', '....ooYyyyyYoo....', '......oooooo......'] },
  lightmoon: { label: 'Light Moon', group: 'nature n weather', art: [
    '......oooo........', '....ooyccyo...o...', '...oycccoo...olo..', '..oyccco...oolwlo.', '.oycccyo..oloolo..', '.occyco...olo.o...',
    'oycccco..olwlo....', 'occycco...olo...o.', 'occlcco...olo..oyo', 'oclwlcco...o...oco', 'occlcccyo....oocco', 'oycycccccooooyccyo',
    '.occcclccccccccco.', '.oyccywycccccccyo.', '..oycclccyccccyo..', '...oyccccccccyo...', '....ooyccccyoo....', '......oooooo......'] },
  whiteskate2: { label: 'White skate', group: 'sport', art: [
    '.....ooo..........', '....owkwo.........', '...owwsdo.........', '..okwskwo.........', '..okwskwlo........', '..okswwswwo.......',
    '.okkwwwwkwloo.....', '.okkwwwwwswwlo....', '.okkkwwwwwkswwoo..', '..okkkkwwwwkkkwwo.', '.ooooookwwwwwwwko.', 'odddodoowwwwwwkko.',
    'odsdodo.ookkkkkdo.', 'odddoo...odddoddo.', '.ooo.....odsdooo..', '.........odddo....', '..........ooo.....', '..................'] },
  whiteskate: { label: 'Coloured skate', group: 'sport', art: [
    '.....ooo..........', '....oldlo.........', '...olsllo.........', '..odssddo.........', '..odssdslo........', '..odssslslo.......',
    '.oddssssdsloo.....', '.oddssssslsllo....', '.odddsssssdlsloo..', '..oddddssssdddllo.', '.oooooodsssssssdo.', 'olllolooldssssddo.',
    'olslolo.oodddddlo.', 'ollloo...olllollo.', '.ooo.....olslooo..', '.........olllo....', '..........ooo.....', '..................'] },
  carrot: { label: 'Carrot', group: 'food', art: [
    '..........oo...oo.', '.........oggoooggo', '..........oggGgggo', '..........ogGgggo.', '.......oooGGGggGo.', '......oYccYYGGGGo.',
    '.....oYYccYY(GGGGo', '....oYYYY(Y((GooGo', '....oYY(YY(((o..o.', '...oYYYY((((Yo....', '..oY(YYYY(((Yo....', '..oY((Y((((Yo.....',
    '.oYYY((((YYo......', '.oYYY(((Yoo.......', 'oYY(((YYo.........', 'oY((YYoo..........', 'oYYYoo............', '.ooo..............'] },
  waffle: { label: 'Waffle', group: 'food', art: [
    '..................', '...oooo....oooo...', '..oYNUYo..oUYNUo..', '.oYYYYYYooYYYYYYo.', 'oYNYNNYNNYNNYNNYNo', 'oNUYNUYNUYNUYNUYNo',
    'oYYYYYYYYYYYYYYYYo', 'oNNYNNYNNYNNYNNYNo', '.oUYNUYNUYNUYNUYo.', '.oYYYYYYYYYYYYYYo.', '..oYNNYNNYNNYNNo..', '...oNUYNUYNUYNo...',
    '....oYYYYYYYYo....', '.....oYNNYNNo.....', '......oNUYNo......', '.......oYYo.......', '........oo........', '..................'] },
  chocolatewaffle: { label: 'Chocolate Waffle', group: 'food', art: [
    '..................', '...oooo....oooo...', '..o((((o..o(oNUo..', '.o((((((oo((oYYYo.', 'o(((((((((((oNNYNo', 'o(((((((((o(oNUYNo',
    'oo(((o(((oYoYYYYYo', 'oNo(oNo((oNNYNNYNo', '.oUoNUo(oYNUYNUYo.', '.oYYYYo(oYYYYYYYo.', '..oYNNYoNYNNYNNo..', '...oNUYNUYNUYNo...',
    '....oYYYYYYYYo....', '.....oYNNYNNo.....', '......oNUYNo......', '.......oYYo.......', '........oo........', '..................'] },
  flavouredwaffle: { label: 'Flavoured Waffle', group: 'food', art: [
    '..................', '...oooo....oooo...', '..ollllo..oldNUo..', '.olssssloolsdYYYo.', 'olssssssllssdNNYNo', 'olssssssssdsdNUYNo',
    'odsssdsssdYdYYYYYo', 'oNdsdNdssdNNYNNYNo', '.oUdNUdsdYNUYNUYo.', '.oYYYYdsdYYYYYYYo.', '..oYNNYdNYNNYNNo..', '...oNUYNUYNUYNo...',
    '....oYYYYYYYYo....', '.....oYNNYNNo.....', '......oNUYNo......', '.......oYYo.......', '........oo........', '..................'] },
  banana: { label: 'Banana', group: 'food', art: [
    '............oo....', '...........oUUoo..', '...........o((UUo.', '...........o((((o.', '..........oxx(((o.', '.......ooo^^xxx(o.',
    '....oooy^^^Y^^xxo.', '.oooyy^^^YYy^^xyyo', 'oY^^^^^YYyy^^Ycyyo', 'oYY^YYYyyy^^Yccyyo', '.oYYyyyyy^^Yccyyyo', 'oYyyyy^^^^Ycccyyyo',
    'oYY^^^^^YYcccyyyo.', '.oY^^YYYccccyyyyo.', '..oooYcccccyyyyo..', '....oYYyyyyyyyo...', '.....oYyyyyyoo....', '......oooooo......'] },
  whiteiceskate: { label: 'White ice skate', group: 'sport', art: [
    '.....ooo..........', '....owkwo.........', '...owwsdo.........', '..okwskwo.........', '..okwskwlo........', '..okswwswwo.......',
    '.okkwwwwkwloo.....', '.okkwwwwwswwlo....', '.okkkwwwwwkswwoo..', '.ookkkkwwwwkkkwwo.', 'oKooKookwwwwwwwko.', 'oKKKKooowwwwwwkko.',
    '.ooKKKKoookkkkko..', '...oooKkkoooKoo...', '......ooKkkoKo....', '........ooKkkko...', '..........oooKko..', '.............oo...'] },
  blueberry: { label: 'Blueberry', group: 'food', art: [
    '..................', '..................', '.........o........', '.....oooolooo.....', '...oolllldllloo...', '..olllsddsdllllo..',
    '.olslddssssddlslo.', '.olsslddsdddllsdo.', 'olsssslldlllsssslo', 'olsllssllsssssssdo', 'olsllsssssssssssdo', 'odssssssssssssssdo',
    'odsssslsssssssssdo', '.odssssssssssssdo.', '.odddssssssssdddo.', '..oddddddddddddo..', '...ooddddddddoo...', '.....oooooooo.....'] },
  snowman: { label: 'Snowman', group: 'nature n weather', art: [
    '.........oooo.....', '......ooollllo....', '.....owwwwssslo...', '....owwwwwwsdo....', '...owwwwwwwwo.....', '...owowwwowwo.....',
    '..oowowwwowwo.o...', '.onolwwwwwwdoono..', 'onn(ssssssss((nno.', '.o(n(ssssssw(n(o..', '..o(wwwwwsswn(o...', '..owwwllwsswwwo...',
    '..owwwllwsswwwo...', '..owwwwwwllwwwo...', '...owwsswwwwwo....', '...oiwsswwwwio....', '....ooiwwwioo.....', '......ooooo.......'] },
  untitled: { label: 'Gingerbread Man', group: 'cute dessert', art: [
    '...........oooo...', '..........orryyo..', '.....ooo.oyrroyyo.', '....oyyyooyoyyyyyo', '....oyywyoyoyyyoyo', '....oywYyyyyoyyrro',
    '.....oYyyyyyyoorro', '..oooyyyydsyyyyyo.', '.oywyyyyyddyyyoo..', 'oyyYwyydsyyyyyo...', 'oyywYyyddyyyywYo..', '.oYYwYyyyyyYwYYo..',
    '..ooooyyyyYoYYYo..', '.....owywYwoooo...', '.....oYwYwo.......', '.....oyYyYo.......', '......oYYo........', '.......oo.........'] },
  icecreamwaffle: { label: 'Ice cream waffle', group: 'food', art: [
    '..................', '..................', '..................', '..................', '..................', '..................',
    '..................', '....o.............', '...oYo............', '...oYfo...........', '..oYffo...........', '..oYcffoo.........',
    '.oYffcfffo........', '.oYcffcfYYo.......', 'oYffcfYYoo........', 'oYcfYYoo..........', 'oYYYoo............', '.ooo..............'] },
  chocoicecream: { label: 'Flavoured ice cream', group: 'food', art: [
    '.........ooooo....', '........odddddo...', '......oodllllldo..', '.....oddlwwwllldo.', '....oddlwwwwlllldo', '...odldlwwlllllsdo',
    '...odlsdlllllllsdo', '...odlsdslllllssdo', '...oYdlldsssssssdo', '...oYfdssdsssssdo.', '..oYffdsslddssdo..', '..oYcffddlssdddo..',
    '.oYffcfffdllldo...', '.oYcffcfYYdddo....', 'oYffcfYYooooo.....', 'oYcfYYoo..........', 'oYYYoo............', '.ooo..............'] },
  flavouredsoftserve: { label: 'Flavoured soft serve', group: 'food', art: [
    '.............oo...', '............owlo..', '...........oooldo.', '.......oooodddldo.', '.....ooddddwlssdo.', '....oddlwwdllssdo.',
    '...odwldwwldsssdo.', '...odlldlllsdddo..', '...oYslldlsssdo...', '...oYfsssdsssdo...', '..oYffdsssddsdo...', '..oYcffdssssdo....',
    '.oYffcfffsssdo....', '.oYcffcfYYddo.....', 'oYffcfYYoooo......', 'oYcfYYoo..........', 'oYYYoo............', '.ooo..............'] },
  flavouredduosoftserve: { label: 'Flavoured duo soft serve', group: 'food', art: [
    '.............oo...', '............owlo..', '...........ooolyo.', '.......oooodddcyo.', '.....ooddddwlccyo.', '....oddlwwdlcccyo.',
    '...odwldwwldcccyo.', '...odlldlllcyyyo..', '...oYslldlcccyo...', '...oYfsssycccyo...', '..oYffdsscyycyo...', '..oYcffyccccyo....',
    '.oYffcffycccyo....', '.oYcffcfYYyyo.....', 'oYffcfYYoooo......', 'oYcfYYoo..........', 'oYYYoo............', '.ooo..............'] },
  cheesecrustpizza: { label: 'Cheese crust pizza', group: 'food', art: [
    '....oooo..........', '..ooffffooooo.....', '.oUUYYYYfffffooo..', '.oUUUUYYYYYYYfffo.', '..oRRRUUUUUUYYYYYo', '.o#R&RRyNNNNUYUcYo',
    '.oR&&R&ccyyyNUccco', '.oRR&R&cccyyyNYcco', 'oUUR&&_ccccyyyYYco', 'oyyyUU__RR&UUYYoco', 'occyyyURRRR&Yoooco', 'occ_yy#&&&#Yo...o.',
    'o&R__y#R&YYo......', 'oR&R_URYYoo.......', 'o&&RRUYoo.........', 'oR#RYYo...........', 'oYYYoo............', '.ooo..............'] },
  meat: { label: 'Meat', group: 'food', food: true, art: [
    '..................', '..................', '..oo..ooooo.......', '.occooUU(((oo.....', 'occ(((((f(f((o....', 'oc((((((((fc((o...',
    '.o(((((((((((((o..', '.o(((((((((fff(o..', 'o((((((((fffff(o..', 'oU((((((fffffffo..', 'oU((((((fffUUffo..', '.oU((((fffUccUUo..',
    '.oU((((fffUccccco.', '..oU(((ffffUcccco.', '...oU(((fffUccoo..', '....ooUU(ffocco...', '......ooooo.oo....', '..................'] },
  shell: { label: 'Shell', group: 'animal', art: [
    '................o.', '..............oolo', '.............ollo.', '...........oolllo.', '.........oolwlwo..', '........ollslwwo..',
    '......oowlllslo...', '....oollslwlsdo...', '...ollssslwwdo....', '..owwwllsslwwo....', '.olsslwlllllwo....', '.olssslwwllswo....',
    'ollllsslwwllo.....', 'oldddwlslwwwo.....', 'owodddwllwwo......', 'owsooddlooo.......', 'owwdddoo..........', '.ooooo............'] },
  jellyfish: { label: 'Jellyfish', group: 'animal', art: [
    '.....ooooo........', '....olllllooo.....', '...ollwwllllloo...', '...olwwwwsswwlloo.', '..ollwwwwsswwllllo', '..olwwwwwsssllwllo',
    '.ollwwwwsssslllllo', 'ollwwwwssslllllllo', 'ollwwwlllllllwwlwo', 'owllllllwdddddooo.', '.owwwwwddsdsddo...', '..oldddsdddlsllo..',
    '...oldsddooldlolo.', '..ollsdoloololldo.', '..ololdoololollolo', '..olloolololoololo', '...oloolololoololo', '....o..o.o.o..o.o.'] },
  starfish: { label: 'Starfish', group: 'animal', art: [
    '..oo...........oo.', '.olloo.......oollo', '.olslloo...oollslo', '..oldsllooolldsdo.', '...olssslllsssdo..', '....oldsssddssdo..',
    '....olsddddssdo...', '...olssddddlsdo...', '..olssddddddsslo..', '..oldsssdssssdslo.', '.olsssssdssssssslo', 'olssddsssssddddsdo',
    'olddoodsdssdoooddo', '.ooo..olssdo...oo.', '......olsdo.......', '......olsdo.......', '......oldo........', '.......oo.........'] },
  squirrel: { label: 'Squirrel', group: 'animal', art: [
    '..........ooooo...', '.....o...oYYYYYo..', '....oYo.oYYYYYYYo.', '...ooYYooYYYYYnnYo', '..oYYYYNoYYYYNnnno', '.occYYYNNYYYYNnnno',
    'oYcnoYYYNNYYYYNnno', 'oYYoocnYYYNnYYYNno', 'oYYYccnYYYYnnYYNo.', 'onYYYoYYYYYnonYo..', '.ooooYYYYYYYnonNo.', '.oNNYYYoooYYnnoNo.',
    'oNNYYYoYYYYYnnoNo.', 'oNNNNNcYYYYYnnNNo.', '.oNNNccYYYYnnnNNo.', '..ooocccYYnnnNNo..', '....oYYnnnnnoNo...', '.....ooooooooo....'] },
  flour: { label: 'Flour', group: 'food', art: [
    '...ooooooooooooo..', '..occccccccccccco.', '..oufuuuuuuuuuufo.', '...offfffffffffo..', '..ouuuuuuuuuuffoo.', '..occcccccccccfoo.',
    '.occccccccccccfuo.', '.occcccYYYccccfuuo', 'occcccYcyYccccfuuo', 'occccYyyyYccccfuuo', 'oucccYnynYccccfuuo', 'oucccYnnYcccccfuuo',
    'oucccYYYccccccfuuo', 'ouccccccccccccfufo', 'ouucccccccccccfufo', 'ofuucccccccccffffo', '.ofuuuuuuuuuffffo.', '..oooooooooooooo..'] },
  milk: { label: 'Milk', group: 'food', art: [
    '....ooooooooooo...', '...olllllllllllo..', '...oldldlllssllo..', '..owwwwwwwwwwwslo.', '.owwwwwwwwwwwosslo', 'owwwwwwwwwwwoooddo',
    'olssssssssssoddddo', 'oldddsssssssdddddo', 'olssssssssssdddddo', 'olssswswssssdddddo', 'olsswwwwwsssdddddo', 'olsswswswsssddddlo',
    'olsswssswsssddlllo', 'olsssssssssslllllo', 'owwwwwwwwwwwlllllo', 'owwwwwwwwwwwllloo.', 'owwwwwwwwwwwloo...', '.oooooooooooo.....'] },
  chonkbottle: { label: 'Chonk bottle', group: 'food', art: [
    '.......oooo.......', '......ollllo......', '.....olsssslo.....', '.....olsssslo.....', '....oiilllliio....', '....oiiiiiiiio....',
    '.....oibiibio.....', '....oibbbbbbio....', '....oibbbbbbio....', '...oibiiiiiibio...', '...oibiiiiiibio...', '..oibllllllllbio..',
    '..oissllllllssio..', '..oissssssssssio..', '..oissssssssssio..', '...oissssssssio...', '....oiiiiiiiio....', '.....oooooooo.....'] },
  boba: { label: 'Boba', group: 'food', art: [
    '........oo.....oo.', '.......owwo...oslo', '.......owwwo.oslso', '......owffwwoslso.', '.....owffcfwwsso..', '....owffcccfwwo...',
    '...owffcccfffwwo..', '..owffcccfffffwwo.', '.owffyccfffffffwwo', '.owffyyffffffffwwo', 'owffffffffffffwoo.', 'owfffU(ffU(ffwo...',
    'owU(f((ff((fwo....', 'ow((fffffffwo.....', '.owfffU(ffwo......', '..owff((wwo.......', '...owwwwoo........', '....oooo..........'] },
  mushroom2: { label: 'Mushroom', group: 'food', art: [
    '......oooooo......', '....oowllllloo....', '..oolllsswlsllo...', '.owlsssssllsssdo..', 'olsswlssssssswllo.', 'oldddddddddddlllo.',
    'oldslccNNNNddddllo', '.oolddlccnncclsddo', '...ooolcccndddddo.', '......occnoooooo..', '......occo........', '.....occco........',
    '.....occco........', '.....occcno.......', '.....oncccno......', '.....oncccno......', '......onnno.......', '.......ooo........'] },
};
// Every icon the app knows: the official ones with Kitty Gallery's put over them (src/pixel/live.ts keeps it so).
export const PICKER_ICONS: Record<string, PickerIcon> = { ...OFFICIAL_PICKER_ICONS };

// The order the pickers show them in: the icons without a group first, then each group A to Z, and A to Z by name in each.
// Both lists are filled in place (refreshPickerOrder), so whoever holds them sees Kitty Gallery's icons once they are in.
const az = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
export const PICKER_ICON_NAMES: string[] = [];
// The same, cut into groups for the pickers' headings: [group, names] with the icons without a group under "default", first.
export const PICKER_ICON_GROUPS: [string, string[]][] = [];
export function refreshPickerOrder() {
  const names = Object.keys(PICKER_ICONS).sort((a, b) => {
    const ga = PICKER_ICONS[a].group ?? '', gb = PICKER_ICONS[b].group ?? '';
    return az(ga, gb) || az(PICKER_ICONS[a].label, PICKER_ICONS[b].label);
  });
  const groups: [string, string[]][] = [];
  for (const n of names) {
    const g = PICKER_ICONS[n].group ?? 'default';
    if (groups[groups.length - 1]?.[0] !== g) groups.push([g, []]);
    groups[groups.length - 1][1].push(n);
  }
  PICKER_ICON_NAMES.splice(0, PICKER_ICON_NAMES.length, ...names);
  PICKER_ICON_GROUPS.splice(0, PICKER_ICON_GROUPS.length, ...groups);
}
refreshPickerOrder();
