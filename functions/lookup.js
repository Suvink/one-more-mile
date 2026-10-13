/**
 * GET /lookup?bib=1234 -> { bib, name }
 * Lets supporters confirm the runner's name before recording.
 */
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Content-Type', 'application/json');

  const bib = (event.bib || '').trim();
  if (!bib) {
    response.setStatusCode(400);
    response.setBody({ error: 'Missing bib number.' });
    return callback(null, response);
  }

  try {
    const item = await context
      .getTwilioClient()
      .sync.v1.services(context.SYNC_SERVICE_SID)
      .syncMaps('roster')
      .syncMapItems(bib)
      .fetch();
    response.setBody({ bib, name: item.data.name });
  } catch (e) {
    const notFound = e.status === 404;
    response.setStatusCode(notFound ? 404 : 500);
    response.setBody({ error: notFound ? 'No runner found with that bib number.' : 'Lookup failed.' });
  }

  callback(null, response);
};
