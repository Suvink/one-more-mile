#!/usr/bin/env node
/**
 * Removes everything setup.mjs created on your Twilio account.
 *
 *   npm run destroy            # shows what will be removed
 *   npm run destroy -- --yes   # removes it
 *
 * Twilio-hosted call recordings are not deleted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import twilio from 'twilio';

const root = path.dirname(fileURLToPath(import.meta.url));

if (!process.argv.includes('--yes')) {
  console.log(`This permanently deletes the One More Mile resources on your Twilio account:
  - the Serverless service (Functions + the web app Assets)
  - the Sync service (the roster AND every recorded message index)
  - the Voice API key
  - the TwiML App

Twilio-hosted call recordings are NOT deleted.

Re-run to confirm:  npm run destroy -- --yes`);
  process.exit(0);
}

const env = {};
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
if (!env.ACCOUNT_SID || !env.AUTH_TOKEN) {
  console.error('No ACCOUNT_SID / AUTH_TOKEN in .env. Run this from the folder you ran setup in.');
  process.exit(1);
}
const client = twilio(env.ACCOUNT_SID, env.AUTH_TOKEN);

let serviceSid;
const infoPath = path.join(root, '.twiliodeployinfo');
if (fs.existsSync(infoPath)) {
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  serviceSid = Object.entries(info).find(([k]) => k.startsWith(env.ACCOUNT_SID))?.[1]?.serviceSid;
}

async function remove(label, fn) {
  try {
    await fn();
    console.log(`  removed ${label}`);
  } catch (e) {
    console.log(`  ! could not remove ${label}: ${e.message}`);
  }
}

console.log('\n▸ Removing resources...');
if (serviceSid) await remove('Serverless service', () => client.serverless.v1.services(serviceSid).remove());
else console.log('  ! No .twiliodeployinfo found; remove the Serverless service in the Console if needed.');
if (env.TWIML_APP_SID) await remove('TwiML App', () => client.applications(env.TWIML_APP_SID).remove());
if (env.API_KEY_SID) await remove('Voice API key', () => client.keys(env.API_KEY_SID).remove());
if (env.SYNC_SERVICE_SID) await remove('Sync service', () => client.sync.v1.services(env.SYNC_SERVICE_SID).remove());

console.log('\n✔ Teardown complete. You can now delete .env and .twiliodeployinfo.');
