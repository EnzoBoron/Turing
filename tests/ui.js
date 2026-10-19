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

  await open('or');
  await drag(await pin('in0', 'out'), await pin('out0', 'in'));
  await drag(await pin('in1', 'out'), await pin('out0', 'in'));
  w = await wires();
  check('deux fils vers la même sortie : le second remplace le premier', w.length === 1 && w[0] === 'in1.0>out0.0', w.join(' '));
  check('un message explique pourquoi', (await page.isVisible('#c-toast'))
    && (await page.textContent('#c-toast')).includes('un seul fil'));
  await open('and');

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

  console.log('Énoncés');
  await open('gt2');
  const pinText = await page.textContent('#c-desc .pins');
  check('la légende explique chaque bit', pinText.includes('A1') && pinText.includes('compte pour 2'));
  check('la table attendue est repliée', !(await page.isVisible('#c-desc details.expected table')));
  await page.click('#c-desc details.expected summary');
  check('la table attendue a 16 lignes', (await page.locator('#c-desc details.expected tbody tr').count()) === 16);
  check('l\'indice est replié', (await page.locator('#c-desc details.hint').count()) === 1
    && !(await page.isVisible('#c-desc details.hint p')));
  await open('max');
  check('un niveau d\'assemblage montre un exemple', (await page.textContent('#a-desc .example')).includes('Sorties attendues'));

  console.log('Nouvelles instructions');
  await open('sum');
  await page.fill('#a-code', 'shl');
  await page.dispatchEvent('#a-code', 'input');
  check('shl refusé avant son niveau', (await page.textContent('#a-cpu')).includes('pas encore débloquée'));
  await open('squares');
  check('la référence signale call comme nouveau', (await page.textContent('#a-isa')).includes('nouveau'));
  check('la mémoire et la pile sont affichées', (await page.isVisible('#a-cpu .ram'))
    && (await page.textContent('#a-cpu')).includes('Pile d'));
  await page.fill('#a-code', 'imm 7\nmov r0 r1\nmov r0 r2\nstore\ncall f\nf:\njmp f');
  await page.dispatchEvent('#a-code', 'input');
  for (let k = 0; k < 6; k++) await page.click('#a-step');
  check('store remplit la case 7', (await page.textContent('#a-cpu .ram div:nth-child(8) b')) === '7');
  check('call empile l\'adresse de retour', (await page.textContent('#a-cpu')).includes('vide') === false);

  console.log('Énoncé repliable');
  await open('and');
  await page.click('#screen-circuit .desc-toggle');
  check('le bouton cache l\'énoncé', !(await page.isVisible('#c-desc')));
  await open('sum');
  check('l\'énoncé reste caché dans les autres niveaux', !(await page.isVisible('#a-desc')));
  await page.click('#screen-asm .desc-toggle');
  check('le bouton réaffiche l\'énoncé', await page.isVisible('#a-desc'));

  console.log('Crayon');
  await open('and');
  const drawn = () => page.evaluate(() => (JSON.parse(localStorage.getItem('turing-save-v1')).drawings || {}).and || []);
  await page.click('#draw-btn');
  check('le crayon affiche ses outils', await page.isVisible('#draw-tools'));
  const box = await page.locator('#c-canvas').boundingBox();
  const stroke = async (x0, y0, x1, y1) => {
    await page.mouse.move(box.x + x0, box.y + y0);
    await page.mouse.down();
    await page.mouse.move(box.x + x1, box.y + y1, { steps: 8 });
    await page.mouse.up();
  };
  const compsBefore = (await page.evaluate(() => window.game.editor.circuit.components.length));
  await stroke(100, 100, 300, 120);
  await page.click('#draw-colors .swatch[data-color="#e03131"]');
  await stroke(100, 200, 300, 220);
  await page.waitForTimeout(300);
  let d = await drawn();
  check('deux traits sont enregistrés', d.length === 2 && d[1].c === '#e03131', JSON.stringify(d.map((s) => s.c)));
  check('dessiner ne modifie pas le circuit', compsBefore === (await page.evaluate(() => window.game.editor.circuit.components.length)));
  await page.click('#draw-eraser');
  await stroke(200, 90, 200, 130);
  await page.waitForTimeout(300);
  d = await drawn();
  check('la gomme efface le trait touché', d.length === 1 && d[0].c === '#e03131');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check('Ctrl+Z annule le dernier trait', (await drawn()).length === 0);
  await page.click('#draw-colors .swatch[data-color="text"]');
  await stroke(100, 300, 200, 300);
  await page.keyboard.press('Escape');
  check('Échap range le crayon', !(await page.isVisible('#draw-tools')));
  await page.mouse.click(box.x + 400, box.y + 400);
  check('hors du mode crayon, la souris revient au circuit', !(await page.evaluate(() => document.body.classList.contains('drawing'))));
  await open('sum');
  check('chaque écran a son propre dessin', await page.evaluate(() => !(JSON.parse(localStorage.getItem('turing-save-v1')).drawings || {}).sum));

  console.log('Brouillon');
  await open('and');
  await page.fill('#c-notes', 'A B | Q\n0 0 | 0');
  await page.keyboard.press('Delete');
  check('taper dans le brouillon ne touche pas au circuit', (await page.inputValue('#c-notes')).startsWith('A B'));
  await open('sum');
  check('chaque niveau a son propre brouillon', (await page.inputValue('#a-notes')) === '');
  await page.fill('#a-notes', 'compteur dans R4');
  await open('and');
  check('le brouillon est retrouvé', (await page.inputValue('#c-notes')) === 'A B | Q\n0 0 | 0');

  console.log('Symboles des portes');
  const pixels = () => page.evaluate(() => window.game.editor.canvas.toDataURL());
  const blocks = await pixels();
  await page.click('#c-symbols');
  check('le bouton active le mode symboles', await page.evaluate(() => window.game.editor.symbols) && (await page.getAttribute('#c-symbols', 'aria-pressed')) === 'true');
  check('les portes sont redessinées', (await pixels()) !== blocks);
  const wiresBefore = await wires();
  await open('sum');
  await open('and');
  check('le choix est gardé d\'un niveau à l\'autre', await page.evaluate(() => window.game.editor.symbols));
  check('le circuit ne change pas', JSON.stringify(await wires()) === JSON.stringify(wiresBefore));
  await page.click('#c-symbols');
  check('un second clic revient aux blocs', !(await page.evaluate(() => window.game.editor.symbols)));

  console.log('Copier le schéma');
  await page.click('#c-copy');
  const shown = await page.inputValue('#copy-text');
  check('le schéma s\'affiche en texte', await page.isVisible('#copy-modal') && shown.startsWith('Circuit « ') && /NAND1 = NAND\(/.test(shown), shown);
  await page.evaluate(() => {
    window.copied = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.copied = t; } } });
  });
  await page.click('#copy-do');
  await page.waitForSelector('#copy-msg.good');
  check('le bouton Copier copie ce texte', (await page.evaluate(() => window.copied)) === shown);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('refus'); } } });
    document.execCommand = () => false;
  });
  await page.click('#copy-do');
  await page.waitForSelector('#copy-msg.bad');
  check('si la copie est refusée, le texte reste sélectionné', await page.evaluate(() => {
    const a = document.getElementById('copy-text');
    return document.activeElement === a && a.selectionStart === 0 && a.selectionEnd === a.value.length;
  }));
  await page.keyboard.press('Escape');
  check('Échap ferme la fenêtre du schéma', !(await page.isVisible('#copy-modal')));

  console.log('Bac à sable');
  await page.click('#home-btn');
  await page.click('#sandbox-btn');
  await page.waitForFunction(() => window.game.level && window.game.level.id === 'sandbox');
  check('le bac à sable démarre vide', (await page.evaluate(() => window.game.editor.circuit.components.length)) === 0);
  check('tous les composants, plus Entrée et Sortie', (await page.$$('.pal-item')).length === 2 + await page.evaluate(() => Object.values(window.Circuits.COMPONENTS).filter((d) => !d.io).length));
  await page.click('.pal-item:has(b:text-is("Entrée"))');
  await page.click('.pal-item:has(b:text-is("Entrée"))');
  await page.click('.pal-item:has(b:text-is("Sortie"))');
  const io = await page.evaluate(() => window.game.editor.circuit.components.map((c) => c.id + ':' + c.name));
  check('les entrées et sorties placées sont nommées', io.map((x) => x.split(':')[1]).join() === 'E1,E2,S1', io.join());
  const [e1, e2, s1] = io.map((x) => x.split(':')[0]);
  const sx = await addGate('XOR');
  await drag(await pin(e1, 'out'), await pin(sx, 'in', 0));
  await drag(await pin(e2, 'out'), await pin(sx, 'in', 1));
  await drag(await pin(sx, 'out'), await pin(s1, 'in'));
  await page.click('#c-verify');
  const table = await page.$$eval('#c-results tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent).join('')));
  check('la table de vérité est calculée', table.join(' ') === '000 011 101 110', table.join(' '));

  await page.click('#t-all');
  check('une ligne de test par combinaison', (await page.$$('.tests-edit tbody tr')).length === 4);
  await page.click('.tests-edit tbody tr:nth-child(2) td.exp button');
  await page.click('.tests-edit tbody tr:nth-child(3) td.exp button');
  await page.click('#t-run');
  check('la batterie de tests passe', (await page.textContent('#c-results .verdict')).includes('Tous les tests passent'));
  check('pas de victoire dans le bac à sable', !(await page.isVisible('#modal')));
  await page.click('.tests-edit tbody tr:nth-child(4) td.exp button');
  await page.click('#t-run');
  check('un test faux est signalé', (await page.textContent('#c-results .verdict')).includes('1 ligne incorrecte'));

  const box1 = await page.evaluate((id) => {
    const ed = window.game.editor;
    const c = ed.circuit.components.find((o) => o.id === id);
    const r = ed.canvas.getBoundingClientRect();
    return { x: r.left + ed.view.x + (c.x + 12) * ed.view.scale, y: r.top + ed.view.y + (c.y + 16) * ed.view.scale };
  }, s1);
  page.once('dialog', (d) => d.accept('Q'));
  await page.mouse.dblclick(box1.x, box1.y);
  check('double-clic renomme une sortie', (await page.evaluate(() => window.game.level.outputs.join())) === 'Q');
  check('les tests suivent le nouveau nom', (await page.textContent('.tests-edit thead')).includes('Q'));

  await page.reload();
  await page.waitForFunction(() => window.game.level && window.game.level.id === 'sandbox');
  check('circuit et tests sont gardés', (await wires()).length === 3 && (await page.$$('.tests-edit tbody tr')).length === 4);
  await page.evaluate((id) => { const ed = window.game.editor; ed.selection = { kind: 'comp', id }; ed.deleteSelection(); }, e1);
  check('supprimer une entrée renumérote les autres', (await page.evaluate(() => window.game.level.inputs.join())) === 'E2');

  console.log('Constructions');
  check('une construction non enregistrée est signalée', (await page.textContent('#c-builds')).includes('non enregistrées'));
  page.once('dialog', (d) => d.accept('Mon XOR'));
  await page.click('#b-save');
  check('enregistrer demande un nom puis l\'affiche', (await page.textContent('#c-builds .build-current')).includes('Mon XOR') && (await page.textContent('#c-builds')).includes('✓ enregistrée'));
  const xorWires = (await wires()).length;
  await page.click('#b-new');
  check('« Nouvelle » repart d\'un bac à sable vide', (await page.evaluate(() => window.game.editor.circuit.components.length)) === 0);
  await page.click('.pal-item:has(b:text-is("Entrée"))');
  page.once('dialog', (d) => d.accept('Brouillon'));
  await page.click('#b-saveas');
  check('deux constructions dans la liste', (await page.$$('.build-list li')).length === 2);
  await page.click('.build-open:text-is("Mon XOR")');
  check('ouvrir une construction recharge son circuit', (await wires()).length === xorWires && (await page.$$('.tests-edit tbody tr')).length === 4);
  page.once('dialog', (d) => d.accept('XOR maison'));
  await page.click('.build-list li.current [data-rename]');
  check('renommer une construction', (await page.textContent('#c-builds .build-current')).includes('XOR maison'));
  page.once('dialog', (d) => d.accept());
  await page.click('.build-list li:not(.current) [data-remove]');
  check('supprimer une construction', (await page.$$('.build-list li')).length === 1);
  await page.reload();
  await page.waitForFunction(() => window.game.level && window.game.level.id === 'sandbox');
  check('les constructions sont gardées', (await page.textContent('#c-builds .build-current')).includes('XOR maison'));

  console.log('Réutiliser une construction');
  await page.click('#b-new');
  await page.evaluate(() => {
    const ed = window.game.editor;
    const a = ed.addIO('IN'), b = ed.addIO('IN'), q = ed.addIO('OUT');
    const x = ed.addComponent('XOR');
    ed.circuit.wires.push({ from: { c: a.id, p: 0 }, to: { c: x.id, p: 0 } }, { from: { c: b.id, p: 0 }, to: { c: x.id, p: 1 } },
      { from: { c: x.id, p: 0 }, to: { c: q.id, p: 0 } });
    ed.changed();
  });
  page.once('dialog', (d) => d.accept('Ou exclusif'));
  await page.click('#b-save');
  check('une construction enregistrée apparaît dans la palette… sauf dans elle-même', !(await page.$('.pal-item.custom:has(b:text-is("Ou exclusif"))')));
  await page.click('#b-new');
  await page.click('.pal-item.custom:has(b:text-is("Ou exclusif"))');
  const placed = await page.evaluate(() => {
    const ed = window.game.editor;
    const u = ed.circuit.components.at(-1);
    const a = ed.addIO('IN'), b = ed.addIO('IN'), q = ed.addIO('OUT');
    ed.circuit.wires.push({ from: { c: a.id, p: 0 }, to: { c: u.id, p: 0 } }, { from: { c: b.id, p: 0 }, to: { c: u.id, p: 1 } },
      { from: { c: u.id, p: 0 }, to: { c: q.id, p: 0 } });
    ed.changed();
    return u.type;
  });
  check('elle se pose comme un composant', placed.startsWith('U:'));
  await page.click('#c-verify');
  const reused = await page.$$eval('#c-results tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent).join('')));
  check('et elle calcule comme son circuit', reused.join(' ') === '000 011 101 110', reused.join(' '));
  check('son coût compte dans le total', (await page.textContent('#c-stats')).includes('4 NAND'));
  const described = await page.evaluate(() => window.Circuits.describeCircuit(window.game.level, window.game.editor.circuit));
  check('le schéma copié la nomme', described.includes('Ouexclusif1 = Ou exclusif('), described);

  console.log('Fichier de sauvegarde');
  await page.click('#home-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-save')]);
  const file = path.join(os.tmpdir(), 'turing-test-sauvegarde.json');
  await download.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('l\'export contient le niveau réussi', data.format === 'turing-sauvegarde' && !!data.done.and);
  check('l\'export contient le circuit', Array.isArray(data.circuits.and && data.circuits.and.components));
  check('l\'export contient les dessins', data.drawings && data.drawings.and && data.drawings.and.length === 1);
  check('l\'export contient les brouillons', data.notes && data.notes.sum === 'compteur dans R4');
  check('l\'export contient les constructions', Object.values(data.builds || {}).some((b) => b.name === 'XOR maison'));

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
