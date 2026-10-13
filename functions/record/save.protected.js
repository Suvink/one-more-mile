/**
 * <Record> action: append the recording to the runner's Sync list.
 */
exports.handler = async function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const bib = (event.bib || '').trim();
  const { RecordingUrl: recordingUrl, RecordingSid: recordingSid } = event;

  if (!bib || !recordingUrl) {
    twiml.say('Sorry, the message could not be saved. Please try again.');
    twiml.hangup();
    return callback(null, twiml);
  }

  const maxMessages = parseInt(context.MAX_MESSAGES_PER_BIB || '50', 10);
  const svc = context.getTwilioClient().sync.v1.services(context.SYNC_SERVICE_SID);
  const listName = `messages_${bib}`;

  try {
    try {
      await svc.syncLists(listName).fetch();
    } catch (e) {
      if (e.status !== 404) throw e;
      await svc.syncLists.create({ uniqueName: listName });
    }

    // Re-check the cap in case several supporters recorded at once.
    const existing = await svc.syncLists(listName).syncListItems.list({ pageSize: maxMessages + 1 });
    if (existing.length >= maxMessages) {
      twiml.say('Sorry, this runner has already received the maximum number of messages.');
      twiml.hangup();
      return callback(null, twiml);
    }

    await svc.syncLists(listName).syncListItems.create({
      data: {
        recordingSid,
        recordingUrl,
        from: event.from || '',
        createdAt: new Date().toISOString(),
      },
    });

    twiml.say('Thanks! Your message has been saved. The runner will hear it on race day.');
  } catch (e) {
    twiml.say('Sorry, there was a problem saving your message. Please try again.');
  }

  twiml.hangup();
  callback(null, twiml);
};
