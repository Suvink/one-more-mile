#!/usr/bin/env node
/**
 * Provisions One More Mile on your Twilio account and deploys it.
 *
 *   npm run setup
 *
 * Creates a Sync service, a Voice API key, a TwiML App and an admin key,
 * writes them to .env, builds the web app, deploys Functions + Assets, and
 * points the TwiML App at the deployed /voice. Re-running reuses .env.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import twilio from 'twilio';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, '.env');
const SERVICE_NAME = process.env.OMM_SERVICE_NAME || 'one-more-mile';

const runLive = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const step = (m) => console.log(`\n▸ ${m}`);
const die = (m) => {
  console.error(`\n✖ ${m}`);
  process.exit(1);
};

function readEnv() {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else if (s.includes('\n') || s.includes('\r')) rl.output.write('\n');
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

const env = readEnv();

// 1. Twilio credentials
env.ACCOUNT_SID ||= process.env.TWILIO_ACCOUNT_SID || '';
env.AUTH_TOKEN ||= process.env.TWILIO_AUTH_TOKEN || '';
if (!env.ACCOUNT_SID || !env.AUTH_TOKEN) {
  if (!process.stdin.isTTY) die('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or run this in a terminal.');
  console.log('Enter your Twilio credentials (Console → Account Info: https://console.twilio.com).');
  env.ACCOUNT_SID = await ask('Account SID: ');
  env.AUTH_TOKEN = await ask('Auth Token:  ', { hidden: true });
}
if (!/^AC[0-9a-f]{32}$/i.test(env.ACCOUNT_SID)) die('That Account SID does not look right (it starts with AC).');

const client = twilio(env.ACCOUNT_SID, env.AUTH_TOKEN);
try {
  const account = await client.api.v2010.accounts(env.ACCOUNT_SID).fetch();
  step(`Using Twilio account "${account.friendlyName}"`);
} catch {
  die('Twilio rejected those credentials. Check the Account SID and Auth Token.');
}

// 2. Provision whatever is missing
if (!env.SYNC_SERVICE_SID) {
  step('Creating Sync service...');
  env.SYNC_SERVICE_SID = (await client.sync.v1.services.create({ friendlyName: SERVICE_NAME })).sid;
}
if (!env.API_KEY_SID || !env.API_KEY_SECRET) {
  step('Creating Voice API key...');
  const key = await client.newKeys.create({ friendlyName: `${SERVICE_NAME}-voice` });
  env.API_KEY_SID = key.sid;
  env.API_KEY_SECRET = key.secret;
}
if (!env.TWIML_APP_SID) {
  step('Creating TwiML App...');
  env.TWIML_APP_SID = (await client.applications.create({ friendlyName: SERVICE_NAME })).sid;
}
env.ADMIN_SECRET ||= 'omm_' + crypto.randomBytes(18).toString('base64url');
env.MAX_RECORDING_SECONDS ||= '120';
env.MAX_MESSAGES_PER_BIB ||= '50';

fs.writeFileSync(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
step('Wrote .env');

// 3. Build the web app and stage it as Twilio Assets
step('Installing web dependencies...');
runLive('npm install --prefix web --no-audit --no-fund');
step('Building the web app...');
runLive('npm run build --prefix web');

const assets = path.join(root, 'assets');
fs.rmSync(assets, { recursive: true, force: true });
fs.cpSync(path.join(root, 'web', 'dist'), assets, { recursive: true });

// 4. Deploy Functions + Assets (twilio-run reads ACCOUNT_SID/AUTH_TOKEN from .env)
step('Deploying to Twilio Serverless (this can take a minute)...');
runLive(`npx --no-install twilio-run deploy --service-name ${SERVICE_NAME} --override-existing-project`);

const deployInfo = JSON.parse(fs.readFileSync(path.join(root, '.twiliodeployinfo'), 'utf8'));
const serviceSid = Object.entries(deployInfo).find(([k]) => k.startsWith(env.ACCOUNT_SID))?.[1]?.serviceSid;
if (!serviceSid) die('Deployed, but could not find the service in .twiliodeployinfo.');
const [environment] = await client.serverless.v1.services(serviceSid).environments.list({ limit: 1 });
const domain = environment?.domainName;
if (!domain) die('Deployed, but could not find the service domain.');

// 5. Point the TwiML App at the deployed /voice
step(`Pointing the TwiML App at https://${domain}/voice ...`);
await client.applications(env.TWIML_APP_SID).update({ voiceUrl: `https://${domain}/voice`, voiceMethod: 'POST' });

console.log(`
✔ One More Mile is live.

  App    https://${domain}/index.html
  Admin  https://${domain}/index.html#/admin
  Admin key: ${env.ADMIN_SECRET}

Next: open the Admin page, enter the key, and upload a roster CSV
(there's a template download on that page). Then share each runner's link.
`);
