const crypto = require('crypto');
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(path, opts = {}) {
  if (!URL_ || !KEY) throw new Error('config');
  const r = await fetch(URL_ + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation'
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) { const err = new Error('db'); err.detail = data; throw err; }
  return data;
}

const hits = new Map();
function limited(req, name, max, windowMs) {
  const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x').trim();
  const k = name + ':' + ip, now = Date.now();
  const a = (hits.get(k) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(k, a);
  if (hits.size > 5000) hits.clear();
  return a.length > max;
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
const okDevice = d => typeof d === 'string' && /^[a-f0-9]{32}$/.test(d);

function send(res, code, obj) {
  res.status(code).setHeader('Cache-Control', 'no-store').json(obj);
}

async function activeSub(device) {
  const now = new Date().toISOString();
  const rows = await sb('aaref_subs?device_id=eq.' + device + '&cancelled=eq.false&ends_at=gt.' + encodeURIComponent(now) + '&order=ends_at.desc&limit=1');
  return rows && rows[0] ? rows[0] : null;
}

function sign(exp) {
  const secret = (process.env.ADMIN_PASSWORD || '') + '|' + (KEY || '').slice(-24);
  return crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
}
function makeToken() { const exp = Date.now() + 8 * 3600 * 1000; return exp + '.' + sign(exp); }
function checkToken(req) {
  const h = (req.headers.authorization || '').replace('Bearer ', '');
  const [exp, sig] = h.split('.');
  if (!exp || !sig || !process.env.ADMIN_PASSWORD) return false;
  if (Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
function genCode() {
  const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(8);
  let s = ''; for (const x of b) s += al[x % al.length];
  return 'AREF-' + s.slice(0, 4) + '-' + s.slice(4);
}
module.exports = { sb, limited, body, okDevice, send, activeSub, makeToken, checkToken, genCode };
