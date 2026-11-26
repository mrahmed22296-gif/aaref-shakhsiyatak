const { body, okDevice, send, activeSub, limited } = require('./_lib');
const { build } = require('./_premium');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'premium', 30, 60000)) return send(res, 429, { ok: false });
  const b = body(req);
  if (!okDevice(b.device) || !b.scores) return send(res, 400, { ok: false });
  const sc = {};
  for (const k of 'ASEMCFVD') { const v = Number(b.scores[k]); if (!isFinite(v)) return send(res, 400, { ok: false }); sc[k] = Math.max(0, Math.min(100, v)); }
  try {
    const s = await activeSub(b.device);
    if (!s) return send(res, 402, { ok: false, error: 'subscription' });
    send(res, 200, { ok: true, ends_at: s.ends_at, ...build(sc) });
  } catch (e) { send(res, 500, { ok: false }); }
};
