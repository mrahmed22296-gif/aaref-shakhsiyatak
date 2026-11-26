const { sb, send } = require('./_lib');
const fallback = require('../data/questions.json');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  try {
    const rows = await sb('aaref_questions?active=eq.true&order=id.asc');
    if (rows && rows.length >= 16) return res.status(200).json(rows.map(r => ({ id: r.id, axis: r.axis, text: r.text, options: r.options })));
  } catch (e) {}
  res.status(200).json(fallback);
};
