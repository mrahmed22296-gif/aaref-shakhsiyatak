const { sb, body, okDevice, send, limited } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'delete', 5, 60 * 60000)) return send(res, 429, { ok: false });
  const b = body(req);
  if (!okDevice(b.device)) return send(res, 400, { ok: false });
  try {
    for (const t of ['aaref_tests', 'aaref_requests', 'aaref_events', 'aaref_subs']) {
      await sb(t + '?device_id=eq.' + b.device, { method: 'DELETE', prefer: 'return=minimal' });
    }
    send(res, 200, { ok: true });
  } catch (e) { send(res, 500, { ok: false }); }
};
