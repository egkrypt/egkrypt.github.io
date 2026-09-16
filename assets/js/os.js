/* ==========================================================================
   os.js — KryptOS desktop environment. No dependencies.

   Contents
     1. Boot screen
     2. Window manager (open, focus, minimise, maximise, drag, resize)
     3. Taskbar + start menu
     4. Clock
     5. Paint
     6. Calculator (tokeniser + shunting-yard, no eval)
     7. Terminal (real command REPL)
     8. Gallery lightbox
     9. Copy buttons + global keys
   ========================================================================== */

(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPhone = () => matchMedia("(max-width: 760px)").matches;
  const status = $("#os-status");
  const announce = (msg) => { if (status) status.textContent = msg; };

  /* =====================================================================
     1. Boot screen
     ===================================================================== */

  const boot = $("#boot");
  const endBoot = () => {
    if (!boot || boot.dataset.done === "true") return;
    boot.dataset.done = "true";
    setTimeout(() => boot.setAttribute("hidden", ""), 400);
    announce("KryptOS ready");
  };

  if (boot) {
    $("#boot-skip")?.addEventListener("click", endBoot);
    // Any key or tap skips the intro
    addEventListener("keydown", endBoot, { once: true });
    boot.addEventListener("pointerdown", endBoot);
    setTimeout(endBoot, reduceMotion ? 250 : 1900);
  }

  /* =====================================================================
     2. Window manager
     ===================================================================== */

  const TASKBAR = 52;
  let z = 10;
  let cascade = 0;
  let activeId = null;

  const wins = new Map();
  $$(".win").forEach((el) => {
    wins.set(el.id, {
      el,
      title: el.dataset.title || el.id,
      glyph: el.dataset.glyph || "▪",
      placed: false,
    });
  });

  const tasklist = $("#tasklist");

  function renderTasklist() {
    if (!tasklist) return;
    tasklist.textContent = "";

    wins.forEach((w, id) => {
      if (w.el.dataset.open !== "true") return;

      const btn = document.createElement("button");
      btn.className = "taskitem";
      btn.type = "button";
      btn.dataset.for = id;
      btn.dataset.active = String(id === activeId && w.el.dataset.min !== "true");
      btn.setAttribute("aria-label",
        w.el.dataset.min === "true" ? `Restore ${w.title}` : `Show ${w.title}`);

      const g = document.createElement("span");
      g.setAttribute("aria-hidden", "true");
      g.textContent = w.glyph;

      const l = document.createElement("span");
      l.className = "t-label";
      l.textContent = w.title;

      btn.append(g, l);
      btn.addEventListener("click", () => {
        if (w.el.dataset.min === "true") { restore(id); }
        else if (id === activeId) { minimise(id); }
        else { focusWin(id); }
      });

      tasklist.appendChild(btn);
    });
  }

  function place(w) {
    if (w.placed || isPhone()) return;
    const rect = w.el.getBoundingClientRect();
    const maxLeft = Math.max(12, innerWidth - rect.width - 12);
    const maxTop = Math.max(12, innerHeight - TASKBAR - rect.height - 12);
    const step = 34;
    w.el.style.left = Math.min(maxLeft, 90 + cascade * step) + "px";
    w.el.style.top = Math.min(maxTop, 40 + cascade * step) + "px";
    cascade = (cascade + 1) % 6;
    w.placed = true;
  }

  function openWin(id) {
    const w = wins.get(id);
    if (!w) return;
    endBoot();
    const wasOpen = w.el.dataset.open === "true";
    w.el.dataset.open = "true";
    w.el.dataset.min = "false";
    if (!wasOpen) place(w);
    focusWin(id);
    announce(`${w.title} opened`);

    // Let an app grab focus (e.g. the terminal input)
    const target = w.el.dataset.autofocus;
    if (target) setTimeout(() => $(target)?.focus(), 60);
    w.el.dispatchEvent(new CustomEvent("win:open"));
  }

  function focusWin(id) {
    const w = wins.get(id);
    if (!w || w.el.dataset.open !== "true") return;
    w.el.dataset.min = "false";
    w.el.style.zIndex = String(++z);
    activeId = id;
    wins.forEach((o, oid) => { o.el.dataset.active = String(oid === id); });
    renderTasklist();
  }

  // When a window that held keyboard focus goes away, hand focus to the
  // next window's taskbar button rather than dropping it on <body>.
  function rehome(hadFocus, nextId) {
    if (!hadFocus) return;
    const target = nextId
      ? document.querySelector(`.taskitem[data-for="${nextId}"]`)
      : document.getElementById("start-btn");
    target?.focus();
  }

  function closeWin(id) {
    const w = wins.get(id);
    if (!w) return;
    const hadFocus = w.el.contains(document.activeElement);
    w.el.dataset.open = "false";
    w.el.dataset.min = "false";
    w.el.dataset.active = "false";
    if (activeId === id) {
      activeId = null;
      // Hand focus to the topmost remaining window
      let top = null, topZ = -1;
      wins.forEach((o, oid) => {
        if (o.el.dataset.open === "true" && o.el.dataset.min !== "true") {
          const oz = Number(o.el.style.zIndex || 0);
          if (oz > topZ) { topZ = oz; top = oid; }
        }
      });
      if (top) focusWin(top);
      renderTasklist();
      rehome(hadFocus, top);
      announce(`${w.title} closed`);
      return;
    }
    renderTasklist();
    rehome(hadFocus, null);
    announce(`${w.title} closed`);
  }

  function minimise(id) {
    const w = wins.get(id);
    if (!w) return;
    const hadFocus = w.el.contains(document.activeElement);
    w.el.dataset.min = "true";
    w.el.dataset.active = "false";
    if (activeId === id) activeId = null;
    renderTasklist();
    // Keep focus on this window's own taskbar button so it can be restored
    if (hadFocus) document.querySelector(`.taskitem[data-for="${id}"]`)?.focus();
    announce(`${w.title} minimised`);
  }

  const restore = (id) => { wins.get(id).el.dataset.min = "false"; focusWin(id); };

  function toggleMax(id) {
    const w = wins.get(id);
    if (!w) return;
    const on = w.el.dataset.max === "true";
    w.el.dataset.max = String(!on);
    w.el.querySelector(".max")?.setAttribute("aria-pressed", String(!on));
    focusWin(id);
    w.el.dispatchEvent(new CustomEvent("win:resize"));
  }

  // Wire up window chrome
  wins.forEach((w, id) => {
    w.el.addEventListener("pointerdown", () => { if (activeId !== id) focusWin(id); }, true);

    $(".min", w.el)?.addEventListener("click", (e) => { e.stopPropagation(); minimise(id); });
    $(".max", w.el)?.addEventListener("click", (e) => { e.stopPropagation(); toggleMax(id); });
    $(".close", w.el)?.addEventListener("click", (e) => { e.stopPropagation(); closeWin(id); });

    // Double-click the title bar to maximise, like a real desktop
    const bar = $(".titlebar", w.el);
    bar?.addEventListener("dblclick", (e) => {
      if (e.target.closest("button") || isPhone()) return;
      toggleMax(id);
    });

    /* --- Drag --- */
    if (bar) {
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button") || isPhone() || w.el.dataset.max === "true") return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        ox = w.el.offsetLeft; oy = w.el.offsetTop;
        bar.setPointerCapture(e.pointerId);
      });

      bar.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const rect = w.el.getBoundingClientRect();
        // Always leave a grabbable strip on screen so a window can't be lost
        const minLeft = 80 - rect.width;
        const maxLeft = innerWidth - 80;
        const maxTop = innerHeight - TASKBAR - 24;
        w.el.style.left = Math.min(maxLeft, Math.max(minLeft, ox + e.clientX - sx)) + "px";
        w.el.style.top = Math.min(maxTop, Math.max(0, oy + e.clientY - sy)) + "px";
      });

      const stopDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        if (bar.hasPointerCapture?.(e.pointerId)) bar.releasePointerCapture(e.pointerId);
      };
      bar.addEventListener("pointerup", stopDrag);
      bar.addEventListener("pointercancel", stopDrag);
    }

    /* --- Resize --- */
    const handle = $(".resize-handle", w.el);
    if (handle) {
      let sizing = false, sx = 0, sy = 0, sw = 0, sh = 0;

      handle.addEventListener("pointerdown", (e) => {
        if (isPhone()) return;
        e.stopPropagation();
        sizing = true;
        const r = w.el.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY; sw = r.width; sh = r.height;
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener("pointermove", (e) => {
        if (!sizing) return;
        w.el.style.width = Math.max(300, Math.min(innerWidth - 20, sw + e.clientX - sx)) + "px";
        w.el.style.height = Math.max(200, Math.min(innerHeight - TASKBAR - 20, sh + e.clientY - sy)) + "px";
        w.el.dispatchEvent(new CustomEvent("win:resize"));
      });

      const stopSize = (e) => {
        if (!sizing) return;
        sizing = false;
        if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      };
      handle.addEventListener("pointerup", stopSize);
      handle.addEventListener("pointercancel", stopSize);
    }
  });

  // Pull windows back on screen after a viewport change
  addEventListener("resize", () => {
    if (isPhone()) return;
    wins.forEach((w) => {
      if (w.el.dataset.open !== "true") return;
      const r = w.el.getBoundingClientRect();
      if (r.left > innerWidth - 80) w.el.style.left = Math.max(12, innerWidth - r.width - 12) + "px";
      if (r.top > innerHeight - TASKBAR - 24) {
        w.el.style.top = Math.max(0, innerHeight - TASKBAR - r.height - 12) + "px";
      }
    });
  });

  /* =====================================================================
     3. Taskbar + start menu
     ===================================================================== */

  $$("[data-open-app]").forEach((el) => {
    el.addEventListener("click", () => {
      openWin(el.dataset.openApp);
      setStart(false);
    });
  });

  const startBtn = $("#start-btn");
  const startMenu = $("#start-menu");

  function setStart(open) {
    if (!startBtn || !startMenu) return;
    startBtn.setAttribute("aria-expanded", String(open));
    startMenu.dataset.open = String(open);
    if (open) $(".start-list button", startMenu)?.focus();
  }

  startBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setStart(startBtn.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("pointerdown", (e) => {
    if (startMenu?.dataset.open !== "true") return;
    if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) setStart(false);
  });

  /* =====================================================================
     4. Clock
     ===================================================================== */

  const elTime = $("#clock-time");
  const elDate = $("#clock-date");

  function tick() {
    const now = new Date();
    if (elTime) {
      elTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      elTime.setAttribute("datetime", now.toISOString());
    }
    if (elDate) {
      elDate.textContent = now.toLocaleDateString([], { day: "2-digit", month: "short" });
    }
  }
  tick();
  setInterval(tick, 10000);

  /* =====================================================================
     5. Paint
     ===================================================================== */

  const paint = $("#paint");
  if (paint) {
    const ctx = paint.getContext("2d", { willReadFrequently: false });
    const win = $("#app-paint");
    let drawing = false, tool = "brush", size = 6, color = "#a855f7";
    const undoStack = [];

    /* The original bug: CSS gave the canvas a display size but the bitmap
       stayed at the 300x150 default, so strokes landed in the wrong place.
       Size the bitmap to the element's real box, times device pixel ratio. */
    function resize() {
      const r = paint.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (paint.width === w && paint.height === h) return;

      const prev = paint.width ? ctx.getImageData(0, 0, paint.width, paint.height) : null;
      paint.width = w;
      paint.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = ctx.lineCap = "round";
      if (prev) {
        const tmp = document.createElement("canvas");
        tmp.width = prev.width; tmp.height = prev.height;
        tmp.getContext("2d").putImageData(prev, 0, 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(tmp, 0, 0);
        ctx.restore();
      }
    }

    const pos = (e) => {
      const r = paint.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    function pushUndo() {
      try {
        undoStack.push(ctx.getImageData(0, 0, paint.width, paint.height));
        if (undoStack.length > 12) undoStack.shift();
      } catch { /* tainted canvas: nothing to do */ }
    }

    paint.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      paint.setPointerCapture(e.pointerId);
      pushUndo();
      drawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // A single tap should leave a dot
      ctx.lineTo(p.x + 0.01, p.y);
      stroke();
    });

    paint.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });

    function stroke() {
      ctx.lineWidth = tool === "eraser" ? size * 2.4 : size;
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.stroke();
    }

    const stop = (e) => {
      if (!drawing) return;
      drawing = false;
      ctx.beginPath();
      if (paint.hasPointerCapture?.(e.pointerId)) paint.releasePointerCapture(e.pointerId);
    };
    paint.addEventListener("pointerup", stop);
    paint.addEventListener("pointercancel", stop);
    paint.addEventListener("pointerleave", stop);

    $("#paint-color")?.addEventListener("input", (e) => {
      color = e.target.value;
      setTool("brush");
    });
    $("#paint-size")?.addEventListener("input", (e) => {
      size = Number(e.target.value);
      $("#paint-size-out").textContent = size + "px";
    });

    function setTool(t) {
      tool = t;
      $("#tool-brush")?.setAttribute("aria-pressed", String(t === "brush"));
      $("#tool-eraser")?.setAttribute("aria-pressed", String(t === "eraser"));
    }
    $("#tool-brush")?.addEventListener("click", () => setTool("brush"));
    $("#tool-eraser")?.addEventListener("click", () => setTool("eraser"));

    $("#paint-undo")?.addEventListener("click", () => {
      const last = undoStack.pop();
      if (!last) { announce("Nothing to undo"); return; }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(last, 0, 0);
      ctx.restore();
    });

    $("#paint-clear")?.addEventListener("click", () => {
      pushUndo();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, paint.width, paint.height);
      ctx.restore();
    });

    $("#paint-save")?.addEventListener("click", () => {
      // Flatten onto white so transparent areas don't export black
      const out = document.createElement("canvas");
      out.width = paint.width; out.height = paint.height;
      const octx = out.getContext("2d");
      octx.fillStyle = "#fff";
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(paint, 0, 0);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = "kryptpaint.png";
      a.click();
    });

    win?.addEventListener("win:open", resize);
    win?.addEventListener("win:resize", resize);
    addEventListener("resize", resize);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(paint);
  }

  /* =====================================================================
     6. Calculator — tokenise, convert to RPN, evaluate.
        No eval(), so a stray keystroke can never run code.
     ===================================================================== */

  const calcOut = $("#calc-out");
  const calcExpr = $("#calc-expr");

  if (calcOut) {
    let expr = "";

    const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3 };

    function tokenise(src) {
      const out = [];
      let i = 0;
      while (i < src.length) {
        const c = src[i];
        if (c === " ") { i++; continue; }
        if (/[0-9.]/.test(c)) {
          let n = "";
          while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
          if ((n.match(/\./g) || []).length > 1) throw new Error("Too many decimal points");
          out.push({ t: "num", v: parseFloat(n) });
          continue;
        }
        if ("+-*/()%".includes(c)) { out.push({ t: c }); i++; continue; }
        throw new Error(`Unexpected character "${c}"`);
      }
      return out;
    }

    function toRpn(tokens) {
      const out = [], ops = [];
      let prev = null;

      for (const tk of tokens) {
        if (tk.t === "num") { out.push(tk); }
        else if (tk.t === "%") {
          // Postfix: 50% -> 0.5
          out.push({ t: "num", v: 100 });
          out.push({ t: "/" });
        }
        else if (tk.t === "(") { ops.push(tk); }
        else if (tk.t === ")") {
          while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop());
          if (!ops.length) throw new Error("Unmatched )");
          ops.pop();
        }
        else {
          // Unary minus when there is no value to the left
          const unary = tk.t === "-" &&
            (prev === null || prev.t === "(" || "+-*/".includes(prev.t));
          const op = unary ? { t: "u-" } : tk;
          while (
            ops.length &&
            ops[ops.length - 1].t !== "(" &&
            PREC[ops[ops.length - 1].t] >= PREC[op.t] &&
            op.t !== "u-"
          ) out.push(ops.pop());
          ops.push(op);
        }
        prev = tk;
      }

      while (ops.length) {
        const op = ops.pop();
        if (op.t === "(") throw new Error("Unmatched (");
        out.push(op);
      }
      return out;
    }

    function evalRpn(rpn) {
      const st = [];
      for (const tk of rpn) {
        if (tk.t === "num") { st.push(tk.v); continue; }
        if (tk.t === "u-") {
          if (!st.length) throw new Error("Incomplete expression");
          st.push(-st.pop());
          continue;
        }
        const b = st.pop(), a = st.pop();
        if (a === undefined || b === undefined) throw new Error("Incomplete expression");
        if (tk.t === "+") st.push(a + b);
        else if (tk.t === "-") st.push(a - b);
        else if (tk.t === "*") st.push(a * b);
        else if (tk.t === "/") {
          if (b === 0) throw new Error("Can't divide by zero");
          st.push(a / b);
        }
      }
      if (st.length !== 1) throw new Error("Incomplete expression");
      return st[0];
    }

    const format = (n) => {
      if (!Number.isFinite(n)) throw new Error("Result is out of range");
      const mag = Math.abs(n);
      // Rounding via *1e10 overflows past ~1e298, and tiny values round to 0
      if (mag >= 1e15 || (mag > 0 && mag < 1e-9)) return n.toExponential(6);
      return String(Math.round(n * 1e10) / 1e10);
    };

    const pretty = (s) => s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");

    function render(result, isError) {
      calcExpr.textContent = pretty(expr) || "\u00a0";
      calcOut.textContent = result;
      calcOut.dataset.error = String(Boolean(isError));
    }

    function compute(final) {
      if (!expr.trim()) { render("0", false); return; }
      try {
        render(format(evalRpn(toRpn(tokenise(expr)))), false);
      } catch (err) {
        // While typing, a half-finished sum isn't an error worth shouting about
        if (final) render(err.message, true);
        else render("…", false);
      }
    }

    function press(key) {
      if (key === "C") { expr = ""; render("0", false); return; }
      if (key === "back") { expr = expr.slice(0, -1); compute(false); return; }
      if (key === "=") {
        try {
          const v = format(evalRpn(toRpn(tokenise(expr))));
          // Exponential results can't be re-parsed, so start fresh instead
          expr = /^-?[0-9.]+$/.test(v) ? v : "";
          render(v, false);
        } catch (err) { render(err.message, true); }
        return;
      }
      expr += key;
      compute(false);
    }

    $$("[data-key]").forEach((b) => b.addEventListener("click", () => press(b.dataset.key)));

    // Keyboard works as soon as the calculator is the active window,
    // without stealing keystrokes from the terminal or any text field.
    document.addEventListener("keydown", (e) => {
      if (activeId !== "app-calc") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (/^[0-9.]$/.test(k) || "+-*/()%".includes(k)) { press(k); e.preventDefault(); }
      else if (k === "Enter" || k === "=") { press("="); e.preventDefault(); }
      else if (k === "Backspace") { press("back"); e.preventDefault(); }
      else if (k === "Delete" || k === "c" || k === "C") { press("C"); e.preventDefault(); }
    });

    render("0", false);
  }

  /* =====================================================================
     7. Terminal — a real REPL, not a canned animation
     ===================================================================== */

  const termOut = $("#term-out");
  const termIn = $("#term-input");

  if (termOut && termIn) {
    const esc = (s) => String(s).replace(/[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const write = (html = "") => {
      const p = document.createElement("p");
      p.innerHTML = html;
      termOut.appendChild(p);
      termOut.scrollTop = termOut.scrollHeight;
    };

    const FILES = {
      "about.txt":
        "Ali Saleh — 18, Lebanese-Kuwaiti, based in Kuwait.\n" +
        "Computer engineering student at AASU, class of 2030.\n" +
        "I build horror games in Unity, C# software, and this desktop.",
      "stack.txt":
        "Languages   C#, C++, Python\n" +
        "Engines     Unity, .NET\n" +
        "Creative    After Effects, Filmora, Pixlr, Audacity, Soundtrap\n" +
        "Ops         Ubuntu 22.04 / 24.04 LTS server hosting",
      "awards.txt":
        "1st place — Kuwait Science Award\n" +
        "11 certificates from HP LIFE, Coursera and typing programmes",
      "contact.txt":
        "Email    dsremixes5@gmail.com\nDiscord  G9ES\nCommunity  discord.gg/ExMbGbcszn",
    };

    const APPS = {
      files: "app-files", degrees: "app-files", certs: "app-files",
      skills: "app-skills", games: "app-games", gallery: "app-gallery",
      projects: "app-gallery", contact: "app-contact", paint: "app-paint",
      calc: "app-calc", calculator: "app-calc", terminal: "app-term",
    };

    const COMMANDS = {
      help() {
        write('<span class="sys">Available commands</span>');
        const rows = [
          ["help", "this list"],
          ["whoami", "who runs this machine"],
          ["about", "short bio"],
          ["skills", "what I work with"],
          ["games", "published games"],
          ["certs", "awards and certificates"],
          ["contact", "how to reach me"],
          ["ls", "list files"],
          ["cat <file>", "print a file"],
          ["open <app>", "launch a desktop app"],
          ["neofetch", "system info"],
          ["date", "current date and time"],
          ["echo <text>", "print text"],
          ["history", "commands this session"],
          ["clear", "clear the screen"],
          ["exit", "leave KryptOS"],
        ];
        rows.forEach(([c, d]) =>
          write(`  <span class="hi">${esc(c.padEnd(13))}</span><span class="dim">${esc(d)}</span>`));
        write('<span class="dim">Tip: ↑ / ↓ for history, Tab to complete.</span>');
      },

      whoami() {
        write('<span class="hi">Ali Saleh</span> <span class="dim">(EG-KRYPT)</span>');
        write("Computer engineer, software and game developer.");
      },

      about() { write(esc(FILES["about.txt"])); },

      skills() {
        write('<span class="sys">Programming</span>');
        write("  C# — 6 years, Unity and .NET, 30+ games built");
        write("  C++ — low-level work, learning Windows kernel drivers");
        write("  Python — learning, focused on AI");
        write('<span class="sys">Creative</span>');
        write("  After Effects (2D and 3D via Element), Filmora");
        write("  Audio design in After Effects, Soundtrap, Audacity");
        write("  Image editing in Pixlr, UI/UX and colour");
        write('<span class="sys">Ops</span>');
        write("  Ubuntu 22.04 and 24.04 LTS server hosting, Discord server design");
        write('<span class="warn">Learning next: Blender, Photoshop, Illustrator</span>');
      },

      games() {
        write('<span class="sys">Published on itch.io</span>');
        write('  The Asylum  <span class="dim">puzzle horror</span>   <a href="https://alawyds.itch.io/the-asylum" target="_blank" rel="noopener noreferrer">open</a>');
        write('  Chasers     <span class="dim">meme horror</span>     <a href="https://alawyds.itch.io/chasers" target="_blank" rel="noopener noreferrer">open</a>');
        write('  Backrooms   <span class="dim">survival horror</span> <a href="https://alawyds.itch.io/backrooms" target="_blank" rel="noopener noreferrer">open</a>');
        write('<span class="warn">In development: HUSH. — first Steam release</span>');
      },

      certs() {
        write(esc(FILES["awards.txt"]));
        write('<span class="dim">Run "open certs" to browse the PDFs.</span>');
      },

      contact() {
        write('Email    <a href="mailto:dsremixes5@gmail.com">dsremixes5@gmail.com</a>');
        write("Discord  G9ES");
        write('Server   <a href="https://discord.gg/ExMbGbcszn" target="_blank" rel="noopener noreferrer">discord.gg/ExMbGbcszn</a>');
      },

      ls() {
        Object.keys(FILES).forEach((f) => write(`  <span class="hi">${esc(f)}</span>`));
        write('  <span class="dim">Degrees/</span>');
      },

      cat(args) {
        const name = args[0];
        if (!name) { write('<span class="err">cat: give me a file name. Try "ls".</span>'); return; }
        if (FILES[name]) { write(esc(FILES[name])); return; }
        write(`<span class="err">cat: ${esc(name)}: no such file</span>`);
      },

      open(args) {
        const name = (args[0] || "").toLowerCase();
        if (!name) {
          write('<span class="err">open: which app? ' + esc(Object.keys(APPS).join(", ")) + "</span>");
          return;
        }
        const id = APPS[name];
        if (!id) { write(`<span class="err">open: unknown app "${esc(name)}"</span>`); return; }
        openWin(id);
        write(`<span class="sys">Launching ${esc(wins.get(id).title)}…</span>`);
      },

      neofetch() {
        const lines = [
          "        ██   ██        ",
          "        ██  ██         ",
          "        ██ ██          ",
          "        ████           ",
          "        ██ ██          ",
          "        ██  ██         ",
          "        ██   ██        ",
        ];
        const info = [
          ["OS", "KryptOS 2.0 (browser)"],
          ["Host", "kryptdev.me"],
          ["Shell", "kshell"],
          ["Resolution", `${innerWidth}x${innerHeight}`],
          ["Engine", navigator.userAgent.includes("Firefox") ? "Gecko"
                    : navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "WebKit"
                    : "Blink"],
          ["Language", navigator.language],
          ["Uptime", `${Math.round(performance.now() / 1000)}s`],
        ];
        const rows = Math.max(lines.length, info.length + 1);
        for (let i = 0; i < rows; i++) {
          const art = `<span class="sys">${esc((lines[i] || "").padEnd(23))}</span>`;
          if (i === 0) { write(art + '<span class="hi">ali@kryptos</span>'); continue; }
          const pair = info[i - 1];
          write(art + (pair ? `<span class="hi">${esc(pair[0])}</span>: ${esc(pair[1])}` : ""));
        }
      },

      date() { write(esc(new Date().toString())); },

      echo(args) { write(esc(args.join(" "))); },

      history() {
        hist.forEach((h, i) => write(`  <span class="dim">${String(i + 1).padStart(3)}</span>  ${esc(h)}`));
      },

      clear() { termOut.textContent = ""; },

      exit() {
        write('<span class="warn">Logging off…</span>');
        setTimeout(() => { location.href = "index.html"; }, 500);
      },

      sudo(args) {
        write(`<span class="warn">Nice try. ${esc(args.join(" ") || "…")}</span>`);
        write('<span class="dim">ali is not in the sudoers file. This incident has been reported.</span>');
      },
    };

    const ALIASES = { man: "help", "?": "help", dir: "ls", cls: "clear", quit: "exit", logout: "exit", info: "about" };

    const hist = [];
    let histPos = -1;

    function run(raw) {
      const line = raw.trim();
      write(`<span class="sys">ali@kryptos</span>:<span class="dim">~</span>$ ${esc(raw)}`);
      if (!line) return;

      hist.push(line);
      histPos = hist.length;

      const [head, ...args] = line.split(/\s+/);
      const name = ALIASES[head.toLowerCase()] || head.toLowerCase();
      const fn = COMMANDS[name];

      if (!fn) {
        write(`<span class="err">kshell: ${esc(head)}: command not found</span>`);
        const guess = Object.keys(COMMANDS).find((c) => c.startsWith(head.toLowerCase()[0]));
        if (guess) write(`<span class="dim">Did you mean "${esc(guess)}"? Type "help" for the list.</span>`);
        return;
      }
      try { fn(args); } catch (err) { write(`<span class="err">${esc(err.message)}</span>`); }
    }

    termIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const v = termIn.value;
        termIn.value = "";
        run(v);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        if (!hist.length) return;
        histPos = Math.max(0, histPos - 1);
        termIn.value = hist[histPos] ?? "";
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        if (!hist.length) return;
        histPos = Math.min(hist.length, histPos + 1);
        termIn.value = hist[histPos] ?? "";
        e.preventDefault();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const part = termIn.value.trim().toLowerCase();
        if (!part) return;
        const hits = Object.keys(COMMANDS).filter((c) => c.startsWith(part));
        if (hits.length === 1) termIn.value = hits[0] + " ";
        else if (hits.length > 1) write('<span class="dim">' + esc(hits.join("  ")) + "</span>");
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        COMMANDS.clear();
      }
    });

    // Clicking anywhere in the output puts the caret back in the prompt
    termOut.addEventListener("click", (e) => {
      if (!e.target.closest("a") && !getSelection().toString()) termIn.focus();
    });

    write('<span class="hi">KryptOS kshell</span> <span class="dim">2.0</span>');
    write('<span class="dim">Type "help" to see what this thing can do.</span>');
    write("");
  }

  /* =====================================================================
     8. Gallery lightbox
     ===================================================================== */

  const lb = $("#lightbox");
  if (lb) {
    const lbImg = $("#lb-img");
    const lbCap = $("#lb-cap");
    let returnTo = null;

    $$("[data-shot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        returnTo = btn;
        lbImg.src = btn.dataset.shot;
        lbImg.alt = btn.dataset.alt || "";
        lbCap.textContent = btn.dataset.cap || "";
        lb.dataset.open = "true";
        $("#lb-close").focus();
      });
    });

    const closeLb = () => {
      lb.dataset.open = "false";
      lbImg.removeAttribute("src");
      returnTo?.focus();
    };

    $("#lb-close").addEventListener("click", closeLb);
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.dataset.open === "true") { e.stopPropagation(); closeLb(); }
    });
  }

  /* =====================================================================
     9. Copy buttons + global keys
     ===================================================================== */

  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.dataset.copied = "true";
        announce("Copied to clipboard");
        setTimeout(() => btn.removeAttribute("data-copied"), 1800);
      } catch {
        announce("Copy failed — select the text instead");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (lb?.dataset.open === "true") return;              // lightbox handles its own
    if (startMenu?.dataset.open === "true") { setStart(false); return; }
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      document.activeElement.blur();
      return;
    }
    if (activeId) closeWin(activeId);
  });

  // Open the file explorer on first load so the desktop isn't a dead end
  setTimeout(() => {
    if (!activeId && !isPhone()) openWin("app-files");
  }, reduceMotion ? 300 : 2100);
})();
