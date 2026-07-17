const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.runtime');
const envPath = path.join(root, '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const match = envText.match(/^STRIPE_SECRET_KEY=(.+)$/m);
if (!match || !match[1].trim()) throw new Error('STRIPE_SECRET_KEY is empty');

fs.mkdirSync(runtime, { recursive: true });
const stdout = fs.openSync(path.join(runtime, 'stripe-listen.out.log'), 'a');
const stderr = fs.openSync(path.join(runtime, 'stripe-listen.err.log'), 'a');
const stripe = process.env.STRIPE_CLI_PATH || 'stripe';
const child = spawn(stripe, [
  'listen',
  '--forward-to', 'http://localhost:3000/api/webhooks/stripe',
  '--events', 'checkout.session.completed,checkout.session.expired,payment_intent.payment_failed',
], {
  cwd: root,
  detached: true,
  windowsHide: true,
  stdio: ['ignore', stdout, stderr],
  env: { ...process.env, STRIPE_API_KEY: match[1].trim() },
});
child.unref();
fs.writeFileSync(path.join(runtime, 'stripe-listen.pid'), String(child.pid));
console.log(`Stripe listener started (PID ${child.pid})`);
