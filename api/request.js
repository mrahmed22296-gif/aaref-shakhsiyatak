const { sb, body, okDevice, send, limited } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'request', 5, 60 * 60000)) return send(res, 429, { ok: false, error: 'rate' });
  const b = body(req);
  const contact = String(b.contact || '').replace(/[^\d+]/g, '').slice(0, 20);
  const note = String(b.note || '').slice(0, 200);
  if (!okDevice(b.device) || contact.length < 7) return send(res, 400, { ok: false, error: 'format' });
  try {
    await sb('aaref_requests', { method: 'POST', body: { device_id: b.device, contact, note } });
    send(res, 200, { ok: true });
  } catch (e) { send(res, 500, { ok: false, error: 'server' }); }
};
