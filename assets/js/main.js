/* ==========================================================================
   main.js — small page effects shared by the content pages
   ========================================================================== */

/* Fade elements with the .reveal class in as they scroll into view */
(function revealOnScroll() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el, i) => {
    // small stagger for items that appear together
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 80}ms`;
    observer.observe(el);
  });
})();

/* Typing effect for elements with data-typewords="word1|word2|word3" */
(function typeWords() {
  const el = document.querySelector("[data-typewords]");
  if (!el) return;

  const words = el.dataset.typewords.split("|");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    el.textContent = words[0];
    return;
  }

  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const word = words[wordIndex];
    charIndex += deleting ? -1 : 1;
    el.textContent = word.slice(0, charIndex);

    let delay = deleting ? 45 : 85;
    if (!deleting && charIndex === word.length) {
      delay = 1800;
      deleting = true;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      delay = 350;
    }
    setTimeout(tick, delay);
  }

  tick();
})();
