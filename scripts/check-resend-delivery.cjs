const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envText = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const key = envText.match(/^RESEND_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('RESEND_API_KEY is empty');

async function main() {
  const response = await fetch('https://api.resend.com/emails', {
    headers: { authorization: `Bearer ${key}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message ?? `Resend HTTP ${response.status}`);
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recent = (data?.data ?? [])
    .filter((email) => Date.parse(email.created_at) >= cutoff)
    .map((email) => ({
      createdAt: email.created_at,
      subject: email.subject,
      to: email.to,
      lastEvent: email.last_event,
    }));
  console.log(JSON.stringify(recent, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
