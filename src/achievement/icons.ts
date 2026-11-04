// The icons people can put on an achievement or a side quest, drawn at 16×16 on the fine grid (see pixelart.ts).
// Letters: s the side-quest colour (lit and shaded at the edges for you), o a dark line, w white, y/Y yellow/gold,
// r pink, R red, g/G green, b/B blue, n/N brown, k/K grey, c cream; '.' is empty. The outline is added for you,
// so draw only the inside. Icon names are stored with the data: rename none, only add.

export const PICKER_ICONS: Record<string, { label: string; art: string[] }> = {
  star: { label: 'Star', art: [
    '.......ss.......', '......swss......', '......ssss......', '.....swssss.....', 'ssssssssssssssss', '.ssssssssssssss.',
    '..ssssossossss..', '...srssssssrs...', '....ssssssss....', '....ssssssss....', '...ssssssssss...', '...ssss..ssss...',
    '..ssss....ssss..', '..sss......sss..', '.ss..........ss.', '................'] },
  heart: { label: 'Heart', art: [
    '................', '..ssss....ssss..', '.ssssss..ssssss.', 'sswwssssssssssss', 'swwsssssssssssss', 'swssssssssssssss',
    'ssssssssssssssss', 'ssssssssssssssss', '.ssssssssssssss.', '..ssssssssssss..', '...ssssssssss...', '....ssssssss....',
    '.....ssssss.....', '......ssss......', '.......ss.......', '................'] },
  food: { label: 'Food', art: [
    '............N.N.', '...........N.N..', '..........N.N...', '....w.w..N.N....', '.....w..N.N.....', '..cccccNcNcccc..',
    '.cyycccgccRccgc.', 'oooooooooooooooo', 'ssssssssssssssss', 'swssssssssssssss', '.ssssssssssssss.', '.ssssssssssssss.',
    '..ssssssssssss..', '...ssssssssss...', '.....ssssss.....', '....ssssssss....'] },
  coffee: { label: 'Drink', art: [
    '................', '....w...w.......', '.....w...w......', '....w...w.......', '................', '.sssssssssss....',
    '.sNNNNNNNNNs....', '.ssssssssssssss.', '.swsssssssss..s.', '.swsssssssss..s.', '.ssssssssssssss.', '.sssssssssss....',
    '..sssssssss.....', 'kkkkkkkkkkkkkk..', '.kkkkkkkkkkkk...', '................'] },
  cake: { label: 'Sweets', art: [
    '.......Y........', '......yYy.......', '.......y........', '.......r........', '.......r........', '..wwwwwwwwwwww..',
    '.wwwwwwwwwwwwww.', '.wswwwswwwwswww.', '.ssrsssssrsssss.', '.ssssssssssssss.', '.cccccccccccccc.', '.ssssssssssssss.',
    '.ssssssssssssss.', '.ssssssssssssss.', 'kkkkkkkkkkkkkkkk', '................'] },
  fish: { label: 'Fish', art: [
    '................', '................', '....sssss.....ss', '..sssssssss..sss', '.sssssssssss.sss', 'ssowssssssssssss',
    'ssoosssssssss...', 'sssssssssssss...', 'sssssssssssss...', 'ssssssssssssssss', '.sssssssssss.sss', '..sssssssss..sss',
    '....sssss.....ss', '................', '................', '................'] },
  camera: { label: 'Photo', art: [
    '................', '................', '..kk..ssss......', '.ssssssssssssss.', '.swsssssssssRRs.', '.sssssoooosssss.',
    '.ssssoBBBBossss.', '.sssoBbwBBBosss.', '.sssoBwBBBBosss.', '.sssoBBBBBBosss.', '.ssssoBBBBossss.', '.sssssoooosssss.',
    '.ssssssssssssss.', '................', '................', '................'] },
  mountain: { label: 'Nature', art: [
    '................', '................', '......w.........', '.....www........', '....wswsw...w...', '....sssss..www..',
    '...sssssss.wsww.', '...ssssssssssss.', '..ssssssssssssss', '..ssssssssssssss', '.sssssssssssssss', '.sssssssssssssss',
    'ssssssssssssssss', 'gggggggggggggggg', 'GgGgGgGgGgGgGgGg', '................'] },
  tree: { label: 'Tree', art: [
    '......ssss......', '....ssssssss....', '...swwsssssss...', '..swssssssssss..', '.ssssssrsssssss.', '.ssssssssssssss.',
    '.ssrssssssssrss.', '..ssssssssssss..', '...ssssssssss...', '.....ssnnss.....', '......nnnn......', '......nnnn......',
    '......nnnn......', '.....nnnnnn.....', '...gggggggggg...', '................'] },
  wave: { label: 'Beach', art: [
    '................', '......ssss......', '....swssssss....', '..sswssswsssss..', '.swsssswsssswss.', 'swssssswssssswss',
    'ss..ss.nn.ss..ss', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......',
    '.......nn.......', 'cccccccnnccccccc', 'cccccccccccccccc', '................'] },
  sun: { label: 'Sun', art: [
    '.......y........', '..y....y....y...', '...y........y...', '.....ssssss.....', '....ssssssss....', '...sswsssssss...',
    '...ssssssssss...', 'yy.ssosssosss.yy', '...srssssssrs...', '...ssssoossss...', '....ssssssss....', '.....ssssss.....',
    '...y........y...', '..y....y....y...', '.......y........', '................'] },
  temple: { label: 'Temple', art: [
    '.......yy.......', '.......ss.......', '......ssss......', '.....ssssss.....', '..yyyyyyyyyyyy..', 'y..ssssssssss..y',
    '...ssossssoss...', '.yyyyyyyyyyyyyy.', 'y.ssssssssssss.y', '..ssoossssooss..', '..ssoossssooss..', '..sssssoosssss..',
    '..sssssoosssss..', '.kkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkk', '................'] },
  plane: { label: 'Travel', art: [
    '.......ss.......', '......ssss......', '......sBBs......', '......ssss......', '......ssss......', '.....ssssss.....',
    '...ssssssssss...', '.ssssssssssssss.', 'RssssssssssssssR', 'sss...ssss...sss', '......ssss......', '......ssss......',
    '.....ssssss.....', '....ssssssss....', '....sss..sss....', '................'] },
  boot: { label: 'Hike', art: [
    '................', '..ssssss........', '..ssswws........', '..ssssss........', '..ssswws........', '..ssssss........',
    '..ssswwss.......', '..ssssssssss....', '..sssssssssss...', '.ssssssssssssss.', '.ssssssssssssss.', 'NNNNNNNNNNNNNNNN',
    'N.N.N.N.N.N.N.N.', '................', '................', '................'] },
  pin: { label: 'Place', art: [
    '....ssssssss....', '...ssssssssss...', '..sswsssssssss..', '..swssoooossss..', '..sssowwwwosss..', '..sssowwwwosss..',
    '..ssssoooossss..', '..ssssssssssss..', '...ssssssssss...', '....ssssssss....', '.....ssssss.....', '......ssss......',
    '.......ss.......', '....kkkkkkkk....', '................', '................'] },
  home: { label: 'Home', art: [
    '...........nn...', '.......RR..nn...', '......RRRR.nn...', '.....RRRRRRnn...', '....RRRRRRRR....', '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..', '.RRRRRRRRRRRRRR.', '..ssssssssssss..', '..sBBssssssBBs..', '..sBBsnnnnsBBs..', '..ssssnnnnssss..',
    '..ssssnnynssss..', '..ssssnnnnssss..', 'gggggggggggggggg', '................'] },
  book: { label: 'Book', art: [
    '................', '................', '.wwwwww..wwwwww.', 'swkkkkwwwwkkkkws', 'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws',
    'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws', 'swwwwwwwwwwwwwws', 'swkkkkwwwwkkkkws', 'swwwwwwsswwwwwws', 'ssssssssssssssss',
    '.ssssss..ssssss.', '................', '................', '................'] },
  music: { label: 'Music', art: [
    '................', '.....sssssssssss', '.....sssssssssss', '.....ss.......ss', '.....ss.......ss', '.....ss.......ss',
    '.....ss.......ss', '.....ss.......ss', '.....ss.......ss', '..sssss....sssss', '.swssss...swssss', '.ssssss...ssssss',
    '..ssss.....ssss.', '................', '................', '................'] },
  flag: { label: 'Goal', art: [
    '................', '.nssssssssss....', '.nsssssssssss...', '.nsssswsssssss..', '.nssswwwssssss..', '.nsssswssssss...',
    '.nssssssssssss..', '.nsssssssss.....', '.n..............', '.n..............', '.n..............', '.n..............',
    '.n..............', '.n..............', 'kkk.............', '................'] },
  trophy: { label: 'Trophy', art: [
    '....wwwwwwww....', '..yyyyyyyyyyyy..', '..y.yyyyyyyy.y..', '..y.yyyYYyyy.y..', '..y.yyYYYYyy.y..', '..yyyyyYYyyyyy..',
    '...yyyyyyyyyy...', '....yyyyyyyy....', '....yyyyyyyy....', '.....yyyyyy.....', '.....YYYYYY.....', '......yyyy......',
    '.......yy.......', '.......yy.......', '.....YYYYYY.....', '....YYYYYYYY....'] },
  gem: { label: 'Gem', art: [
    '................', '................', '...ssssssssss...', '..swwsssssssss..', '.swwsssssssssss.', 'dddddddddddddddd',
    '.ssssssssssssss.', '..sswsssssssss..', '...ssssssssss...', '....ssssssss....', '.....ssssss.....', '......ssss......',
    '.......ss.......', '................', '................', '................'] },
  fire: { label: 'Fire', art: [
    '.......R........', '......RR........', '......RRR....R..', '.....RRRR...RR..', '....RRRRRR..RRR.', '...RRRRYRRRRRRR.',
    '..RRRRYYRRRRRRR.', '..RRRYYYYRRRRRR.', '.RRRYYyyYYRRRRR.', '.RRYYyyyyYYRRRR.', '.RRYyyyyyyYRRRR.', '.RRYyyywyyYRRR..',
    '..RRYyyyyyYRR...', '...RRYYYYYRR....', '.....RRRRRR.....', '................'] },
  paw: { label: 'Paw', art: [
    '................', '....ss....ss....', '...ssss..ssss...', '...ssss..ssss...', '....ss....ss....', '.ss..........ss.',
    'ssss........ssss', 'ssss..ssss..ssss', '.ss..ssssss..ss.', '....ssssssss....', '...ssssssssss...', '...ssssssssss...',
    '...ssssssssss...', '....sss..sss....', '................', '................'] },
  bag: { label: 'Shopping', art: [
    '................', '......ssss......', '.....s....s.....', '.....s....s.....', '..ssssssssssss..', '..swwsssssssss..',
    '..swssssssssss..', '..ssssssssssss..', '.ssssswsswsssss.', '.sssswwwwwwssss.', '.ssssswwwwsssss.', '.sssssswwssssss.',
    '.ssssssssssssss.', '.ssssssssssssss.', '................', '................'] },
  cat: { label: 'Cat', art: [
    '................', '.s............s.', '.ss..........ss.', '.srs........srs.', '.ssssssssssssss.', 'ssssssssssssssss',
    'sssowssssssowsss', 'sssoossssssoosss', 'srrssssRRssssrrs', 'ssssssossossssss', '.ssssssoossssss.', '..ssssssssssss..',
    '....ssssssss....', '................', '................', '................'] },
  dog: { label: 'Dog', art: [
    '................', '..nn........nn..', '.nnnssssssssnnn.', '.nnssssssssssnn.', '.nnssssssssssnn.', '.nnsowssssowsnn.',
    '.nnsoossssoosnn.', '..nssssssssssn..', '...swwwNNwwws...', '....swwwwwws....', '.....sswwss.....', '......ssss......',
    '................', '................', '................', '................'] },
  flower: { label: 'Flower', art: [
    '................', '......ssss......', '.....ssssss.....', '..ss.ssssss.ss..', '.ssss.ssss.ssss.', '.sssssyyyysssss.',
    '..sssyywyyysss..', '...ssyyyyyyss...', '..sssyyyyyysss..', '.sssssyyyysssss.', '.ssss.ssss.ssss.', '..ss.ssssss.ss..',
    '.....ssssss.....', '.......GG.......', '....gggGGggg....', '................'] },
  icecream: { label: 'Ice cream', art: [
    '.....ssssss.....', '....swwsssss....', '...swssssssss...', '...ssRsssbsss...', '..ssssssssssss..', '..sssysssssRss..',
    '..ssssssssssss..', '...nnnnnnnnnn...', '...nNnnnNnnnN...', '....nnnnnnnn....', '....nnNnnnNn....', '.....nnnnnn.....',
    '.....nNnnNn.....', '......nnnn......', '.......nn.......', '................'] },
  gift: { label: 'Gift', art: [
    '................', '...yy......yy...', '..y..y....y..y..', '..y...y..y...y..', '...yyyyyyyyyy...', '.ssssssyyssssss.',
    '.swssssyyssssss.', '.ddddddyydddddd.', '..sssssyysssss..', '..swsssyysssss..', '..sssssyysssss..', '..sssssyysssss..',
    '..sssssyysssss..', '..sssssyysssss..', '................', '................'] },
  tent: { label: 'Camping', art: [
    '................', '.......nn.......', '.......ss.......', '......ssss......', '.....ssssss.....', '....ssssssss....',
    '...ssssoossss...', '..sssssoosssss..', '..ssssoKKossss..', '.sssssoKKosssss.', '.ssssoKKKKossss.', 'sssssoKKKKosssss',
    'ssssoKKKKKKossss', 'gggggggggggggggg', 'GgGgGgGgGgGgGgGg', '................'] },
  ticket: { label: 'Event', art: [
    '................', '................', '................', 'ssssssssssssssss', 'ssssssssssysssss', 'ssssswsssyyyssss',
    '.sssssssyyyyyss.', '.sssswsssyyysss.', '.ssssssssysysss.', 'ssssswssssssssss', 'ssssssssssssssss', '................',
    '................', '................', '................', '................'] },
  game: { label: 'Games', art: [
    '................', '................', '................', '...ssssssssss...', '.sswsssssssssss.', 'sssKssssssssysss',
    'ssKKKssssssBsBss', 'sssKssssssssgsss', 'ssssssssssssssss', 'ssssss....ssssss', '.ssss......ssss.', '..ss........ss..',
    '................', '................', '................', '................'] },
  dumbbell: { label: 'Fitness', art: [
    '................', '................', '................', '.ss..........ss.', 'swss........swss', 'swss........swss',
    'ssss........ssss', 'sssskkkkkkkkssss', 'sssskkkkkkkkssss', 'ssss........ssss', 'ssss........ssss', 'ssss........ssss',
    '.ss..........ss.', '................', '................', '................'] },
  night: { label: 'Night', art: [
    '................', '....ssss........', '...sssss.....y..', '..sssss.....yyy.', '.sssss.......y..', '.sssss..........',
    'sssss...........', 'sssss...........', 'ssoss.......y...', 'ssssrs..........', '.ssssss.........', '.ssssssss.......',
    '..ssssssssss....', '...ssssssss.....', '.....ssss.......', '................'] },
  rainbow: { label: 'Rainbow', art: [
    '................', '................', '................', '................', '....RRRRRRRR....', '..RRYYYYYYYYRR..',
    '.RYYyyyyyyyyYYR.', '.RYyggggggggyYR.', 'RYygBBBBBBBBgyYR', 'RYygB......BgyYR', 'RYygB......BgyYR', 'wwww........wwww',
    'wwwww......wwwww', '.www........www.', '................', '................'] },
  cheers: { label: 'Party', art: [
    '............y...', '...........yyy..', '.wwwwwwwwwwwwww.', '.ssssssssssssss.', '..sssssssssRss..', '...ssssssssss...',
    '....ssssssss....', '.....ssssss.....', '......ssss......', '.......kk.......', '.......kk.......', '.......kk.......',
    '.....kkkkkk.....', '................', '................', '................'] },
  rocket: { label: 'Rocket', art: [
    '.......ss.......', '......ssss......', '.....ssssss.....', '.....ssssss.....', '.....ssBBss.....', '.....ssBBss.....',
    '.....ssssss.....', '.....ssssss.....', '....ssssssss....', '...RssssssssR...', '..RRssssssssRR..', '..RR.ssssss.RR..',
    '.....yyyyyy.....', '......yyyy......', '......rYYr......', '.......yy.......'] },
  balloon: { label: 'Balloon', art: [
    '...ssssssssss...', '..ssssssssssss..', '.sssssYYYYsssss.', '.sssssYYYYsssss.', 'ssssssYYYYssssss', 'ssssssYYYYssssss',
    'ssssssYYYYssssss', '.sssssYYYYsssss.', '.sssssYYYYsssss.', '..ssssYYYYssss..', '...sssYYYYsss...', '.....o....o.....',
    '.....o....o.....', '....nnnnnnnn....', '....nNNNNNNn....', '....nnnnnnnn....'] },
  umbrella: { label: 'Rain', art: [
    '.......ss.......', '....ssssssss....', '..ssssssssssss..', '.ssssssssssssss.', 'ssssssssssssssss', 'ssssssssssssssss',
    'ss.ss.ssss.ss.ss', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......', '.......nn.......',
    '.......nn.......', '......nnnn......', '....nnnnnnnn....', '................'] },
  snow: { label: 'Snow', art: [
    '................', '.......ss.......', '..s...ssss...s..', '...s...ss...s...', '....s..ss..s....', '.....s.ss.s.....',
    '..s...ssss...s..', '.sssssswwssssss.', '.sssssswwssssss.', '..s...ssss...s..', '.....s.ss.s.....', '....s..ss..s....',
    '...s...ss...s...', '..s...ssss...s..', '.......ss.......', '................'] },
  cloud: { label: 'Cloud', art: [
    '................', '................', '.....ssssss.....', '....ssssssss....', '..ssssssssssss..', '..ssssssssssss..',
    '.ssssssssssssss.', 'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss', '.ssssssssssssss.', '................',
    '..B..B....B..B..', '.B..B......B..B.', '..B..B....B..B..', '................'] },
  sparkle: { label: 'Sparkle', art: [
    '.......ss.......', '.......ss.......', '.......ss.......', '......ssss......', '......ssss......', '.....ssssss.....',
    '....ssssssss....', 'ssssssswwsssssss', 'ssssssswwsssssss', '....ssssssss....', '.....ssssss.....', '......ssss......',
    '......ssss......', '.......ss.......', '.......ss.......', '................'] },
  leaf: { label: 'Leaf', art: [
    '................', '................', '.........ssss...', '........ssssGs..', '......sssssGss..', '.....sssssGsss..',
    '.....ssssGssss..', '....ssssGssss...', '...ssssGssss....', '...sssGsssss....', '...ssGsssss.....', '...sGssss.......',
    '...Nssss........', '..N.............', '.N..............', '................'] },
  cactus: { label: 'Desert', art: [
    '.......rr.......', '......ssss......', '......ssss......', '..ss..ssss..ss..', '..ss..ssss..ss..', '..ss..ssss..ss..',
    '..ssssssssssss..', '..ssssssssssss..', '......ssss......', '......ssss......', '......ssss......', '......ssss......',
    '...nnnnnnnnnn...', '....nnnnnnnn....', '....nNNNNNNn....', '................'] },
  mushroom: { label: 'Forest', art: [
    '................', '....ssssssss....', '..ssssssssssss..', '.sswwsssssswwss.', 'ssswwsssssswwsss', 'sssssswwwwssssss',
    'ssssssssssssssss', '.ssssssssssssss.', '...cccccccccc...', '....cccccccc....', '....cccccccc....', '....cccccccc....',
    '...gggggggggg...', '..gggggggggggg..', '................', '................'] },
  butterfly: { label: 'Butterfly', art: [
    '......o..o......', '.....o.NN.o.....', '.ss..ssNNss..ss.', 'sssssssNNsssssss', 'ssswwssNNsswwsss', 'ssswwssNNsswwsss',
    'sssssssNNsssssss', '.ssssssNNssssss.', '..sssssNNsssss..', '.ssssNNNNNNssss.', '.ssswssNNsswsss.', '..ss.ssNNss.ss..',
    '...s..sNNs..s...', '......sNNs......', '.......NN.......', '................'] },
  chick: { label: 'Chick', art: [
    '................', '....yyyyyyyy....', '..yyyyyyyyyyyy..', '.yyyyyyyyyyyyyy.', '.yyyyyyyyyyyyyy.', 'yyyoyyyyyyyyoyyy',
    'yyyyyyyRRyyyyyyy', 'yyyyyyyRRyyyyyyy', 'yyyyyyyyyyyyyyyy', '.yyyyyyyyyyyyyy.', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..',
    '...yyyyyyyyyy...', '...R..R..R..R...', '..RR.RR..RR.RR..', '................'] },
  pizza: { label: 'Pizza', art: [
    'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'yyyyyyyyyyyyyyyy', 'yysyyyyyyyyyysyy', 'yysyyyyyyyyyysyy', '.yyyyyyyyyyyyyy.',
    '.yyyyssyyssyyyy.', '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..', '...yyyyyyyyyy...', '...yysyyyysyy...', '....yyyyyyyy....',
    '.....yyyyyy.....', '......yyyy......', '.......yy.......', '................'] },
  burger: { label: 'Burger', art: [
    '................', '....nnnnnnnn....', '..nnnnnnnnnnnn..', '.nnnwnnnnnnwnnn.', 'nnnnnnnnnnnnnnnn', 'gggggggggggggggg',
    'ssssssssssssssss', 'yyyyyyyyyyyyyyyy', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNNNNNN', 'gggggggggggggggg', 'nnnnnnnnnnnnnnnn',
    '.nnnnnnnnnnnnnn.', '..nnnnnnnnnnnn..', '................', '................'] },
  apple: { label: 'Fruit', art: [
    '.......NN.gg....', '.......NNggg....', '..sssss..sssss..', '.ssssssssssssss.', 'sswsssssssssssss', 'sswsssssssssssss',
    'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssss', '.ssssssssssssss.', '.ssssssssssssss.',
    '..sssss..sssss..', '...sss....sss...', '................', '................'] },
  headphones: { label: 'Listen', art: [
    '....ssssssss....', '..sss......sss..', '.ss..........ss.', '.s............s.', 'ss............ss', 'ss............ss',
    'ssss........ssss', 'sssk........ksss', 'sssk........ksss', 'sssk........ksss', 'sssk........ksss', 'ssss........ssss',
    '.ss..........ss.', '................', '................', '................'] },
  cap: { label: 'Study', art: [
    '................', '.......ss.......', '....ssssssss....', '..ssssssssssss..', 'ssssssssssssssss', '..ssssssssssss.y',
    '....ssssssss...y', '.......ss......y', '...KKKKKKKKKK..y', '...KKKKKKKKKK..Y', '...KKKKKKKKKK...', '....KKKKKKKK....',
    '................', '................', '................', '................'] },
  laptop: { label: 'Work', art: [
    '................', '..ssssssssssss..', '..ssssssssssss..', '..sBwBBBBBBBBs..', '..sBwBBBBBBBBs..', '..sBBBBBBBBBBs..',
    '..sBBBBBBBBBBs..', '..sBBBBBBBBBBs..', '..ssssssssssss..', '................', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
    '.kkkkkkkkkkkkkk.', '................', '................', '................'] },
  bulb: { label: 'Idea', art: [
    '................', '....yyyyyyyy....', '..yyyyyyyyyyyy..', '.yywyyyyyyyyyyy.', '.yywyyyyyyyyyyy.', 'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy', 'yyyyyyyyyyyyyyyy', '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..', '...yyyyyyyyyy...', '....kkkkkkkk....',
    '....KKKKKKKK....', '....kkkkkkkk....', '.....kkkkkk.....', '......kkkk......'] },
  medal: { label: 'Medal', art: [
    '..RR........RR..', '..RRR......RRR..', '...RRR....RRR...', '....RRRRRRRR....', '.....RRRRRR.....', '......RRRR......',
    '....yyyyyyyy....', '..yyyyyyyyyyyy..', '.yyyyyyyyyyyyyy.', '.yyyyyYYYYyyyyy.', 'yyyyyYYYYYYyyyyy', '.yyyyyYYYYyyyyy.',
    '.yyyyyyyyyyyyyy.', '..yyyyyyyyyyyy..', '....yyyyyyyy....', '................'] },
  crown: { label: 'Crown', art: [
    '................', '..y....yy....y..', '..yy..yyyy..yy..', '..yy..yyyy..yy..', '..yyy.yyyy.yyy..', '..yyyyyyyyyyyy..',
    '..yyyyyyyyyyyy..', '..yyyyyyyyyyyy..', '..yyRyyRRyyRyy..', '..yyyyyyyyyyyy..', '..YYYYYYYYYYYY..', '..YYYYYYYYYYYY..',
    '................', '................', '................', '................'] },
  clock: { label: 'Time', art: [
    '....ssssssss....', '..ssssssssssss..', '.sswwwwwwwwwwss.', '.sswwwwwwwwwwss.', 'ssswwwwowwwwwsss', 'ssswwwwowwwwwsss',
    'ssswwwwowwwwwsss', 'ssswwwwowwwwwsss', 'ssswwwwooooowsss', 'ssswwwwwwwwwwsss', 'ssswwwwwwwwwwsss', '.sswwwwwwwwwwss.',
    '.sswwwwwwwwwwss.', '..ssssssssssss..', '....ssssssss....', '................'] },
  bell: { label: 'Bell', art: [
    '.......yy.......', '......ssss......', '.....ssssss.....', '....ssssssss....', '....ssssssss....', '...ssssssssss...',
    '...ssssssssss...', '..ssssssssssss..', '..ssssssssssss..', '.ssssssssssssss.', 'ssssssssssssssss', 'ssssssssssssssss',
    '................', '.....yyyyyy.....', '......yyyy......', '................'] },
  ball: { label: 'Sport', art: [
    '....sssoosss....', '..sssssoosssss..', '.ssssssoossssss.', '.sossssoossssos.', 'ssossssoossssoss', 'ssossssoossssoss',
    'ssossssoossssoss', 'oooooooooooooooo', 'oooooooooooooooo', 'ssossssoossssoss', 'ssossssoossssoss', 'ssossssoossssoss',
    '.sossssoossssos.', '.ssssssoossssss.', '..sssssoosssss..', '....sssoosss....'] },
  train: { label: 'Train', art: [
    '................', '..ssssssssssss..', '.ssssssssssssss.', '.ssBBBBBBBBBBss.', '.ssBBBBBBBBBBss.', '.ssBBBBBBBBBBss.',
    '.ssssssssssssss.', '.ssssssssssssss.', '.ssyssssssssyss.', '.ssssssssssssss.', '.ssssssssssssss.', '..KK..KKKK..KK..',
    '................', 'KKKKKKKKKKKKKKKK', '................', '................'] },
  backpack: { label: 'Backpack', art: [
    '......KKKK......', '....ssssssss....', '..ssssssssssss..', '.ssssssssssssss.', '.ssssssssssssss.', '.ssssssssssssss.',
    '.sssddddddddsss.', '.sssdKdKKdKdsss.', '.sssddddddddsss.', '.sssddddddddsss.', '.sssddddddddsss.', '.sssddddddddsss.',
    '.ssssssssssssss.', '..ssssssssssss..', '................', '................'] },
  compass: { label: 'Compass', art: [
    '....ssssssss....', '..ssssssssssss..', '.sswwwwRRwwwwss.', '.sswwwRRRRwwwss.', 'ssswwwRRRRwwwsss', 'ssswwRRRRRRwwsss',
    'ssswwRRRRRRwwsss', 'ssswwwwoowwwwsss', 'ssswwwwoowwwwsss', 'ssswwkkkkkkwwsss', 'ssswwkkkkkkwwsss', 'ssswwwkkkkwwwsss',
    '.sswwwwkkwwwwss.', '.sswwwwwwwwwwss.', '..ssssssssssss..', '....ssssssss....'] },
  key: { label: 'Key', art: [
    '................', '................', '................', '................', '................', '..ssss..........',
    '.ssssss.........', 'sss..sssssssssss', 'sss..sssssssssss', '.ssssss...ss.ss.', '..ssss....ss.ss.', '................',
    '................', '................', '................', '................'] },
  car: { label: 'Car', art: [
    '................', '................', '................', '................', '.....ssssss.....', '....ssBBssBBs...',
    '...sssBBssBBss..', 'ssssssssssssssss', 'ssssssssssssssss', 'ssssssssssssssyy', 'ssssssssssssssss', '.KKKK....KKKK...',
    '.KkkK....KkkK...', '.KkkK....KkkK...', '.KKKK....KKKK...', '................'] },
  boat: { label: 'Boat', art: [
    '.......N........', '.......Nw.......', '.......Nww......', '.......Nwww.....', '.......Nwwww....', '.......Nwwwww...',
    '.......Nwwwwww..', '.......Nwwwwwww.', '.......N........', 'ssssssssssssssss', '.ssssssssssssss.', '..ssssssssssss..',
    '...ssssssssss...', 'bbbbbbbbbbbbbbbb', '.bb..bb..bb..bb.', '................'] },
};
export const PICKER_ICON_NAMES = Object.keys(PICKER_ICONS);
