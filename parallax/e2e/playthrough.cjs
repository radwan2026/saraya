// Browser-level playthrough: builds nothing, starts `vite preview`, then plays PARALLAX from a fresh
// save to the completion screen through the real input path (crosshair raycasts, E, Q, W, panels).
// Usage: npm run build && npm run test:e2e   (needs Playwright with Chromium available)
// Env: QUALITY=low|medium|high (default low), SHOTS=<dir> to save screenshots, PORT (default 4174).

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const PORT = Number(process.env.PORT || 4174);
const QUALITY = process.env.QUALITY || 'low';
const SHOTS = process.env.SHOTS || '';
const URL = `http://localhost:${PORT}/?debug&quality=${QUALITY}`;
const root = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

(async () => {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('dist/ is missing. Run npm run build first.');
    process.exit(2);
  }
  const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  let page;
  try {
    await waitForServer();
    page = await browser.newPage({ viewport: { width: Number(process.env.W || 800), height: Number(process.env.H || 450) } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const P = (fn, arg) => page.evaluate(fn, arg);
    const state = () => P(() => window.__parallax.state());
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
    const settle = (ms = 400) => page.waitForTimeout(ms);
    /** Stand somewhere, look at something, and press E on whatever the crosshair finds. */
    const nextFrames = async (n = 2) => {
      const f0 = await P(() => window.__parallax.frames());
      await page.waitForFunction((f) => window.__parallax.frames() >= f, f0 + n, { timeout: 120000 });
    };
    let retries = 0;
    const use = async (stand, lookAt, expectId, done, noEffect = false) => {
      await ready();
      await P(([x, z]) => window.__parallax.teleport(x, z), stand);
      await P(([x, y, z]) => window.__parallax.look(x, y, z), lookAt);
      await nextFrames();
      await page.waitForFunction((id) => window.__parallax.target() === id, expectId, { timeout: 60000 }).catch(() => {});
      const got = await P(() => window.__parallax.target());
      assert(got === expectId, `crosshair finds ${expectId} (got ${got})`);
      for (let attempt = 0; attempt < (noEffect ? 1 : 2); attempt++) {
        const before = (await state()).stats.interactions;
        await page.keyboard.press('KeyE');
        await page.waitForFunction((b) => window.__parallax.state().stats.interactions > b, before, { timeout: 30000 }).catch(() => {});
        if (noEffect || (await state()).stats.interactions > before) break;
        retries++;
        console.log(`  ! E press on ${expectId} was not received; retrying`);
        await ready();
      }
      await settle(150);
      if (done) await page.waitForFunction(done, null, { timeout: 8000 }).catch(() => {});
    };
    const shift = async (want) => {
      await ready();
      await page.keyboard.press('KeyQ');
      await settle(300);
      const s = await state();
      assert(s.timeline === want, `shifted to ${want}`);
    };
    const panel = (act, data) => P(([a, d]) => window.__parallax.panelAct(a, d), [act, data || {}]);
    const ready = () => page.waitForFunction(() => window.__parallax.ready(), null, { timeout: 120000 }).catch(async (e) => { console.error('not ready:', JSON.stringify(await P(() => window.__parallax.why()))); throw e; });
    const closePanel = async () => { await P(() => window.__parallax.closePanel()); await ready(); };

    console.log(`Loading ${URL}`);
    await page.goto(URL, { timeout: 180000 });
    await page.waitForFunction(() => window.__parallax && window.__parallax.mode() === 'menu', null, { timeout: 120000 });
    await P(() => localStorage.removeItem('parallax.save'));
    await P((k) => window.__parallax.setTimeScale(k), Number(process.env.TIMESCALE || 6));
    console.log('average real frame time:', await P(() => window.__parallax.frameMs()), 'ms');
    await shot('01-menu');

    console.log('Intro');
    await page.click('#mBegin');
    if (await page.isVisible('#mConfirm')) await page.click('#mBeginYes');
    await settle(1500);
    assert((await P(() => window.__parallax.mode())) === 'intro', 'intro sequence is playing');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__parallax.mode() === 'play', null, { timeout: 20000 });
    assert(true, 'intro can be skipped and control is handed over');
    await settle(800);
    await shot('02-start');

    console.log('Movement and collision');
    let s = await state();
    const z0 = s.player.z;
    await P(() => window.__parallax.teleport(2.2, 12.2, 0));
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__parallax.state().player.z < 10.5, null, { timeout: 30000 }).catch(() => {});
    await page.keyboard.up('KeyW');
    s = await state();
    assert(s.player.z < z0 - 0.5, `walking forward moves the player (z ${z0.toFixed(2)} → ${s.player.z.toFixed(2)})`);
    await P(() => window.__parallax.teleport(0, 10.8, 0));
    await page.keyboard.down('KeyW');
    await settle(2500);
    await page.keyboard.up('KeyW');
    s = await state();
    assert(Math.hypot(s.player.x - 0, s.player.z - 9.4) >= 0.8, 'the pedestal blocks the player');
    await page.keyboard.press('KeyQ');
    await settle(200);
    assert((await state()).timeline === 'present', 'shifting is locked before the keepsake is taken');

    console.log('Onboarding: the keepsake');
    await use([-0.22, 10.7], [-0.22, 1.15, 9.4], 'keepsake-compass');
    s = await state();
    assert(s.keepsake === 'compass' && s.inventory.includes('compass'), 'took the compass');
    await settle(1500);
    await shift('echo');
    await shot('03-echo');
    await shift('present');

    console.log('Audio');
    await page.waitForFunction(() => window.__parallax.audioLevel() > 0.002, null, { timeout: 60000 }).catch(() => {});
    const level = await P(() => window.__parallax.audioLevel());
    assert(level > 0.002, `the mix is audible (RMS ${level.toFixed(4)})`);
    await page.waitForFunction(() => window.__parallax.audioLayers().present > 0.9, null, { timeout: 60000 }).catch(() => {});
    let layers = await P(() => window.__parallax.audioLayers());
    assert(layers.state === 'running' && layers.present > 0.9 && layers.echo < 0.1, `present ambience playing (present ${layers.present.toFixed(2)}, echo ${layers.echo.toFixed(2)})`);
    await shift('echo');
    await page.waitForFunction(() => window.__parallax.audioLayers().echo > 0.9, null, { timeout: 60000 }).catch(() => {});
    layers = await P(() => window.__parallax.audioLayers());
    assert(layers.echo > 0.9 && layers.present < 0.1, `shifting cross-fades into the echo layer (present ${layers.present.toFixed(2)}, echo ${layers.echo.toFixed(2)})`);
    await shift('present');

    console.log('Journal, pause and settings');
    await ready();
    await page.keyboard.press('Tab');
    await page.waitForSelector('#journal:not([hidden])', { timeout: 30000 });
    assert((await page.locator('#journalBody .entry').count()) >= 2, 'journal opens with Tab and lists clues');
    await page.click('#journalTabs [data-tab="items"]');
    assert((await page.textContent('#journalBody')).includes('Brass compass'), 'items tab lists the keepsake');
    await page.keyboard.press('Tab');
    await page.waitForSelector('#journal', { state: 'hidden', timeout: 30000 });
    await ready();
    await page.keyboard.press('Escape');
    await page.waitForSelector('#pause:not([hidden])', { timeout: 30000 });
    assert(true, 'Escape pauses the game');
    await page.click('#pSettings');
    await page.waitForSelector('#settings:not([hidden])');
    await page.fill('#sMaster', '0.5');
    await page.dispatchEvent('#sMaster', 'input');
    const stored = await P(() => JSON.parse(localStorage.getItem('parallax.settings')).master);
    assert(stored === 0.5, 'settings are applied and remembered');
    await page.click('#sDone');
    await page.click('#pResume');
    await ready();
    assert(true, 'resume returns control');

    console.log('Puzzle A — shadow archive');
    const target = [2, 0, 2];
    for (let i = 0; i < 3; i++) {
      const z = [2.6, 4.6, 6.6][i];
      for (let n = 0; n < 4 && (await state()).shadow.rotations[i] !== target[i]; n++) await use([-7.4, z], [-9, 0.35, z], `sculpture-${i}`);
      assert((await state()).shadow.rotations[i] === target[i], `plate ${i} turned to its target`);
    }
    assert(!(await state()).shadow.solved, 'pattern does not unlock in the present');
    await P(() => window.__parallax.teleport(-5.6, 4.6));
    await P(() => window.__parallax.look(-11.9, 2.2, 4.6));
    await shift('echo');
    await page.waitForFunction(() => window.__parallax.state().shadow.solved, null, { timeout: 5000 });
    assert(true, 'pattern unlocks in the echo');
    await settle(3500);
    await shot('04-shadows');
    await use([-10.5, 9.2], [-11.9, 1.1, 9.2], 'compartment');
    assert((await state()).inventory.includes('ring-segment'), 'took the ring segment');
    await use([-10.5, 9.2], [-11.9, 1.1, 9.2], 'compartment', null, true);
    assert((await state()).inventory.filter((i) => i === 'ring-segment').length === 1, 'the reward is not duplicated');

    console.log('Puzzle B — memory engine');
    await use([0, -3.4], [0, 1.1, -6], 'engine-console');
    assert(await page.isVisible('#panel'), 'engine console opens');
    await panel('turn', { i: '1', d: '1' });
    assert((await state()).engine.rings[1] === 3, 'rings cannot be moved in the echo');
    await closePanel();
    await shift('present');
    await use([0, -3.4], [0, 1.1, -6], 'engine-console');
    await panel('engage');
    assert(!(await state()).engine.solved, 'engaging without the segment fails');
    await panel('install');
    assert((await state()).engine.segmentInstalled, 'segment fitted');
    const want = [4, 6, 0];
    for (let i = 0; i < 3; i++) {
      for (let n = 0; n < 8 && (await state()).engine.rings[i] !== want[i]; n++) await panel('turn', { i: String(i), d: '1' });
    }
    await panel('turn', { i: '2', d: '1' });
    await panel('engage');
    assert(!(await state()).engine.solved, 'a wrong calibration is rejected');
    await panel('turn', { i: '2', d: '-1' });
    await panel('engage');
    assert((await state()).engine.solved, 'engine calibrated');
    await shot('05-engine');
    await closePanel();
    await settle(3500);

    console.log('Persistence: reload and continue');
    await page.reload({ timeout: 180000 });
    await page.waitForFunction(() => window.__parallax && window.__parallax.mode() === 'menu', null, { timeout: 120000 });
    await P((k) => window.__parallax.setTimeScale(k), Number(process.env.TIMESCALE || 6));
    assert(await page.isVisible('#mContinue'), 'continue is offered');
    await page.click('#mContinue');
    await page.waitForFunction(() => window.__parallax.mode() === 'play', null, { timeout: 20000 });
    s = await state();
    assert(s.engine.solved && s.shadow.solved && s.keepsake === 'compass', 'progress survives a reload');

    console.log('Puzzle C — impossible bridge');
    await use([1.6, -7.4], [2.5, 1.3, -8.3], 'anchor');
    assert(!(await state()).bridge.anchored, 'anchoring in the present holds nothing');
    await shift('echo');
    await use([1.6, -7.4], [2.5, 1.3, -8.3], 'anchor');
    assert((await state()).bridge.anchored, 'anchored in the echo');
    await settle(3500);
    // the quarantine field blocks the echo crossing
    await P(() => window.__parallax.teleport(0, -9.6, 0));
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__parallax.state().player.z < -14, null, { timeout: 40000 }).catch(() => {});
    await settle(1500);
    await page.keyboard.up('KeyW');
    s = await state();
    assert(s.player.z > -15 && !s.bridge.crossed, `the quarantine field stops the echo crossing (z ${s.player.z.toFixed(2)})`);
    await shot('06-barrier');
    await shift('present');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__parallax.state().bridge.crossed, null, { timeout: 40000 }).catch(() => {});
    await page.keyboard.up('KeyW');
    assert((await state()).bridge.crossed, 'crossed the bridge in the present');

    console.log('Puzzle D — the voice that arrived early');
    await use([-6.6, -20.6], [-8.5, 1.8, -21.6], 'machine-drip');
    await use([6.6, -20.6], [8.5, 1.4, -21.6], 'machine-relay');
    await use([-6.0, -17.6], [-8, 1.3, -18], 'machine-turbine', null, true);
    assert(!(await state()).voice.registered.includes('turbine'), 'the turbine is silent in the present');
    await shift('echo');
    await use([-6.0, -17.6], [-8, 1.3, -18], 'machine-turbine');
    await use([6.2, -17.6], [8, 2, -18], 'machine-bell');
    s = await state();
    assert(['drip', 'relay', 'turbine', 'bell'].every((x) => s.voice.registered.includes(x)), 'all four machines registered');
    await use([-3.0, -16.0], [-3.6, 1.2, -17.4], 'voice-console');
    await panel('play');
    await settle(800);
    for (const src of ['turbine', 'drip', 'bell', 'keepsake', 'relay']) await panel('press', { src });
    assert(!(await state()).voice.solved, 'a wrong order is rejected');
    for (const src of ['turbine', 'drip', 'keepsake', 'bell', 'relay']) await panel('press', { src });
    assert((await state()).voice.solved, 'recording matched');
    await shot('07-voice');
    await closePanel();

    console.log('Puzzle E — the final parallax');
    await use([3.4, -15.4], [3.6, 1.2, -16.8], 'parallax-console');
    await panel('core');
    assert((await state()).parallax.coreInserted, 'keepsake seated in the core');
    for (const [i, g] of ['wave', 'span', 'orbit', 'eye'].entries()) { await panel('slot', { i: String(i) }); await panel('glyph', { g }); }
    await panel('activate');
    assert(!(await state()).completed, 'activation in the echo fails');
    await closePanel();
    await shift('present');
    await use([3.4, -15.4], [3.6, 1.2, -16.8], 'parallax-console');
    await panel('activate');
    assert(!(await state()).completed, 'the wrong bearing fails');
    for (let n = 0; n < 8 && (await state()).parallax.bearing !== 2; n++) await panel('bear', { d: '1' });
    assert((await state()).parallax.bearing === 2, 'engine turned to face east, where the room kept the hourglass');
    await shot('08-steering');
    await panel('activate');
    s = await state();
    assert(s.completed && s.parallax.solved, 'the final mechanism opens');
    await page.waitForFunction(() => window.__parallax.mode() === 'ending', null, { timeout: 5000 });
    await settle(5000);
    await shot('09-ending');
    await page.waitForSelector('#ending:not([hidden])', { timeout: 120000 });
    await settle(1500);
    await shot('10-ending-text');
    for (let i = 0; i < 8 && !(await page.isVisible('#complete')); i++) { await page.click('#endingNext').catch(() => {}); await settle(400); }
    await page.waitForSelector('#complete:not([hidden])', { timeout: 30000 });
    assert(true, 'completion screen shown');
    await shot('11-complete');

    const fatal = errors.filter((e) => !/favicon/.test(e));
    assert(fatal.length === 0, 'no console errors' + (fatal.length ? ':\n' + fatal.join('\n') : ''));
    console.log(`\nPLAYTHROUGH PASSED${retries ? ` (input retries: ${retries})` : ''}`);
  } catch (err) {
    console.error('\n' + err.message);
    if (errors.length) console.error('Console errors:\n' + errors.join('\n'));
    if (page && SHOTS) await page.screenshot({ path: path.join(SHOTS, 'failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
})();
