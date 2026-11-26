const { body, okDevice, send, activeSub, limited } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'status', 60, 60000)) return send(res, 429, { ok: false, error: 'rate' });
  const { device } = body(req);
  if (!okDevice(device)) return send(res, 400, { ok: false, error: 'device' });
  try {
    const s = await activeSub(device);
    send(res, 200, { ok: true, active: !!s, starts_at: s && s.starts_at, ends_at: s && s.ends_at });
  } catch (e) { send(res, 500, { ok: false, error: 'server' }); }
};
