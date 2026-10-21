// Fetch the live openIMIS schema and save it cleanly.
const fs = require('fs');
const path = require('path');

const HOST = process.env.OPENIMIS_HOST || 'http://localhost';
const OUT = process.argv[2] || path.join(__dirname, '..', 'schema-snapshot.json');

const QUERY = `
  query SandboxSchemaDump {
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
          args { name type { name kind ofType { name kind ofType { name kind } } } }
          type { name kind ofType { name kind ofType { name kind } } }
        }
        inputFields { name type { name kind ofType { name kind } } }
        enumValues { name }
      }
    }
  }
`;

async function main() {
  const res = await fetch(`${HOST}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'sandbox-client' },
    body: JSON.stringify({ query: QUERY })
  });

  const json = await res.json();
  if (json.errors) {
    console.error('Introspection failed:', json.errors.map(e => e.message).join(' | '));
    process.exit(1);
  }

  const schema = json.data.__schema;
  fs.writeFileSync(OUT, JSON.stringify(schema, null, 0), 'utf8');

  const size = fs.statSync(OUT).size;
  console.log(`  Saved ${schema.types.length} types -> ${OUT}`);
  console.log(`  Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
