// Crayon : un calque transparent pour griffonner par-dessus tout l'écran.
(function (global) {
  'use strict';

  const PEN_WIDTH = 3;
  const ERASER_R = 12;
  const MIN_STEP = 2; // distance minimale entre deux points d'un trait

  // Distance du point (px, py) au segment [(ax, ay), (bx, by)].
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  // Zone qui défile sous le point : le trait y sera accroché et défilera avec elle.
  function scrollerAt(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (!e.id) continue;
      const st = getComputedStyle(e);
      if (/(auto|scroll)/.test(st.overflowY + st.overflowX)) return e;
    }
    return null;
  }

  class DrawLayer {
    // Chaque trait : { c: couleur, p: [x0, y0, x1, y1…], a: accroche }. L'accroche dit dans
    // quel repère sont ses points : « scroll:<id> » pour une zone qui défile, un nom donné
    // par `anchorOf` (le circuit, qui se zoome), ou rien pour la page elle-même.
    constructor(canvas, { onChange, anchorOf, frames }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onChange = onChange || (() => {});
      this.anchorOf = anchorOf || (() => null);
      this.frames = frames || (() => null);
      this.strokes = [];
      this.color = 'text';
      this.eraser = false;
      this.active = null; // trait en cours
      this.pointer = null;

      canvas.addEventListener('pointerdown', (e) => this.down(e));
      canvas.addEventListener('pointermove', (e) => this.move(e));
      canvas.addEventListener('pointerup', () => this.up());
      canvas.addEventListener('pointercancel', () => this.up());
      window.addEventListener('resize', () => this.resize());
      // En phase de capture : on entend aussi le défilement des zones intérieures.
      document.addEventListener('scroll', () => this.draw(), { passive: true, capture: true });
      global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
      this.resize();
    }

    load(strokes) {
      this.up();
      this.strokes = strokes;
      this.draw();
    }

    undo() {
      if (!this.strokes.length) return;
      this.strokes.pop();
      this.changed();
    }

    clear() {
      if (!this.strokes.length) return;
      this.strokes.length = 0;
      this.changed();
    }

    changed() {
      this.draw();
      this.onChange(this.strokes);
    }

    resize() {
      const dpr = global.devicePixelRatio || 1;
      this.canvas.width = Math.round(innerWidth * dpr);
      this.canvas.height = Math.round(innerHeight * dpr);
      this.draw();
    }

    // Repère d'une accroche : conversion écran ↔ trait, et rectangle visible (pour couper
    // ce qui sort de la zone). null si la zone n'est pas affichée en ce moment.
    frame(anchor) {
      if (!anchor) {
        return {
          toLocal: (x, y) => [x + scrollX, y + scrollY],
          toScreen: (x, y) => [x - scrollX, y - scrollY],
          clip: null,
        };
      }
      if (anchor.startsWith('scroll:')) {
        const el = document.getElementById(anchor.slice(7));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return {
          toLocal: (x, y) => [x - r.left + el.scrollLeft, y - r.top + el.scrollTop],
          toScreen: (x, y) => [x + r.left - el.scrollLeft, y + r.top - el.scrollTop],
          clip: r,
        };
      }
      return this.frames(anchor);
    }

    anchorAt(clientX, clientY) {
      const el = document.elementsFromPoint(clientX, clientY).find((e) => e !== this.canvas);
      if (!el) return null;
      const named = this.anchorOf(el);
      if (named && this.frames(named)) return named;
      const sc = scrollerAt(el);
      return sc ? 'scroll:' + sc.id : null;
    }

    down(e) {
      if (e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      if (this.eraser) {
        this.pointer = [e.clientX, e.clientY];
        this.erase(e.clientX, e.clientY);
      } else {
        const a = this.anchorAt(e.clientX, e.clientY);
        const f = this.frame(a);
        const [x, y] = f.toLocal(e.clientX, e.clientY).map(Math.round);
        this.active = { c: this.color, p: [x, y] };
        if (a) this.active.a = a;
        this.activeFrame = f;
        this.strokes.push(this.active);
      }
      this.draw();
    }

    move(e) {
      if (this.eraser) {
        this.pointer = [e.clientX, e.clientY];
        if (e.buttons & 1) this.erase(e.clientX, e.clientY);
        this.draw();
        return;
      }
      if (!this.active) return;
      // Le repère est relu à chaque point : la zone a pu défiler pendant le trait.
      const f = this.frame(this.active.a) || this.activeFrame;
      const [x, y] = f.toLocal(e.clientX, e.clientY).map(Math.round);
      const p = this.active.p;
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < MIN_STEP) return;
      p.push(x, y);
      this.draw();
    }

    up() {
      if (!this.active) return;
      this.active = null;
      this.onChange(this.strokes);
    }

    // Points d'un trait en coordonnées écran, ou null s'il n'est pas visible.
    screenPoints(s) {
      const f = this.frame(s.a);
      if (!f) return null;
      const out = [];
      for (let i = 0; i < s.p.length; i += 2) out.push(...f.toScreen(s.p[i], s.p[i + 1]));
      return { pts: out, clip: f.clip };
    }

    // La gomme efface d'un coup chaque trait visible qu'elle touche.
    erase(x, y) {
      const before = this.strokes.length;
      this.strokes = this.strokes.filter((s) => {
        const sp = this.screenPoints(s);
        if (!sp) return true;
        const p = sp.pts;
        if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) > ERASER_R;
        for (let i = 2; i < p.length; i += 2) {
          if (segDist(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]) <= ERASER_R) return false;
        }
        return true;
      });
      if (this.strokes.length !== before) this.onChange(this.strokes);
    }

    draw() {
      const ctx = this.ctx;
      const dpr = global.devicePixelRatio || 1;
      const textColor = getComputedStyle(document.body).color;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = PEN_WIDTH;
      for (const s of this.strokes) {
        const sp = this.screenPoints(s);
        if (!sp) continue;
        const p = sp.pts;
        ctx.save();
        if (sp.clip) {
          ctx.beginPath();
          ctx.rect(sp.clip.left, sp.clip.top, sp.clip.width, sp.clip.height);
          ctx.clip();
        }
        ctx.strokeStyle = ctx.fillStyle = s.c === 'text' ? textColor : s.c;
        ctx.beginPath();
        if (p.length === 2) {
          ctx.arc(p[0], p[1], PEN_WIDTH / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (this.eraser && this.pointer && document.body.classList.contains('drawing')) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = textColor;
        ctx.beginPath();
        ctx.arc(this.pointer[0], this.pointer[1], ERASER_R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  global.DrawLayer = DrawLayer;
})(window);
