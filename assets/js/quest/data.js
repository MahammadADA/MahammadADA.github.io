/* ==========================================================================
   quest/data.js — ALL the text of the quest game lives here.
   Edit this file to change what the game says; no game logic in here.
   ========================================================================== */

window.Quest = window.Quest || {};

Quest.data = {
  player: {
    name: "Mahammad",
    startLevel: 10, // +1 level per place visited -> 8 places = level 18 (my age)
  },

  /* Places on the map. `id` must match a building in world.js. */
  locations: [
    {
      id: "home",
      name: "Home",
      subtitle: "Baku",
      icon: "🏠",
      color: "#ff6b7d",
      pages: [
        "Home. I'm from Baku — and, generally, from the Talysh region.",
        "I'm 18 years old. A normal university student. (At least I hope so.)",
        "My background is fairly normal, honestly. I had a normal life.",
      ],
      facts: ["Origin: Baku", "Roots: Talysh region", "Age: 18"],
    },
    {
      id: "school",
      name: "School Road",
      subtitle: "Gənc İstedadlar Liseyi",
      icon: "🏫",
      color: "#6aa9ff",
      pages: [
        "Before university, my school path had three stops.",
        "Grades 1 and 2 at School No. 211. Grades 3 and 4 at School No. 53.",
        "And from 5th to 11th grade — Gənc İstedadlar Liseyi.",
      ],
      facts: ["School No. 211", "School No. 53", "Gənc İstedadlar Liseyi"],
    },
    {
      id: "ada",
      name: "ADA University",
      subtitle: "Current location",
      icon: "🎓",
      color: "#5fe3d0",
      pages: [
        "ADA University. I'm a first-year IT bachelor's student here.",
        "This website — and this little game — is my project for SITE 1101: Principles of Information Systems.",
      ],
      facts: ["IT, Bachelor's", "Year 1", "SITE 1101"],
    },
    {
      id: "guild",
      name: "Roleplaying Guild",
      subtitle: "Tabletop Roleplaying Club",
      icon: "🎲",
      color: "#f6c453",
      pages: [
        "The tabletop roleplaying club. I'm actively involved in it right now, and I highly recommend it to others too.",
        "This is where I just started playing Dungeons & Dragons.",
        "I want to join other clubs too, but I'll be honest: I like going back home and chilling in front of the computer. So one is enough for now.",
      ],
      facts: ["Active member", "Dungeons & Dragons"],
      dice: true, // shows a "Roll a d20" button in the dialog
    },
    {
      id: "gym",
      name: "The Iron Forge",
      subtitle: "Gym",
      icon: "🏋️",
      color: "#c0c7dd",
      pages: [
        "The gym. I go to the gym.",
        "I don't know if that counts as a hobby — but I like going.",
      ],
      facts: ["STR +1"],
    },
    {
      id: "workshop",
      name: "The Workshop",
      subtitle: "Projects",
      icon: "🔧",
      color: "#ffa45c",
      pages: [
        "My projects live here.",
        "Project 1: in the university lab, our group of four built logic gates — AND, OR and NOT — and made a video. I built the AND gate, successfully.",
        "Project 2 (Hour of Code) and Project 3 (programming a LEGO EV3 robot to make shapes) are still ahead of me.",
        "And Project 4 is the website you are walking around in right now.",
      ],
      facts: ["AND gate ✓", "Hour of Code — soon", "LEGO EV3 — soon"],
      link: { label: "Open Projects page", href: "projects.html" },
    },
    {
      id: "arcade",
      name: "The Arcade",
      subtitle: "Computers & PC games",
      icon: "🎮",
      color: "#a98bff",
      pages: [
        "I use a computer daily for several hours, and I know a lot of things. You could say I'm digitally highly knowledgeable.",
        "I also like playing PC games.",
        "I don't have an \"expertise\" in one thing yet. But I can learn new things quickly, and I think I'm capable.",
        "I've also done a few one-time freelance jobs in the past.",
      ],
      facts: ["Fast learner", "PC games", "Freelance (one-time jobs)"],
    },
    {
      id: "tower",
      name: "Tower of the Future",
      subtitle: "Main quest",
      icon: "🔭",
      color: "#ffd98a",
      pages: [
        "This is the main quest.",
        "My ultimate goal is to have an AI company and fix as many problems as I can.",
        "And while doing that, create interesting AI models — maybe even robots or VR products.",
        "One of my hobbies is already using AI to create projects. So — first steps.",
      ],
      facts: ["Goal: AI company", "AI models", "Robots / VR"],
    },
  ],

  /* Collectible language scrolls placed around the map */
  scrolls: [
    { id: "az", name: "Azerbaijani", note: "I speak it." },
    { id: "tr", name: "Turkish", note: "I speak it." },
    { id: "en", name: "English", note: "I speak it." },
    { id: "ru", name: "Russian", note: "I'm learning it right now, but my level is very low.", faded: true },
  ],

  /* The sign next to the starting point */
  sign: {
    title: "Welcome sign",
    pages: [
      "Welcome to Mahammad's world.",
      "Visit all 8 places to finish the quest. There are also 4 language scrolls hidden around.",
      "Tip: you can click a building (or a place in the Quest Log) to walk there automatically.",
    ],
  },

  /* Results of the d20 roll on the intro screen and in the Guild */
  rolls: {
    nat20: "NATURAL 20! A perfect start.",
    high: "A strong roll. The quest begins well.",
    mid: "Not bad. Normal roll for a normal university student.",
    low: "Low roll... but the quest goes on anyway.",
    nat1: "Natural 1. Tripped over a cable. Getting up and starting anyway.",
  },

  /* Character sheet shown at the end. Stats are just for fun. */
  sheet: {
    title: "Mahammad Shahmuradov",
    class: "Apprentice Technomancer",
    background: "Normal university student (hopefully)",
    origin: "Baku · Talysh region",
    stats: [
      { key: "STR", value: 13, why: "Goes to the gym" },
      { key: "DEX", value: 11, why: "" },
      { key: "CON", value: 12, why: "" },
      { key: "INT", value: 15, why: "Learns new things quickly" },
      { key: "WIS", value: 12, why: "" },
      { key: "CHA", value: 12, why: "Roleplaying club" },
    ],
    feats: ["Digital Native — hours at the computer every day", "Fast Learner", "Builds projects with AI"],
    inventory: ["A computer (used daily)", "A d20 from the roleplaying club", "Gym bag", "ADA student ID"],
    mainQuest: "Build an AI company and fix as many problems as possible.",
  },
};
