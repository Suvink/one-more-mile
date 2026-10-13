/**
 * GET /token -> a short-lived Voice access token for the browser SDK.
 * Calls placed with it are routed through the TwiML App to /voice.
 */
exports.handler = function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Content-Type', 'application/json');

  const { AccessToken } = Twilio.jwt;
  const identity = 'web-' + Math.random().toString(36).slice(2, 10);
  const token = new AccessToken(context.ACCOUNT_SID, context.API_KEY_SID, context.API_KEY_SECRET, {
    identity,
    ttl: 3600,
  });
  token.addGrant(
    new AccessToken.VoiceGrant({ outgoingApplicationSid: context.TWIML_APP_SID, incomingAllow: false })
  );

  response.setBody({ token: token.toJwt(), identity });
  callback(null, response);
};
