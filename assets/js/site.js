/* ==========================================================================
   site.js — landing page behaviour. No dependencies.
   Everything here is an enhancement: the page works with JS disabled.
   ========================================================================== */

(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Footer year ---------------------------------------------------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* --- Nav: shadow once scrolled -------------------------------------- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.setAttribute("data-scrolled", String(window.scrollY > 12));
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --- Nav: mobile menu ----------------------------------------------- */
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");

  if (toggle && links) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      links.setAttribute("data-open", String(open));
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (!e.target.closest("#nav-links") && !e.target.closest("#nav-toggle")) setOpen(false);
    });

    // Reset when resizing up to desktop so the panel can't stay stuck open.
    // Safari < 14 only has the deprecated addListener, so support both.
    const wide = matchMedia("(min-width: 721px)");
    const onWide = (e) => { if (e.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* --- Nav: highlight the section you're reading ---------------------- */
  const navAnchors = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const sections = navAnchors
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => seen.set(en.target.id, en.intersectionRatio));
        let best = "", ratio = 0;
        seen.forEach((r, id) => {
          if (r > ratio) { ratio = r; best = id; }
        });
        navAnchors.forEach((a) => {
          if (a.getAttribute("href") === "#" + best && ratio > 0) {
            a.setAttribute("aria-current", "true");
          } else {
            a.removeAttribute("aria-current");
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75], rootMargin: "-20% 0px -40% 0px" }
    );
    sections.forEach((s) => io.observe(s));
  }

  /* --- Copy to clipboard ---------------------------------------------- */
  const status = document.getElementById("copy-status");

  const flash = (btn, ok) => {
    btn.setAttribute("data-copied", String(ok));
    if (status) status.textContent = ok ? "Copied to clipboard" : "Copy failed — select the text instead";
    setTimeout(() => {
      btn.removeAttribute("data-copied");
      if (status) status.textContent = "";
    }, 2000);
  };

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for non-secure contexts
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        flash(btn, true);
      } catch {
        flash(btn, false);
      }
    });
  });

  /* --- Warp into KryptOS ---------------------------------------------- *
   * The link navigates normally on its own. We only intercept to play
   * the transition, and we bail out for reduced motion, modified clicks
   * and middle clicks so browser behaviour is never hijacked.            */
  const launch = document.getElementById("launch");
  const warp = document.getElementById("warp");

  if (launch && warp && !reduceMotion) {
    launch.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const href = launch.getAttribute("href");
      warp.setAttribute("data-on", "true");

      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        location.href = href;
      };

      // Navigate when the animation ends, with a timeout as a safety net
      warp.querySelector(".core")?.addEventListener("animationend", go, { once: true });
      setTimeout(go, 900);
    });
  }
})();
