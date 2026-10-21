// Inspect the live openIMIS schema dump to confirm exact field names.
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const schema = raw.data ? raw.data.__schema : raw;
const types = schema.types;

function byName(n) {
  return types.find(t => t.name === n);
}

function typeStr(t) {
  if (!t) return '?';
  if (t.kind === 'NON_NULL') return typeStr(t.ofType) + '!';
  if (t.kind === 'LIST') return '[' + typeStr(t.ofType) + ']';
  return t.name || '?';
}

const want = process.argv.slice(3);
for (const w of want) {
  const t = byName(w);
  if (!t) {
    // fuzzy search
    const near = types.filter(x => x.name && x.name.toLowerCase().includes(w.toLowerCase().replace(/gqltype$/, '').toLowerCase()))
      .map(x => x.name).slice(0, 8);
    console.log(`\n${w}: NOT FOUND. Similar: ${near.join(', ') || '(none)'}`);
    continue;
  }
  console.log(`\n=== ${t.name} [${t.kind}] ===`);
  if (t.fields && t.fields.length) {
    t.fields.forEach(f => {
      const args = f.args && f.args.length
        ? '(' + f.args.map(a => `${a.name}: ${typeStr(a.type)}`).join(', ') + ')'
        : '';
      console.log(`  ${f.name}${args}: ${typeStr(f.type)}`);
    });
  }
  if (t.inputFields && t.inputFields.length) {
    t.inputFields.forEach(f => console.log(`  ${f.name}: ${typeStr(f.type)}`));
  }
  if (t.enumValues && t.enumValues.length) {
    console.log('  values: ' + t.enumValues.map(v => v.name).join(', '));
  }
}
