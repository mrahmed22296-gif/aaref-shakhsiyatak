const NAMES = { A: 'المحلل', S: 'الاجتماعي', E: 'صاحب القلب', M: 'الطموح', C: 'الهادئ الثابت', F: 'الواثق', V: 'المغامر', D: 'المنظّم' };
const TAGS = { A: 'عقلك يزن كل شي قبل ما يتحرك', S: 'طاقتك من الناس ووجودك يغيّر الجو', E: 'تحس بالأشياء بعمق قبل غيرك', M: 'عينك على القمة وما يرضيك القليل', C: 'هدوءك قوتك وسط أي عاصفة', F: 'حضورك قوي وقرارك واضح', V: 'روحك حرة وتكره الروتين', D: 'ترتيبك وانضباطك يوصلونك بعيد' };
module.exports = (req, res) => {
  const t = String((req.query && req.query.t) || '').toUpperCase().replace(/[^ASEMCFVD]/g, '').slice(0, 1);
  const n = NAMES[t];
  const title = n ? 'طلع لي: ' + n + ' | اعرف شخصيتك' : 'اعرف شخصيتك';
  const desc = n ? TAGS[t] + '. جرّب أنت كمان، أول تحليل مجاني (للتسلية فقط).' : 'تحليل شخصية ممتع من إجاباتك. أول تحليل مجاني.';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).send('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<meta name="description" content="' + desc + '"><meta property="og:type" content="website"><meta property="og:title" content="' + title + '">' +
    '<meta property="og:description" content="' + desc + '"><meta property="og:image" content="https://aaref.vercel.app/assets/og.png">' +
    '<meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=/"></head><body><a href="/">اعرف شخصيتك</a></body></html>');
};
