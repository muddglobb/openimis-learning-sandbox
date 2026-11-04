const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENIMIS_HOST = (process.env.OPENIMIS_HOST || 'http://localhost').replace(/\/+$/, '');

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ------------------------------------------------------------
// Static frontend
// ------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function upstreamHeaders(req, extra = {}) {
  const headers = Object.assign({ 'User-Agent': 'sandbox-client' }, extra);
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  return headers;
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// Health
// ------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const started = Date.now();

  const result = {
    status: 'ok',
    sandbox: 'running',
    openimis: 'disconnected',
    openimisHost: OPENIMIS_HOST,
    graphql: false,
    fhir: false,
    latencyMs: null,
    timestamp: new Date().toISOString()
  };

  try {
    const gqlRes = await fetchWithTimeout(`${OPENIMIS_HOST}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'sandbox-client' },
      body: JSON.stringify({ query: '{ __typename }' })
    }, 10000);

    result.graphql = gqlRes.ok;
    if (gqlRes.ok) {
      result.openimis = 'connected';
      result.latencyMs = Date.now() - started;
    }
  } catch (err) {
    result.error = err.message;
  }

  if (result.graphql) {
    try {
      const fhirRes = await fetchWithTimeout(`${OPENIMIS_HOST}/api/api_fhir_r4/Patient/?_count=1`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'sandbox-client' }
      }, 8000);
      result.fhir = fhirRes.ok || fhirRes.status === 401 || fhirRes.status === 403;
    } catch (e) { /* ignore */ }
  }

  if (result.openimis !== 'connected') {
    result.status = 'degraded';
  }

  res.status(result.openimis === 'connected' ? 200 : 503).json(result);
});

// ------------------------------------------------------------
// GraphQL proxy
// ------------------------------------------------------------
app.post('/api/graphql', async (req, res) => {
  const body = req.body || {};
  if (!body.query) {
    return res.status(400).json({
      errors: [{ message: 'Body harus berisi properti "query".' }]
    });
  }

  const payload = { query: body.query };
  if (body.variables !== undefined) payload.variables = body.variables;
  if (body.operationName !== undefined) payload.operationName = body.operationName;

  try {
    const upstream = await fetchWithTimeout(`${OPENIMIS_HOST}/api/graphql`, {
      method: 'POST',
      headers: upstreamHeaders(req, {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }),
      body: JSON.stringify(payload)
    }, 45000);

    const text = await upstream.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      return res.status(502).json({
        errors: [{
          message: `Respons upstream bukan JSON (HTTP ${upstream.status}).`,
          detail: text.slice(0, 500)
        }]
      });
    }

    return res.status(upstream.status).json(json);
  } catch (err) {
    const aborted = err.name === 'AbortError';
    console.error('[graphql]', err.message);
    return res.status(aborted ? 504 : 502).json({
      errors: [{
        message: aborted
          ? 'OpenIMIS tidak merespons dalam 45 detik (timeout).'
          : `Gagal menghubungi OpenIMIS: ${err.message}`
      }]
    });
  }
});

// ------------------------------------------------------------
// FHIR R4 proxy
// ------------------------------------------------------------
app.all('/api/fhir/*', async (req, res) => {
  const fhirPath = req.params[0] || '';
  const queryIndex = req.url.indexOf('?');
  const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const targetUrl = `${OPENIMIS_HOST}/api/api_fhir_r4/${fhirPath}${queryString}`;

  const headers = upstreamHeaders(req, {
    'Accept': req.headers.accept || 'application/fhir+json, application/json'
  });
  if (req.body && Object.keys(req.body).length > 0) {
    headers['Content-Type'] = 'application/fhir+json';
  }

  const options = { method: req.method, headers };
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    options.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetchWithTimeout(targetUrl, options, 30000);
    const contentType = upstream.headers.get('content-type') || '';
    const text = await upstream.text();

    res.status(upstream.status);
    res.set('Content-Type', contentType || 'application/json');
    return res.send(text);
  } catch (err) {
    console.error('[fhir]', err.message);
    return res.status(502).json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'exception',
        diagnostics: `Gagal menghubungi OpenIMIS: ${err.message}`
      }]
    });
  }
});

// ------------------------------------------------------------
// Introspection proxy (cached)
// ------------------------------------------------------------
let schemaCache = { data: null, at: 0 };
const SCHEMA_TTL_MS = 10 * 60 * 1000;

app.get('/api/schema', async (req, res) => {
  const now = Date.now();
  if (schemaCache.data && now - schemaCache.at < SCHEMA_TTL_MS && !req.query.refresh) {
    return res.json(schemaCache.data);
  }

  const query = `
    query SandboxIntrospection {
      __schema {
        queryType { name }
        mutationType { name }
        types {
          name
          kind
          description
          fields {
            name
            description
            args { name type { name kind ofType { name kind } } }
            type { name kind ofType { name kind } }
          }
          inputFields { name type { name kind ofType { name kind } } }
          enumValues { name }
        }
      }
    }
  `;

  try {
    const upstream = await fetchWithTimeout(`${OPENIMIS_HOST}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'sandbox-client' },
      body: JSON.stringify({ query })
    }, 30000);

    const json = await upstream.json();
    if (json.errors) return res.status(400).json(json);

    schemaCache = { data: json.data.__schema, at: now };
    return res.json(schemaCache.data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// Anomaly detection (Python: aturan + IsolationForest)
// ------------------------------------------------------------
const { spawn } = require('child_process');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const ANOMALY_SCRIPT = path.join(__dirname, 'ai', 'claim_anomaly.py');
const ANOMALY_MAX_CLAIMS = 5000;

function runAnomaly(claims) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, ['-I', ANOMALY_SCRIPT]);
    let out = '';
    let err = '';
    const timer = setTimeout(() => { py.kill(); reject(new Error('Analisis melebihi 60 detik')); }, 60000);
    py.stdout.on('data', d => { out += d; });
    py.stderr.on('data', d => { err += d; });
    py.on('error', e => { clearTimeout(timer); reject(new Error(`Python tidak bisa dijalankan (${PYTHON_BIN}): ${e.message}`)); });
    py.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split('\n').pop() || `Python exit ${code}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('Output Python bukan JSON')); }
    });
    py.stdin.end(JSON.stringify({ claims }));
  });
}

app.post('/api/anomaly/claims', async (req, res) => {
  const claims = req.body && req.body.claims;
  if (!Array.isArray(claims)) {
    return res.status(400).json({ error: 'Body harus berisi array "claims".' });
  }
  if (claims.length > ANOMALY_MAX_CLAIMS) {
    return res.status(413).json({ error: `Maksimal ${ANOMALY_MAX_CLAIMS} klaim per analisis.` });
  }
  try {
    return res.json(await runAnomaly(claims));
  } catch (err) {
    console.error('[anomaly]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// SPA fallback
// ------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log('======================================================');
  console.log('  OpenIMIS Hospital & Insurance Learning Sandbox');
  console.log('======================================================');
  console.log(`  Local    : http://localhost:${PORT}`);
  console.log(`  GraphQL  : ${OPENIMIS_HOST}/api/graphql`);
  console.log(`  FHIR R4  : ${OPENIMIS_HOST}/api/api_fhir_r4/`);
  console.log('======================================================');
});

module.exports = app;
