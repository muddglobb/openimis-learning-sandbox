// Headless UI smoke test using Chrome DevTools Protocol over WebSocket.
// Renders the sandbox, clicks through every nav tab, and reports any
// uncaught exception / console error per tab.
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { requireChrome, sandboxUrl } = require('./_shared');

const CHROME = requireChrome();
const PORT = 9333;
const URL = sandboxUrl();

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const profile = path.join(process.env.TEMP || '.', 'cdp-prof-' + Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(2500);

  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      targets = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
      if (targets.some(t => t.type === 'page')) break;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const logs = [];

  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description || d.text || 'exception');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const t = msg.params.entry.text || '';
      if (!/net::ERR|Failed to load resource/.test(t)) logs.push(t);
    }
  };

  function send(method, params = {}) {
    return new Promise(resolve => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }

  async function evaluate(expr) {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    return r.result?.result?.value;
  }

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: URL });
  await sleep(6000);

  const tabs = [
    'simulation', 'mobile-jkn', 'pcare', 'architecture',
    'patients', 'families', 'medical', 'pricelist', 'facilities',
    'claims', 'policies', 'finance', 'tickets',
    'api-explorer', 'api-catalog', 'fhir'
  ];

  console.log('');
  console.log('  Tab-by-tab UI smoke test');
  console.log('  ' + '-'.repeat(60));

  let fails = 0;
  for (const tab of tabs) {
    const before = errors.length;

    const visible = await evaluate(`
      (function () {
        try {
          AppRouter.navigate(${JSON.stringify(tab)});
          var v = document.getElementById('view-' + ${JSON.stringify(tab)});
          return !!(v && !v.classList.contains('hidden'));
        } catch (e) { return 'ERR:' + e.message; }
      })()
    `);

    await sleep(1200);

    const newErrors = errors.length - before;
    if (visible === true && newErrors === 0) {
      console.log(`  PASS  ${tab}`);
    } else {
      fails++;
      console.log(`  FAIL  ${tab}  visible=${visible} errors=${newErrors}`);
    }
  }

  // Exercise the modal + help popup
  console.log('');
  const modalOk = await evaluate(`
    (function () {
      try {
        GraphQLHelp.open('concept');
        var m = document.getElementById('app-modal');
        var opened = m && !m.classList.contains('hidden');
        AppModal.close();
        return opened;
      } catch (e) { return 'ERR:' + e.message; }
    })()
  `);
  console.log(`  ${modalOk === true ? 'PASS' : 'FAIL'}  GraphQL help modal`);

  const previewOk = await evaluate(`
    (function () {
      try {
        GraphQLHelp.preview({ title: 't', query: '{ __typename }', variables: {}, notes: 'n' });
        var m = document.getElementById('app-modal');
        var ok = m && !m.classList.contains('hidden');
        AppModal.close();
        return ok;
      } catch (e) { return 'ERR:' + e.message; }
    })()
  `);
  console.log(`  ${previewOk === true ? 'PASS' : 'FAIL'}  GraphQL preview modal`);

  const catalogOk = await evaluate(`
    (function () {
      try {
        return ApiCatalog.OPERATIONS.length + ':' + ApiCatalog.FHIR_RESOURCES.length;
      } catch (e) { return 'ERR:' + e.message; }
    })()
  `);
  console.log(`  Catalog size: ${catalogOk}`);

  console.log('');
  console.log('  ' + '-'.repeat(60));
  console.log(`  Tab failures: ${fails}`);
  if (errors.length) {
    console.log('');
    console.log('  Uncaught exceptions:');
    [...new Set(errors)].slice(0, 20).forEach(e => console.log('   • ' + String(e).split('\n')[0]));
  }
  if (logs.length) {
    console.log('');
    console.log('  Console errors:');
    [...new Set(logs)].slice(0, 20).forEach(e => console.log('   • ' + String(e).split('\n')[0]));
  }
  console.log('');

  ws.close();
  chrome.kill();
  process.exit(fails > 0 || errors.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
