const { sb, body, okDevice, send, limited } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (limited(req, 'redeem', 8, 10 * 60000)) return send(res, 429, { ok: false, error: 'rate' });
  const b = body(req);
  const code = String(b.code || '').trim().toUpperCase();
  if (!okDevice(b.device) || !/^AREF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return send(res, 400, { ok: false, error: 'format' });
  try {
    const rows = await sb('aaref_codes?code=eq.' + code);
    const c = rows && rows[0];
    if (!c || c.revoked) return send(res, 200, { ok: false, error: 'invalid' });
    if (c.redeemed_at) return send(res, 200, { ok: false, error: 'used' });
    // علامة الاستخدام ذرية: تنجح مرة وحدة فقط
    const claimed = await sb('aaref_codes?code=eq.' + code + '&redeemed_at=is.null&revoked=eq.false', {
      method: 'PATCH', body: { redeemed_at: new Date().toISOString(), redeemed_device: b.device }
    });
    if (!claimed || !claimed.length) return send(res, 200, { ok: false, error: 'used' });
    // لو عنده اشتراك فعال، نمدده من نهايته (تجديد)
    const now = new Date();
    const cur = await sb('aaref_subs?device_id=eq.' + b.device + '&cancelled=eq.false&ends_at=gt.' + encodeURIComponent(now.toISOString()) + '&order=ends_at.desc&limit=1');
    const start = cur && cur[0] ? new Date(cur[0].ends_at) : now;
    const ends = new Date(start.getTime() + c.days * 86400000);
    await sb('aaref_subs', { method: 'POST', body: { device_id: b.device, code, starts_at: now.toISOString(), ends_at: ends.toISOString() } });
    send(res, 200, { ok: true, ends_at: ends.toISOString(), renewed: !!(cur && cur[0]) });
  } catch (e) { send(res, 500, { ok: false, error: 'server' }); }
};
