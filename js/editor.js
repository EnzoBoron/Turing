// Éditeur de circuits sur canvas : placement, câblage, simulation en direct.
(function (global) {
  'use strict';

  const { getDef, Simulator } = global.Circuits;
  const GRID = 10;
  const PIN_R = 6;
  const PIN_GAP = 20;

  const snap = (v) => Math.round(v / GRID) * GRID;

  class CircuitEditor {
    constructor(canvas, { level, circuit, onChange, onSim }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.level = level;
      this.circuit = circuit;
      this.onChange = onChange || (() => {});
      this.onSim = onSim || (() => {});
      this.view = { x: 0, y: 0, scale: 1 };
      this.selection = null;
      this.drag = null;
      this.hoverPin = null;
      this.inputVals = level.inputs.map(() => 0);
      this.tickCount = 0;
      this.nextId = 1 + Math.max(0, ...circuit.components.map((c) => parseInt(String(c.id).replace(/\D/g, ''), 10) || 0));

      this.colors = {};
      this.readColors();
      this.sim = new Simulator(this.circuit);
      this.bind();
      this.resize();
      this.fitView();
      this.recompile();
    }

    readColors() {
      const st = getComputedStyle(document.documentElement);
      const v = (n) => st.getPropertyValue(n).trim();
      this.colors = {
        bg: v('--canvas-bg'), grid: v('--canvas-grid'), comp: v('--comp-bg'), compBorder: v('--comp-border'),
        text: v('--text'), muted: v('--muted'), on: v('--wire-on'), off: v('--wire-off'),
        sel: v('--accent'), io: v('--io-bg'), err: v('--danger'), state: v('--state-bg'),
      };
    }

    // ------------------------------------------------------------ Géométrie

    geom(c) {
      const def = getDef(c.type);
      if (c.type === 'IN' || c.type === 'OUT') {
        const w = 64;
        const h = 32;
        const pin = c.type === 'IN' ? { x: c.x + w, y: c.y + h / 2 } : { x: c.x, y: c.y + h / 2 };
        return { w, h, ins: c.type === 'OUT' ? [pin] : [], outs: c.type === 'IN' ? [pin] : [] };
      }
      const n = Math.max(def.inputs.length, def.outputs.length, 1);
      const h = n * PIN_GAP + 10;
      const named = def.inputs.length > 1 || def.outputs.length > 1 || c.type === 'DELAY' || c.type === 'MEM';
      const w = named ? 96 : 70;
      const side = (count, x) => {
        const off = (h - (count - 1) * PIN_GAP) / 2;
        return Array.from({ length: count }, (_, i) => ({ x, y: c.y + off + i * PIN_GAP }));
      };
      return { w, h, ins: side(def.inputs.length, c.x), outs: side(def.outputs.length, c.x + w) };
    }

    toWorld(e) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left - this.view.x) / this.view.scale,
        y: (e.clientY - r.top - this.view.y) / this.view.scale,
      };
    }

    pinAt(p) {
      const tol = PIN_R + 4 / this.view.scale;
      for (const c of this.circuit.components) {
        const g = this.geom(c);
        for (const [kind, list] of [['in', g.ins], ['out', g.outs]]) {
          for (let i = 0; i < list.length; i++) {
            if (Math.hypot(list[i].x - p.x, list[i].y - p.y) <= tol) return { c: c.id, p: i, kind };
          }
        }
      }
      return null;
    }

    compAt(p) {
      const comps = this.circuit.components;
      for (let i = comps.length - 1; i >= 0; i--) {
        const c = comps[i];
        const g = this.geom(c);
        if (p.x >= c.x && p.x <= c.x + g.w && p.y >= c.y && p.y <= c.y + g.h) return c;
      }
      return null;
    }

    wireEnds(w) {
      const from = this.circuit.components.find((c) => c.id === w.from.c);
      const to = this.circuit.components.find((c) => c.id === w.to.c);
      if (!from || !to) return null;
      return { a: this.geom(from).outs[w.from.p], b: this.geom(to).ins[w.to.p] };
    }

    bezier(a, b) {
      const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
      return [a, { x: a.x + dx, y: a.y }, { x: b.x - dx, y: b.y }, b];
    }

    wireAt(p) {
      const tol = 6 / this.view.scale;
      for (let k = this.circuit.wires.length - 1; k >= 0; k--) {
        const ends = this.wireEnds(this.circuit.wires[k]);
        if (!ends || !ends.a || !ends.b) continue;
        const [p0, p1, p2, p3] = this.bezier(ends.a, ends.b);
        for (let t = 0; t <= 1; t += 0.04) {
          const u = 1 - t;
          const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
          const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
          if (Math.hypot(x - p.x, y - p.y) <= tol) return k;
        }
      }
      return -1;
    }

    // ----------------------------------------------------------- Événements

    bind() {
      const cv = this.canvas;
      this.handlers = {
        down: (e) => this.pointerDown(e),
        move: (e) => this.pointerMove(e),
        up: (e) => this.pointerUp(e),
        wheel: (e) => this.wheel(e),
        menu: (e) => this.contextMenu(e),
        key: (e) => this.key(e),
        resize: () => this.resize(),
      };
      cv.addEventListener('pointerdown', this.handlers.down);
      cv.addEventListener('pointermove', this.handlers.move);
      cv.addEventListener('pointerup', this.handlers.up);
      cv.addEventListener('pointercancel', this.handlers.up);
      cv.addEventListener('wheel', this.handlers.wheel, { passive: false });
      cv.addEventListener('contextmenu', this.handlers.menu);
      window.addEventListener('keydown', this.handlers.key);
      this.ro = new ResizeObserver(this.handlers.resize);
      this.ro.observe(cv.parentElement);
      this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.themeHandler = () => { this.readColors(); this.draw(); };
      this.themeQuery.addEventListener('change', this.themeHandler);
    }

    destroy() {
      const cv = this.canvas;
      cv.removeEventListener('pointerdown', this.handlers.down);
      cv.removeEventListener('pointermove', this.handlers.move);
      cv.removeEventListener('pointerup', this.handlers.up);
      cv.removeEventListener('pointercancel', this.handlers.up);
      cv.removeEventListener('wheel', this.handlers.wheel);
      cv.removeEventListener('contextmenu', this.handlers.menu);
      window.removeEventListener('keydown', this.handlers.key);
      this.themeQuery.removeEventListener('change', this.themeHandler);
      this.ro.disconnect();
    }

    pointerDown(e) {
      if (e.button === 2) return;
      this.canvas.setPointerCapture(e.pointerId);
      const p = this.toWorld(e);
      const pin = this.pinAt(p);
      if (pin) {
        this.drag = { kind: 'wire', pin, pos: p };
      } else {
        const c = this.compAt(p);
        if (c) {
          this.selection = { kind: 'comp', id: c.id };
          this.drag = { kind: 'move', comp: c, dx: p.x - c.x, dy: p.y - c.y, moved: false, start: p };
          // Le composant déplacé passe au premier plan.
          const comps = this.circuit.components;
          comps.push(comps.splice(comps.indexOf(c), 1)[0]);
        } else {
          const w = this.wireAt(p);
          if (w >= 0) this.selection = { kind: 'wire', index: w };
          else this.selection = null;
          this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y };
        }
      }
      this.draw();
    }

    pointerMove(e) {
      const p = this.toWorld(e);
      const d = this.drag;
      if (!d) {
        const pin = this.pinAt(p);
        const changed = JSON.stringify(pin) !== JSON.stringify(this.hoverPin);
        this.hoverPin = pin;
        this.canvas.style.cursor = pin ? 'crosshair' : this.compAt(p) ? 'grab' : 'default';
        if (changed) this.draw();
        return;
      }
      if (d.kind === 'wire') {
        d.pos = p;
        this.hoverPin = this.pinAt(p);
      } else if (d.kind === 'move') {
        if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 3) d.moved = true;
        if (d.moved) {
          d.comp.x = snap(p.x - d.dx);
          d.comp.y = snap(p.y - d.dy);
        }
      } else if (d.kind === 'pan') {
        this.view.x = d.vx + e.clientX - d.sx;
        this.view.y = d.vy + e.clientY - d.sy;
      }
      this.draw();
    }

    pointerUp(e) {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.kind === 'wire') {
        const target = this.pinAt(this.toWorld(e));
        if (target && target.kind !== d.pin.kind) {
          const out = d.pin.kind === 'out' ? d.pin : target;
          const inp = d.pin.kind === 'in' ? d.pin : target;
          this.connect(out, inp);
        } else if (!target && d.pin.kind === 'in') {
          // Tirer depuis une entrée déjà câblée puis relâcher dans le vide : débranche.
          const before = this.circuit.wires.length;
          this.circuit.wires = this.circuit.wires.filter((w) => !(w.to.c === d.pin.c && w.to.p === d.pin.p));
          if (this.circuit.wires.length !== before) this.changed();
        }
      } else if (d.kind === 'move') {
        if (!d.moved && d.comp.type === 'IN') {
          this.inputVals[d.comp.idx] ^= 1;
          this.simulate();
        } else if (d.moved) this.changed(false);
      }
      this.draw();
    }

    contextMenu(e) {
      e.preventDefault();
      const p = this.toWorld(e);
      const c = this.compAt(p);
      if (c) this.selection = { kind: 'comp', id: c.id };
      else {
        const w = this.wireAt(p);
        this.selection = w >= 0 ? { kind: 'wire', index: w } : null;
      }
      this.deleteSelection();
    }

    wheel(e) {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const f = Math.exp(-e.deltaY * 0.0015);
      const s = Math.min(2.5, Math.max(0.3, this.view.scale * f));
      const k = s / this.view.scale;
      this.view.x = mx - (mx - this.view.x) * k;
      this.view.y = my - (my - this.view.y) * k;
      this.view.scale = s;
      this.draw();
    }

    key(e) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selection) {
          e.preventDefault();
          this.deleteSelection();
        }
      }
    }

    // -------------------------------------------------------------- Édition

    connect(out, inp) {
      this.circuit.wires = this.circuit.wires.filter((w) => !(w.to.c === inp.c && w.to.p === inp.p));
      this.circuit.wires.push({ from: { c: out.c, p: out.p }, to: { c: inp.c, p: inp.p } });
      this.changed();
    }

    addComponent(type) {
      const r = this.canvas.getBoundingClientRect();
      const cx = (r.width / 2 - this.view.x) / this.view.scale;
      const cy = (r.height / 2 - this.view.y) / this.view.scale;
      const c = { id: 'c' + this.nextId++, type, x: 0, y: 0 };
      // Décale le nouveau composant tant qu'il chevauche un autre.
      let k = 0;
      do {
        c.x = snap(cx - 35 + (k % 5) * 20);
        c.y = snap(cy - 20 + k * 20);
        k++;
      } while (k < 30 && this.circuit.components.some((o) => Math.abs(o.x - c.x) < 40 && Math.abs(o.y - c.y) < 30));
      this.circuit.components.push(c);
      this.selection = { kind: 'comp', id: c.id };
      this.changed();
    }

    deleteSelection() {
      const s = this.selection;
      if (!s) return;
      if (s.kind === 'wire') {
        this.circuit.wires.splice(s.index, 1);
      } else {
        const c = this.circuit.components.find((o) => o.id === s.id);
        if (!c || c.type === 'IN' || c.type === 'OUT') return;
        this.circuit.components = this.circuit.components.filter((o) => o.id !== s.id);
        this.circuit.wires = this.circuit.wires.filter((w) => w.from.c !== s.id && w.to.c !== s.id);
      }
      this.selection = null;
      this.changed();
    }

    clear() {
      this.circuit.components = this.circuit.components.filter((c) => c.type === 'IN' || c.type === 'OUT');
      this.circuit.wires = [];
      this.selection = null;
      this.changed();
    }

    changed(structural = true) {
      if (structural) this.recompile();
      this.onChange(this.circuit);
      this.draw();
    }

    // ----------------------------------------------------------- Simulation

    recompile() {
      this.sim = new Simulator(this.circuit);
      this.tickCount = 0;
      this.simulate();
    }

    simulate() {
      this.sim.evaluate(this.inputVals);
      this.onSim(this);
      this.draw();
    }

    tick() {
      this.sim.tick();
      this.tickCount++;
      this.simulate();
    }

    resetState() {
      this.sim.reset();
      this.tickCount = 0;
      this.simulate();
    }

    // -------------------------------------------------------------- Rendu

    resize() {
      const parent = this.canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      this.canvas.width = Math.max(1, w * dpr);
      this.canvas.height = Math.max(1, h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.dpr = dpr;
      this.draw();
    }

    fitView() {
      const comps = this.circuit.components;
      if (!comps.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of comps) {
        const g = this.geom(c);
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
        x1 = Math.max(x1, c.x + g.w); y1 = Math.max(y1, c.y + g.h);
      }
      const r = this.canvas.parentElement.getBoundingClientRect();
      const pad = 40;
      const s = Math.min(1.4, Math.max(0.4, Math.min((r.width - pad * 2) / (x1 - x0 || 1), (r.height - pad * 2) / (y1 - y0 || 1))));
      this.view.scale = s;
      this.view.x = r.width / 2 - ((x0 + x1) / 2) * s;
      this.view.y = r.height / 2 - ((y0 + y1) / 2) * s;
      this.draw();
    }

    valueOfOut(compId, pin) {
      const i = this.sim.index.get(compId);
      if (i === undefined || this.sim.error) return null;
      return this.sim.values[i][pin];
    }

    draw() {
      const ctx = this.ctx;
      const C = this.colors;
      const { x: vx, y: vy, scale } = this.view;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const W = this.canvas.width / this.dpr;
      const H = this.canvas.height / this.dpr;
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      // Grille de points.
      const step = GRID * 2 * scale;
      if (step > 6) {
        ctx.fillStyle = C.grid;
        const ox = ((vx % step) + step) % step;
        const oy = ((vy % step) + step) % step;
        for (let x = ox; x < W; x += step) for (let y = oy; y < H; y += step) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }

      ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * vx, this.dpr * vy);

      // Fils.
      this.circuit.wires.forEach((w, k) => {
        const ends = this.wireEnds(w);
        if (!ends || !ends.a || !ends.b) return;
        const v = this.valueOfOut(w.from.c, w.from.p);
        const selected = this.selection && this.selection.kind === 'wire' && this.selection.index === k;
        this.strokeWire(ends.a, ends.b, v ? C.on : C.off, selected ? 5 : 3, selected);
      });
      if (this.drag && this.drag.kind === 'wire') {
        const pinPos = this.pinPos(this.drag.pin);
        const a = this.drag.pin.kind === 'out' ? pinPos : this.drag.pos;
        const b = this.drag.pin.kind === 'out' ? this.drag.pos : pinPos;
        ctx.setLineDash([6, 4]);
        this.strokeWire(a, b, C.sel, 2.5);
        ctx.setLineDash([]);
      }

      // Composants.
      const cycle = new Set(this.sim ? this.sim.cycle : []);
      for (const c of this.circuit.components) this.drawComp(c, cycle.has(c.id));
    }

    pinPos(pin) {
      const c = this.circuit.components.find((o) => o.id === pin.c);
      const g = this.geom(c);
      return (pin.kind === 'out' ? g.outs : g.ins)[pin.p];
    }

    strokeWire(a, b, color, width, glow) {
      const ctx = this.ctx;
      const [p0, p1, p2, p3] = this.bezier(a, b);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      if (glow) {
        ctx.strokeStyle = this.colors.sel;
        ctx.lineWidth = width + 4;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    drawComp(c, inCycle) {
      const ctx = this.ctx;
      const C = this.colors;
      const def = getDef(c.type);
      const g = this.geom(c);
      const selected = this.selection && this.selection.kind === 'comp' && this.selection.id === c.id;
      const io = c.type === 'IN' || c.type === 'OUT';

      ctx.beginPath();
      ctx.roundRect(c.x, c.y, g.w, g.h, io ? 16 : 6);
      ctx.fillStyle = io ? C.io : def.stateful ? C.state : C.comp;
      ctx.fill();
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.strokeStyle = inCycle ? C.err : selected ? C.sel : C.compBorder;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (io) {
        const name = c.type === 'IN' ? this.level.inputs[c.idx] : this.level.outputs[c.idx];
        let v;
        if (c.type === 'IN') v = this.inputVals[c.idx];
        else {
          const i = this.sim.index.get(c.id);
          v = this.sim.error ? null : this.sim.inputsOf[i][0];
        }
        ctx.fillStyle = C.text;
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(name, c.x + (c.type === 'IN' ? 22 : 42), c.y + g.h / 2);
        const bx = c.type === 'IN' ? c.x + 46 : c.x + 18;
        ctx.beginPath();
        ctx.arc(bx, c.y + g.h / 2, 9, 0, Math.PI * 2);
        ctx.fillStyle = v ? C.on : C.off;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.fillText(v == null ? '?' : String(v), bx, c.y + g.h / 2 + 0.5);
      } else {
        ctx.fillStyle = C.text;
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(def.label, c.x + g.w / 2, c.y + g.h / 2);
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillStyle = C.muted;
        if (def.inputs.length > 1 || def.outputs.length > 1 || def.stateful) {
          ctx.textAlign = 'left';
          def.inputs.forEach((n, i) => ctx.fillText(n, g.ins[i].x + 8, g.ins[i].y));
          ctx.textAlign = 'right';
          def.outputs.forEach((n, i) => ctx.fillText(n, g.outs[i].x - 8, g.outs[i].y));
        }
      }

      // Pastilles de connexion.
      const drawPin = (pt, v, hover) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, hover ? PIN_R + 2 : PIN_R, 0, Math.PI * 2);
        ctx.fillStyle = v ? C.on : C.off;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = hover ? C.sel : C.compBorder;
        ctx.stroke();
      };
      const i = this.sim.index.get(c.id);
      const isHover = (kind, p) => this.hoverPin && this.hoverPin.c === c.id && this.hoverPin.kind === kind && this.hoverPin.p === p;
      g.ins.forEach((pt, p) => drawPin(pt, this.sim.error ? 0 : this.sim.inputsOf[i][p], isHover('in', p)));
      g.outs.forEach((pt, p) => drawPin(pt, this.sim.error ? 0 : this.sim.values[i][p], isHover('out', p)));
    }
  }

  // Circuit initial d'un niveau : entrées à gauche, sorties à droite.
  function initialCircuit(level) {
    const components = [];
    const n = Math.max(level.inputs.length, level.outputs.length, 1);
    const h = n * 60;
    level.inputs.forEach((_, k) => components.push({
      id: 'in' + k, type: 'IN', idx: k, x: 0, y: snap((h - level.inputs.length * 60) / 2 + k * 60),
    }));
    level.outputs.forEach((_, k) => components.push({
      id: 'out' + k, type: 'OUT', idx: k, x: 460, y: snap((h - level.outputs.length * 60) / 2 + k * 60),
    }));
    return { components, wires: [] };
  }

  global.CircuitEditor = CircuitEditor;
  global.initialCircuit = initialCircuit;
})(window);
