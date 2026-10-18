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

  class DrawLayer {
    // Les traits sont stockés en coordonnées de page : { c: couleur, p: [x0, y0, x1, y1…] }.
    constructor(canvas, { onChange }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onChange = onChange || (() => {});
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
      window.addEventListener('scroll', () => this.draw(), { passive: true });
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

    point(e) {
      return [Math.round(e.clientX + scrollX), Math.round(e.clientY + scrollY)];
    }

    down(e) {
      if (e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      const [x, y] = this.point(e);
      if (this.eraser) {
        this.pointer = [x, y];
        this.erase(x, y);
      } else {
        this.active = { c: this.color, p: [x, y] };
        this.strokes.push(this.active);
      }
      this.draw();
    }

    move(e) {
      const [x, y] = this.point(e);
      if (this.eraser) {
        this.pointer = [x, y];
        if (e.buttons & 1) this.erase(x, y);
        this.draw();
        return;
      }
      if (!this.active) return;
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

    // La gomme efface d'un coup chaque trait qu'elle touche.
    erase(x, y) {
      const before = this.strokes.length;
      this.strokes = this.strokes.filter((s) => {
        const p = s.p;
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
      ctx.setTransform(dpr, 0, 0, dpr, -scrollX * dpr, -scrollY * dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = PEN_WIDTH;
      for (const s of this.strokes) {
        const p = s.p;
        ctx.strokeStyle = ctx.fillStyle = s.c === 'text' ? textColor : s.c;
        if (p.length === 2) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], PEN_WIDTH / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.stroke();
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
