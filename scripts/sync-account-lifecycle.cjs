// The services deploy independently; ship the same policy source in each.
const fs = require('node:fs');
const path = require('node:path');
const check = process.argv.includes('--check');
const target = process.argv.slice(2).find((arg) => arg !== '--check');
if (!target) throw new Error('Usage: node scripts/sync-account-lifecycle.cjs <mobile-backend-directory> [--check]');
const normalize = (content) => content.replace(/\r\n/g, '\n');
const source = normalize(fs.readFileSync(path.join(__dirname, '../server/lib/accountLifecycle.js'), 'utf8'));
const destination = path.resolve(target, 'lib/accountLifecycle.js');
if (check) {
  if (source !== normalize(fs.readFileSync(destination, 'utf8'))) throw new Error('Account lifecycle policies differ; run sync first.');
  console.log('Account lifecycle policies match.');
} else {
  fs.writeFileSync(destination, source);
  console.log('Account lifecycle policy synchronized.');
}
