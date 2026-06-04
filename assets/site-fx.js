/* ==========================================================================
   site-fx.js — the haunted layer, wired up.
   Every module is independent and defensive: a failure in one never takes
   down another, and nothing here is required for the page to work.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const safe = (label, fn) => {
    try { fn(); } catch (err) {
      // Keep the rest of the site alive; just log the offending module.
      if (window.console && console.warn) console.warn('[site-fx] ' + label + ' disabled:', err);
    }
  };

  onReady(() => {
    root.classList.add('fx-ready');

    safe('layers', mountLayers);
    safe('pointer-glow', pointerGlow);
    safe('bloom-cursor', bloomCursor);
    safe('scroll-descent', scrollDescent);
    safe('qualia-map', qualiaMap);
    safe('hero-field', heroField);
    safe('audio-reactive', audioReactive);
    safe('easter-egg', easterEgg);
    safe('rooms-mood', roomsMood);

    if (window.console && console.log) {
      console.log(
        '%cqualiacology%c — you found the source. type "i seent it" anywhere.',
        'color:#ff8fc8;font-weight:700;font-size:13px',
        'color:#b9b1d0'
      );
    }
  });

  /* ----------------------------------------------------------------------
     Mount the fixed background/foreground layers once.
     ---------------------------------------------------------------------- */
  function mountLayers() {
    const make = (cls) => {
      const el = document.createElement('div');
      el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      return el;
    };
    if (!document.querySelector('.fx-pointer-glow')) make('fx-pointer-glow');
    if (!document.querySelector('.fx-descent')) make('fx-descent');
    if (!document.querySelector('.fx-grain')) make('fx-grain');
  }

  /* ----------------------------------------------------------------------
     1. Pointer-reactive ambient glow — three lines of real work.
     ---------------------------------------------------------------------- */
  function pointerGlow() {
    let px = 50, py = 38, queued = false;
    const apply = () => {
      root.style.setProperty('--mx', px + '%');
      root.style.setProperty('--my', py + '%');
      queued = false;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      px = (e.clientX / window.innerWidth) * 100;
      py = (e.clientY / window.innerHeight) * 100;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------
     2. Bloom cursor — a soft light that trails the pointer, brightens over
     anything interactive. Native cursor stays visible underneath.
     ---------------------------------------------------------------------- */
  function bloomCursor() {
    if (coarsePointer.matches || reduceMotion.matches) return;

    const dot = document.createElement('div');
    dot.className = 'fx-cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    // Trailing: ease toward the true pointer each frame.
    let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    let cx = tx, cy = ty, raf = 0, visible = false;

    const loop = () => {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      dot.style.setProperty('--cx', cx + 'px');
      dot.style.setProperty('--cy', cy + 'px');
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX; ty = e.clientY;
      if (!visible) { visible = true; dot.classList.add('is-visible'); }
      const hot = e.target instanceof Element &&
        e.target.closest('a, button, [role="button"], input, .map-node, .toy-card, .album-card');
      dot.classList.toggle('is-hot', !!hot);
    }, { passive: true });

    window.addEventListener('pointerdown', () => dot.classList.add('is-hot'), { passive: true });
    window.addEventListener('pointerup', () => dot.classList.remove('is-hot'), { passive: true });
    document.addEventListener('mouseleave', () => { dot.classList.remove('is-visible'); visible = false; });
    raf = requestAnimationFrame(loop);
  }

  /* ----------------------------------------------------------------------
     3. The descent — a single scroll-linked variable that quietly turns
     reading the page into going somewhere lower than where you started.
     ---------------------------------------------------------------------- */
  function scrollDescent() {
    // On touch devices the descent layer is hidden (see CSS), and updating a
    // scroll-linked variable every frame just forces repaints — skip it.
    if (coarsePointer.matches) return;
    let queued = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const depth = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      // Ease so the floor of the page feels heavier than a linear ramp.
      root.style.setProperty('--scroll-depth', (depth * depth).toFixed(4));
      queued = false;
    };
    window.addEventListener('scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ----------------------------------------------------------------------
     4. Wake the qualia map — draw real filaments from the core to each node,
     send a travelling pulse down each, and light one thread on hover.
     ---------------------------------------------------------------------- */
  function qualiaMap() {
    const grid = document.querySelector('.qualia-map .map-grid');
    const core = grid && grid.querySelector('.map-core');
    if (!grid || !core) return;

    const nodes = Array.from(grid.querySelectorAll('.map-node'));
    if (!nodes.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'qualia-links');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    grid.insertBefore(svg, grid.firstChild);

    const built = nodes.map((node, i) => {
      const base = document.createElementNS(NS, 'path');
      base.setAttribute('class', 'ql-base');
      const pulse = document.createElementNS(NS, 'path');
      pulse.setAttribute('class', 'ql-pulse l' + (i + 1));
      svg.appendChild(base);
      svg.appendChild(pulse);
      node.addEventListener('pointerenter', () => {
        grid.classList.add('node-focus');
        base.classList.add('is-active');
        pulse.classList.add('is-active');
      });
      node.addEventListener('pointerleave', () => {
        grid.classList.remove('node-focus');
        base.classList.remove('is-active');
        pulse.classList.remove('is-active');
      });
      return { node, base, pulse };
    });

    const centerOf = (el, box) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    };

    const draw = () => {
      const box = grid.getBoundingClientRect();
      if (!box.width || !box.height) return;
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      const c = centerOf(core, box);
      built.forEach(({ node, base, pulse }) => {
        const n = centerOf(node, box);
        // A gentle quadratic curve bowed toward the centre line.
        const mx = (c.x + n.x) / 2;
        const my = (c.y + n.y) / 2 + (n.x < c.x ? -18 : 18);
        const d = 'M ' + c.x + ' ' + c.y + ' Q ' + mx + ' ' + my + ' ' + n.x + ' ' + n.y;
        base.setAttribute('d', d);
        pulse.setAttribute('d', d);
      });
    };

    draw();
    // Redraw after fonts/layout settle and on resize.
    window.addEventListener('resize', draw, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw).catch(() => {});
    setTimeout(draw, 300);
    setTimeout(draw, 1200);
  }

  /* ----------------------------------------------------------------------
     5. Hero living field — a low-cost canvas substrate: drifting motes of
     light with faint filaments between near neighbours ("neurons that don't
     touch"). DPR capped at 1, modest particle count, audio-reactive energy.
     ---------------------------------------------------------------------- */
  function heroField() {
    const hero = document.querySelector('.hero');
    const visuals = hero && hero.querySelector('.hero-visuals');
    if (!hero || !visuals) return;

    // The hero field is a per-frame canvas; on touch devices it costs battery
    // and can jank the first screen of scrolling. The static orbs stay behind.
    if (coarsePointer.matches) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-field';
    canvas.setAttribute('aria-hidden', 'true');
    visuals.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COLORS = ['#ff5ead', '#8f72ff', '#69e2ff', '#70f3cf', '#ffd27a'];
    let w = 0, h = 0, motes = [], raf = 0, running = false;

    const resize = () => {
      const r = hero.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      canvas.width = w;
      canvas.height = h;
      const count = Math.max(14, Math.min(34, Math.floor(w / 46)));
      motes = new Array(count).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1.2 + Math.random() * 2.6,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      }));
    };

    const frame = () => {
      const energy = parseFloat(getComputedStyle(root).getPropertyValue('--audio-energy')) || 0;
      const speed = 1 + energy * 2.2;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx * speed;
        m.y += m.vy * speed;
        if (m.x < -20) m.x = w + 20; else if (m.x > w + 20) m.x = -20;
        if (m.y < -20) m.y = h + 20; else if (m.y > h + 20) m.y = -20;

        const glow = m.r * (3.2 + energy * 2.5);
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glow);
        g.addColorStop(0, m.c);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.16 + energy * 0.2;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, glow, 0, Math.PI * 2);
        ctx.fill();
      }

      // Filaments between near neighbours — the constellation that constellates.
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      const link = 150;
      for (let i = 0; i < motes.length; i++) {
        for (let j = i + 1; j < motes.length; j++) {
          const a = motes[i], b = motes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < link) {
            ctx.globalAlpha = (1 - dist / link) * (0.1 + energy * 0.16);
            ctx.strokeStyle = a.c;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    window.addEventListener('resize', () => { resize(); }, { passive: true });

    if (reduceMotion.matches) {
      frame();           // one static painted frame, then leave it be.
      stop();
      return;
    }

    // Don't burn cycles when the hero is offscreen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? start() : stop()));
      }, { threshold: 0.02 }).observe(hero);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });
  }

  /* ----------------------------------------------------------------------
     6. Audio-reactive title — tap the ambient track (owned by site-ambient)
     with an AnalyserNode and feed its energy into --audio-energy. Best-effort:
     if WebAudio is unavailable the track simply plays as before.
     ---------------------------------------------------------------------- */
  function audioReactive() {
    if (reduceMotion.matches) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx = null, analyser = null, data = null, wired = false, raf = 0, energy = 0;

    const findAudio = () => document.querySelector('audio[data-ambient-audio]');

    const wire = (audio) => {
      if (wired) return;
      // createMediaElementSource can only be called once per element, and it
      // reroutes output — so we connect straight to destination to preserve playback.
      ctx = new AudioCtx();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      data = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      wired = true;
    };

    const measure = () => {
      if (analyser) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length) / 255;     // 0..1
        const target = Math.min(1, rms * 1.8);
        energy += (target - energy) * 0.25;                 // smooth attack/decay
      } else {
        energy += (0 - energy) * 0.1;
      }
      root.style.setProperty('--audio-energy', energy.toFixed(3));
      raf = requestAnimationFrame(measure);
    };

    const attach = (audio) => {
      try {
        wire(audio);
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        document.body.classList.add('fx-audio-live');
        if (!raf) raf = requestAnimationFrame(measure);
      } catch (err) {
        // Already wired elsewhere, or blocked — leave audio untouched.
        document.body.classList.remove('fx-audio-live');
      }
    };

    // The audio element is appended by site-ambient on DOM ready; it begins
    // playing on the first user gesture. Hook its play event when it shows up.
    const bind = (audio) => {
      if (!audio || audio.dataset.fxBound) return;
      audio.dataset.fxBound = '1';
      audio.addEventListener('play', () => attach(audio));
      audio.addEventListener('pause', () => document.body.classList.remove('fx-audio-live'));
      if (!audio.paused) attach(audio);
    };

    let tries = 0;
    const poll = setInterval(() => {
      const audio = findAudio();
      if (audio) { bind(audio); clearInterval(poll); }
      else if (++tries > 40) clearInterval(poll);   // give up after ~8s
    }, 200);
  }

  /* ----------------------------------------------------------------------
     8. Mood-reactive rooms — hovering a node, door, or toy retints the whole
     page to that world (via body[data-mood]). Pairs with site-rooms.css.
     ---------------------------------------------------------------------- */
  function roomsMood() {
    const targets = Array.from(document.querySelectorAll('[data-mood]'));
    if (!targets.length) return;
    let clearTimer = 0;

    const set = (mood) => {
      window.clearTimeout(clearTimer);
      if (mood) document.body.dataset.mood = mood;
    };
    const clear = () => {
      // Small delay so moving between adjacent doors doesn't flicker the wash.
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => { delete document.body.dataset.mood; }, 120);
    };

    targets.forEach((item) => {
      const mood = item.getAttribute('data-mood');
      if (!mood) return;
      item.addEventListener('pointerenter', () => set(mood));
      item.addEventListener('pointerleave', clear);
      item.addEventListener('focusin', () => set(mood));
      item.addEventListener('focusout', clear);
    });
  }

  /* ----------------------------------------------------------------------
     7. Easter egg — type "i seent it" anywhere, or long-press the QUALIA core,
     and a small trapdoor opens. Tasteful, on-brand, easy to close.
     ---------------------------------------------------------------------- */
  function easterEgg() {
    const overlay = document.createElement('div');
    overlay.className = 'fx-secret';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'A hidden room');
    overlay.innerHTML =
      '<div class="fx-secret-card" role="document">' +
        '<p class="eyebrow">a wrong door</p>' +
        '<h3>I seent it.</h3>' +
        '<p>The sky is missing. The site noticed. You went looking, and the house ' +
        'admitted one room the map pretends it did not build. Nothing to win here — ' +
        'just a corner that opens when the visitor says the wrong true thing.</p>' +
        '<div class="fx-secret-actions">' +
          '<a class="button cyan" href="/no-moon/"><i class="fa-solid fa-gamepad"></i> Start Descent</a>' +
          '<button type="button" class="fx-secret-close">close the door</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const card = overlay.querySelector('.fx-secret-card');
    const closeBtn = overlay.querySelector('.fx-secret-close');
    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      overlay.classList.add('is-open');
      closeBtn.focus();
    };
    const close = () => {
      overlay.classList.remove('is-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });

    // Keystroke buffer for the phrase.
    const phrase = 'iseentit';
    let buf = '';
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).replace(/[^a-z]/g, '').slice(-phrase.length);
      if (buf === phrase) { buf = ''; open(); }
    });

    // Long-press the core (works on touch and mouse).
    const core = document.querySelector('.qualia-map .map-core');
    if (core) {
      let timer = 0;
      const start = () => { timer = window.setTimeout(open, 650); };
      const cancel = () => { window.clearTimeout(timer); };
      core.addEventListener('pointerdown', start);
      core.addEventListener('pointerup', cancel);
      core.addEventListener('pointerleave', cancel);
      core.addEventListener('pointercancel', cancel);
    }
  }
})();
