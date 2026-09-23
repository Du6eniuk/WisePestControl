/* ==========================================================================
   Wise Pest Control — interactions
   Mobile menu, sticky-header state, active nav link, scroll reveal,
   the live barrier scene in the hero, mobile call bar, plan picker, quote form.
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Fonts ready: lets the headline highlighter draw itself in ---------- */
  const ready = () => root.classList.add("is-ready");
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready);
  setTimeout(ready, 1200);

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  const setNav = (open) => {
    root.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  if (toggle && nav) {
    toggle.addEventListener("click", () => setNav(!root.classList.contains("nav-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.classList.contains("nav-open")) { setNav(false); toggle.focus(); }
    });
    matchMedia("(min-width: 1080px)").addEventListener("change", (e) => { if (e.matches) setNav(false); });
  }

  /* ---------- Header shadow once the page scrolls ---------- */
  const header = document.querySelector("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Active nav link + scroll reveal ---------- */
  const reveals = document.querySelectorAll("[data-reveal]");

  // Once revealed, drop the attribute so the element's own hover transitions take over again.
  const settle = (el) => {
    const done = () => { el.removeAttribute("data-reveal"); el.classList.remove("is-visible"); };
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 1500);
  };

  if ("IntersectionObserver" in window) {
    const links = [...document.querySelectorAll('.nav__list a[href^="#"]')];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a.hash === "#" + entry.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => { const s = document.querySelector(a.hash); if (s) spy.observe(s); });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        settle(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.removeAttribute("data-reveal"));
  }

  /* ---------- Hero scene: the barrier, live ----------
     The lawn and the barrier are circles on the ground plane, drawn squashed by K.
     Ants walk in ground units toward the house and U-turn at the barrier. Mosquitoes
     fly in screen units and bounce off the dome, leaving a ripple. */
  const scene = document.querySelector("[data-scene]");

  if (scene && !reduceMotion && "requestAnimationFrame" in window) {
    const svg = scene.querySelector("svg");
    const NS = "http://www.w3.org/2000/svg";
    const layer = (name) => svg.querySelector(`[data-layer="${name}"]`);
    const back = layer("back"), front = layer("front"), air = layer("air"), ripples = layer("ripples"), sparks = layer("sparks");
    const countEl = scene.querySelector("[data-count]");
    const countLabel = scene.querySelector("[data-count-label]");

    const CX = 320, CY = 380, K = 0.42;       // lawn centre and ground squash
    const R_BARRIER = 160, R_TURN = 171, R_EDGE = 292, R_LAWN = 300;
    const DOME_R = 160;                        // radius of the dome's outline
    const SQUASH = 0.62;                       // how flat an ant looks on the ground
    let ANT_SIZE = 1.2, MOSQ_SIZE = 1.35;      // bugs get a little bigger when the scene is small
    const fit = () => {
      const small = svg.clientWidth < 480;
      ANT_SIZE = small ? 1.45 : 1.2;
      MOSQ_SIZE = small ? 1.6 : 1.35;
    };
    fit();
    window.addEventListener("resize", fit, { passive: true });
    const MAX_ANTS = 28, AMBIENT_ANTS = 11, MAX_MOSQ = 2;

    const rand = (a, b) => a + Math.random() * (b - a);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const turnToward = (h, target, maxStep) => {
      const d = wrap(target - h);
      return h + Math.max(-maxStep, Math.min(maxStep, d));
    };

    const ants = [];
    const mosqs = [];
    let count = 0;
    let warm = false;       // true while fast-forwarding the opening frame
    let bumpTimer = 0;
    let hitTimer = 0;

    const addCount = () => {
      if (warm) return;
      count += 1;
      countEl.textContent = count.toLocaleString("en-US");
      countLabel.textContent = count === 1 ? "bug" : "bugs";
      countEl.classList.add("bump");
      clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => countEl.classList.remove("bump"), 160);
    };

    const fadeOut = (el, ms, delay = 0) => {
      const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, delay, easing: "ease-out", fill: "forwards" });
      anim.onfinish = () => el.remove();
    };

    // A short glowing stretch of the barrier line where an ant turned back.
    const spark = (angle, behind) => {
      const pts = [];
      for (let i = -3; i <= 3; i++) {
        const a = angle + i * 0.045;
        pts.push(`${(CX + Math.cos(a) * R_BARRIER).toFixed(1)} ${(CY + Math.sin(a) * R_BARRIER * K).toFixed(1)}`);
      }
      const p = document.createElementNS(NS, "polyline");
      p.setAttribute("points", pts.join(" "));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "#FFC43D");
      p.setAttribute("stroke-width", "4.5");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      (behind ? back : sparks).appendChild(p);
      fadeOut(p, 700, 120);
    };

    const ripple = (x, y) => {
      [[0, 46, 3], [130, 28, 2]].forEach(([delay, r, w]) => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", x.toFixed(1));
        c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("r", r);
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", "#fff");
        c.setAttribute("stroke-width", w);
        c.setAttribute("vector-effect", "non-scaling-stroke");
        c.style.transformBox = "fill-box";
        c.style.transformOrigin = "center";
        ripples.appendChild(c);
        const anim = c.animate(
          [{ transform: "scale(.15)", opacity: 1 }, { transform: "scale(1)", opacity: 0 }],
          { duration: 800, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }
        );
        anim.onfinish = () => c.remove();
      });
      const glow = document.createElementNS(NS, "circle");
      glow.setAttribute("cx", x.toFixed(1));
      glow.setAttribute("cy", y.toFixed(1));
      glow.setAttribute("r", "16");
      glow.setAttribute("fill", "#fff");
      glow.setAttribute("opacity", ".55");
      ripples.appendChild(glow);
      fadeOut(glow, 500);
      scene.classList.add("is-hit");
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => scene.classList.remove("is-hit"), 180);
    };

    /* Ants */
    const spawnAnt = (gx, gz, heading, opts = {}) => {
      if (ants.length >= MAX_ANTS) return;
      const el = document.createElementNS(NS, "use");
      el.setAttribute("href", "#ant-a");
      ants.push({
        el, gx, gz, h: heading, parent: null,
        speed: opts.speed || rand(24, 34),
        state: "in", t: 0, wob: rand(0, 6.28), legs: 0, pose: 0,
        turnDir: 1, turned: 0, fadeIn: opts.fadeIn ?? 0.45, gone: false,
      });
    };

    const spawnFromEdge = () => {
      // mostly from the sides and the front, where you can see them coming
      const a = rand(-0.45, Math.PI + 0.45);
      const gx = Math.cos(a) * R_EDGE, gz = Math.sin(a) * R_EDGE;
      spawnAnt(gx, gz, Math.atan2(-gz, -gx) + rand(-0.35, 0.35));
    };

    const updateAnt = (ant, dt) => {
      ant.t += dt;
      const r = Math.hypot(ant.gx, ant.gz);

      if (ant.state === "in") {
        const want = Math.atan2(-ant.gz, -ant.gx) + Math.sin(ant.t * 2.2 + ant.wob) * 0.38;
        ant.h = turnToward(ant.h, want, 2.4 * dt);
        if (r <= R_TURN) {
          ant.state = "turn";
          ant.turnDir = Math.random() < 0.5 ? -1 : 1;
          ant.turned = 0;
          addCount();
          if (!warm) spark(Math.atan2(ant.gz, ant.gx), ant.gz < 0);
        }
      } else if (ant.state === "turn") {
        const w = Math.PI / 0.75;
        ant.h += ant.turnDir * w * dt;
        ant.turned += w * dt;
        if (ant.turned >= Math.PI * 0.92) ant.state = "out";
      } else {
        const want = Math.atan2(ant.gz, ant.gx) + Math.sin(ant.t * 1.8 + ant.wob) * 0.45;
        ant.h = turnToward(ant.h, want, 1.3 * dt);
        if (r > R_EDGE + 6) ant.gone = true;
      }

      const v = ant.state === "turn" ? ant.speed * 0.35 : ant.speed;
      ant.gx += Math.cos(ant.h) * v * dt;
      ant.gz += Math.sin(ant.h) * v * dt;

      // nobody gets through the barrier
      const r2 = Math.hypot(ant.gx, ant.gz);
      if (r2 < R_BARRIER + 5) {
        const s = (R_BARRIER + 5) / r2;
        ant.gx *= s;
        ant.gz *= s;
      }

      // six little legs
      ant.legs += v * dt;
      if (ant.legs > 3) {
        ant.legs = 0;
        ant.pose ^= 1;
        ant.el.setAttribute("href", ant.pose ? "#ant-b" : "#ant-a");
      }
    };

    const drawAnt = (ant) => {
      const sx = CX + ant.gx, sy = CY + ant.gz * K;
      const depth = ANT_SIZE * (0.84 + 0.28 * ((ant.gz + R_LAWN) / (2 * R_LAWN)));
      const edge = Math.min(1, Math.max(0, (R_EDGE + 6 - Math.hypot(ant.gx, ant.gz)) / 22));
      const fade = ant.fadeIn > 0 ? Math.min(1, ant.t / ant.fadeIn) : 1;
      const alpha = fade * (ant.state === "out" ? edge : 1);
      ant.el.setAttribute("transform",
        `translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${depth.toFixed(3)} ${(depth * SQUASH).toFixed(3)}) rotate(${(ant.h * 57.2958).toFixed(1)})`);
      ant.el.setAttribute("opacity", alpha.toFixed(2));
      const want = ant.gz < 0 ? back : front;
      if (ant.parent !== want) { want.appendChild(ant.el); ant.parent = want; }
    };

    /* Mosquitoes */
    const spawnMosq = (x, y, target) => {
      if (mosqs.length >= MAX_MOSQ + 2) return;
      const left = x < CX;
      const a = target ?? (left ? rand(-2.9, -1.9) : rand(-1.25, -0.25));
      const tx = CX + Math.cos(a) * DOME_R, ty = CY + Math.sin(a) * DOME_R;
      const d = Math.hypot(tx - x, ty - y) || 1;
      const speed = rand(62, 82);
      const el = document.createElementNS(NS, "use");
      el.setAttribute("href", "#mosq-a");
      air.appendChild(el);
      mosqs.push({ el, x, y, vx: (tx - x) / d * speed, vy: (ty - y) / d * speed, t: 0, wob: rand(0, 6.28), flap: 0, pose: 0, state: "in", gone: false });
    };

    const spawnMosqFromSide = () => {
      const left = Math.random() < 0.5;
      spawnMosq(left ? -24 : 664, rand(50, 230));
    };

    const updateMosq = (m, dt) => {
      m.t += dt;
      const sp = Math.hypot(m.vx, m.vy) || 1;
      const wob = Math.sin(m.t * 7.5 + m.wob) * 30 + Math.sin(m.t * 3.1 + m.wob * 2) * 14;
      m.x += (m.vx + (-m.vy / sp) * wob) * dt;
      m.y += (m.vy + (m.vx / sp) * wob) * dt;

      if (m.state === "in") {
        const dx = m.x - CX, dy = m.y - CY, dist = Math.hypot(dx, dy);
        if (dy < 0 && dist <= DOME_R + 3) {
          const nx = dx / dist, ny = dy / dist;
          ripple(CX + nx * DOME_R, CY + ny * DOME_R);
          const dot = m.vx * nx + m.vy * ny;
          m.vx = (m.vx - 2 * dot * nx) * 1.15 + nx * 30;
          m.vy = (m.vy - 2 * dot * ny) * 1.15 + ny * 30 - 20;
          m.x = CX + nx * (DOME_R + 5);
          m.y = CY + ny * (DOME_R + 5);
          m.state = "out";
          addCount();
        }
      } else {
        m.vy -= 14 * dt;
      }
      if (m.x < -40 || m.x > 680 || m.y < -40 || m.y > 560 || m.t > 14) m.gone = true;

      m.flap += dt;
      if (m.flap > 0.045) { m.flap = 0; m.pose ^= 1; m.el.setAttribute("href", m.pose ? "#mosq-b" : "#mosq-a"); }
    };

    const drawMosq = (m) => {
      const facing = m.vx >= 0 ? 1 : -1;
      const tilt = Math.max(-35, Math.min(35, Math.atan2(m.vy, Math.abs(m.vx)) * 57.2958));
      const s = MOSQ_SIZE;
      m.el.setAttribute("transform", `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${facing * s} ${s}) rotate(${tilt.toFixed(1)})`);
    };

    /* Taps and clicks: ants on the lawn, a mosquito in the sky, a ripple on the dome */
    const toSvg = (e) => {
      const p = svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    };

    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const { x, y } = toSvg(e);
      const gx = x - CX, gz = (y - CY) / K, r = Math.hypot(gx, gz);
      const onDome = y < CY ? Math.hypot(x - CX, y - CY) < DOME_R : r < R_BARRIER;
      scene.classList.add("is-played");

      if (onDome) {
        ripple(x, y);
      } else if (r <= R_LAWN) {
        // a little squad, single file, starting where you tapped
        const a = Math.atan2(gz, gx);
        const rr = Math.min(Math.max(r, R_TURN + 30), R_EDGE - 50);
        for (let i = 0; i < 4; i++) {
          const d = rr + i * 16;
          spawnAnt(Math.cos(a) * d + rand(-8, 8), Math.sin(a) * d + rand(-8, 8),
            a + Math.PI + rand(-0.2, 0.2), { speed: rand(30, 38), fadeIn: 0.2 });
        }
      } else if (y < CY) {
        spawnMosq(x, y, Math.atan2(y - CY, x - CX));
      }
    });

    /* Main loop */
    let running = false, raf = 0, last = 0, nextAnt = 0, nextMosq = 1.4, clock = 0;

    const step = (dt) => {
      clock += dt;
      if (clock >= nextAnt) {
        if (ants.length < AMBIENT_ANTS) spawnFromEdge();
        nextAnt = clock + rand(0.7, 1.3);
      }
      if (clock >= nextMosq) {
        if (mosqs.length < MAX_MOSQ) spawnMosqFromSide();
        nextMosq = clock + rand(3.2, 5.5);
      }
      for (let i = ants.length - 1; i >= 0; i--) {
        updateAnt(ants[i], dt);
        if (ants[i].gone) { ants[i].el.remove(); ants.splice(i, 1); }
      }
      for (let i = mosqs.length - 1; i >= 0; i--) {
        updateMosq(mosqs[i], dt);
        if (mosqs[i].gone) { mosqs[i].el.remove(); mosqs.splice(i, 1); }
      }
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      ants.forEach(drawAnt);
      mosqs.forEach(drawMosq);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    // Open on a scene already in motion: a few seconds of silent fast-forward.
    warm = true;
    for (let i = 0; i < 7; i++) spawnFromEdge();
    for (let i = 0; i < 90; i++) step(0.05);
    mosqs.forEach((m) => m.el.remove());
    mosqs.length = 0;
    nextMosq = clock + 1.2;
    warm = false;
    ants.forEach(drawAnt);
    scene.classList.add("is-live");

    let visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(scene);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else if (visible) start();
    });
  }

  /* ---------- Mobile call bar: appears once the hero buttons scroll away ---------- */
  const bar = document.querySelector(".mobile-bar");
  const heroCtas = document.querySelector(".hero__ctas");
  if (bar && heroCtas && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      const e = entries[0];
      bar.classList.toggle("is-visible", !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(heroCtas);
  } else if (bar) {
    bar.classList.add("is-visible");
  }

  /* ---------- Quote links focus the form; plan buttons pre-select the plan ---------- */
  const form = document.querySelector("[data-quote-form]");

  document.querySelectorAll('a[href="#quote"]').forEach((a) => {
    a.addEventListener("click", () => {
      if (a.dataset.plan && form) form.elements.plan.value = a.dataset.plan;
      setTimeout(() => document.getElementById("q-name")?.focus({ preventScroll: true }), 700);
    });
  });

  /* ---------- Quote form ---------- */
  const formWrap = document.querySelector("[data-quote]");
  const success = document.querySelector("[data-quote-success]");

  if (form && formWrap && success) {
    const phone = form.elements.phone;
    const zip = form.elements.zip;

    // Format US numbers as the user types: (407) 203-2072
    phone.addEventListener("input", () => {
      const d = phone.value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
      phone.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
        : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}`
        : d;
    });
    zip.addEventListener("input", () => { zip.value = zip.value.replace(/\D/g, "").slice(0, 5); });

    const rules = {
      name: (v) => v.trim().length >= 2 || "Please enter your name.",
      phone: (v) => v.replace(/\D/g, "").length === 10 || "Enter a 10-digit phone number.",
      zip: (v) => /^\d{5}$/.test(v) || "Enter a 5-digit ZIP code.",
    };

    const check = (name) => {
      const input = form.elements[name];
      const result = rules[name](input.value);
      const field = input.closest(".field");
      const ok = result === true;
      field.classList.toggle("is-invalid", !ok);
      input.setAttribute("aria-invalid", String(!ok));
      field.querySelector(".field__error").textContent = ok ? "" : result;
      return ok;
    };

    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      input.addEventListener("blur", () => { if (input.value) check(name); });
      input.addEventListener("input", () => { if (input.closest(".is-invalid")) check(name); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const invalid = Object.keys(rules).filter((name) => !check(name));
      if (invalid.length) { form.elements[invalid[0]].focus(); return; }

      // Showcase build: no backend. Hook a form service (Formspree, Web3Forms, etc.) in here.
      const data = new FormData(form);
      success.querySelector('[data-out="name"]').textContent = String(data.get("name")).trim().split(/\s+/)[0];
      success.querySelector('[data-out="phone"]').textContent = data.get("phone");
      formWrap.hidden = true;
      success.hidden = false;
      success.querySelector("button").focus();
    });

    success.querySelector("[data-quote-reset]").addEventListener("click", () => {
      form.reset();
      success.hidden = true;
      formWrap.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
