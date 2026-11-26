const { sb } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  try { const rows = await sb('aaref_content?limit=500'); const o = {}; rows.forEach(r => o[r.key] = r.value); return res.status(200).json(o); }
  catch (e) { res.status(200).json({}); }
};
