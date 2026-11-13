// The icons people can put on an achievement or a side quest, drawn at 16×16 on the fine grid (see pixelart.ts).
// Letters: s the side-quest colour (lit and shaded at the edges for you; l and d paint it lit or shaded by hand), o a dark line, w white, y/Y yellow/gold,
// r pink, R red, g/G green, b/B blue, n/N brown, k/K grey, c cream, v lavender, f peach, x lime; each note colour lit/shaded:
// p/P pink, a/A lavender, i/I sky, m/M mint, j/J sun, u/U peach, z/Z lime; '.' is empty. The outline is added for you,
// so draw only the inside. Icon names are stored with the data: rename none, only add.
// `group` sorts the icons in Kitty Gallery and the pickers; without one an icon is in the "default" group. Order here doesn't
// matter: each group is listed A to Z by label.

export const PICKER_ICONS: Record<string, { label: string; art: string[]; group?: string }> = {
  star: { label: 'Star', group: 'nature n weather', art: [
    '.......ss.......', '.......ss.......', '......swss......', '......ssss......', '.....swssss.....', 'ssssssssssssssss',
    '.ssssssssssssss.', '..ssssossossss..', '...srssssssrs...', '....ssssssss....', '....ssssssss....', '...ssssssssss...',
    '...ssss..ssss...', '..ssss....ssss..', '..sss......sss..', '.ss..........ss.'] },
  heart: { label: 'Heart', art: [
    '................', '..ssss....ssss..', '.ssssss..ssssss.', 'sswwssssssssssss', 'swwsssssssssssss', 'swssssssssssssss',
    'ssssssssssssssss', '.ssssssssssssss.', '.ssssssssssssss.', '..ssssssssssss..', '...ssssssssss...', '....ssssssss....',
    '.....ssssss.....', '......ssss......', '.......ss.......', '................'] },
  food: { label: 'Food', group: 'food', art: [
    '............N.N.', '...........N.N..', '..........N.N...', '....w.w..N.N....', '.....w..N.N.....', '..cccccNcNcccc..',
    '.cyycccgccRccgc.', 'oooooooooooooooo', 'ssssssssssssssss', 'swssssssssssssss', '.ssssssssssssss.', '.ssssssssssssss.',
    '..ssssssssssss..', '...ssssssssss...', '.....ssssss.....', '....ssssssss....'] },
  coffee: { label: 'Drink 1', group: 'food', art: [
    '................', '....w...w.......', '.....w...w......', '....w...w.......', '................', '.sssssssssss....',
    '.sNNNNNNNNNs....', '.ssssssssssssss.', '.swsssssssss..s.', '.swsssssssss..s.', '.ssssssssssssss.', '.sssssssssss....',
    '..sssssssss.....', 'kkkkkkkkkkkkkk..', '.kkkkkkkkkkkk...', '................'] },
  cake: { label: 'Cake', group: 'food', art: [
    '.......Y........', '......yYy.......', '.......y........', '.......r........', '.......r........', '.wwwwwwwwwwwww..',
    '.wwwwwwwwwwwwww.', '.wswwwswwwwswww.', '.dsrsssssrsssss.', '.dsssssssssssss.', '.cccccccccccccc.', '.dsssssssssssss.',
    '.dsssssssssssss.', '.dsssssssssssss.', 'kkkkkkkkkkkkkkkk', '................'] },
  fish: { label: 'Fish', group: 'pet', art: [
    '................', '................', '....sssss.....ss', '..sssssssss..sss', '.sssssssssss.sss', 'ssowssssssssssss',
    'ssoosssssssss...', 'sssssssssssss...', 'sssssssssssss...', 'ssssssssssssssss', '.sssssssssss.sss', '..sssssssss..sss',
    '....sssss.....ss', '................', '................', '................'] },
  camera: { label: 'Camera', group: 'object', art: [
    '................', '................', '..kk..ssss......', '.ssssssssssssss.', '.swsssssssssRRs.', '.sssssoooosssss.',
    '.ssssoBBBBossss.', '.sssoBbwBBBosss.', '.sssoBwBBBBosss.', '.sssoBBBBBBosss.', '.ssssoBBBBossss.', '.sssssoooosssss.',
    '.ssssssssssssss.', '................', '................', '................'] },
  mountain: { label: 'Mountain', group: 'nature n weather', art: [
    '................', '................', '......w.........', '.....www........', '....wlwlw...w...', '....lllll..www..',
    '...lsssssl.wlww.', '...ssssssslllll.', '..ssssssssssssll', '..ssssssssssssss', '.sssssssssssssss', '.sssssssssssssss',
    'ssssssssssssssss', 'gggggggggggggggg', 'GgGgGgGgGgGgGgGg', '................'] },
  tree: { label: 'Tree', group: 'nature n weather', art: [
    '......ssss......', '....ssssssss....', '...swwsssssss...', '..swssssssssss..', '.ssssssrsssssss.', '.ssssssssssssss.',
    '.ssrssssssssrss.', '..ssssssssssss..', '...ssssssssss...', '.....ssnnss.....', '......nnnn......', '......nnnn......',
    '......nnnn......', '.....nnnnnn.....', '...gggggggggg...', '................'] },
  wave: { label: 'Parasol', group: 'object', art: [
    '................', '......ssss......', '....swssssss....', '..sswssswsssss..', '.swsssswsssswss.', 'swssssswssssswss',
    'ss..ss.nn.ss..ss', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......',
    '.......nn.......', 'cccccccnnccccccc', 'cccccccccccccccc', '................'] },
  sun: { label: 'Sun', group: 'nature n weather', art: [
    '.......y........', '..y....y....y...', '...y........y...', '.....ssssss.....', '....ssssssss....', '...sswsssssss...',
    '...ssssssssss...', 'yy.ssosssosss.yy', '...srssssssrs...', '...ssssoossss...', '....ssssssss....', '.....ssssss.....',
    '...y........y...', '..y....y....y...', '.......y........', '................'] },
  temple: { label: 'Temple', group: 'housing', art: [
    '.......yy.......', '.......ss.......', '......ssss......', '.....ssssss.....', '..yyyyyyyyyyyy..', 'y..ssssssssss..y',
    '...ssossssoss...', '.yyyyyyyyyyyyyy.', 'y.ssssssssssss.y', '..ssoossssooss..', '..ssoossssooss..', '..sssssoosssss..',
    '..sssssoosssss..', '.kkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkk', '................'] },
  plane: { label: 'Plane', group: 'transport', art: [
    '.......ss.......', '......ssss......', '......sBBs......', '......ssss......', '......ssss......', '.....ssssss.....',
    '...ssssssssss...', '.ssssssssssssss.', 'RssssssssssssssR', 'sss...ssss...sss', '......ssss......', '......ssss......',
    '.....ssssss.....', '....ssssssss....', '....sss..sss....', '................'] },
  boot: { label: 'Hiking boots', group: 'object', art: [
    '................', '..ssssss........', '..ssswws........', '..ssssss........', '..ssswws........', '..ssssss........',
    '..ssswwss.......', '..ssssssssss....', '..sssssssssss...', '.ssssssssssssss.', '.ssssssssssssss.', 'NNNNNNNNNNNNNNNN',
    'N.N.N.N.N.N.N.N.', '................', '................', '................'] },
  pin: { label: 'Place', art: [
    '....ssssssss....', '...ssssssssss...', '..sswsssssssss..', '..swssoooossss..', '..sssowwwwosss..', '..sssowwwwosss..',
    '..ssssoooossss..', '..ssssssssssss..', '...ssssssssss...', '....ssssssss....', '.....ssssss.....', '......ssss......',
    '.......ss.......', '....kkkkkkkk....', '................', '................'] },
  home: { label: 'Home', group: 'housing', art: [
    '...........nn...', '.......RR..nn...', '......RRRR.nn...', '.....RRRRRRnn...', '....RRRRRRRR....', '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..', '.RRRRRRRRRRRRRR.', '..ssssssssssss..', '..sBBssssssBBs..', '..sBBsnnnnsBBs..', '..ssssnnnnssss..',
    '..ssssnnynssss..', '..ssssnnnnssss..', 'gggggggggggggggg', '................'] },
  book: { label: 'Book', group: 'object', art: [
    '................', '................', '.wwwwww..wwwwww.', 'swkkkkwwwwkkkkws', 'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws',
    'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws', 'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws', 'swwwwwwsswwwwwws', 'ssssssssssssssss',
    '.ssssss..ssssss.', '................', '................', '................'] },
  music: { label: 'Music', art: [
    '................', '.....sssssssssss', '.....sssssssssss', '.....ss.......ss', '.....ss.......ss', '.....ss.......ss',
    '.....ss.......ss', '.....ss.......ss', '.....ss.......ss', '..sssss....sssss', '.swssss...swssss', '.ssssss...ssssss',
    '..ssss.....ssss.', '................', '................', '................'] },
  flag: { label: 'Flag pole', group: 'object', art: [
    '................', '.nssssssssss....', '.nsssssssssss...', '.nsssswsssssss..', '.nssswwwssssss..', '.nsssswssssss...',
    '.nssssssssssss..', '.nsssssssss.....', '.n..............', '.n..............', '.n..............', '.n..............',
    '.n..............', '.n..............', 'kkk.............', '................'] },
  trophy: { label: 'Trophy', group: 'object', art: [
    '...ssssssssss...', '.yyyyyyyyyyyyyy.', 'yy.yyyyyyyyyy.yy', 'y..yyyylsyyyy..y', 'yy.yyyssssyyy.yy', '.yyyyyysdyyyyyy.',
    '....yyyyyyyy....', '....yyyyyyyy....', '.....yyyyyy.....', '.....yyyyyy.....', '......ssss......', '......yyyy......',
    '.......yy.......', '.......yy.......', '.....ssssss.....', '....ssssssss....'] },
  gem: { label: 'Gem', group: 'object', art: [
    '................', '................', '...ssssssssss...', '..swwsssssssss..', '.swwsssssssssss.', 'dddddddddddddddd',
    '.ssssssssssssss.', '..sswsssssssss..', '...ssssssssss...', '....ssssssss....', '.....ssssss.....', '......ssss......',
    '.......ss.......', '................', '................', '................'] },
  fire: { label: 'Fire', art: [
    '.......R........', '......RR........', '......RRR....R..', '.....RRRR...RR..', '....RRRRRR..RRR.', '...RRRRYRRRRRRR.',
    '..RRRRYYRRRRRRR.', '..RRRYYYYRRRRRR.', '.RRRYYyyYYRRRRR.', '.RRYYyyyyYYRRRR.', '.RRYyyyyyyYRRRR.', '.RRYyyywyyYRRR..',
    '..RRYyyyyyYRR...', '...RRYYYYYRR....', '.....RRRRRR.....', '................'] },
  paw: { label: 'Paw', group: 'pet', art: [
    '................', '....ss....ss....', '...ssss..ssss...', '...ssss..ssss...', '....ss....ss....', '.ss..........ss.',
    'ssss........ssss', 'ssss..ssss..ssss', '.ss..ssssss..ss.', '....ssssssss....', '...ssssssssss...', '...ssssssssss...',
    '...ssssssssss...', '....sss..sss....', '................', '................'] },
  bag: { label: 'Shopping Bag', group: 'object', art: [
    '................', '......ssss......', '.....s....s.....', '.....s....s.....', '..ssssssssssss..', '..swwsssssssss..',
    '..swssssssssss..', '..ssssssssssss..', '.ssssswsswsssss.', '.sssswwwwwwssss.', '.ssssswwwwsssss.', '.sssssswwssssss.',
    '.ssssssssssssss.', '.ssssssssssssss.', '................', '................'] },
  cat: { label: 'Cat', group: 'pet', art: [
    '...s........s...', '..sss......sss..', '..ssss....ssss..', '..ssssssssssss..', '.ssssssssssssss.', '.ssssssssssssss.',
    'ssswosssssswosss', 'sssoossssssoosss', 'sssssssrrsssssss', 'ooossssoossssooo', 'sssssoossoosssss', 'ooossssssssssooo',
    '..sssssssssssss.', '...ssssssssss...', '.....ssssss.....', '................'] },
  dog: { label: 'Dog', group: 'pet', art: [
    '................', '..nn........nn..', '.nnnssssssssnnn.', '.nnssssssssssnn.', '.nnssssssssssnn.', '.nnsowssssowsnn.',
    '.nnsoossssoosnn.', '..nssssssssssn..', '...swwwNNwwws...', '....swwwwwws....', '.....sswwss.....', '......ssss......',
    '................', '................', '................', '................'] },
  flower: { label: 'Flower', group: 'nature n weather', art: [
    '................', '......ssss......', '.....ssssss.....', '..ss.ssssss.ss..', '.ssss.ssss.ssss.', '.sssssyyyysssss.',
    '..sssyywyyysss..', '...ssyyyyyyss...', '..sssyyyyyysss..', '.sssssyyyysssss.', '.ssss.ssss.ssss.', '..ss.ssssss.ss..',
    '.....ssssss.....', '.......GG.......', '....gggGGggg....', '................'] },
  icecream: { label: 'Ice cream', group: 'food', art: [
    '.....ssssss.....', '....swwsssss....', '...swssssssss...', '...ssRsssbsss...', '..ssssssssssss..', '..sssysssssRss..',
    '..ssssssssssss..', '...nnnnnnnnnn...', '...nNnnnNnnnN...', '....nnnnnnnn....', '....nnNnnnNn....', '.....nnnnnn.....',
    '.....nNnnNn.....', '......nnnn......', '.......nn.......', '.......nn.......'] },
  gift: { label: 'Gift', group: 'object', art: [
    '................', '...yy......yy...', '..y..y....y..y..', '..y...y..y...y..', '...yyyyyyyyyy...', '.ssssssyyssssss.',
    '.swssssyyssssss.', '.ddddddyydddddd.', '..sssssyysssss..', '..swsssyysssss..', '..sssssyysssss..', '..sssssyysssss..',
    '..sssssyysssss..', '..sssssyysssss..', '................', '................'] },
  tent: { label: 'Tent', group: 'housing', art: [
    '................', '.......nn.......', '.......ss.......', '......ssss......', '.....ssssss.....', '....ssssssss....',
    '...ssssoossss...', '..sssssoosssss..', '..ssssoKKossss..', '.sssssoKKosssss.', '.ssssoKKKKossss.', 'sssssoKKKKosssss',
    'ssssoKKKKKKossss', 'gggggggggggggggg', 'GgGgGgGgGgGgGgGg', '................'] },
  ticket: { label: 'Ticket', group: 'object', art: [
    '................', '................', '................', 'ssssssssssssssss', 'ssssssssssysssss', 'ssssswsssyyyssss',
    '.sssssssyyyyyss.', '.sssswsssyyysss.', '.ssssssssysysss.', 'ssssswssssssssss', 'ssssssssssssssss', '................',
    '................', '................', '................', '................'] },
  game: { label: 'Controller', group: 'object', art: [
    '................', '................', '................', '...ssssssssss...', '.sswsssssssssss.', 'sssKssssssssysss',
    'ssKKKssssssBsBss', 'sssKssssssssgsss', 'ssssssssssssssss', 'ssssss....ssssss', '.ssss......ssss.', '..ss........ss..',
    '................', '................', '................', '................'] },
  dumbbell: { label: 'Dumbbell', group: 'object', art: [
    '................', '................', '................', '.ss..........ss.', 'swss........swss', 'swss........swss',
    'ssss........ssss', 'sssskkkkkkkkssss', 'sssskkkkkkkkssss', 'ssss........ssss', 'ssss........ssss', 'ssss........ssss',
    '.ss..........ss.', '................', '................', '................'] },
  night: { label: 'Night', group: 'nature n weather', art: [
    '................', '....ssss........', '...sssss.....y..', '..sssss.....yyy.', '.sssss.......y..', '.sssss..........',
    'sssss...........', 'sssss...........', 'ssoss.......y...', 'ssssrs..........', '.ssssss.........', '.ssssssss.......',
    '..ssssssssss....', '...ssssssss.....', '.....ssss.......', '................'] },
  rainbow: { label: 'Rainbow', group: 'nature n weather', art: [
    '................', '................', '................', '................', '......RRRR......', '....RRYYYYRR....',
    '...RYYyyyyYYR...', '...RYyggggyYR...', '..RYygBBBBgyYR..', '..RYygB..BgyYR..', '..RYygB..BgyYR..', '.wwwwww..wwwwww.',
    '.wwwwww..wwwwww.', '..wwww....wwww..', '................', '................'] },
  cheers: { label: 'Cocktail', group: 'food', art: [
    '............y...', '...........yyy..', '.wwwwwwwwwwwwww.', '.ssssssssssssss.', '..sssssssssRss..', '...ssssssssss...',
    '....ssssssss....', '.....ssssss.....', '......ssss......', '.......kk.......', '.......kk.......', '.......kk.......',
    '.....kkkkkk.....', '................', '................', '................'] },
  rocket: { label: 'Rocket', group: 'transport', art: [
    '.......ss.......', '......ssss......', '.....ssssss.....', '.....ssssss.....', '.....ssBBss.....', '.....ssBBss.....',
    '.....ssssss.....', '.....ssssss.....', '....ssssssss....', '...RssssssssR...', '..RRssssssssRR..', '..RR.ssssss.RR..',
    '.....yyyyyy.....', '......yyyy......', '......rYYr......', '.......yy.......'] },
  balloon: { label: 'Hot Air Balloon', group: 'transport', art: [
    '...ssssssssss...', '..ssssssssssss..', '.ssssssssssssss.', '.sssssYYYYsssss.', '.sssssYYYYsssss.', '.sssssYYYYsssss.',
    '..ssssYYYYssss..', '...sssYYYYsss...', '....ssYYYYss....', '.....o....o.....', '.....o....o.....', '.....o....o.....',
    '.....o....o.....', '....nnnnnnnn....', '....nNNNNNNn....', '....nnnnnnnn....'] },
  umbrella: { label: 'Rain', group: 'nature n weather', art: [
    '...sss..........', '..sssss..ssss...', '.sssssssssssss..', 'sssssssssssssss.', 'sssssssssssssss.', 'sssssssssssssss.',
    '.s.ss.ssss.ss...', '................', '................', '..B..B....B..B..', '.B..B....B..B...', '................',
    '................', '................', '................', '................'] },
  snow: { label: 'Snow', group: 'nature n weather', art: [
    '................', '.......ss.......', '......ssss......', '...s...ss...s...', '....s..ss..s....', '.....s.ss.s.....',
    '..s...ssss...s..', '.sssssswwssssss.', '.sssssswwssssss.', '..s...ssss...s..', '.....s.ss.s.....', '....s..ss..s....',
    '...s...ss...s...', '......ssss......', '.......ss.......', '................'] },
  cloud: { label: 'Cloud', group: 'nature n weather', art: [
    '................', '................', '................', '.........sss....', '...ss...ssssss..', '..ssss.sssssss..',
    '.ssssssssssssss.', 'ssssssssssssssss', 'ssssssssssssssss', '.ssssssssssssss.', '..ssssssssssss..', '................',
    '................', '................', '................', '................'] },
  sparkle: { label: 'Sparkle', art: [
    '.......ss.......', '.......ss.......', '.......ss.......', '.......ss.......', '.......ss.......', '......ssss......',
    '.....ssssss.....', 'ssssssswwsssssss', 'ssssssswwsssssss', '.....ssssss.....', '......ssss......', '.......ss.......',
    '.......ss.......', '.......ss.......', '.......ss.......', '................'] },
  leaf: { label: 'Leaf', group: 'nature n weather', art: [
    '...........sssss', '........ssssdsss', '......ssssdsdsss', '.....sssssdsdsss', '....sssdssddddds', '...ssssdssdsssss',
    '..ssdssddddssss.', '..ssdssddddddss.', '..ssdssdssssss..', '..ssdsddssssss..', '..ssddddsssss...', '...dddddddss....',
    '..Nddsssss......', '.NN.sssss.......', 'NN..............', 'N...............'] },
  cactus: { label: 'Cactus', group: 'nature n weather', art: [
    '.......rr.......', '......ssss......', '......ssss......', '..ss..ssss..ss..', '..ss..ssss..ss..', '..ss..ssss..ss..',
    '..ssssssssssss..', '..ssssssssssss..', '......ssss......', '......ssss......', '......ssss......', '......ssss......',
    '...nnnnnnnnnn...', '....nnnnnnnn....', '....nNNNNNNn....', '................'] },
  mushroom: { label: 'Mushroom', group: 'food', art: [
    '.....ssssss.....', '...ssssssssss...', '..ssssssssssss..', '.sswwsssssswwss.', 'ssswwsssssswwsss', 'sssssswwwwssssss',
    'ssssssssssssssss', '.ssssssssssssss.', '..ssssssssssss..', '................', '....cccccccc....', '....cccccccc....',
    '....cccccccc....', '....cccccccc....', '.....cccccc.....', '................'] },
  butterfly: { label: 'Butterfly', group: 'pet', art: [
    '.....d....d.....', '......d..d......', '.......dd.......', '.ss..ssddss..ss.', 'sssssssddsssssss', 'ssswlssddsswlsss',
    'ssswwssddsswwsss', 'sssssssddsssssss', '.ssssssddssssss.', '..sssssddsssss..', '.ssssddddddssss.', '.ssslssddsslsss.',
    '..sssssddsssss..', '...sss.dd.sss...', '.......dd.......', '................'] },
  chick: { label: 'Chick', group: 'pet', art: [
    '.....yyyyyy.....', '....yyyyyyyy....', '..yyyyyyysysyy..', '.yyyyyyyyysyyyy.', '.yyyyyyyyyyyyyy.', 'yyyoyyyyyyyyoyyy',
    'yyyyyyyyyyyyyyyy', 'yyyyyyyRRyyyyyyy', 'yyyyyyyRRyyyyyyy', '.yyyyyyyyyyyyyy.', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..',
    '...yyyyyyyyyy...', '...R..R..R..R...', '..RR.RR..RR.RR..', '................'] },
  pizza: { label: 'Pizza', group: 'food', art: [
    'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'yyssyyyyyyyyssyy', '.ysdyyyylyyysdy.', '.yyyyssyyyyyyyy.', '..yyysdyyssyyy..',
    '..ysyyyyysdysy..', '...yyyyyyyyyy...', '...yyyyysyyyy...', '....ylyyyysy....', '....yyyyyyyy....', '.....yyssyy.....',
    '.....yysdyy.....', '......yyyy......', '.......ys.......', '.......yy.......'] },
  burger: { label: 'Burger', group: 'food', art: [
    '................', '....nnnnnnnn....', '..nnnnnnnnnnnn..', '.nnnwnnnnnnwnnn.', 'nnnnnnnnnnnnnnnn', 'gggggggggggggggg',
    'ssssssssssssssss', 'yyyyyyyyyyyyyyyy', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNNNNNN', 'gggggggggggggggg', 'nnnnnnnnnnnnnnnn',
    '.nnnnnnnnnnnnnn.', '..nnnnnnnnnnnn..', '................', 'dddddddddddddddd'] },
  apple: { label: 'Fruit', group: 'food', art: [
    '...........GG...', '.......nn.GGG...', '.......nn.GG....', '................', '..sssss..sssss..', '.ssssssssssssss.',
    'sswsssssssssssss', 'sswsssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss',
    '.ssssssssssssss.', '..ssssssssssss..', '...ssssssssss...', '....sss..sss....'] },
  headphones: { label: 'Headphone', group: 'object', art: [
    '....ssssssss....', '..sss......sss..', '.ss..........ss.', '.s............s.', 'ss............ss', 'ss............ss',
    'ssss........ssss', 'sssk........ksss', 'sssk........ksss', 'sssk........ksss', 'sssk........ksss', 'ssss........ssss',
    '.ss..........ss.', '................', '................', '................'] },
  cap: { label: 'Study', group: 'object', art: [
    '................', '.......ss.......', '....ssssssss....', '..ssssssssssss..', 'ssssssssssssssss', '..ssssssssssss.y',
    '...KssssssssK..y', '...KKKKssKKKK..y', '...KKKKKKKKKK..y', '...KKKKKKKKKK..Y', '...KKKKKKKKKK...', '...KKKKKKKKKK...',
    '...KKKKKKKKKK...', '....KKKKKKKK....', '................', '................'] },
  laptop: { label: 'Laptop', group: 'object', art: [
    '................', '..ssssssssssss..', '..ssssssssssss..', '..sBwBBBBBBBBs..', '..sBwBBBBBBBBs..', '..sBBBBBBBBBBs..',
    '..sBBBBBBBBBBs..', '..sBBBBBBBBBBs..', '..ssssssssssss..', '................', 'kkkkkkkkkkkkkkkk', '.kkkkkkkkkkkkkk.',
    '................', '................', '................', '................'] },
  bulb: { label: 'Light bulb', group: 'object', art: [
    '.....yyyyyy.....', '...yyyyyyyyyy...', '..yyyyyyyyyyyy..', '..ywyyyyyyyyyy..', '.yywyyyyyyyyyyy.', '.yyyyyyyyyyyyyy.',
    '.yyyyyyyyyyyyyy.', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..', '...yyyyyyyyyy...', '....yyyyyyyy....', '....ssssssss....',
    '....dddddddd....', '....ssssssss....', '.....ssssss.....', '......ssss......'] },
  medal: { label: 'Medal', group: 'object', art: [
    '..ss........ss..', '..sss......sss..', '...sss....sss...', '....sss..sss....', '.....ssssss.....', '......ssss......',
    '....yyyyyyyy....', '...yyyyyyyyyy...', '..yyyyyyyyyyyy..', '..yyyyYYYYyyyy..', '..yyyYYYYYYyyy..', '..yyyYYYYYYyyy..',
    '..yyyyYYYYyyyy..', '...yyyyyyyyyy...', '....yyyyyyyy....', '................'] },
  crown: { label: 'Crown', group: 'object', art: [
    'y..............y', 'yy.....yy.....yy', 'yyy....yy....yyy', 'yyyy..yyyy..yyyy', 'yyyy..yyyy..yyyy', 'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy', 'yyyyyyyyyyyyyyyy', 'yyyssyyssyyssyyy', 'yyyssyyssyyssyyy', 'yyyyyyyyyyyyyyyy', 'dddddddddddddddd',
    'dddddddddddddddd', 'dddddddddddddddd', '................', '................'] },
  clock: { label: 'Clock', group: 'object', art: [
    '....ssssssss....', '..ssssssssssss..', '.ssssssssssssss.', '.ssswwwwwwwwsss.', 'ssswwwwowwwwwsss', 'ssswwwwowwwwwsss',
    'ssswwwwowwwwwsss', 'ssswwwwowwwwwsss', 'ssswwwwooooowsss', 'ssswwwwwwwwwwsss', 'ssswwwwwwwwwwsss', '.ssswwwwwwwwsss.',
    '.ssssssssssssss.', '..ssssssssssss..', '....ssssssss....', '................'] },
  bell: { label: 'Bell', group: 'object', art: [
    '.......yy.......', '......ssss......', '.....slssss.....', '....sllsssss....', '....slssssss....', '...sllsssssss...',
    '...slssssssss...', '...ssssssssss...', '..ssssssssssss..', '.ssssssssssssss.', 'ssssssssssssssss', 'ssssssssssssssss',
    '................', '.....yyyyyy.....', '......yyyy......', '................'] },
  ball: { label: 'Ball', group: 'object', art: [
    '....sssoosss....', '..ossssoosssso..', '.sossssoossssos.', '.sossssoossssos.', 'ssossssoossssoss', 'ssossssoossssoss',
    'ssossssoossssoss', 'oooooooooooooooo', 'oooooooooooooooo', 'ssossssoossssoss', 'ssossssoossssoss', 'ssossssoossssoss',
    '.sossssoossssos.', '.sossssoossssos.', '..ossssoosssso..', '....sssoosss....'] },
  train: { label: 'Train', group: 'transport', art: [
    '................', '..ssssssssssss..', '.ssssssssssssss.', '.ssBBBBBBBBBBss.', '.ssBBBBBBBBBBss.', '.ssBBBBBBBBBBss.',
    '.ssssssssssssss.', '.ssssssssssssss.', '.ssyssssssssyss.', '.ssssssssssssss.', '.ssssssssssssss.', '..KK..KKKK..KK..',
    '................', '................', 'KKKKKKKKKKKKKKKK', '................'] },
  backpack: { label: 'Backpack', group: 'object', art: [
    '..dd..KKKK..dd..', '..ddssssssssdd..', '..ssssssssssss..', '.sssllllllllsss.', '.ssssssssssssss.', '.ssssssssssssss.',
    '.sssddddddddsss.', '.sssdKdKKdKdsss.', '.sssddddddddsss.', '.sssddddddddsss.', '.sssddddddddsss.', '.sssddddddddsss.',
    '.ssssssssssssss.', '..ssssssssssss..', '..dd........dd..', '..dd........dd..'] },
  compass: { label: 'Compass', group: 'object', art: [
    '....ssssssss....', '..ssssssssssss..', '.ssslllRRlllsss.', '.ssllllRRRlllss.', 'ssllllRRRRllllss', 'sslllRRRRRRlllss',
    'sslllRRRRRRlllss', 'ssllllloolllllss', 'ssllllloolllllss', 'sslllkkkkkklllss', 'sslllkkkkkklllss', 'ssllllkkkkllllss',
    '.ssllllkkllllss.', '.sssllllllllsss.', '..ssssssssssss..', '....ssssssss....'] },
  key: { label: 'Key', group: 'object', art: [
    '................', '................', '................', '................', '................', '..ssss..........',
    '.ssssss.........', 'sss..sssssssssss', 'sss..sssssssssss', '.ssssss...ss.ss.', '..ssss....ss.ss.', '................',
    '................', '................', '................', '................'] },
  car: { label: 'Car', group: 'transport', art: [
    '................', '................', '................', '.....ssssss.....', '...ssBBsBBBs....', '..ssBBBsBBBBs...',
    '..ssBBBsBBBBs...', '.sssssssssssss..', 'ssssssssssssssss', 'sssKKKKssKKKKsyy', 'sssKkkKssKkkKsss', '...KkkK..KkkK...',
    '...KKKK..KKKK...', '................', '................', '................'] },
  boat: { label: 'Boat', group: 'transport', art: [
    '.......N........', '.......Nw.......', '.......Nww......', '.......Nwww.....', '.......Nwwww....', '.......Nwwwww...',
    '.......Nwwwwww..', '.......Nwwwwwww.', '.......N........', 'ssssssssssssssss', '.ssssssssssssss.', '..ssssssssssss..',
    '...ssssssssss...', 'bbbbbbbbbbbbbbbb', '.bb..bb..bb..bb.', '................'] },
  strawberrycake: { label: 'Strawberry cake', group: 'cute dessert', art: [
    '................', '......RRll......', '.....RRrRsll....', '.....RoRRssll...', '....llRRlsssll..', '...lllllllllsl..',
    '..llllllcccccc..', '..ccccccllRRll..', '..llRRlllRrrRl..', '.YlRrrRllRrrRlY.', 'wYlRrrRlccccccYw', 'wYccccccccccccYw',
    'wYccccccYYYYYYww', 'wwYYYYYYwwwwwwww', '.wwwwwwwwwwwwww.', '...wwwwwwwwww...'] },
  strawberrymacaron: { label: 'Strawberry macaron', group: 'cute dessert', art: [
    '................', '.....ssslww.....', '...ssssslwwls...', '..sssssssllsss..', '..ssssssssssss..', '.dssssssssssssd.',
    '.ddssssssssssdd.', '.dsllssssssllsd.', '.wdsssslsllssdw.', '.wRddssssssddRw.', '.RrrRwwRRwwRrrR.', '..lrRwRrrRwRrl..',
    '..sslwRrrRwlss..', '...ssssssssss...', '.....ssssss.....', '................'] },
  chocolate: { label: 'Chocolate', group: 'cute dessert', art: [
    '..wwwccnnnnnNN..', '..woonoonoonNN..', '..wNNnNNnNNnNN..', '..cNNnNNnNNnNN..', '..nnnnnnnnnnNN..', '..noonoonoonNN..',
    '..nNNnNNnNNnNN..', '..nNNnNNnNNnNN..', '.KKKnnnnnnKKKKK.', '.kkkKKNNKKkkkkk.', '.kkkkkKKkkkkkkk.', '.kkkkkkKkkkkkkk.',
    '..dddddddddddd..', '..ssssssssssdd..', '..ssssssssssdd..', '................'] },
  flavouredchocolate: { label: 'Flavoured Chocolate', group: 'cute dessert', art: [
    '..wwwllsssssdd..', '..woosoosoosdd..', '..wddsddsddsdd..', '..lddsddsddsdd..', '..ssssssssssdd..', '..soosoosoosdd..',
    '..sddsddsddsdd..', '..sddsddsddsdd..', '.KKKssssssKKKKK.', '.kkkKKddKKkkkkk.', '.kkkkkKKkkkkkkk.', '.kkkkkkKkkkkkkk.',
    '..KKKKKKKKKKKK..', '..kkkkkkkkkkKK..', '..kkkkkkkkkkKK..', '................'] },
  strawberrysundae: { label: 'Strawberry Sundae', group: 'cute dessert', art: [
    '.......cc.....Gg', '......wcwc...gGg', '....cwwcwwcwGgG.', '..RRwwwcwwcwRR..', '.wRrRwcRRccRrRw.', '.wRRRcRRrRcRRRw.',
    '..wwdcRRRRcdww..', '..wswwwwwwwwsw..', '...wssssssssw...', '...wsdsdsdsdw...', '...wddddddddw...', '....wddddddw....',
    '....BwwwwwwB....', '....wBBBBBBw....', '....wwbwwbww....', '.....wwwwww.....'] },
  strawberrypankcake: { label: 'Strawberry Pancake', group: 'cute dessert', art: [
    '................', '......www.......', '.....wwwwwlGG...', '...lswcwwwRRGG..', '..llswccwRRrRG..', '..lllswwwRrRRl..',
    '..lwwlllloRRll..', '..dlllwlllllld..', '..yddllllllldy..', '..cccsssllldcc..', '.nycccyydlldcyn.', '.ncyycccdlldycn.',
    '..nccyycyddccn..', '...nnccccccnn...', '.....nnnnnn.....', '................'] },
  strawberryflan: { label: 'Strawberry Flan', group: 'cute dessert', art: [
    '.........RR.....', '.....RR.RRrR....', '....RrrRRRRR....', '....RrrrgggR....', '...sRrrGgggGs...', '...ssRRGggGGs...',
    '...slsssGGsss...', '..clssllsssslc..', '..cclsssssslcc..', '..cccccccccccc..', '..cccccccccccc..', '.wnccccccccccnw.',
    '.wwnnccccccnnww.', '.wwwwYYYYYYwwww.', '..wwwwwwwwwwww..', '....wwwwwwww....'] },
  pawcoffee: { label: 'Paw Coffee', group: 'cute dessert', art: [
    '...wwwwwwww.....', '.wwcnnnnnncww...', 'wcnnNNwwNNnncw..', 'wnncwNccNwcnnw..', 'wnnwNwwwwNwnnw..', 'wnnNwwwwwwNnnwww',
    'wcnncwwwwcnncwlw', 'wwwcnnnnnncwwwdw', 'wwwwwwwwwwwwwwdw', 'lwwwlswwslwwwwlw', 'lwwwsssssswwwww.', '.wwwsssssswww...',
    '.lwwwsssswwwl...', '..lwwwsswwwl....', '....wwwwww......', '................'] },
  honeyjar: { label: 'Honey jar', group: 'cute dessert', art: [
    '....YycccyY.....', '..ccyYYcYYycc...', '..cccyyyyyccc...', '.YYYyccyccyYYY..', '.ccyYYYYYYYycc..', '...ccocccocc....',
    '..YooYoooYooY...', '.yYYYYyywwwwwY..', '.yyYYwwwwYYwww..', '.YYYwwwwycYwww..', '.YyywwwwyyYYww..', '.YyywwwycYcYww..',
    '.YYYwwwyyYYwww..', '...Ywwwwwwwwwy..', '...YYwwwwwwYy...', '.....YYyyYY.....'] },
  rabbittanghulu: { label: 'Rabbit Tanghulu', group: 'cute dessert', art: [
    '...........rrw..', '..........rrww..', '........wwwwwsww', '........lwowwwwr', '.......wwowwwwrr', '.......swwwwowr.',
    '.....wwwswwoww..', '....wwwwwswwlw..', '....wwwwwwsww...', '..sdwwlllw......', '.sssdwlllw......', '.ssssdwww.......',
    '.sssssd.........', '..sssss.........', '.n.sss..........', 'n...............'] },
  drink: { label: 'Drink 2', group: 'cute dessert', art: [
    '......wwwwwww...', '....wwssllwllww.', '...wwsllwlwwllww', '...ksswlwwllllsw', '..Kkdswllwwwlsdw', 'wwwwkdwwwssssdww',
    'w.KKwwdddddddwwK', 'k.KKkwwwwwwwwwkK', 'k.KKkkkkkkkkkkkK', 'k.KKkkwwwwwwwwkK', 'k.KKkkwwwwwwwwkK', 'kkKKkkwwwwwwwwkK',
    '.kKKkkwwwwwwwwkd', '...dkkwwwwwwwwd.', '....dkwwwwwwwd..', '.....ddsssssd...'] },
  rabbit: { label: 'Rabbit', group: 'pet', art: [
    '................', '....wwwwwww..w..', '..wwwwooowww.ww.', '.wwwwwowwowwwow.', '.wwwwwocwwowwow.', 'wwwwwwoccwowwwww',
    'wwwwwwwocwwwwwww', 'wwwwwwwwwwwwwwww', 'wcwwwwwwwwwwwwww', '.wcwwwwwwwldwwww', '.wccwwwwwwddwwow', 'ldwwwwwwccwwwwwd',
    'lsdddwwwwwwwwddl', 'llsssddddddddssl', '.slllssssssssll.', '...lslllllsll...'] },
  chicken2: { label: 'Chicken', group: 'pet', art: [
    '....sss.........', '...sssss........', '..ssswwww.......', '..swwwwwww......', '.swwwwwwww....wc', '.wwwowwwwww..wwc',
    'yyyworrwwwwccwwc', 'YYYwwrrwwwwwwwwn', 'cwwwwwwwwwwwwwnc', 'cwwwwwwwwcwwcnwc', 'cwwwwwwwwwcwwwnc', 'cwwwwwwwwwwccnwn',
    '.cwwwwwwwwwwwwc.', '.cwwwwwwwwwwwwn.', '..ccwwwwwwwccn..', '....ccccccc.....'] },
  chicken: { label: 'Chicken (Cream)', group: 'pet', art: [
    '....sss.........', '...sdddd........', '..sddcccc.......', '..dccccccc......', '.dcccccccc....cy', '.cccocccccc..ccy',
    'yyycorrccccyyccy', 'YYYccrrccccccccn', 'ycccccccccccccny', 'yccccccccyccynwy', 'ycccccccccycccny', 'yccccccccccyynwn',
    '.yccccccccccccy.', '.yccccccccccccn.', '..yycccccccyyn..', '....yyyyyyy.....'] },
  bee: { label: 'Bee', group: 'pet', art: [
    '...www..........', '...wwwww........', '...lllwww.......', '...oolllwl...N..', 'wwwwloolllN.N...', 'llwwwllolN..N...',
    'llllwllnYNyyN...', '.lllllnYyNyyyy..', 'yYnYYnyyyyyyyoy.', 'ynyynnyyyyyyyoy.', 'Ynyynnyyyyoyyyr.', 'YnyynnYyyyoyyyy.',
    'YnYynnnyyrryyyy.', '..nYYnnYYyyyyy..', '..nnYYnnnYYYY...', '....YYYnnnn.....'] },
};
// The order the pickers show them in: the icons without a group first, then each group A to Z, and A to Z by name in each.
const az = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
export const PICKER_ICON_NAMES = Object.keys(PICKER_ICONS).sort((a, b) => {
  const ga = PICKER_ICONS[a].group ?? '', gb = PICKER_ICONS[b].group ?? '';
  return az(ga, gb) || az(PICKER_ICONS[a].label, PICKER_ICONS[b].label);
});
// The same, cut into groups for the pickers' headings: [group, names] with the icons without a group under "default", first.
export const PICKER_ICON_GROUPS: [string, string[]][] = (() => {
  const out: [string, string[]][] = [];
  for (const n of PICKER_ICON_NAMES) {
    const g = PICKER_ICONS[n].group ?? 'default';
    if (out[out.length - 1]?.[0] !== g) out.push([g, []]);
    out[out.length - 1][1].push(n);
  }
  return out;
})();
