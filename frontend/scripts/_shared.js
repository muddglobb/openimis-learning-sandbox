// Shared helpers for the browser-driven test scripts.
// Keeps Chrome discovery and project paths portable across machines.
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_JS = path.join(PROJECT_ROOT, 'public', 'js');

/**
 * Locate a Chrome/Chromium executable.
 *
 * Order of preference:
 *   1. CHROME_PATH environment variable
 *   2. well-known install locations per platform
 *   3. executables found on PATH
 *
 * Returns the absolute path, or null when nothing is found.
 */
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [];

  if (process.platform === 'win32') {
    const roots = [
      process.env['PROGRAMFILES'],
      process.env['PROGRAMFILES(X86)'],
      process.env['LOCALAPPDATA']
    ].filter(Boolean);
    for (const root of roots) {
      candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(root, 'Chromium', 'Application', 'chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge'
    );
  }

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }

  // Last resort: ask the shell where it is.
  const names = process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of dirs) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full)) return full;
      } catch (e) { /* ignore */ }
    }
  }

  return null;
}

/** Resolve Chrome or exit with an actionable message. */
function requireChrome() {
  const chrome = findChrome();
  if (chrome) return chrome;

  console.error('');
  console.error('  Chrome/Chromium tidak ditemukan.');
  console.error('');
  console.error('  Skrip ini memerlukan browser berbasis Chromium untuk dijalankan headless.');
  console.error('  Pasang Google Chrome, atau set variabel lingkungan CHROME_PATH:');
  console.error('');
  console.error('    Windows : $env:CHROME_PATH="C:\\path\\to\\chrome.exe"');
  console.error('    macOS   : export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"');
  console.error('    Linux   : export CHROME_PATH="/usr/bin/google-chrome"');
  console.error('');
  process.exit(1);
}

/** Default sandbox URL used by the browser tests. */
function sandboxUrl() {
  return process.env.TEST_URL || process.env.SANDBOX_URL || 'http://127.0.0.1:3000/';
}

/** Default openIMIS host used by the API tests. */
function openimisHost() {
  return process.env.OPENIMIS_HOST || 'http://localhost';
}

module.exports = {
  PROJECT_ROOT,
  PUBLIC_JS,
  findChrome,
  requireChrome,
  sandboxUrl,
  openimisHost
};
