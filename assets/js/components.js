/* ==========================================================================
   components.js — shared layout pieces used on every page.

   The navigation bar and footer are written ONCE here and inserted into each
   page through two custom HTML elements:

       <site-header></site-header>
       <site-footer></site-footer>

   Each page sets <body data-page="home|about|projects|quest"> so the
   matching nav link is highlighted.
   ========================================================================== */

const SITE = {
  name: "Mahammad Shahmuradov",
  shortName: "Mahammad",
  repoUrl: "https://github.com/MahammadADA/MahammadADA.github.io",
  githubProfile: "https://github.com/MahammadADA",
  pages: [
    { id: "home", label: "Home", href: "index.html" },
    { id: "about", label: "About", href: "about.html" },
    { id: "projects", label: "Projects", href: "projects.html" },
    { id: "quest", label: "Quest", href: "quest.html", badge: "Play" },
  ],
};

const ICONS = {
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
};

/* ---------- <site-header> ---------- */
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const current = document.body.dataset.page;

    const links = SITE.pages
      .map((page) => {
        const isCurrent = page.id === current ? ' aria-current="page"' : "";
        const questClass = page.id === "quest" ? " nav__link--quest" : "";
        const badge = page.badge ? `<span class="nav__badge">${page.badge}</span>` : "";
        return `<li><a class="nav__link${questClass}" href="${page.href}"${isCurrent}>${page.label}${badge}</a></li>`;
      })
      .join("");

    this.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="site-header">
        <div class="container">
          <a class="brand" href="index.html" aria-label="${SITE.name} — home">
            <span class="brand__logo" aria-hidden="true">M</span>
            <span>${SITE.shortName}</span>
          </a>
          <nav class="nav" aria-label="Main">
            <ul class="nav__list" id="nav-list">${links}</ul>
            <a class="icon-link" href="${SITE.repoUrl}" target="_blank" rel="noopener"
               aria-label="Source code of this website on GitHub" title="This website's GitHub repository">
              ${ICONS.github}
            </a>
            <button class="nav-toggle" aria-controls="nav-list" aria-expanded="false" aria-label="Open menu">
              <span></span>
            </button>
          </nav>
        </div>
      </header>`;

    this.setupMobileMenu();
  }

  setupMobileMenu() {
    const toggle = this.querySelector(".nav-toggle");
    const list = this.querySelector(".nav__list");

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      list.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    list.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
  }
}

/* ---------- <site-footer> ---------- */
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();
    const pageLinks = SITE.pages
      .map((page) => `<li><a href="${page.href}">${page.label}</a></li>`)
      .join("");

    this.innerHTML = `
      <footer class="site-footer">
        <div class="container footer__inner">
          <div class="footer__brand">
            <a class="brand" href="index.html">
              <span class="brand__logo" aria-hidden="true">M</span>
              <span>${SITE.name}</span>
            </a>
            <p>IT student at ADA University in Baku. Building things with AI, one project at a time.</p>
          </div>
          <div>
            <p class="footer__title">Pages</p>
            <ul class="footer__links">${pageLinks}</ul>
          </div>
          <div>
            <p class="footer__title">Find me</p>
            <div class="footer__socials">
              <a class="icon-link" href="${SITE.repoUrl}" target="_blank" rel="noopener"
                 aria-label="This website's GitHub repository" title="This website's GitHub repository">
                ${ICONS.github}
              </a>
            </div>
            <ul class="footer__links" style="margin-top: 0.9rem">
              <li><a href="${SITE.repoUrl}" target="_blank" rel="noopener">Website source code</a></li>
              <li><a href="${SITE.githubProfile}" target="_blank" rel="noopener">GitHub profile</a></li>
            </ul>
          </div>
        </div>
        <div class="container footer__bottom">
          <span>&copy; ${year} ${SITE.name}</span>
          <span>SITE 1101 · Project 4 · Hosted on GitHub Pages</span>
        </div>
      </footer>`;
  }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);

/* ---------- Ambient background (glowing orbs + grid) ---------- */
(function addBackground() {
  if (document.querySelector(".bg-decor")) return;
  const decor = document.createElement("div");
  decor.className = "bg-decor";
  decor.setAttribute("aria-hidden", "true");
  decor.innerHTML =
    '<span class="orb orb--gold"></span><span class="orb orb--teal"></span><span class="orb orb--violet"></span>';
  document.body.prepend(decor);
})();
