const fs = require('node:fs');
const path = require('node:path');
const check = process.argv.includes('--check');
const target = process.argv.slice(2).find(arg => arg !== '--check');
if (!target) throw new Error('Usage: node scripts/sync-approval-notifications.cjs <mobile-backend-directory> [--check]');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
for (const name of ['approveLink.js', 'purokNotify.js', 'notificationContact.js', 'emailDelivery.js']) {
  const source = read(path.join(__dirname, '../server/lib', name));
  const destination = path.resolve(target, 'lib', name);
  if (check) {
    if (!fs.existsSync(destination) || source !== read(destination)) throw new Error(`${name} differs; synchronize before deploying.`);
  } else fs.writeFileSync(destination, source);
}
console.log(check ? 'Approval notification modules match.' : 'Approval notification modules synchronized.');
