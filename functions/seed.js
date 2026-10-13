/**
 * POST /seed  (header: x-admin-secret)  body: { rows: [{ bib, name }] }
 * Replaces the roster: upserts each row and removes runners not in the upload.
 * Existing runners keep their token, so their listen links stay the same.
 */
const crypto = require('crypto');

exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret');
  response.appendHeader('Content-Type', 'application/json');

  const fail = (status, body) => {
    response.setStatusCode(status);
    response.setBody(body);
    callback(null, response);
  };

  const headers = (event.request && event.request.headers) || {};
  if (!context.ADMIN_SECRET || headers['x-admin-secret'] !== context.ADMIN_SECRET) {
    return fail(401, { error: 'Invalid admin key.' });
  }

  let rows = event.rows;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = undefined;
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) return fail(400, { error: 'No rows provided.' });

  const details = [];
  const seen = new Set();
  const clean = [];
  rows.forEach((r, i) => {
    const bib = String(r?.bib ?? '').trim();
    const name = String(r?.name ?? '').trim();
    if (!bib) details.push(`Row ${i + 1}: missing bib`);
    else if (!name) details.push(`Row ${i + 1}: missing name`);
    else if (seen.has(bib)) details.push(`Row ${i + 1}: duplicate bib "${bib}"`);
    else {
      seen.add(bib);
      clean.push({ bib, name });
    }
  });
  if (details.length) return fail(422, { error: 'Validation failed.', details });

  const svc = context.getTwilioClient().sync.v1.services(context.SYNC_SERVICE_SID);
  const roster = svc.syncMaps('roster');
  const linkFor = (bib, token) =>
    `https://${context.DOMAIN_NAME}/index.html#/for/${encodeURIComponent(bib)}?t=${token}`;

  try {
    try {
      await roster.fetch();
    } catch (e) {
      if (e.status !== 404) throw e;
      await svc.syncMaps.create({ uniqueName: 'roster' });
    }

    const existing = await roster.syncMapItems.list({ limit: 5000 });
    const tokens = new Map(existing.map((it) => [it.key, it.data.token]));
    const keep = new Set(clean.map((r) => r.bib));

    for (const it of existing) {
      if (!keep.has(it.key)) await roster.syncMapItems(it.key).remove();
    }

    const results = [];
    for (const { bib, name } of clean) {
      const token = tokens.get(bib) || crypto.randomBytes(24).toString('base64url');
      if (tokens.has(bib)) await roster.syncMapItems(bib).update({ data: { name, token } });
      else await roster.syncMapItems.create({ key: bib, data: { name, token } });
      results.push({ bib, name, listen_link: linkFor(bib, token) });
    }

    response.setBody({ count: results.length, results });
    callback(null, response);
  } catch (e) {
    fail(500, { error: 'Seeding failed partway. Fix the issue and re-upload.' });
  }
};
