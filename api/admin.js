const crypto = require('crypto');
const { sb, body, send, limited, makeToken, checkToken, genCode } = require('./_lib');
const seed = require('../data/questions.json');
const iso = d => new Date(d).toISOString();
const q = s => encodeURIComponent(s);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  const b = body(req);
  try {
    if (b.action === 'login') {
      if (limited(req, 'adminlogin', 6, 15 * 60000)) return send(res, 429, { ok: false, error: 'rate' });
      const pw = String(b.password || ''), real = process.env.ADMIN_PASSWORD || '';
      const a = crypto.createHash('sha256').update(pw).digest(), c = crypto.createHash('sha256').update(real).digest();
      if (!real || !crypto.timingSafeEqual(a, c)) { await new Promise(r => setTimeout(r, 900)); return send(res, 401, { ok: false }); }
      return send(res, 200, { ok: true, token: makeToken() });
    }
    if (!checkToken(req)) return send(res, 401, { ok: false, error: 'auth' });
    if (limited(req, 'admin', 240, 60000)) return send(res, 429, { ok: false });
    const now = Date.now(), d7 = iso(now - 7 * 864e5), d30 = iso(now - 30 * 864e5);

    switch (b.action) {
      case 'stats': {
        const [tests, subs, reqs] = await Promise.all([
          sb('aaref_tests?select=device_id,started_at,completed_at,archetype&order=started_at.desc&limit=10000'),
          sb('aaref_subs?select=device_id,days:ends_at,starts_at,ends_at,cancelled,code&limit=10000'),
          sb('aaref_requests?select=status&limit=10000')
        ]);
        const devices = new Set(tests.map(t => t.device_id));
        const completedDevices = new Set(tests.filter(t => t.completed_at).map(t => t.device_id));
        const active7 = new Set(tests.filter(t => t.started_at > d7).map(t => t.device_id));
        const new7 = [...devices].filter(dv => !tests.some(t => t.device_id === dv && t.started_at <= d7));
        const nowIso = iso(now);
        const activeSubs = subs.filter(s => !s.cancelled && s.ends_at > nowIso);
        const expired = subs.filter(s => s.cancelled || s.ends_at <= nowIso);
        const monthStart = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        const monthSubs = subs.filter(s => s.starts_at >= monthStart && !s.cancelled);
        const rev = monthSubs.reduce((a, s) => a + Math.max(1, Math.round((new Date(s.ends_at) - new Date(s.starts_at)) / 864e5 / 30)), 0);
        const subDevices = new Set(subs.map(s => s.device_id));
        const types = {}; tests.filter(t => t.archetype).forEach(t => { const k = t.archetype[0]; types[k] = (types[k] || 0) + 1; });
        return send(res, 200, {
          ok: true, totalTests: tests.length, completedTests: tests.filter(t => t.completed_at).length,
          completionRate: tests.length ? Math.round(100 * tests.filter(t => t.completed_at).length / tests.length) : 0,
          users: devices.size, newUsers7: new7.length, activeUsers7: active7.size,
          activeSubs: activeSubs.length, expiredSubs: expired.length, newSubs30: subs.filter(s => s.starts_at > d30).length,
          pendingRequests: reqs.filter(r => r.status === 'pending').length,
          conversion: completedDevices.size ? Math.round(1000 * [...subDevices].filter(x => completedDevices.has(x)).length / completedDevices.size) / 10 : 0,
          monthRevenueKWD: rev, types
        });
      }
      case 'users': {
        const tests = await sb('aaref_tests?select=device_id,started_at,completed_at,archetype&order=started_at.desc&limit=10000');
        const subs = await sb('aaref_subs?select=device_id,ends_at,cancelled&limit=10000');
        const m = {};
        for (const t of tests) { const u = m[t.device_id] || (m[t.device_id] = { device: t.device_id.slice(0, 8), tests: 0, last: t.started_at, type: null, full: t.device_id }); u.tests++; if (!u.type && t.archetype) u.type = t.archetype; }
        const nowIso = iso(now);
        for (const s of subs) { if (m[s.device_id] && !s.cancelled && s.ends_at > nowIso) m[s.device_id].sub = s.ends_at; }
        return send(res, 200, { ok: true, users: Object.values(m).slice(0, 300) });
      }
      case 'subs': {
        const rows = await sb('aaref_subs?order=starts_at.desc&limit=300');
        return send(res, 200, { ok: true, subs: rows.map(s => ({ ...s, device_short: s.device_id.slice(0, 8), active: !s.cancelled && s.ends_at > iso(now) })) });
      }
      case 'cancelSub': await sb('aaref_subs?id=eq.' + Number(b.id), { method: 'PATCH', body: { cancelled: true } }); return send(res, 200, { ok: true });
      case 'extendSub': {
        const days = Math.max(1, Math.min(366, Number(b.days) || 30));
        const r = await sb('aaref_subs?id=eq.' + Number(b.id));
        if (!r[0]) return send(res, 404, { ok: false });
        const base = Math.max(new Date(r[0].ends_at).getTime(), now);
        await sb('aaref_subs?id=eq.' + Number(b.id), { method: 'PATCH', body: { ends_at: iso(base + days * 864e5), cancelled: false } });
        return send(res, 200, { ok: true });
      }
      case 'requests': {
        const rows = await sb('aaref_requests?order=created_at.desc&limit=200');
        return send(res, 200, { ok: true, requests: rows.map(r => ({ ...r, device_short: (r.device_id || '').slice(0, 8) })) });
      }
      case 'approveRequest': {
        const days = Math.max(1, Math.min(366, Number(b.days) || 30));
        const r = await sb('aaref_requests?id=eq.' + Number(b.id));
        if (!r[0] || r[0].status !== 'pending') return send(res, 400, { ok: false, error: 'state' });
        const code = genCode();
        await sb('aaref_codes', { method: 'POST', body: { code, days, note: 'طلب ' + r[0].contact } });
        await sb('aaref_requests?id=eq.' + Number(b.id), { method: 'PATCH', body: { status: 'approved', code } });
        return send(res, 200, { ok: true, code, contact: r[0].contact });
      }
      case 'rejectRequest': await sb('aaref_requests?id=eq.' + Number(b.id), { method: 'PATCH', body: { status: 'rejected' } }); return send(res, 200, { ok: true });
      case 'codes': {
        const rows = await sb('aaref_codes?order=created_at.desc&limit=300');
        return send(res, 200, { ok: true, codes: rows });
      }
      case 'createCode': {
        const days = Math.max(1, Math.min(366, Number(b.days) || 30));
        const n = Math.max(1, Math.min(20, Number(b.count) || 1));
        const out = [];
        for (let i = 0; i < n; i++) { const code = genCode(); await sb('aaref_codes', { method: 'POST', body: { code, days, note: String(b.note || '').slice(0, 100) } }); out.push(code); }
        return send(res, 200, { ok: true, codes: out });
      }
      case 'revokeCode': await sb('aaref_codes?code=eq.' + q(String(b.code)) + '&redeemed_at=is.null', { method: 'PATCH', body: { revoked: true } }); return send(res, 200, { ok: true });
      case 'questions': return send(res, 200, { ok: true, questions: await sb('aaref_questions?order=id.asc&limit=500') });
      case 'saveQuestion': {
        const o = b.question || {};
        if (!o.text || !o.axis || !Array.isArray(o.options) || o.options.length < 2) return send(res, 400, { ok: false, error: 'format' });
        const options = o.options.map(x => ({ t: String(x.t).slice(0, 200), w: String(x.w || '').replace(/[^A-Z0-9\-]/g, '').slice(0, 20) }));
        let id = Number(o.id);
        if (!id) { const mx = await sb('aaref_questions?select=id&order=id.desc&limit=1'); id = (mx[0] ? mx[0].id : 0) + 1; }
        await sb('aaref_questions', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: { id, axis: o.axis, text: String(o.text).slice(0, 300), options, active: o.active !== false } });
        return send(res, 200, { ok: true, id });
      }
      case 'deleteQuestion': await sb('aaref_questions?id=eq.' + Number(b.id), { method: 'DELETE', prefer: 'return=minimal' }); return send(res, 200, { ok: true });
      case 'seedQuestions': {
        const ex = await sb('aaref_questions?select=id&limit=1');
        if (ex.length && !b.force) return send(res, 200, { ok: true, seeded: 0 });
        await sb('aaref_questions', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: seed.map(x => ({ id: x.id, axis: x.axis, text: x.text, options: x.options, active: true })) });
        return send(res, 200, { ok: true, seeded: seed.length });
      }
      case 'content': return send(res, 200, { ok: true, content: await sb('aaref_content?limit=500') });
      case 'saveContent': {
        const k = String(b.key || '');
        if (!/^arch\.[ASEMCFVD]\.(n|d|tag)$/.test(k) && !/^think\.[ASEMCFVD]$/.test(k)) return send(res, 400, { ok: false, error: 'key' });
        if (!String(b.value || '').trim()) { await sb('aaref_content?key=eq.' + q(k), { method: 'DELETE', prefer: 'return=minimal' }); return send(res, 200, { ok: true }); }
        await sb('aaref_content', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { key: k, value: String(b.value).slice(0, 800) } });
        return send(res, 200, { ok: true });
      }
      default: return send(res, 400, { ok: false, error: 'action' });
    }
  } catch (e) { return send(res, 500, { ok: false, error: 'server', detail: e.detail ? JSON.stringify(e.detail).slice(0, 200) : String(e.message) }); }
};
