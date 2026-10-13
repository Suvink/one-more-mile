/**
 * TwiML App voice URL for browser calls. device.connect() sends:
 *   flow=record, bib, from   -> <Record> a message, saved by /record/save
 *   flow=listen, bib, token  -> <Play> every message (token must match the roster)
 */
exports.handler = async function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const flow = (event.flow || '').trim();
  const bib = (event.bib || '').trim();
  const svc = context.getTwilioClient().sync.v1.services(context.SYNC_SERVICE_SID);
  const messages = (opts) => svc.syncLists(`messages_${bib}`).syncListItems.list(opts).catch(() => []);

  if (!bib) {
    twiml.say('No bib number was provided.');
    twiml.hangup();
    return callback(null, twiml);
  }

  try {
    const runner = await svc.syncMaps('roster').syncMapItems(bib).fetch();
    const { name } = runner.data;

    if (flow === 'record') {
      const maxMessages = parseInt(context.MAX_MESSAGES_PER_BIB || '50', 10);
      if ((await messages({ pageSize: maxMessages + 1 })).length >= maxMessages) {
        twiml.say(`Sorry, ${name} has already received the maximum number of messages. Thank you for your support!`);
        twiml.hangup();
        return callback(null, twiml);
      }

      const from = (event.from || '').trim();
      twiml.say(`Recording a message for ${name}. Speak after the beep, then press stop when you are done.`);
      twiml.record({
        maxLength: parseInt(context.MAX_RECORDING_SECONDS || '120', 10),
        playBeep: true,
        finishOnKey: '#', // sent by the browser's "Stop & send" button
        action: `/record/save?bib=${encodeURIComponent(bib)}&from=${encodeURIComponent(from)}`,
        method: 'POST',
      });
      twiml.say('We did not catch a message. Goodbye.');
    } else if (flow === 'listen') {
      if (!runner.data.token || runner.data.token !== (event.token || '').trim()) {
        twiml.say('This link is not valid. Please check with your organizer.');
        twiml.hangup();
        return callback(null, twiml);
      }

      const list = (await messages({ order: 'desc', pageSize: 100 })).filter((m) =>
        String(m.data.recordingUrl || '').startsWith('https://api.twilio.com/')
      );
      if (list.length === 0) {
        twiml.say(`Hi ${name}! No messages yet, but keep going, you've got this!`);
      } else {
        const n = list.length;
        twiml.say(`Hi ${name}! You have ${n} ${n === 1 ? 'message' : 'messages'}. Here ${n === 1 ? 'it is' : 'they are'}.`);
        // Recording media needs auth; Twilio fetches it with the API key, the browser never sees it.
        const cred = `${context.API_KEY_SID}:${context.API_KEY_SECRET}`;
        for (const msg of list) {
          if (msg.data.from) twiml.say(`Message from ${msg.data.from}.`);
          twiml.play(msg.data.recordingUrl.replace('https://', `https://${cred}@`) + '.mp3');
        }
        twiml.say('That was all your messages. Keep running!');
      }
    } else {
      twiml.say('Unknown request.');
    }
  } catch (e) {
    twiml.say(e.status === 404 ? 'We could not find that bib number.' : 'Sorry, something went wrong.');
  }

  twiml.hangup();
  callback(null, twiml);
};
