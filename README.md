# Mahammad Shahmuradov — Personal Website

My personal portfolio website, made for the **SITE 1101: Principles of Information Systems** course at **ADA University** (Fall 2026, Project 4).

🌐 **Live site:** https://mahammadada.github.io
📦 **Repository:** https://github.com/MahammadADA/MahammadADA.github.io

---

## About the project

A static website (HTML, CSS and JavaScript, no frameworks) hosted on GitHub Pages. It has four pages:

| Page | File | What's on it |
| --- | --- | --- |
| **Home** | `index.html` | Profile photo, a short intro, my main goal and what I spend my time on |
| **About** | `about.html` | Background, education timeline, languages, skills, clubs, work and hobbies |
| **Projects** | `projects.html` | Project 1 (Logic Gates), Project 2 (Hour of Code), Project 3 (LEGO EV3 Robotics) and this website, with filters |
| **Quest** | `quest.html` | **Gamified About page**: a small pixel-art RPG about me |

Every page shares the same navigation bar and footer, and both include an icon that links to this GitHub repository.

### Mahammad's Quest (gamified About page)

Instead of reading about me, you can walk around a small pixel world:

- 🎲 Start by **rolling a d20 for initiative** (a nod to the tabletop roleplaying club I'm in).
- 🗺️ Walk with **WASD / arrow keys**, **click** anywhere to walk there, or use the **on-screen buttons** on a phone.
- 🏠 Visit **8 places from my life**: home, schools, ADA University, the Roleplaying Guild, the gym, the projects workshop, the arcade and the "Tower of the Future" (my main goal).
- ✨ Each new place gives **+100 XP** and a level. You start at **Lv 10** and finish at **Lv 18**, my age.
- 📜 Find **4 language scrolls** hidden around the map (the Russian one is faded, because I'm still learning it).
- 🧙 Finish the quest to unlock a D&D-style **character sheet**.
- 💾 Progress is saved in the browser (`localStorage`), and sound can be muted with **M**.

All the art is drawn with code on an HTML `<canvas>`, and all sounds are generated with the Web Audio API. There are no image or audio files in the game.

---

## Folder structure

```
.
├── index.html            # Home page
├── about.html            # About page
├── projects.html         # Projects page
├── quest.html            # Gamified About page (the RPG)
├── README.md
└── assets/
    ├── css/
    │   ├── base.css          # design tokens (colors, fonts), reset, typography
    │   ├── layout.css        # header / nav, footer, sections, background
    │   ├── components.css    # buttons, cards, chips, badges, timeline
    │   └── pages/            # styles used by only one page
    │       ├── home.css
    │       ├── about.css
    │       ├── projects.css
    │       └── quest.css
    ├── js/
    │   ├── components.js     # <site-header> and <site-footer>, written once for all pages
    │   ├── main.js           # scroll-reveal and typing effects
    │   ├── projects.js       # project filter buttons
    │   └── quest/            # the game, split into modules
    │       ├── data.js       # ALL game text (edit this to change what the game says)
    │       ├── audio.js      # retro sound effects
    │       ├── world.js      # map, buildings, drawing, collision, path-finding
    │       ├── player.js     # character movement and sprite
    │       ├── ui.js         # HUD, dialogs, quest log, d20, character sheet
    │       └── game.js       # game loop, camera, input, saving progress
    └── img/
        ├── favicon.svg
        ├── profile-placeholder.svg
        └── projects/         # project images
```

### How the code is organized

- **Shared layout written once.** The nav bar and footer are custom HTML elements (`<site-header>`, `<site-footer>`) defined in `components.js`. Each page sets `<body data-page="...">` so the current page is highlighted in the menu.
- **CSS in layers.** `base.css` holds design tokens and the reset, `layout.css` and `components.css` hold shared pieces, and `pages/*.css` holds page-specific styles.
- **Game split by responsibility.** Content (`data.js`) is kept apart from logic (`world.js`, `player.js`, `game.js`) and interface (`ui.js`).

---

## Running it locally

There's no build step. Either:

- open the folder in VS Code and use the **Live Server** extension, or
- run a simple local server from the project folder:

  ```bash
  python -m http.server 5500
  ```

  and open http://localhost:5500.

## Tech

- HTML5, CSS3 (custom properties, grid, flexbox), vanilla JavaScript
- Canvas 2D API (game rendering) and Web Audio API (sound effects)
- Fonts: [Inter](https://fonts.google.com/specimen/Inter), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) from Google Fonts
- Version control with git, hosting on GitHub Pages

## Built with AI

As required by the course, I built this website together with an AI coding agent (Claude Code). The full conversation is submitted separately as a Markdown file. The text about me on the site is based on my own answers to the agent's questions.

---

© 2026 Mahammad Shahmuradov
