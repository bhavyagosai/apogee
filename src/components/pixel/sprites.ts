/**
 * Pixel art as text. Each string is a row; each character indexes the sprite's
 * palette; "." is transparent. Sprites render through <Sprite />.
 */
export interface SpriteDef {
  rows: string[];
  palette: Record<string, string>;
}

const W = "#f4f6fb";
const G = "#9aa3b8";

export const ROCKET: SpriteDef = {
  palette: { W, R: "#ff5d5d", B: "#8fd3ff", D: "#39415a", F: "#ff8a3d", Y: "#ffd166" },
  rows: [
    ".....W.....",
    "....WWW....",
    "....WRW....",
    "...WWRWW...",
    "...WWRWW...",
    "...WWBWW...",
    "...WWBWW...",
    "...WWWWW...",
    "..RWWWWWR..",
    "..RWWWWWR..",
    ".RRWWWWWRR.",
    ".RR.DDD.RR.",
    "....FFF....",
    "....FYF....",
    ".....F.....",
  ],
};

/** Just the flame, so it can flicker independently under the rocket. */
export const FLAME: SpriteDef = {
  palette: { F: "#ff8a3d", Y: "#ffd166", O: "#ff5d2e" },
  rows: ["..FFF..", ".FFYFF.", ".FYYYF.", "..FYF..", "..OFO..", "...O...", "...O..."],
};

export const PAPER_PLANE: SpriteDef = {
  palette: { W, G },
  rows: [
    "..........W.",
    "......WWWWW.",
    "..WWWWWWWWW.",
    "WWWWWWGWWWW.",
    "..WWWWGWW...",
    "....WWG.....",
    ".....W......",
  ],
};

export const BALLOON: SpriteDef = {
  palette: { P: "#f2c94c", H: "#fff3b0", S: "#9aa3b8", B: "#d9dde8" },
  rows: [
    "...PPP...",
    "..PHPPP..",
    ".PHPPPPP.",
    ".PPPPPPP.",
    ".PPPPPPP.",
    ".PPPPPPP.",
    "..PPPPP..",
    "...PPP...",
    "....S....",
    "....S....",
    "...BBB...",
    "...BBB...",
  ],
};

export const JETLINER: SpriteDef = {
  palette: { W, B: "#8fd3ff", G },
  rows: [
    "...........W....",
    "...........WW...",
    "...........WWW..",
    ".WWWWWWWWWWWWWW.",
    "WWBWBWBWBWWWWWWW",
    ".WWWWWWWWWWWWWG.",
    ".....WWW........",
    "......WW........",
  ],
};

export const SATELLITE: SpriteDef = {
  palette: { B: "#4f7fff", L: "#8fd3ff", W, G },
  rows: [
    "BB.........BB",
    "BLB..WWW..BLB",
    "BLBBBWGWBBBLB",
    "BLB..WWW..BLB",
    "BB....W....BB",
    "......W......",
    ".....WWW.....",
  ],
};

export const RINGED_PLANET: SpriteDef = {
  palette: { V: "#c39cff", D: "#8e63d6", R: "#e6d7ff" },
  rows: [
    ".....VVVVV.....",
    "....VVDVVVV....",
    "R..VVVVVDVVV..R",
    "RRRRVVVVVVVRRRR",
    "..RRRRRRRRRRR..",
    "R..VVDVVVVVV..R",
    "....VVVVDVV....",
    ".....VVVVV.....",
  ],
};

export const COMET: SpriteDef = {
  palette: { G: "#ffb347", Y: "#ffd166", W, T: "#ff8a3d" },
  rows: [
    "............GG..",
    "..........GGGGG.",
    ".......TGGGYYYG.",
    "...TTGGGGYYWWYG.",
    ".TTGGGGGGYYWWYG.",
    "...TTGGGGYYYYG..",
    "..........GGGG..",
    "............GG..",
  ],
};

export const SCRUBBED: SpriteDef = {
  palette: { S: "#5a6478", X: "#ff5d5d" },
  rows: [
    "..X.....X..",
    "...X...X...",
    "....X.X....",
    ".....X.....",
    "....X.X....",
    "...X...X...",
    "..X.....X..",
    "...........",
    ".SSSSSSSSS.",
    "SSSSSSSSSSS",
  ],
};

export const LAUNCH_PAD: SpriteDef = {
  palette: { D: "#39415a", L: "#56648a", R: "#ff5d5d", W },
  rows: [
    "..L.........L..",
    "..L.........L..",
    "..L..R...R..L..",
    "..L.........L..",
    "..LLLLLLLLLLL..",
    "..L.........L..",
    "..L.........L..",
    "DDDDDDDDDDDDDDD",
    "DDDDDDDDDDDDDDD",
  ],
};

export const STAR_4: SpriteDef = {
  palette: { W },
  rows: [".W.", "WWW", ".W."],
};

/** Tier → the sprite shown on its reveal card. */
export const TIER_SPRITES = {
  paper: PAPER_PLANE,
  balloon: BALLOON,
  jet: JETLINER,
  orbit: SATELLITE,
  deep: RINGED_PLANET,
  apogee: COMET,
} as const;

/** A filled pixel disc with optional darker crater pixels, for planets on the ruler. */
export function disc(radius: number, color: string, craters: [number, number][] = [], craterColor?: string): SpriteDef {
  const size = radius * 2 + 1;
  const rows: string[] = [];
  const craterSet = new Set(craters.map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const inside = dx * dx + dy * dy <= radius * radius + radius * 0.5;
      row += inside ? (craterSet.has(`${x},${y}`) ? "C" : "P") : ".";
    }
    rows.push(row);
  }
  return { rows, palette: { P: color, C: craterColor ?? color } };
}

export const MOON = disc(6, "#d9dde8", [[4, 4], [8, 7], [5, 9], [9, 3]], "#aab2c4");
export const MARS = disc(5, "#e2673d", [[3, 4], [7, 6]], "#b84f2c");
export const JUPITER: SpriteDef = {
  palette: { A: "#e8c39e", B: "#c98a5a", C: "#f3dcc2", R: "#d9583f" },
  rows: [
    ".....AAAAA.....",
    "...AAAAAAAAA...",
    "..BBBBBBBBBBB..",
    ".CCCCCCCCCCCCC.",
    ".AAAAAAAAAAAAA.",
    "BBBBBBBBRRBBBBB",
    "BBBBBBBRRRBBBBB",
    ".CCCCCCCCCCCCC.",
    ".AAAAAAAAAAAAA.",
    "..BBBBBBBBBBB..",
    "...AAAAAAAAA...",
    ".....AAAAA.....",
  ],
};
export const SATURN: SpriteDef = {
  palette: { P: "#f0d79b", D: "#d4b06a", R: "#e8e2cf" },
  rows: [
    "......PPPPP......",
    ".....PPDPPPP.....",
    "R...PPPPPPPPP...R",
    ".RRRRPPDPPPPRRRR.",
    "...RRRRRRRRRRR...",
    "R...PPPPPPDPP...R",
    ".....PPPPPPP.....",
    "......PPPPP......",
  ],
};
export const NEPTUNE = disc(5, "#4f7fff", [[4, 3], [6, 7]], "#3a62c9");
export const EARTH = disc(8, "#4f9bff", [[5, 5], [6, 5], [7, 6], [10, 9], [11, 10], [9, 12], [4, 11]], "#5ad17a");
