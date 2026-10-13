// Tests de l'interface dans un vrai navigateur (Playwright + Chromium).
// Installation : npm install   puis   npx playwright install chromium
// Lancement   : node tests/ui.js
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || detail === undefined ? '' : ' — ' + detail));
  if (!ok) failures++;
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Position écran d'une pastille : kind = 'in' ou 'out'.
  const pin = (id, kind, i = 0) => page.evaluate(([id, kind, i]) => {
    const ed = window.game.editor;
    const c = ed.circuit.components.find((o) => o.id === id);
    const pt = (kind === 'out' ? ed.geom(c).outs : ed.geom(c).ins)[i];
    const r = ed.canvas.getBoundingClientRect();
    return { x: r.left + ed.view.x + pt.x * ed.view.scale, y: r.top + ed.view.y + pt.y * ed.view.scale };
  }, [id, kind, i]);

  const drag = async (a, b) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
  };
  const wires = () => page.evaluate(() => window.game.editor.circuit.wires.map((w) => `${w.from.c}.${w.from.p}>${w.to.c}.${w.to.p}`));
  const addGate = async (label) => {
    await page.click(`.pal-item:has(b:text-is("${label}"))`);
    return page.evaluate(() => window.game.editor.circuit.components.at(-1).id);
  };

  const open = async (id) => {
    await page.goto(URL + '#' + id);
    await page.waitForFunction((lvl) => window.game && window.game.level && window.game.level.id === lvl, id);
  };

  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.check('#free-mode');

  console.log('Niveau AND : une sortie vers deux entrées');
  await open('and');
  const n1 = await addGate('NAND');
  const n2 = await addGate('NAND');
  const overlap = await page.evaluate(([a, b]) => {
    const ed = window.game.editor;
    const [c1, c2] = [a, b].map((id) => ed.circuit.components.find((o) => o.id === id));
    const [g1, g2] = [c1, c2].map((c) => ed.geom(c));
    return c1.x < c2.x + g2.w && c2.x < c1.x + g1.w && c1.y < c2.y + g2.h && c2.y < c1.y + g1.h;
  }, [n1, n2]);
  check('deux portes ajoutées ne se chevauchent pas', !overlap);

  await drag(await pin('in0', 'out'), await pin(n1, 'in', 0));
  await drag(await pin('in1', 'out'), await pin(n1, 'in', 1));
  await drag(await pin(n1, 'out'), await pin(n2, 'in', 0));
  await drag(await pin(n1, 'out'), await pin(n2, 'in', 1));
  let w = await wires();
  check('la même sortie alimente les deux entrées', w.includes(`${n1}.0>${n2}.0`) && w.includes(`${n1}.0>${n2}.1`), w.join(' '));

  // Relâcher un fil un peu à côté de la pastille doit quand même le brancher.
  const q = await pin('out0', 'in');
  await drag(await pin(n2, 'out'), { x: q.x + 9, y: q.y - 8 });
  w = await wires();
  check('un fil relâché près d\'une pastille s\'y accroche', w.includes(`${n2}.0>out0.0`), w.join(' '));

  // Tirer depuis l'entrée vers la sortie (sens inverse) fonctionne aussi.
  await page.click('#c-verify');
  await page.waitForSelector('#modal:not(.hidden)');
  check('le circuit AND est validé', (await page.textContent('#m-text')).includes('2 portes NAND'));
  await page.click('#m-stay');

  console.log('Édition');
  const before = (await wires()).length;
  await drag(await pin('in0', 'out'), await pin(n2, 'in', 1));
  w = await wires();
  check('une entrée déjà câblée est remplacée, pas doublée', w.length === before && w.includes(`in0.0>${n2}.1`), w.join(' '));

  const valA = () => page.evaluate(() => window.game.editor.inputVals[0]);
  const a = await pin('in0', 'out');
  await page.mouse.click(a.x - 40, a.y);
  check('cliquer sur une entrée bascule sa valeur', (await valA()) === 1);
  await page.mouse.click(a.x, a.y);
  check('cliquer sur la pastille d\'une entrée la bascule aussi', (await valA()) === 0);

  const g = await page.evaluate((id) => {
    const ed = window.game.editor;
    const c = ed.circuit.components.find((o) => o.id === id);
    const r = ed.canvas.getBoundingClientRect();
    return { x: r.left + ed.view.x + (c.x + 35) * ed.view.scale, y: r.top + ed.view.y + (c.y + 25) * ed.view.scale };
  }, n1);
  await page.mouse.click(g.x, g.y, { button: 'right' });
  const left = await page.evaluate((id) => window.game.editor.circuit.components.some((o) => o.id === id), n1);
  w = await wires();
  check('clic droit supprime la porte et ses fils', !left && !w.some((s) => s.includes(n1)), w.join(' '));

  console.log('Nouveaux niveaux de portes');
  await open('cmp1');
  check('le niveau Comparateur 1 bit a 3 sorties',
    (await page.evaluate(() => window.game.editor.circuit.components.filter((c) => c.type === 'OUT').length)) === 3);

  console.log('Fichier de sauvegarde');
  await page.click('#home-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-save')]);
  const file = path.join(os.tmpdir(), 'turing-test-sauvegarde.json');
  await download.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('l\'export contient le niveau réussi', data.format === 'turing-sauvegarde' && !!data.done.and);
  check('l\'export contient le circuit', Array.isArray(data.circuits.and && data.circuits.and.components));

  page.once('dialog', (d) => d.accept());
  await page.click('#reset-progress');
  check('la progression est effacée', (await page.textContent('#progress')).startsWith('0 /'));

  page.once('dialog', (d) => d.accept());
  await page.setInputFiles('#import-file', file);
  await page.waitForSelector('#save-msg.good');
  check('l\'import restaure la progression', (await page.textContent('#progress')).startsWith('1 /'));

  fs.writeFileSync(file, '{"pas": "une sauvegarde"}');
  await page.setInputFiles('#import-file', file);
  await page.waitForSelector('#save-msg.bad');
  check('un fichier invalide est refusé', (await page.textContent('#progress')).startsWith('1 /'));
  fs.unlinkSync(file);

  check('aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
