# One More Mile

Voice messages for marathon runners. Supporters enter a runner's bib number and
record a message in the browser. On race day, each runner opens a private link
and hears every message through their headphones.

It runs entirely on Twilio, with no phone number needed. The browser places the
call over WebRTC using the Twilio Voice SDK, so it works in countries where
Twilio numbers aren't available.

- **Functions** (`functions/`): access tokens, bib lookup, roster upload, and the TwiML for recording and playback
- **Sync** stores the roster and each runner's message list. Recordings stay in Twilio's recording storage.
- **Web app** (`web/`): a Vite + React PWA, served as Twilio Assets on the same domain

## Setup

You need git, Node 18+, and your Twilio **Account SID** and **Auth Token** from
the [Twilio Console](https://console.twilio.com).

```bash
curl -fsSL https://raw.githubusercontent.com/Suvink/one-more-mile/main/init.sh | bash
```

This clones the repo, asks for your credentials, creates the Twilio resources
(Sync service, API key, TwiML App), deploys everything, and prints your app URL,
admin URL and admin key. If you've already cloned the repo, run `npm run setup`
instead. To skip the prompts, set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.

Then open the admin page, enter the admin key, upload a `bib,name` CSV, and send
each runner their private listen link from the downloaded CSV.

| Command                     | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `npm run setup`             | Deploy, or redeploy after changes (reuses `.env`)      |
| `npm run destroy -- --yes`  | Remove everything setup created from your Twilio account |
| `npm run dev --prefix web`  | Run the web app locally (set `VITE_FUNCTIONS_BASE` in `web/.env`) |

Credentials and generated keys live in `.env`, which is git-ignored.
