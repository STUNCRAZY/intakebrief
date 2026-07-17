const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const logs = [
  path.join(root, '.runtime', 'stripe-listen.out.log'),
  path.join(root, '.runtime', 'stripe-listen.err.log'),
].filter(fs.existsSync).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const secret = logs.match(/whsec_[A-Za-z0-9]+/)?.[0];
if (!secret) throw new Error('Webhook signing secret not found in Stripe listener output');

const envPath = path.join(root, '.env.local');
const current = fs.readFileSync(envPath, 'utf8');
const updated = current.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${secret}`);
if (updated === current && !/^STRIPE_WEBHOOK_SECRET=/m.test(current)) {
  throw new Error('STRIPE_WEBHOOK_SECRET line is missing from .env.local');
}
fs.writeFileSync(envPath, updated);
console.log('Stripe webhook secret saved to .env.local');
