/* ==========================================================================
   quest/ui.js — everything drawn with HTML on top of the game canvas:
   HUD, quest log, dialog box, prompts, toasts, level-up banner,
   the d20 roll, the intro screen, the character sheet and confetti.
   ========================================================================== */

window.Quest = window.Quest || {};

(function (Q) {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const data = Q.data;
  const audio = Q.audio;

  let handlers = {};
  let dialog = null; // currently open dialog state
  const labels = {};

  /* ---------------------------------------------------------------------
     Setup
     --------------------------------------------------------------------- */
  function init(h) {
    handlers = h;

    $("btn-log").addEventListener("click", toggleLog);
    $("btn-sheet").addEventListener("click", () => handlers.onSheet());
    $("btn-sound").addEventListener("click", toggleSound);
    $("btn-help").addEventListener("click", () => showIntro(true));
    $("dialog-next").addEventListener("click", advanceDialog);
    $("dialog").addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      advanceDialog();
    });

    // intro screen
    $("intro-roll").addEventListener("click", () => {
      audio.unlock();
      rollD20($("intro-die"), $("intro-die-num"), (n) => {
        $("intro-result").textContent = rollText(n);
        $("intro-result").hidden = false;
        $("intro-roll").hidden = true;
        $("intro-start").hidden = false;
        $("intro-start").focus();
      });
    });
    $("intro-start").addEventListener("click", () => {
      audio.select();
      hideIntro();
      handlers.onStart();
    });

    // world labels (one per building) — click to walk there
    const layer = $("labels");
    data.locations.forEach((loc) => {
      const el = document.createElement("button");
      el.className = "world-label";
      el.type = "button";
      el.innerHTML = `<span class="world-label__icon">${loc.icon}</span>${loc.name}`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onTravel(loc.id);
      });
      layer.appendChild(el);
      labels[loc.id] = el;
    });

    updateSoundButton();
  }

  /* ---------------------------------------------------------------------
     HUD and quest log
     --------------------------------------------------------------------- */
  function updateHud(state) {
    const total = data.locations.length;
    $("hud-level").textContent = state.level;
    $("hud-places").textContent = state.visited.size;
    $("hud-places-total").textContent = total;
    $("hud-scrolls").textContent = state.scrolls.size;
    $("hud-scrolls-total").textContent = data.scrolls.length;
    const progress = state.visited.size / total;
    $("xp-fill").style.width = `${Math.max(4, progress * 100)}%`;
    $("xp-text").textContent = `${state.visited.size * 100} / ${total * 100} XP`;
    renderLog(state);
  }

  function renderLog(state) {
    const list = $("log-list");
    list.innerHTML = "";
    data.locations.forEach((loc) => {
      const done = state.visited.has(loc.id);
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="log-item${done ? " is-done" : ""}">
          <span class="log-item__check" aria-hidden="true">${done ? "✓" : ""}</span>
          <span class="log-item__icon" aria-hidden="true">${loc.icon}</span>
          <span class="log-item__text"><b>${loc.name}</b><small>${loc.subtitle}</small></span>
          <span class="visually-hidden">${done ? "(visited)" : "(not visited yet)"} — walk there</span>
        </button>`;
      li.querySelector("button").addEventListener("click", () => {
        handlers.onTravel(loc.id);
        if (window.innerWidth < 760) toggleLog(false);
      });
      list.appendChild(li);
    });

    const scrollList = $("log-scrolls");
    scrollList.innerHTML = data.scrolls
      .map((s) => {
        const got = state.scrolls.has(s.id);
        return `<li class="${got ? "is-done" : ""}">📜 ${got ? s.name : "???"}</li>`;
      })
      .join("");
  }

  function toggleLog(force) {
    const log = $("quest-log");
    const open = typeof force === "boolean" ? force : log.hidden;
    log.hidden = !open;
    $("btn-log").setAttribute("aria-expanded", String(open));
    audio.select();
  }

  function toggleSound() {
    audio.toggle();
    updateSoundButton();
  }

  function updateSoundButton() {
    const btn = $("btn-sound");
    btn.textContent = audio.enabled ? "🔊" : "🔇";
    btn.setAttribute("aria-label", audio.enabled ? "Mute sound (M)" : "Turn sound on (M)");
    btn.title = btn.getAttribute("aria-label");
  }

  /* ---------------------------------------------------------------------
     World labels and the "press E" prompt
     --------------------------------------------------------------------- */
  function placeLabel(id, x, y, visited, near) {
    const el = labels[id];
    if (!el) return;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    el.classList.toggle("is-visited", visited);
    el.classList.toggle("is-near", near);
  }

  function showPrompt(text) {
    const el = $("prompt");
    if (!text) {
      el.hidden = true;
      return;
    }
    if (el.dataset.text !== text) {
      el.dataset.text = text;
      el.innerHTML = text;
    }
    el.hidden = false;
  }

  /* ---------------------------------------------------------------------
     Dialog box with typewriter text
     --------------------------------------------------------------------- */
  function openDialog(opts, onClose) {
    dialog = { ...opts, page: 0, typing: null, onClose };
    const box = $("dialog");
    $("dialog-title").textContent = opts.title;
    $("dialog-sub").textContent = opts.subtitle || "";
    $("dialog-icon").textContent = opts.icon || "💬";
    box.style.setProperty("--loc-color", opts.color || "#f6c453");
    box.hidden = false;
    showPrompt(null);
    audio.open();
    showPage();
    // focus the box itself (keys are handled in game.js, so Space isn't counted twice)
    box.focus({ preventScroll: true });
  }

  function showPage() {
    const d = dialog;
    const text = d.pages[d.page];
    const last = d.page === d.pages.length - 1;
    const el = $("dialog-text");
    $("dialog-extras").innerHTML = "";
    $("dialog-extras").hidden = true;
    $("dialog-next").textContent = last ? "Close ✕" : "Next ▶";
    $("dialog-dots").innerHTML = d.pages
      .map((_, i) => `<i class="${i === d.page ? "on" : i < d.page ? "seen" : ""}"></i>`)
      .join("");

    clearInterval(d.typing);
    if (reduceMotion) {
      el.textContent = text;
      if (last) showExtras();
      return;
    }
    let i = 0;
    el.textContent = "";
    el.classList.add("is-typing");
    d.typing = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0 && text[i - 1] !== " ") audio.blip();
      if (i >= text.length) finishTyping();
    }, 24);
  }

  function finishTyping() {
    const d = dialog;
    clearInterval(d.typing);
    d.typing = null;
    $("dialog-text").textContent = d.pages[d.page];
    $("dialog-text").classList.remove("is-typing");
    if (d.page === d.pages.length - 1) showExtras();
  }

  function showExtras() {
    const d = dialog;
    const box = $("dialog-extras");
    let html = "";
    if (d.facts && d.facts.length) {
      html += `<ul class="dialog__facts">${d.facts.map((f) => `<li>${f}</li>`).join("")}</ul>`;
    }
    const actions = [];
    if (d.reward) actions.push(`<span class="dialog__reward">${d.reward}</span>`);
    if (d.dice) {
      actions.push(`
        <span class="mini-roll">
          <button type="button" class="dialog__btn" id="guild-roll">🎲 Roll a d20</button>
          <span class="mini-roll__die" id="guild-die"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#d20-shape"/></svg><b id="guild-die-num">20</b></span>
        </span>`);
    }
    if (d.link) actions.push(`<a class="dialog__btn" href="${d.link.href}">${d.link.label} →</a>`);
    if (actions.length) html += `<div class="dialog__actions">${actions.join("")}</div>`;
    box.innerHTML = html;
    box.hidden = !html;

    const rollBtn = $("guild-roll");
    if (rollBtn) {
      rollBtn.addEventListener("click", () => {
        rollD20($("guild-die"), $("guild-die-num"), (n) => {
          toast(`🎲 Rolled <b>${n}</b> — ${rollText(n)}`);
        });
      });
    }
  }

  function advanceDialog() {
    if (!dialog) return;
    if (dialog.typing) {
      finishTyping();
      return;
    }
    if (dialog.page < dialog.pages.length - 1) {
      dialog.page += 1;
      audio.blip();
      showPage();
      return;
    }
    closeDialog();
  }

  function closeDialog() {
    if (!dialog) return;
    clearInterval(dialog.typing);
    const cb = dialog.onClose;
    dialog = null;
    $("dialog").hidden = true;
    if (cb) cb();
  }

  /* ---------------------------------------------------------------------
     Toasts, level-up banner, confetti
     --------------------------------------------------------------------- */
  function toast(html) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = html;
    $("toasts").appendChild(el);
    setTimeout(() => el.classList.add("is-leaving"), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  function levelUp(level) {
    const el = $("levelup");
    $("levelup-num").textContent = `Lv ${level}`;
    el.hidden = false;
    el.classList.remove("is-playing");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("is-playing");
    audio.levelUp();
    clearTimeout(levelUp.timer);
    levelUp.timer = setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  function confetti() {
    if (reduceMotion) return;
    const canvas = $("confetti");
    const stage = $("stage");
    const ctx = canvas.getContext("2d");
    canvas.width = stage.clientWidth;
    canvas.height = stage.clientHeight;
    const colors = ["#f6c453", "#5fe3d0", "#a98bff", "#ff6b7d", "#ffffff"];
    const pieces = Array.from({ length: 160 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: Math.random() * Math.PI,
    }));
    const start = performance.now();
    (function frame(now) {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.15;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - t / 3.5);
        ctx.fillRect(p.x, p.y, p.size, p.size * Math.abs(Math.cos(p.spin)));
      });
      ctx.globalAlpha = 1;
      if (t < 3.5) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })(start);
  }

  /* ---------------------------------------------------------------------
     d20 roll
     --------------------------------------------------------------------- */
  function rollD20(dieEl, numEl, onDone) {
    if (dieEl.classList.contains("is-rolling")) return;
    audio.dice();
    const result = 1 + Math.floor(Math.random() * 20);
    dieEl.classList.remove("is-nat20", "is-nat1");
    dieEl.classList.add("is-rolling");
    let ticks = 0;
    const timer = setInterval(() => {
      numEl.textContent = 1 + Math.floor(Math.random() * 20);
      ticks += 1;
      if (ticks > 12) {
        clearInterval(timer);
        numEl.textContent = result;
        dieEl.classList.remove("is-rolling");
        if (result === 20) dieEl.classList.add("is-nat20");
        if (result === 1) dieEl.classList.add("is-nat1");
        if (result === 20) audio.levelUp();
        else audio.select();
        onDone(result);
      }
    }, reduceMotion ? 10 : 60);
  }

  function rollText(n) {
    const r = data.rolls;
    if (n === 20) return r.nat20;
    if (n === 1) return r.nat1;
    if (n >= 14) return r.high;
    if (n >= 7) return r.mid;
    return r.low;
  }

  /* ---------------------------------------------------------------------
     Intro screen
     --------------------------------------------------------------------- */
  function showIntro(isHelp) {
    const intro = $("intro");
    intro.hidden = false;
    intro.classList.toggle("is-help", Boolean(isHelp));
    if (isHelp) {
      $("intro-roll").hidden = true;
      $("intro-result").hidden = true;
      $("intro-start").hidden = false;
      $("intro-start").textContent = "Back to the game";
    }
    $("intro-start").hidden ? $("intro-roll").focus() : $("intro-start").focus();
  }

  function hideIntro() {
    $("intro").hidden = true;
  }

  /* ---------------------------------------------------------------------
     Character sheet
     --------------------------------------------------------------------- */
  function openSheet(state, complete) {
    const s = data.sheet;
    const total = data.locations.length;
    const mod = (v) => {
      const m = Math.floor((v - 10) / 2);
      return m >= 0 ? `+${m}` : `${m}`;
    };

    const stats = s.stats
      .map(
        (st) => `
        <li class="stat-box" ${st.why ? `title="${st.why}"` : ""}>
          <span class="stat-box__key">${st.key}</span>
          <span class="stat-box__val">${st.value}</span>
          <span class="stat-box__mod">${mod(st.value)}</span>
        </li>`
      )
      .join("");

    const langs = data.scrolls
      .map((l) => {
        const got = state.scrolls.has(l.id);
        return `<li class="${got ? "" : "is-locked"}">${got ? `${l.name}${l.faded ? " <em>(learning)</em>" : ""}` : "??? — scroll not found"}</li>`;
      })
      .join("");

    $("sheet-body").innerHTML = `
      ${complete ? `<p class="sheet__banner">🏆 Quest complete — all ${total} places visited!</p>` : ""}
      <header class="sheet__head">
        <img class="sheet__avatar" src="assets/img/profile.jpg" alt="" width="64" height="64">
        <div>
          <h2 id="sheet-title">${s.title}</h2>
          <p>${s.class} · Level ${state.level}</p>
        </div>
      </header>
      <dl class="sheet__info">
        <div><dt>Background</dt><dd>${s.background}</dd></div>
        <div><dt>Origin</dt><dd>${s.origin}</dd></div>
        <div><dt>Places visited</dt><dd>${state.visited.size} / ${total}</dd></div>
      </dl>
      <h3 class="sheet__title">Ability scores <small>(just for fun)</small></h3>
      <ul class="stat-grid" role="list">${stats}</ul>
      <div class="sheet__cols">
        <div>
          <h3 class="sheet__title">Languages</h3>
          <ul class="sheet__list" role="list">${langs}</ul>
          <h3 class="sheet__title">Feats</h3>
          <ul class="sheet__list" role="list">${s.feats.map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>
        <div>
          <h3 class="sheet__title">Inventory</h3>
          <ul class="sheet__list" role="list">${s.inventory.map((f) => `<li>${f}</li>`).join("")}</ul>
          <h3 class="sheet__title">Main quest</h3>
          <p class="sheet__quest">${s.mainQuest}</p>
        </div>
      </div>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary" id="sheet-close">Keep exploring</button>
        <a class="btn btn--ghost" href="about.html">Read the About page</a>
        <button type="button" class="btn btn--ghost" id="sheet-reset">Reset progress</button>
      </div>`;

    $("sheet").hidden = false;
    $("sheet-close").addEventListener("click", closeSheet);
    $("sheet-reset").addEventListener("click", () => {
      closeSheet();
      handlers.onReset();
    });
    $("sheet-close").focus({ preventScroll: true });
    $("sheet-body").scrollTop = 0;
    audio.open();
  }

  function closeSheet() {
    $("sheet").hidden = true;
  }

  Q.ui = {
    init,
    updateHud,
    placeLabel,
    showPrompt,
    openDialog,
    advanceDialog,
    closeDialog,
    toast,
    levelUp,
    confetti,
    showIntro,
    openSheet,
    closeSheet,
    toggleLog,
    toggleSound,
    get dialogOpen() {
      return Boolean(dialog);
    },
    get busy() {
      return Boolean(dialog) || !$("intro").hidden || !$("sheet").hidden;
    },
    get introOpen() {
      return !$("intro").hidden;
    },
    get sheetOpen() {
      return !$("sheet").hidden;
    },
  };
})(window.Quest);
