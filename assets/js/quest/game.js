/* ==========================================================================
   quest/game.js — the main game: canvas setup, camera, input (keyboard,
   mouse/touch, on-screen buttons), interactions, saving progress and the
   game loop. Uses world.js, player.js, ui.js, audio.js and data.js.
   ========================================================================== */

window.Quest = window.Quest || {};

(function (Q) {
  const { world, data, ui, audio } = Q;
  const { T, W, H } = world;
  const STORAGE_KEY = "mahammad-quest-progress";
  const TOTAL = data.locations.length;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const state = {
    visited: new Set(),
    scrolls: new Set(),
    get level() {
      return data.player.startLevel + this.visited.size;
    },
  };

  let player = new Q.Player(world.spawn.x, world.spawn.y);
  let playing = false;
  let pxScale = 1; // CSS pixels per game pixel
  let near = null; // building or sign the player stands next to
  let time = 0;
  let dustTimer = 0;
  const view = { x: 0, y: 0, w: 0, h: 0 };
  const keys = new Set();
  const touchDir = { x: 0, y: 0 };
  const particles = [];

  const locById = (id) => data.locations.find((l) => l.id === id);
  const buildingById = (id) => world.buildings.find((b) => b.id === id);

  /* ---------------------------------------------------------------------
     Save / load progress (localStorage)
     --------------------------------------------------------------------- */
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      (saved.visited || []).forEach((id) => locById(id) && state.visited.add(id));
      (saved.scrolls || []).forEach((id) => state.scrolls.add(id));
    } catch (e) {
      /* ignore broken save data */
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visited: [...state.visited], scrolls: [...state.scrolls] })
    );
  }

  function reset() {
    state.visited.clear();
    state.scrolls.clear();
    localStorage.removeItem(STORAGE_KEY);
    player = new Q.Player(world.spawn.x, world.spawn.y);
    ui.updateHud(state);
    ui.toast("Progress reset. A fresh adventure!");
  }

  /* ---------------------------------------------------------------------
     Canvas size — keeps pixels sharp at any screen size
     --------------------------------------------------------------------- */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = stage.clientWidth;
    const cssH = stage.clientHeight;
    // zoom so that at least ~N tiles fit across and ~14 tiles fit down
    const tilesAcross = cssW < 620 ? 12 : cssW < 1000 ? 17 : 22;
    const byWidth = (cssW * dpr) / (T * tilesAcross);
    const byHeight = (cssH * dpr) / (T * 14);
    const scale = Math.max(1, Math.round(Math.min(byWidth, byHeight)));
    canvas.width = Math.ceil((cssW * dpr) / scale);
    canvas.height = Math.ceil((cssH * dpr) / scale);
    pxScale = scale / dpr;
    canvas.style.width = `${canvas.width * pxScale}px`;
    canvas.style.height = `${canvas.height * pxScale}px`;
    ctx.imageSmoothingEnabled = false;
  }

  function updateCamera() {
    view.w = canvas.width;
    view.h = canvas.height;
    const mapW = W * T;
    const mapH = H * T;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    view.x = view.w >= mapW ? -(view.w - mapW) / 2 : clamp(player.x - view.w / 2, 0, mapW - view.w);
    view.y = view.h >= mapH ? -(view.h - mapH) / 2 : clamp(player.y - 8 - view.h / 2, 0, mapH - view.h);
    view.x = Math.round(view.x);
    view.y = Math.round(view.y);
  }

  /* ---------------------------------------------------------------------
     Interactions
     --------------------------------------------------------------------- */
  function findNear() {
    const tx = player.tileX;
    const ty = player.tileY;
    const b = world.buildings.find((bd) => bd.standX === tx && bd.standY === ty);
    if (b) return { type: "building", id: b.id };
    const s = world.sign;
    if (Math.abs(s.x - tx) + Math.abs(s.y - ty) === 1) return { type: "sign" };
    return null;
  }

  function interact() {
    if (!near) return;
    if (near.type === "building") enterBuilding(near.id);
    else openSign();
  }

  function openSign() {
    ui.openDialog({ title: data.sign.title, icon: "🪧", color: "#c8935a", pages: data.sign.pages });
  }

  function enterBuilding(id) {
    const loc = locById(id);
    const first = !state.visited.has(id);
    player.dir = "up";
    ui.openDialog(
      {
        title: loc.name,
        subtitle: loc.subtitle,
        icon: loc.icon,
        color: loc.color,
        pages: loc.pages,
        facts: loc.facts,
        dice: loc.dice,
        link: loc.link,
        reward: first ? "✨ +100 XP" : "✓ Already visited",
      },
      () => {
        if (!first) return;
        state.visited.add(id);
        save();
        ui.updateHud(state);
        const b = buildingById(id);
        burst(b.doorX * T + 8, b.standY * T, loc.color);
        audio.xp();
        ui.toast(`${loc.icon} <b>${loc.name}</b> visited · +100 XP`);
        setTimeout(() => ui.levelUp(state.level), 250);
        if (state.visited.size === TOTAL) setTimeout(finale, 1900);
      }
    );
  }

  function finale() {
    audio.victory();
    ui.confetti();
    ui.openSheet(state, true);
  }

  function travelTo(id) {
    if (!playing || ui.busy) return;
    const b = buildingById(id);
    if (player.tileX === b.standX && player.tileY === b.standY) {
      enterBuilding(id);
      return;
    }
    const path = world.findPath(player.tileX, player.tileY, b.standX, b.standY);
    if (!path) {
      ui.toast("Hmm, can't find a way there.");
      return;
    }
    audio.select();
    player.walkTo(path, () => enterBuilding(id));
  }

  function collectScrolls() {
    data.scrolls.forEach((scroll) => {
      if (state.scrolls.has(scroll.id)) return;
      const spot = world.scrollSpots[scroll.id];
      const sx = spot.x * T + 8;
      const sy = spot.y * T + 10;
      if (Math.hypot(player.x - sx, player.y - sy) < 11) {
        state.scrolls.add(scroll.id);
        save();
        ui.updateHud(state);
        audio.pickup();
        burst(sx, sy - 4, scroll.faded ? "#c0c7dd" : "#f6c453");
        ui.toast(`📜 Language scroll: <b>${scroll.name}</b> — ${scroll.note}`);
        if (state.scrolls.size === data.scrolls.length) {
          setTimeout(() => ui.toast("🗣️ All 4 language scrolls found!"), 1200);
        }
      }
    });
  }

  /* ---------------------------------------------------------------------
     Particles (dust when walking, sparkles when visiting)
     --------------------------------------------------------------------- */
  function burst(x, y, color) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 45;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.9, max: 0.9, color, size: 2 });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /* ---------------------------------------------------------------------
     Input
     --------------------------------------------------------------------- */
  const KEY_DIRS = {
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
  };

  function inputVector() {
    let x = touchDir.x;
    let y = touchDir.y;
    keys.forEach((code) => {
      const d = KEY_DIRS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    });
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  function onKeyDown(e) {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    const code = e.code;

    if (ui.introOpen) return; // the intro uses normal buttons

    if (ui.sheetOpen) {
      if (code === "Escape" || code === "KeyC") ui.closeSheet();
      return;
    }

    if (ui.dialogOpen) {
      if (["Space", "Enter", "KeyE", "NumpadEnter"].includes(code)) {
        e.preventDefault();
        ui.advanceDialog();
      } else if (code === "Escape") {
        ui.closeDialog();
      }
      return;
    }

    if (!playing) return;

    if (KEY_DIRS[code]) {
      e.preventDefault();
      keys.add(code);
    } else if (["Space", "Enter", "KeyE"].includes(code)) {
      e.preventDefault();
      interact();
    } else if (code === "KeyQ") {
      ui.toggleLog();
    } else if (code === "KeyC") {
      ui.openSheet(state, state.visited.size === TOTAL);
    } else if (code === "KeyM") {
      ui.toggleSound();
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onCanvasClick(e) {
    if (!playing || ui.busy) return;
    audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const wx = view.x + (e.clientX - rect.left) / pxScale;
    const wy = view.y + (e.clientY - rect.top) / pxScale;
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);

    const b = world.buildingAt(tx, ty);
    if (b) {
      travelTo(b.id);
      return;
    }
    if (tx === world.sign.x && ty === world.sign.y) {
      const path = world.findPath(player.tileX, player.tileY, world.sign.x, world.sign.y + 1);
      player.walkTo(path, openSign);
      return;
    }
    const path = world.findPath(player.tileX, player.tileY, tx, ty);
    if (path) {
      player.walkTo(path);
      particles.push({ x: tx * T + 8, y: ty * T + 12, vx: 0, vy: 0, life: 0.5, max: 0.5, color: "#ffffff", size: 3, ring: true });
    } else {
      audio.bump();
    }
  }

  function setupTouch() {
    const pad = document.getElementById("touch");
    if (!isTouch) return;
    pad.hidden = false;

    pad.querySelectorAll("[data-dir]").forEach((btn) => {
      const [dx, dy] = btn.dataset.dir.split(",").map(Number);
      const start = (e) => {
        e.preventDefault();
        audio.unlock();
        touchDir.x = dx;
        touchDir.y = dy;
        btn.classList.add("is-pressed");
      };
      const end = () => {
        if (touchDir.x === dx && touchDir.y === dy) {
          touchDir.x = 0;
          touchDir.y = 0;
        }
        btn.classList.remove("is-pressed");
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointerleave", end);
      btn.addEventListener("pointercancel", end);
    });

    document.getElementById("touch-action").addEventListener("click", () => {
      if (ui.dialogOpen) ui.advanceDialog();
      else interact();
    });
  }

  /* ---------------------------------------------------------------------
     Drawing
     --------------------------------------------------------------------- */
  /* Pulsing glow on the tile in front of a door that hasn't been visited */
  function drawDoorGlow(b) {
    const cx = b.standX * T + 8;
    const cy = b.standY * T + 9;
    const pulse = (Math.sin(time * 3.5) + 1) / 2;
    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.fillStyle = "#f6c453";
    ctx.fillRect(cx - 6, cy - 3, 12, 6);
    ctx.fillRect(cx - 7, cy - 2, 14, 4);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff3c4";
    const r = Math.round(4 + pulse * 3);
    ctx.fillRect(cx - r, cy - 3, 1, 1);
    ctx.fillRect(cx + r, cy + 2, 1, 1);
    ctx.fillRect(cx, cy - 4 - Math.round(pulse * 3), 1, 1);
    ctx.globalAlpha = 1;
  }

  function drawScroll(scroll, spot) {
    const x = spot.x * T + 8;
    const y = spot.y * T + 8 + Math.sin(time * 3 + spot.x) * 2;
    ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.15;
    world.pixelCircle(ctx, x, Math.round(y), 7, scroll.faded ? "#c0c7dd" : "#f6c453");
    ctx.globalAlpha = scroll.faded ? 0.65 : 1;
    const px = Math.round(x - 5);
    const py = Math.round(y - 4);
    ctx.fillStyle = "#6b4426";
    ctx.fillRect(px - 1, py, 1, 8);
    ctx.fillRect(px + 10, py, 1, 8);
    ctx.fillStyle = "#f3e2b5";
    ctx.fillRect(px, py, 10, 8);
    ctx.fillStyle = "#c9b27a";
    ctx.fillRect(px + 2, py + 2, 6, 1);
    ctx.fillRect(px + 2, py + 4, 5, 1);
    ctx.fillStyle = "#c8463d";
    ctx.fillRect(px + 4, py + 6, 2, 3);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.fillStyle = "#2470b0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(world.staticCanvas, -view.x, -view.y);

    ctx.save();
    ctx.translate(-view.x, -view.y);
    world.drawDynamic(ctx, view, time);

    data.scrolls.forEach((s) => {
      if (!state.scrolls.has(s.id)) drawScroll(s, world.scrollSpots[s.id]);
    });

    world.buildings.forEach((b) => {
      if (!state.visited.has(b.id)) drawDoorGlow(b);
    });

    // particles behind the player (dust)
    particles.forEach((p) => {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        const r = 2 + (1 - a) * 6;
        ctx.strokeRect(Math.round(p.x - r), Math.round(p.y - r / 2), Math.round(r * 2), Math.round(r));
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    player.draw(ctx, view.x, view.y);

    // labels above buildings (HTML elements positioned over the canvas)
    world.buildings.forEach((b) => {
      const lift = b.id === "school" || b.id === "ada" ? 20 : b.id === "tower" || b.id === "arcade" ? 12 : 4;
      const sx = (b.x * T + (b.w * T) / 2 - view.x) * pxScale;
      const sy = (b.y * T - lift - view.y) * pxScale;
      const isNear = near && near.type === "building" && near.id === b.id;
      ui.placeLabel(b.id, sx, sy, state.visited.has(b.id), isNear);
    });
  }

  /* ---------------------------------------------------------------------
     Game loop
     --------------------------------------------------------------------- */
  function update(dt) {
    time += dt;
    if (playing && !ui.busy) {
      player.update(dt, inputVector());
      collectScrolls();
      if (player.moving) {
        dustTimer -= dt;
        if (dustTimer <= 0) {
          dustTimer = 0.16;
          particles.push({
            x: player.x - 1 + (Math.random() - 0.5) * 4,
            y: player.y - 2,
            vx: (Math.random() - 0.5) * 10,
            vy: -8,
            life: 0.35,
            max: 0.35,
            color: "rgba(255,255,255,0.7)",
            size: 1,
          });
        }
      }
    }
    updateParticles(dt);

    near = playing && !ui.busy ? findNear() : null;
    if (near && !player.path) {
      const action = isTouch ? "Tap <kbd>A</kbd> to" : "Press <kbd>E</kbd> to";
      const label = near.type === "building" ? `enter <b>${locById(near.id).name}</b>` : "read the <b>sign</b>";
      ui.showPrompt(`${action} ${label}`);
    } else {
      ui.showPrompt(null);
    }
    updateCamera();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------------
     Start
     --------------------------------------------------------------------- */
  function start() {
    load();
    resize();

    ui.init({
      onStart() {
        const firstTime = !playing && state.visited.size === 0 && state.scrolls.size === 0;
        playing = true;
        stage.focus({ preventScroll: true });
        if (firstTime) setTimeout(openSign, 450);
      },
      onTravel: travelTo,
      onReset: reset,
      onSheet: () => ui.openSheet(state, state.visited.size === TOTAL),
    });
    ui.updateHud(state);
    ui.showIntro(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => keys.clear());
    canvas.addEventListener("click", onCanvasClick);
    setupTouch();

    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    requestAnimationFrame(loop);
  }

  start();
})(window.Quest);
