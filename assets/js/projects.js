/* ==========================================================================
   projects.js — filter buttons on the Projects page
   Each project card has data-status="done" or data-status="soon".
   ========================================================================== */

(function projectFilters() {
  const buttons = document.querySelectorAll(".filter");
  const projects = document.querySelectorAll(".project");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      buttons.forEach((b) => {
        const active = b === button;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      projects.forEach((project) => {
        const show = filter === "all" || project.dataset.status === filter;
        project.hidden = !show;
      });
    });
  });
})();
