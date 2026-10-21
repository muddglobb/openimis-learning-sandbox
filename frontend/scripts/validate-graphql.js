// Validate every GraphQL document embedded in the sandbox source.
const fs = require('fs');
const path = require('path');
const { parse } = require('graphql');
const { PUBLIC_JS } = require('./_shared');

const ROOT = PUBLIC_JS;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/**
 * Extract only template literals that are unambiguously GraphQL:
 *   const X = `...`            where the body starts with query/mutation/fragment/{ after trimming
 *   graphql(`...`)
 *   preview({ ... query: `...` })
 */
function extractDocs(src) {
  const docs = [];

  const patterns = [
    // const query = `...`
    /\bconst\s+(?:query|mutation|doc|gql)\w*\s*=\s*`([\s\S]*?)`;/g,
    // graphql(`...`)
    /\bgraphql\(\s*`([\s\S]*?)`/g,
    // query: `...`
    /\bquery:\s*`([\s\S]*?)`\s*,/g
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) docs.push(m[1]);
  }

  return docs;
}

function looksLikeGraphQL(doc) {
  const t = doc.trim();
  if (t.startsWith('<')) return false;            // HTML
  if (/\bclass=/.test(t)) return false;           // HTML
  return /^(query|mutation|fragment|\{)/.test(t);
}

const files = walk(ROOT);
let total = 0, ok = 0;
const failures = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const docs = extractDocs(src).filter(looksLikeGraphQL);
  for (const doc of docs) {
    total++;
    // Replace interpolations with a harmless name
    const normalized = doc.replace(/\$\{[^}]*\}/g, 'X');
    try {
      parse(normalized);
      ok++;
    } catch (e) {
      failures.push({
        file: path.basename(file),
        msg: e.message.split('\n')[0],
        snippet: normalized.trim().slice(0, 160).replace(/\s+/g, ' ')
      });
    }
  }
}

console.log('');
console.log(`  GraphQL documents found : ${total}`);
console.log(`  Parsed successfully     : ${ok}`);
console.log(`  Failed                  : ${failures.length}`);
console.log('');

if (failures.length) {
  for (const f of failures) {
    console.log(`  FAIL ${f.file}`);
    console.log(`       ${f.msg}`);
    console.log(`       ${f.snippet}`);
    console.log('');
  }
  process.exit(1);
}

// Validate catalog examples specifically.
const catalogPath = path.join(ROOT, 'api-catalog-data.js');
const catalogSrc = fs.readFileSync(catalogPath, 'utf8');
const exampleRe = /example:\s*`([^`]*?)`,\s*variables:/g;
let em;
let catTotal = 0, catOk = 0;
const catFail = [];
while ((em = exampleRe.exec(catalogSrc))) {
  catTotal++;
  try { parse(em[1]); catOk++; }
  catch (e) { catFail.push(e.message.split('\n')[0] + ' :: ' + em[1].trim().slice(0, 90).replace(/\s+/g, ' ')); }
}
console.log(`  Catalog examples        : ${catTotal} found, ${catOk} parsed, ${catFail.length} failed`);
if (catFail.length) {
  catFail.slice(0, 12).forEach(m => console.log('   • ' + m));
  process.exit(1);
}
console.log('  ALL GRAPHQL DOCUMENTS VALID');
console.log('');
