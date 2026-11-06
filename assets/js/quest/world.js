/* ==========================================================================
   quest/world.js — the map: terrain, buildings, trees, collision,
   path-finding, and all the pixel-art drawing for the world.

   Everything is drawn with code (no image files). The static part of the
   map is drawn ONCE into an off-screen canvas; only animated details
   (water, smoke, fountain, neon) are drawn every frame.
   ========================================================================== */

window.Quest = window.Quest || {};

(function (Q) {
  const T = 16; // tile size in pixels
  const W = 48; // map width in tiles
  const H = 32; // map height in tiles

  const GRASS = 0;
  const PATH = 1;
  const SAND = 2;
  const WATER = 3;
  const PIER = 4;
  const PLAZA = 5;

  /* Building layout (tile coordinates). The door is in the middle of the
     bottom wall; the player "enters" by standing on the tile below it. */
  const BUILDINGS = [
    { id: "home", x: 4, y: 5, w: 5, h: 4 },
    { id: "school", x: 12, y: 4, w: 7, h: 5 },
    { id: "ada", x: 24, y: 2, w: 8, h: 7 },
    { id: "tower", x: 37, y: 3, w: 6, h: 6 },
    { id: "guild", x: 5, y: 18, w: 6, h: 5 },
    { id: "gym", x: 14, y: 19, w: 5, h: 4 },
    { id: "workshop", x: 25, y: 18, w: 6, h: 5 },
    { id: "arcade", x: 35, y: 19, w: 6, h: 4 },
  ];

  BUILDINGS.forEach((b) => {
    b.doorX = b.x + Math.floor(b.w / 2);
    b.standX = b.doorX;
    b.standY = b.y + b.h;
  });

  const SIGN = { x: 8, y: 10 };
  const FOUNTAIN = { x: 20, y: 11 }; // 2x2 tiles
  const SPAWN = { x: 6, y: 10 };
  const PIER_X = 30;

  const SCROLL_SPOTS = {
    az: { x: 10, y: 12 },
    tr: { x: 34, y: 12 },
    en: { x: 12, y: 21 },
    ru: { x: 30, y: 30 }, // at the end of the pier
  };

  const terrain = new Uint8Array(W * H);
  const solid = new Uint8Array(W * H);
  const trees = [];
  const flowers = [];
  const shore = []; // first water row for each column

  const idx = (x, y) => y * W + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  /* Small seeded random generator so the map looks the same every visit */
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------------
     Map generation
     --------------------------------------------------------------------- */
  function setTile(x, y, type) {
    if (inBounds(x, y)) terrain[idx(x, y)] = type;
  }

  function hLine(y, x1, x2, type) {
    for (let x = x1; x <= x2; x++) setTile(x, y, type);
  }

  function vLine(x, y1, y2, type) {
    for (let y = y1; y <= y2; y++) setTile(x, y, type);
  }

  function generate() {
    terrain.fill(GRASS);
    solid.fill(0);

    // Coast (Caspian Sea at the bottom of the map)
    for (let x = 0; x < W; x++) {
      const wave = Math.sin(x * 0.45) + Math.sin(x * 0.17 + 1);
      shore[x] = 28 + (wave > 0.9 ? -1 : wave < -1.1 ? 1 : 0);
      for (let y = Math.max(26, shore[x] - 2); y < H; y++) {
        setTile(x, y, y >= shore[x] ? WATER : SAND);
      }
    }

    // Roads
    hLine(15, 2, 45, PATH);
    hLine(16, 2, 45, PATH);
    hLine(25, 2, 44, PATH);
    [2, 3, 21, 22, 43, 44].forEach((x) => vLine(x, 15, 25, PATH));

    BUILDINGS.forEach((b) => {
      const toY = b.y < 15 ? 14 : 24;
      if (b.y < 15) vLine(b.standX, b.standY, toY, PATH);
      else vLine(b.standX, b.standY, toY, PATH);
    });

    // Plaza with fountain
    for (let y = 10; y <= 13; y++) hLine(y, 19, 22, PLAZA);
    vLine(21, 14, 14, PATH);
    vLine(20, 14, 14, PATH);

    // Pier into the sea
    for (let y = 26; y < H; y++) {
      setTile(PIER_X, y, PIER);
      setTile(PIER_X + 1, y, PIER);
    }

    // Solid tiles: water, buildings, fountain, sign
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (terrain[idx(x, y)] === WATER) solid[idx(x, y)] = 1;
      }
    }
    BUILDINGS.forEach((b) => {
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) solid[idx(x, y)] = 1;
      }
    });
    for (let y = FOUNTAIN.y; y < FOUNTAIN.y + 2; y++) {
      for (let x = FOUNTAIN.x; x < FOUNTAIN.x + 2; x++) solid[idx(x, y)] = 1;
    }
    solid[idx(SIGN.x, SIGN.y)] = 1;

    // Keep-clear zones (no trees here)
    const reserved = new Set();
    const reserve = (x, y, r = 1) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) reserved.add(idx(x + dx, y + dy));
    };
    reserve(SPAWN.x, SPAWN.y, 2);
    reserve(SIGN.x, SIGN.y);
    Object.values(SCROLL_SPOTS).forEach((s) => reserve(s.x, s.y));

    const nearBlocked = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny)) continue;
          if (terrain[idx(nx, ny)] !== GRASS || solid[idx(nx, ny)]) return true;
        }
      }
      return false;
    };

    // Trees: a border of forest + some scattered trees
    const rand = rng(1101);
    trees.length = 0;
    flowers.length = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (terrain[i] !== GRASS || solid[i]) continue;
        const border = y <= 1 || x <= 1 || x >= W - 2;
        if (border && !reserved.has(i)) {
          trees.push({ x, y, v: rand() });
          solid[i] = 1;
        } else if (!reserved.has(i) && !nearBlocked(x, y) && rand() < 0.11) {
          trees.push({ x, y, v: rand() });
          solid[i] = 1;
        } else if (rand() < 0.08) {
          flowers.push({ x, y, v: rand() });
        }
      }
    }
    trees.sort((a, b) => a.y - b.y);
  }

  /* ---------------------------------------------------------------------
     Pixel drawing helpers
     --------------------------------------------------------------------- */
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function pixelCircle(ctx, cx, cy, r, color, topHalfOnly) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= (topHalfOnly ? 0 : r); dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
    }
  }

  function pick(list, v) {
    return list[Math.floor(v * list.length) % list.length];
  }

  /* ---------------------------------------------------------------------
     Terrain tiles
     --------------------------------------------------------------------- */
  function tileAt(x, y) {
    return inBounds(x, y) ? terrain[idx(x, y)] : GRASS;
  }

  function drawTile(ctx, x, y, rand) {
    const px = x * T;
    const py = y * T;
    const type = terrain[idx(x, y)];

    if (type === GRASS) {
      rect(ctx, px, py, T, T, pick(["#4f9a45", "#4b9542", "#53a049"], rand()));
      for (let i = 0; i < 4; i++) {
        const gx = px + Math.floor(rand() * 15);
        const gy = py + Math.floor(rand() * 14);
        rect(ctx, gx, gy, 1, 2, rand() < 0.5 ? "#3f8637" : "#67b457");
      }
    } else if (type === PATH) {
      rect(ctx, px, py, T, T, "#d4b27b");
      for (let i = 0; i < 5; i++) {
        rect(ctx, px + Math.floor(rand() * 15), py + Math.floor(rand() * 15), 2, 1, rand() < 0.5 ? "#bf9b63" : "#e2c590");
      }
      // soft edge where the path meets grass
      const edge = "#b9955f";
      const isRoad = (t) => t === PATH || t === PLAZA || t === PIER;
      if (!isRoad(tileAt(x, y - 1)) && tileAt(x, y - 1) !== SAND) rect(ctx, px, py, T, 1, edge);
      if (!isRoad(tileAt(x, y + 1)) && tileAt(x, y + 1) !== SAND) rect(ctx, px, py + T - 1, T, 1, edge);
      if (!isRoad(tileAt(x - 1, y))) rect(ctx, px, py, 1, T, edge);
      if (!isRoad(tileAt(x + 1, y))) rect(ctx, px + T - 1, py, 1, T, edge);
    } else if (type === PLAZA) {
      rect(ctx, px, py, T, T, "#a3acbf");
      rect(ctx, px, py, T, 1, "#8c95aa");
      rect(ctx, px, py, 1, T, "#8c95aa");
      rect(ctx, px + 8, py + 8, 1, 8, "#939cb1");
      rect(ctx, px + 1, py + 8, 7, 1, "#939cb1");
    } else if (type === SAND) {
      rect(ctx, px, py, T, T, "#e8d39b");
      for (let i = 0; i < 4; i++) {
        rect(ctx, px + Math.floor(rand() * 15), py + Math.floor(rand() * 15), 1, 1, "#d4bb7f");
      }
    } else if (type === WATER) {
      const depth = y - shore[x];
      const colors = ["#3ea0dc", "#3592d2", "#2b80c2", "#2470b0"];
      rect(ctx, px, py, T, T, colors[Math.min(depth, colors.length - 1)]);
    } else if (type === PIER) {
      const under = y >= shore[x] ? "#2b80c2" : "#e8d39b";
      rect(ctx, px, py, T, T, under);
      rect(ctx, px, py, T, T, "#a2703f");
      for (let i = 0; i < T; i += 4) rect(ctx, px, py + i, T, 1, "#7d532c");
      if (x === PIER_X) rect(ctx, px, py, 1, T, "#6a4524");
      else rect(ctx, px + T - 1, py, 1, T, "#6a4524");
    }
  }

  function drawFlower(ctx, f) {
    const px = f.x * T + 3 + Math.floor(f.v * 8);
    const py = f.y * T + 4 + Math.floor(((f.v * 7) % 1) * 8);
    const color = pick(["#ffe46b", "#ff8fb1", "#ffffff", "#b9a4ff"], f.v);
    rect(ctx, px, py + 1, 3, 1, color);
    rect(ctx, px + 1, py, 1, 3, color);
    rect(ctx, px + 1, py + 1, 1, 1, "#f5a623");
  }

  function drawTree(ctx, t) {
    const cx = t.x * T + 8;
    const base = t.y * T;
    // shadow
    rect(ctx, cx - 6, base + 13, 12, 3, "rgba(0,0,0,0.18)");
    // trunk
    rect(ctx, cx - 2, base + 9, 4, 6, "#6b4426");
    rect(ctx, cx - 2, base + 9, 1, 6, "#57361d");
    // canopy
    const dark = t.v < 0.5 ? "#2c7232" : "#2f6d3a";
    pixelCircle(ctx, cx, base + 4, 7, "#24602a");
    pixelCircle(ctx, cx, base + 3, 7, dark);
    pixelCircle(ctx, cx - 2, base + 1, 4, "#3d9142");
    rect(ctx, cx - 3, base - 1, 2, 1, "#5bb35a");
  }

  /* ---------------------------------------------------------------------
     Buildings
     --------------------------------------------------------------------- */
  const STYLES = {
    home: { wall: "#f1e3c8", wallShade: "#d9c7a6", roof: "#c8463d", roofShade: "#a5352e", roofType: "gable" },
    school: { wall: "#e7ddd0", wallShade: "#cdbfae", roof: "#3f6fb8", roofShade: "#2f5590", roofType: "gable" },
    ada: { wall: "#d8d0c4", wallShade: "#bdb3a4", roof: "#5c6273", roofShade: "#464b59", roofType: "flat" },
    tower: { wall: "#cfd6e6", wallShade: "#aab3c8", roof: "#7b6ad1", roofShade: "#5e4fb0", roofType: "dome" },
    guild: { wall: "#a8744a", wallShade: "#8a5c37", roof: "#7a3d8a", roofShade: "#5e2d6c", roofType: "gable" },
    gym: { wall: "#8c93a6", wallShade: "#747b8f", roof: "#4a5063", roofShade: "#3a3f50", roofType: "flat" },
    workshop: { wall: "#b5653f", wallShade: "#954f30", roof: "#5a5f6e", roofShade: "#474b58", roofType: "gable" },
    arcade: { wall: "#2a2346", wallShade: "#1e1934", roof: "#191530", roofShade: "#110e22", roofType: "flat" },
  };

  function drawWindow(ctx, x, y, w, h, glass) {
    rect(ctx, x - 1, y - 1, w + 2, h + 2, "#3b2a1e");
    rect(ctx, x, y, w, h, glass || "#ffe08a");
    rect(ctx, x, y, w, 1, "#fff3c4");
    rect(ctx, x + Math.floor(w / 2), y, 1, h, "#3b2a1e");
  }

  function drawDoor(ctx, b, py, ph) {
    const dx = b.doorX * T + 3;
    const dy = py + ph - 13;
    rect(ctx, dx - 1, dy - 1, 12, 14, "#3b2a1e");
    rect(ctx, dx, dy, 10, 13, "#6b4426");
    rect(ctx, dx + 1, dy + 1, 4, 11, "#7d5230");
    rect(ctx, dx + 5, dy + 1, 4, 11, "#7d5230");
    rect(ctx, dx + 7, dy + 7, 1, 1, "#f6c453");
    // doormat
    rect(ctx, dx, dy + 13, 10, 2, "#9a3b3b");
  }

  function drawGableRoof(ctx, px, py, pw, roofH, s) {
    for (let i = 0; i < roofH; i++) {
      const inset = Math.round(((roofH - i) / roofH) * (pw * 0.28)) - 2;
      const color = i % 3 === 2 ? s.roofShade : s.roof;
      rect(ctx, px + inset, py + i, pw - inset * 2, 1, color);
    }
    // ridge highlight
    const topInset = Math.round(pw * 0.28) - 2;
    rect(ctx, px + topInset, py, pw - topInset * 2, 1, "rgba(255,255,255,0.25)");
    // eave shadow
    rect(ctx, px - 2, py + roofH, pw + 4, 2, s.roofShade);
  }

  function drawFlatRoof(ctx, px, py, pw, roofH, s) {
    rect(ctx, px - 1, py, pw + 2, roofH, s.roof);
    rect(ctx, px - 1, py, pw + 2, 2, s.roofShade);
    rect(ctx, px - 1, py + roofH - 2, pw + 2, 2, s.roofShade);
  }

  function drawBuilding(ctx, b) {
    const s = STYLES[b.id];
    const px = b.x * T;
    const py = b.y * T;
    const pw = b.w * T;
    const ph = b.h * T;

    // ground shadow
    rect(ctx, px + 3, py + ph - 3, pw, 6, "rgba(0,0,0,0.2)");
    rect(ctx, px + pw, py + 10, 4, ph - 7, "rgba(0,0,0,0.15)");

    if (s.roofType === "dome") {
      drawObservatory(ctx, b, px, py, pw, ph, s);
      return;
    }

    const roofH = Math.round(ph * (b.id === "ada" ? 0.22 : 0.45));
    const wallY = py + roofH;
    const wallH = ph - roofH;

    // walls
    rect(ctx, px, wallY, pw, wallH, s.wall);
    rect(ctx, px + pw - 3, wallY, 3, wallH, s.wallShade);
    rect(ctx, px, py + ph - 3, pw, 3, s.wallShade);

    // wall texture per building
    if (b.id === "workshop") {
      for (let y = wallY + 2; y < py + ph - 3; y += 4) {
        const off = ((y - wallY) / 4) % 2 ? 0 : 4;
        for (let x = px + off; x < px + pw - 3; x += 8) rect(ctx, x, y, 1, 3, s.wallShade);
        rect(ctx, px, y + 3, pw - 3, 1, s.wallShade);
      }
    }
    if (b.id === "guild") {
      rect(ctx, px, wallY + 2, pw, 2, "#5d3b22");
      rect(ctx, px + 2, wallY, 2, wallH, "#5d3b22");
      rect(ctx, px + pw - 5, wallY, 2, wallH, "#5d3b22");
      rect(ctx, px + Math.floor(pw / 2) - 1, wallY, 2, wallH - 14, "#5d3b22");
    }
    if (b.id === "ada") {
      // columns
      for (let x = px + 6; x < px + pw - 6; x += 12) {
        rect(ctx, x, wallY + 4, 3, wallH - 8, "#efe9df");
        rect(ctx, x + 2, wallY + 4, 1, wallH - 8, s.wallShade);
      }
    }

    // roof
    if (s.roofType === "gable") drawGableRoof(ctx, px, py, pw, roofH, s);
    else drawFlatRoof(ctx, px, py, pw, roofH, s);

    // windows (skip the door column)
    const winY = wallY + Math.max(4, Math.floor((wallH - 16) / 2) - 2);
    const glass = b.id === "arcade" ? null : b.id === "workshop" ? "#9fdcff" : b.id === "gym" ? "#bfe6ff" : "#ffe08a";
    if (b.id !== "arcade") {
      for (let x = px + 5; x + 8 < px + pw - 3; x += 14) {
        const doorLeft = b.doorX * T - 2;
        const doorRight = b.doorX * T + 16;
        if (x + 8 > doorLeft && x < doorRight) continue;
        drawWindow(ctx, x, winY, 7, 7, glass);
        if (b.id === "ada" && wallH > 50) drawWindow(ctx, x, winY + 16, 7, 7, glass);
      }
    }

    drawDoor(ctx, b, py, ph);
    drawDecor(ctx, b, px, py, pw, ph, roofH, s);
  }

  function drawObservatory(ctx, b, px, py, pw, ph, s) {
    const wallTop = py + Math.round(ph * 0.48);
    // tower body
    rect(ctx, px + 4, wallTop, pw - 8, py + ph - wallTop, s.wall);
    rect(ctx, px + pw - 8, wallTop, 4, py + ph - wallTop, s.wallShade);
    rect(ctx, px + 4, py + ph - 3, pw - 8, 3, s.wallShade);
    // ring
    rect(ctx, px + 2, wallTop - 2, pw - 4, 4, "#8f98ad");
    // dome
    const cx = px + pw / 2;
    const r = Math.floor((pw - 10) / 2);
    pixelCircle(ctx, cx, wallTop - 1, r, s.roofShade, true);
    pixelCircle(ctx, cx - 1, wallTop - 2, r - 1, s.roof, true);
    pixelCircle(ctx, cx - 6, wallTop - 10, 4, "rgba(255,255,255,0.18)", true);
    // slit + telescope
    rect(ctx, cx - 2, wallTop - r, 5, r - 1, "#2a2346");
    rect(ctx, cx + 1, wallTop - r - 6, 3, 8, "#f6c453");
    rect(ctx, cx + 3, wallTop - r - 9, 4, 4, "#ffd98a");
    // little windows
    drawWindow(ctx, px + 9, wallTop + 8, 5, 6, "#c9b8ff");
    drawWindow(ctx, px + pw - 15, wallTop + 8, 5, 6, "#c9b8ff");
    drawDoor(ctx, b, py, ph);
    // stars painted on the wall
    rect(ctx, px + 10, py + ph - 20, 1, 1, "#f6c453");
    rect(ctx, px + pw - 12, py + ph - 24, 1, 1, "#f6c453");
  }

  function drawDecor(ctx, b, px, py, pw, ph, roofH, s) {
    const cx = px + pw / 2;
    if (b.id === "home") {
      // chimney
      rect(ctx, px + pw - 18, py + 2, 6, 10, "#8a4b3a");
      rect(ctx, px + pw - 19, py + 1, 8, 2, "#6e3a2d");
    }
    if (b.id === "school") {
      // bell tower
      rect(ctx, cx - 6, py - 10, 12, 12, "#e7ddd0");
      rect(ctx, cx - 8, py - 13, 16, 3, s.roofShade);
      rect(ctx, cx - 3, py - 7, 6, 6, "#3b2a1e");
      rect(ctx, cx - 2, py - 6, 4, 4, "#f6c453");
      // flag
      rect(ctx, px + 6, py - 14, 1, 16, "#ddd");
      rect(ctx, px + 7, py - 14, 8, 2, "#00b5e2");
      rect(ctx, px + 7, py - 12, 8, 2, "#ef3340");
      rect(ctx, px + 7, py - 10, 8, 2, "#509e2f");
    }
    if (b.id === "ada") {
      // central tower with a clock
      rect(ctx, cx - 10, py - 14, 20, 16, s.wall);
      rect(ctx, cx + 7, py - 14, 3, 16, s.wallShade);
      rect(ctx, cx - 12, py - 17, 24, 3, s.roof);
      pixelCircle(ctx, cx, py - 6, 5, "#3b2a1e");
      pixelCircle(ctx, cx, py - 6, 4, "#f7f3ea");
      rect(ctx, cx, py - 9, 1, 3, "#3b2a1e");
      rect(ctx, cx, py - 6, 3, 1, "#3b2a1e");
    }
    if (b.id === "guild") {
      // hanging sign with a d20
      const sx = b.doorX * T + 16;
      const sy = py + roofH + 4;
      rect(ctx, sx, sy - 2, 8, 1, "#3b2a1e");
      rect(ctx, sx + 1, sy, 1, 2, "#3b2a1e");
      rect(ctx, sx + 6, sy, 1, 2, "#3b2a1e");
      pixelCircle(ctx, sx + 4, sy + 6, 4, "#f6c453");
      rect(ctx, sx + 3, sy + 5, 3, 2, "#a5352e");
      // barrel
      rect(ctx, px - 6, py + ph - 10, 7, 9, "#8a5c37");
      rect(ctx, px - 6, py + ph - 8, 7, 1, "#4a3020");
      rect(ctx, px - 6, py + ph - 4, 7, 1, "#4a3020");
    }
    if (b.id === "gym") {
      // dumbbell icon above the door
      const dy = py + roofH + 3;
      const dx = b.doorX * T + 1;
      rect(ctx, dx, dy, 3, 6, "#22252f");
      rect(ctx, dx + 11, dy, 3, 6, "#22252f");
      rect(ctx, dx + 3, dy + 2, 8, 2, "#22252f");
    }
    if (b.id === "workshop") {
      // gear icon on the roof
      const gx = cx;
      const gy = py + Math.round(roofH * 0.55);
      pixelCircle(ctx, gx, gy, 5, "#f6c453");
      rect(ctx, gx - 1, gy - 7, 3, 14, "#f6c453");
      rect(ctx, gx - 7, gy - 1, 14, 3, "#f6c453");
      pixelCircle(ctx, gx, gy, 2, s.roof);
    }
    if (b.id === "arcade") {
      // screens instead of windows
      const wy = py + roofH + 6;
      [px + 6, px + 20, px + pw - 30, px + pw - 16].forEach((x, i) => {
        rect(ctx, x - 1, wy - 1, 10, 9, "#0b0e18");
        rect(ctx, x, wy, 8, 7, i % 2 ? "#a98bff" : "#5fe3d0");
        rect(ctx, x + 1, wy + 1, 3, 1, "rgba(255,255,255,0.6)");
      });
      // joystick on the roof
      rect(ctx, cx - 4, py + 4, 9, 4, "#ff6b7d");
      rect(ctx, cx, py - 2, 1, 6, "#c0c7dd");
      pixelCircle(ctx, cx, py - 3, 2, "#ff6b7d");
    }
  }

  function drawFountain(ctx) {
    const cx = FOUNTAIN.x * T + T;
    const cy = FOUNTAIN.y * T + T;
    pixelCircle(ctx, cx, cy + 1, 14, "rgba(0,0,0,0.15)");
    pixelCircle(ctx, cx, cy, 14, "#7f889d");
    pixelCircle(ctx, cx, cy, 12, "#c5ccda");
    pixelCircle(ctx, cx, cy, 10, "#3592d2");
    pixelCircle(ctx, cx, cy, 3, "#c5ccda");
  }

  function drawSign(ctx) {
    const px = SIGN.x * T;
    const py = SIGN.y * T;
    rect(ctx, px + 7, py + 7, 2, 9, "#6b4426");
    rect(ctx, px + 1, py + 1, 14, 9, "#3b2a1e");
    rect(ctx, px + 2, py + 2, 12, 7, "#c8935a");
    rect(ctx, px + 4, py + 4, 8, 1, "#6b4426");
    rect(ctx, px + 4, py + 6, 6, 1, "#6b4426");
    rect(ctx, px + 3, py + 14, 10, 2, "rgba(0,0,0,0.18)");
  }

  /* ---------------------------------------------------------------------
     Static layer — drawn once
     --------------------------------------------------------------------- */
  let staticCanvas = null;

  function renderStatic() {
    staticCanvas = document.createElement("canvas");
    staticCanvas.width = W * T;
    staticCanvas.height = H * T;
    const ctx = staticCanvas.getContext("2d");
    const rand = rng(53);

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawTile(ctx, x, y, rand);
    flowers.forEach((f) => drawFlower(ctx, f));
    drawFountain(ctx);
    drawSign(ctx);

    // Draw trees and buildings from top to bottom so overlaps look right
    const things = [
      ...trees.map((t) => ({ y: t.y + 1, draw: () => drawTree(ctx, t) })),
      ...BUILDINGS.map((b) => ({ y: b.y + b.h, draw: () => drawBuilding(ctx, b) })),
    ].sort((a, b) => a.y - b.y);
    things.forEach((t) => t.draw());
  }

  /* ---------------------------------------------------------------------
     Animated details — drawn every frame (only what is on screen)
     --------------------------------------------------------------------- */
  function drawDynamic(ctx, view, time) {
    const x0 = Math.max(0, Math.floor(view.x / T));
    const y0 = Math.max(0, Math.floor(view.y / T));
    const x1 = Math.min(W - 1, Math.ceil((view.x + view.w) / T));
    const y1 = Math.min(H - 1, Math.ceil((view.y + view.h) / T));

    // Water waves and foam
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (terrain[idx(x, y)] !== WATER) continue;
        const px = x * T;
        const py = y * T;
        const phase = time * 1.6 + x * 0.9 + y * 1.7;
        const off = Math.floor((Math.sin(phase) + 1) * 3);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(px + 2 + off, py + 4, 4, 1);
        ctx.fillRect(px + 9 - off, py + 11, 3, 1);
        if (y === shore[x]) {
          const foam = Math.floor((Math.sin(time * 2 + x) + 1) * 1.5);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillRect(px, py + foam, T, 1);
        }
      }
    }

    // Fountain water jets
    const fx = FOUNTAIN.x * T + T;
    const fy = FOUNTAIN.y * T + T;
    if (fx > view.x - 30 && fx < view.x + view.w + 30 && fy > view.y - 30 && fy < view.y + view.h + 30) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + time * 0.8;
        const r = 6 + Math.sin(time * 3 + i) * 1.5;
        ctx.fillStyle = "rgba(220,240,255,0.8)";
        ctx.fillRect(Math.round(fx + Math.cos(a) * r), Math.round(fy - 2 + Math.sin(a) * r * 0.5), 1, 1);
      }
      const jet = 4 + Math.round((Math.sin(time * 4) + 1) * 2);
      ctx.fillStyle = "rgba(200,230,255,0.9)";
      ctx.fillRect(fx - 1, fy - 3 - jet, 2, jet);
    }

    // Chimney smoke on the home
    const home = BUILDINGS[0];
    const sx = home.x * T + home.w * T - 15;
    const sy = home.y * T;
    for (let i = 0; i < 4; i++) {
      const t = (time * 0.5 + i / 4) % 1;
      const size = 2 + Math.floor(t * 3);
      ctx.fillStyle = `rgba(230,230,240,${0.5 * (1 - t)})`;
      ctx.fillRect(Math.round(sx + Math.sin(t * 6 + i) * 3), Math.round(sy - t * 22), size, size);
    }

    // Arcade neon outline (flickers)
    const arc = BUILDINGS[7];
    const flick = Math.sin(time * 9) > -0.85 ? 1 : 0.3;
    ctx.globalAlpha = flick;
    const ax = arc.x * T;
    const ay = arc.y * T + Math.round(arc.h * T * 0.45) + 1;
    ctx.fillStyle = "#ff5fa2";
    ctx.fillRect(ax + 1, ay, arc.w * T - 5, 1);
    ctx.fillStyle = "#5fe3d0";
    ctx.fillRect(ax + 1, arc.y * T + arc.h * T - 4, arc.w * T - 5, 1);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------------
     Collision and path-finding
     --------------------------------------------------------------------- */
  function isSolid(tx, ty) {
    if (!inBounds(tx, ty)) return true;
    return solid[idx(tx, ty)] === 1;
  }

  /* Breadth-first search on the tile grid. Returns a list of tiles. */
  function findPath(sx, sy, tx, ty) {
    if (isSolid(tx, ty)) return null;
    const prev = new Int32Array(W * H).fill(-1);
    const start = idx(sx, sy);
    const goal = idx(tx, ty);
    const queue = [start];
    prev[start] = start;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      const cx = cur % W;
      const cy = (cur - cx) / W;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (isSolid(nx, ny)) continue;
        const n = idx(nx, ny);
        if (prev[n] !== -1) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let cur = goal; cur !== start; cur = prev[cur]) {
      path.push({ x: cur % W, y: Math.floor(cur / W) });
    }
    return path.reverse();
  }

  function buildingAt(tx, ty) {
    return BUILDINGS.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y - 1 && ty < b.y + b.h) || null;
  }

  generate();

  Q.world = {
    T,
    W,
    H,
    buildings: BUILDINGS,
    sign: SIGN,
    spawn: SPAWN,
    scrollSpots: SCROLL_SPOTS,
    get staticCanvas() {
      if (!staticCanvas) renderStatic();
      return staticCanvas;
    },
    drawDynamic,
    isSolid,
    findPath,
    buildingAt,
    pixelCircle,
  };
})(window.Quest);
