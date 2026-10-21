// Capture a screenshot of each main view by driving AppRouter over CDP.
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const { requireChrome, sandboxUrl } = require('./_shared');

const CHROME = requireChrome();
const CDP_PORT = 9466;
const URL = sandboxUrl();
const OUT = process.env.SHOT_DIR || path.join(process.env.TEMP || '.', 'shots');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const profile = path.join(process.env.TEMP || '.', 'shot-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--window-size=1440,1600',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });

  await sleep(2500);
  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      targets = JSON.parse(await get(`http://127.0.0.1:${CDP_PORT}/json/list`));
      if (targets.some(t => t.type === 'page')) break;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false
  });

  await send('Page.navigate', { url: URL });
  await sleep(6000);

  const views = [
    ['simulation', 'alur-rs'],
    ['mobile-jkn', 'mobile-jkn'],
    ['pcare', 'p-care'],
    ['patients', 'pasien'],
    ['claims', 'klaim'],
    ['api-explorer', 'playground'],
    ['api-catalog', 'katalog-api'],
    ['fhir', 'fhir']
  ];

  for (const [tab, name] of views) {
    await evaluate(`AppRouter.navigate(${JSON.stringify(tab)})`);
    await sleep(1600);

    // Capture just the viewport (full page is huge on long views).
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const data = shot.result?.data;
    if (data) {
      const file = path.join(OUT, name + '.png');
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`  ${name.padEnd(12)} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    } else {
      console.log(`  ${name.padEnd(12)} FAILED`);
    }
  }

  // Also capture the GraphQL help modal
  await evaluate(`GraphQLHelp.open('concept')`);
  await sleep(900);
  const modal = await send('Page.captureScreenshot', { format: 'png' });
  if (modal.result?.data) {
    const f = path.join(OUT, 'graphql-help.png');
    fs.writeFileSync(f, Buffer.from(modal.result.data, 'base64'));
    console.log(`  graphql-help ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
  }
  await evaluate(`AppModal.close()`);

  console.log('');
  console.log('  Saved to: ' + OUT);

  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
