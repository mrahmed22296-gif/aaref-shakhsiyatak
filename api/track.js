const { sb, body, okDevice, send, limited } = require('./_lib');
const TYPES = /^[ASEMCFVD]{1,2}$/;
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'track', 40, 60000)) return send(res, 429, { ok: false });
  const b = body(req);
  if (!okDevice(b.device)) return send(res, 400, { ok: false });
  try {
    if (b.kind === 'start') {
      const r = await sb('aaref_tests', { method: 'POST', body: { device_id: b.device } });
      return send(res, 200, { ok: true, id: r[0].id });
    }
    if (b.kind === 'complete' && Number.isInteger(b.id) && TYPES.test(String(b.archetype || ''))) {
      const sc = {}; for (const k of 'ASEMCFVD') { const v = Number(b.scores && b.scores[k]); sc[k] = Math.max(0, Math.min(100, Math.round(v || 0))); }
      await sb('aaref_tests?id=eq.' + b.id + '&device_id=eq.' + b.device, { method: 'PATCH', body: { completed_at: new Date().toISOString(), archetype: b.archetype, scores: sc } });
      return send(res, 200, { ok: true });
    }
    send(res, 400, { ok: false });
  } catch (e) { send(res, 500, { ok: false }); }
};
