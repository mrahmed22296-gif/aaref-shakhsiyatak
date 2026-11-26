(function(){
const D=window.AAREF, $=s=>document.querySelector(s), view=$('#view');
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PER_AXIS=2, WA='96560085043';
let device=LS.get('aaref_device',null);
if(!device||!/^[a-f0-9]{32}$/.test(device)){device=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');LS.set('aaref_device',device)}
let content={}, bank=null, sub=null, testId=null;
const api=(p,b)=>fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({device},b||{}))}).then(r=>r.json()).catch(()=>({ok:false,error:'net'}));
async function loadBank(){ if(bank)return bank; try{const r=await fetch('/api/questions');bank=await r.json();if(!Array.isArray(bank)||bank.length<16)throw 0}catch(e){try{bank=await (await fetch('/data/questions.json')).json()}catch(e2){bank=[]}} return bank }
async function loadContent(){ try{content=await (await fetch('/api/content')).json()}catch(e){content={}} }
async function loadSub(){ const r=await api('status'); sub=r.ok&&r.active?r:null; return sub }
const arch=k=>({n:content['arch.'+k+'.n']||D.ARCH[k].n,d:content['arch.'+k+'.d']||D.ARCH[k].d,tag:content['arch.'+k+'.tag']||D.ARCH[k].tag,e:D.ARCH[k].e});
const fmt=d=>new Date(d).toLocaleDateString('ar-KW',{year:'numeric',month:'long',day:'numeric'});
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const free=()=>LS.get('aaref_free_used',false);

/* اختيار الأسئلة: سؤالين من كل محور، بدون ما تتكرر على نفس الجهاز لين تنتهي */
function pickQuestions(){
  let seen=LS.get('aaref_seen',[]); const out=[];
  Object.keys(D.AXES).forEach(ax=>{
    const all=bank.filter(q=>q.axis===ax); let pool=all.filter(q=>!seen.includes(q.id));
    if(pool.length<PER_AXIS){seen=seen.filter(id=>!all.some(q=>q.id===id));pool=all}
    shuffle(pool).slice(0,PER_AXIS).forEach(q=>out.push(q));
  });
  const ids=out.map(q=>q.id); LS.set('aaref_seen',seen.concat(ids));
  return shuffle(out).map(q=>({id:q.id,axis:q.axis,text:q.text,options:shuffle(q.options)}));
}
function parseW(w){const m={};(String(w).match(/[A-Z]-?\d/g)||[]).forEach(x=>{m[x[0]]=(m[x[0]]||0)+Number(x.slice(1))});return m}
/* محرك الدرجات: كل إجابة توزع نقاط على السمات، والنسبة تحسب من أعلى نقاط ممكنة للأسئلة اللي ظهرت لك */
function score(qs,ans){
  const raw={},max={};D.ORDER.forEach(k=>{raw[k]=0;max[k]=0});
  qs.forEach((q,i)=>{
    D.ORDER.forEach(k=>{let m=0;q.options.forEach(o=>{m=Math.max(m,parseW(o.w)[k]||0)});max[k]+=m});
    const o=q.options[ans[i]]; if(o){const w=parseW(o.w);D.ORDER.forEach(k=>{raw[k]+=w[k]||0})}
  });
  const s={};D.ORDER.forEach(k=>{s[k]=max[k]>0?Math.max(5,Math.min(100,Math.round(20+80*Math.max(0,raw[k])/max[k]))):35});
  return s;
}
function archetype(s){const ks=D.ORDER.slice().sort((a,b)=>s[b]-s[a]||D.ORDER.indexOf(a)-D.ORDER.indexOf(b));return ks[0]+ks[1]}
function evidence(qs,ans,s){
  const top=D.ORDER.slice().sort((a,b)=>s[b]-s[a]).slice(0,3),out=[];
  qs.forEach((q,i)=>{const o=q.options[ans[i]];if(!o)return;const w=parseW(o.w);const t=top.find(k=>(w[k]||0)>=2);if(t)out.push({q:q.text,o:o.t,t})});
  return shuffle(out).slice(0,3);
}

function go(h){if(location.hash===h)route();else location.hash=h}
function route(){
  const h=(location.hash||'#/').slice(2).split('?')[0]||'home';
  window.scrollTo(0,0);
  ({home,quiz,result,subscribe,account,history}[h]||home)();
}
window.addEventListener('hashchange',route);
$('#themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;LS.set('aaref_theme',t)};
try{const t=LS.get('aaref_theme',null);if(t)document.documentElement.dataset.theme=t}catch(e){}

/* ===== الرئيسية ===== */
async function home(){
  const draft=LS.get('aaref_draft',null);
  view.innerHTML=`<section class="card c fade"><div style="font-size:54px">🔮</div><h1>اعرف شخصيتك</h1>
  <p class="mut">جاوب على ${PER_AXIS*8} سؤال سريع، وطلع لك تحليل مبني على إجاباتك أنت، مو كلام عام للكل.</p>
  <div style="text-align:right;margin:16px 0" class="mut">
   <p>⏱ تاخذ قرابة 3 دقايق</p><p>🔒 ما نطلب صور ولا تسجيل دخول</p><p>🎁 أول تحليل مجاني</p></div>
  ${draft?`<button class="btn" id="resume">كمّل اختبارك (سؤال ${draft.idx+1} من ${draft.qs.length})</button><button class="btn alt" id="start">ابدأ اختبار جديد</button>`:`<button class="btn" id="start">ابدأ الاختبار ✨</button>`}
  <p class="mut" style="margin-top:12px">للتسلية والتأمل فقط وليس تشخيصاً نفسياً.</p></section>
  <section class="card c fade"><h3>👑 الاشتراك الكامل</h3><p style="font-size:26px;font-weight:900;margin:0">1 د.ك <span class="mut">شهرياً</span></p>
  <p class="mut">أقسام حصرية: الجانب الخفي، شخصيتك بالعلاقات، مسارك المهني، تحليل القوة والتحديات، ومقارنة نتائجك السابقة.</p>
  <a class="btn alt" href="#/subscribe">تفاصيل الاشتراك</a></section>`;
  $('#start').onclick=startQuiz; if(draft)$('#resume').onclick=()=>{loadBank().then(()=>quiz())};
}
async function startQuiz(){
  await loadBank(); await loadSub();
  if(free()&&!sub){go('#/subscribe?need=1');return}
  if(!bank.length){alert('تعذر تحميل الأسئلة. تأكد من الاتصال وحاول مرة ثانية.');return}
  const qs=pickQuestions(); LS.set('aaref_draft',{qs,ans:[],idx:0,t:Date.now()});
  api('track',{kind:'start'}).then(r=>{if(r.ok){const d=LS.get('aaref_draft',null);if(d){d.testId=r.id;LS.set('aaref_draft',d)}}});
  go('#/quiz');
}

/* ===== الأسئلة ===== */
async function quiz(){
  let d=LS.get('aaref_draft',null); if(!d){location.hash='#/';return}
  const q=d.qs[d.idx], pct=Math.round(100*d.idx/d.qs.length);
  view.innerHTML=`<section class="card slide"><div class="row"><span class="tag">${esc(D.AXES[q.axis]||'')}</span><span class="mut">${d.idx+1} / ${d.qs.length}</span></div>
  <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
  <h2 style="margin-top:18px">${esc(q.text)}</h2>
  ${q.options.map((o,i)=>`<button class="opt${d.ans[d.idx]===i?' sel':''}" data-i="${i}">${esc(o.t)}</button>`).join('')}
  <div style="display:flex;gap:10px;margin-top:8px">${d.idx>0?'<button class="btn alt" id="back">← السابق</button>':''}</div>
  <p class="mut c" style="margin-top:10px">إجاباتك تنحفظ تلقائياً، تقدر ترجع وتكمل لاحقاً.</p></section>`;
  view.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    d.ans[d.idx]=Number(b.dataset.i); b.classList.add('sel');
    setTimeout(()=>{ if(d.idx+1<d.qs.length){d.idx++;LS.set('aaref_draft',d);quiz()}else{LS.set('aaref_draft',d);finish()} },180);
    LS.set('aaref_draft',d);
  });
  const bk=$('#back'); if(bk)bk.onclick=()=>{d.idx--;LS.set('aaref_draft',d);quiz()};
}
function finish(){
  view.innerHTML=`<section class="card c fade"><div class="spin"></div><h2>نحلل إجاباتك…</h2><p class="mut" id="st">نجمع إجاباتك</p></section>`;
  const steps=['نوزع إجاباتك على 8 أبعاد','نكتشف الأنماط المتكررة','نكتب تقريرك الشخصي'];let i=0;
  const iv=setInterval(()=>{$('#st').textContent=steps[i++]||'جاهز';},900);
  setTimeout(()=>{clearInterval(iv);complete()},3000);
}
function complete(){
  const d=LS.get('aaref_draft',null); if(!d){location.hash='#/';return}
  const s=score(d.qs,d.ans), a=archetype(s), ev=evidence(d.qs,d.ans,s);
  const rec={ts:Date.now(),a,s,ev};
  const h=LS.get('aaref_history',[]); h.unshift(rec); LS.set('aaref_history',h.slice(0,30));
  LS.set('aaref_last',rec); LS.del('aaref_draft'); LS.set('aaref_free_used',true);
  api('track',{kind:'complete',id:d.testId,archetype:a,scores:s});
  go('#/result');
}

/* ===== النتيجة ===== */
async function result(){
  const r=LS.get('aaref_last',null); if(!r){location.hash='#/';return}
  const p=r.a[0], sc=r.a[1], A=arch(p), s=r.s;
  const top3=D.ORDER.slice().sort((x,y)=>s[y]-s[x]).slice(0,3);
  const title=A.n+' '+D.ADJ[sc];
  view.innerHTML=`<div id="res"></div>`; const R=$('#res');
  const blocks=[
   `<section class="card c"><div style="font-size:56px">${A.e}</div><p class="mut">نوع شخصيتك</p><h1>${esc(title)}</h1><p>${esc(A.tag)}</p></section>`,
   `<section class="card"><h3>وصف شخصيتك</h3><p>${esc(A.d)} ${esc(D.SECOND[sc])}</p></section>`,
   `<section class="card"><h3>أبعاد شخصيتك</h3>${D.ORDER.map(k=>`<div class="row"><span>${D.TRAITS[k]}</span><span class="mut">${D.LEVEL(s[k])}</span></div><div class="bar"><i style="width:${s[k]}%"></i></div>`).join('')}</section>`,
   `<section class="card"><h3>أبرز نقاط قوتك</h3>${top3.map((k,i)=>`<p>• ${esc(D.STRENGTH[k][i%2])}</p>`).join('')}</section>`,
   `<section class="card"><h3>طريقة تفكيرك</h3><p>${esc(content['think.'+p]||D.THINK[p])}</p></section>`,
   r.ev&&r.ev.length?`<section class="card"><h3>من إجاباتك أنت</h3>${r.ev.map(e=>`<p class="mut">لما سألناك «${esc(e.q)}» اخترت «${esc(e.o)}»، وهذا يدعم بُعد <b>${D.TRAITS[e.t]}</b> عندك.</p>`).join('')}</section>`:'',
   `<div id="prem"></div>`,
   `<section class="card"><h3>شارك نتيجتك</h3><button class="btn" id="dl">تحميل بطاقة النتيجة (PNG)</button><button class="btn wa" id="shwa">مشاركة على واتساب</button><button class="btn alt" id="shig">انستغرام (حمّل البطاقة وانشرها)</button><button class="btn alt" id="shfb">فيسبوك</button><button class="btn alt" id="inv">دعوة الأصدقاء</button><p class="mut c" style="margin-top:8px">الرابط يعرض نوع شخصيتك فقط. إجاباتك وتفاصيلك ما تظهر لأحد.</p></section>`,
   `<section class="card c"><button class="btn alt" id="again">اختبار جديد</button><a class="btn alt" href="#/history">سجل تحليلاتي</a></section>`
  ];
  blocks.forEach((b,i)=>{setTimeout(()=>{R.insertAdjacentHTML('beforeend',`<div class="fade">${b}</div>`);if(i===blocks.length-1)bind()},i*350)});
  async function bind(){
    $('#dl').onclick=()=>card(title,A,top3).then(c=>{const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='aaref-result.png';a.click()});
    const link='https://aaref.vercel.app/api/share?t='+p, txt='طلع لي في اعرف شخصيتك: '+title+' 😳 جرّب أنت كمان، أول تحليل مجاني: ';
    $('#shwa').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(txt+link),'_blank','noopener');
    $('#shfb').onclick=()=>window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),'_blank','noopener');
    $('#shig').onclick=async()=>{const c=await card(title,A,top3);c.toBlob(async b=>{const f=new File([b],'aaref.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text:txt+link});return}catch(e){}}const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='aaref-result.png';a.click();alert('انحفظت البطاقة. افتح انستغرام وانشرها كستوري أو منشور.')})};
    $('#inv').onclick=async()=>{const u='https://aaref.vercel.app/';if(navigator.share){try{await navigator.share({title:'اعرف شخصيتك',text:'جرّب اختبار اعرف شخصيتك',url:u});return}catch(e){}}window.open('https://wa.me/?text='+encodeURIComponent('جرّب اعرف شخصيتك: '+u),'_blank','noopener')};
    $('#again').onclick=startQuiz;
    renderPremium(r);
  }
}
async function renderPremium(r){
  const box=$('#prem'); if(!box)return; await loadSub();
  if(sub){
    const res=await api('premium',{scores:r.s});
    if(res.ok){
      box.innerHTML=`<section class="card"><span class="tag">👑 اشتراكك فعال حتى ${fmt(res.ends_at)}</span></section>`+res.sections.map(x=>`<section class="card fade"><h3>${esc(x.title)}</h3><p class="sec">${esc(x.body)}</p>${x.list?`<p class="mut">${esc(x.list)}</p>`:''}</section>`).join('')+compare();
      return;
    }
  }
  const names=['الجانب الخفي','شخصيتك في العلاقات','مسارك المهني','أسلوبك في اتخاذ القرارات','تعاملك مع الضغوط','نقاط القوة والتحديات','مقارنة نتائجك السابقة','نصائح عملية لتطوير نفسك'];
  box.innerHTML=`<section class="card c"><h3>🔒 الأقسام الحصرية</h3><p class="mut">متاحة للمشتركين فقط (1 د.ك شهرياً)</p>${names.map(n=>`<div class="lock" style="margin:8px 0"><div class="blur card" style="margin:0"><b>${n}</b><p>هذا القسم يفتح لك بعد الاشتراك ويعرض تحليلاً مبنياً على نتيجتك أنت.</p></div><div class="lay"><span>🔒 ${n}</span></div></div>`).join('')}<a class="btn" href="#/subscribe">اشترك وافتح الأقسام</a></section>`;
}
function compare(){
  const h=LS.get('aaref_history',[]); if(h.length<2)return `<section class="card"><h3>مقارنة نتائجك السابقة</h3><p class="mut">سوّ اختبار ثاني وتظهر لك المقارنة هنا.</p></section>`;
  const [a,b]=h; return `<section class="card"><h3>مقارنة بنتيجتك السابقة</h3>${D.ORDER.map(k=>{const dlt=a.s[k]-b.s[k];return `<div class="row"><span>${D.TRAITS[k]}</span><span class="mut">${b.s[k]}% ← ${a.s[k]}% (${dlt>0?'+':''}${dlt})</span></div>`}).join('')}</section>`;
}

/* بطاقة النتيجة PNG */
function card(title,A,top3){
  return (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>{
    const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,1080,1350);g.addColorStop(0,'#2a0f5c');g.addColorStop(1,'#8a1f6b');x.fillStyle=g;x.fillRect(0,0,1080,1350);
    x.textAlign='center';x.direction='rtl';x.fillStyle='#fff';
    x.font='700 44px Tajawal,sans-serif';x.globalAlpha=.8;x.fillText('اعرف شخصيتك',540,150);x.globalAlpha=1;
    x.font='900 76px Tajawal,sans-serif';x.fillText(title,540,520);
    x.font='500 44px Tajawal,sans-serif';x.fillStyle='#f3d9ff';x.fillText(A.tag,540,620);
    x.fillStyle='#fff';x.font='800 42px Tajawal,sans-serif';x.fillText('أبرز أبعادي',540,790);
    top3.forEach((k,i)=>{x.font='700 48px Tajawal,sans-serif';x.fillText(D.TRAITS[k],540,880+i*80)});
    x.font='500 36px Tajawal,sans-serif';x.globalAlpha=.8;x.fillText('جرّب أنت كمان: aaref.vercel.app',540,1230);x.fillText('للتسلية فقط',540,1285);
    return c;
  });
}

/* ===== الاشتراك ===== */
async function subscribe(){
  await loadSub(); const need=location.hash.includes('need=1');
  view.innerHTML=`<section class="card c fade"><h2>اشتراك اعرف شخصيتك</h2>
  ${need?'<p class="msg e">استخدمت التحليل المجاني. فعّل الاشتراك لتحليلات جديدة.</p>':''}
  ${sub?`<p class="msg o">اشتراكك فعال: من ${fmt(sub.starts_at)} إلى ${fmt(sub.ends_at)}</p>`:''}
  <p style="font-size:30px;font-weight:900;margin:6px 0">1 د.ك <span class="mut">شهرياً</span></p>
  <p class="mut">تحليلات غير محدودة، أقسام حصرية، مقارنة بين نتائجك.</p>
  <div class="card" style="margin-top:14px"><b>الدفع عبر ومض (WAMD)</b><img src="/assets/wamd-qr.jpg" alt="رمز QR للدفع عبر ومض" width="208" height="375" style="max-width:70%;height:auto;border-radius:12px;margin:10px auto;display:block" loading="lazy"><p class="mut">امسح الرمز من تطبيق بنكك أو أي تطبيق يدعم ومض.</p></div>
  <div class="card" style="text-align:right"><b>الخطوات</b><p class="mut">1. ادفع 1 دينار عبر ومض.<br>2. صوّر الإيصال وأرسله على واتساب.<br>3. يوصلك كود التفعيل، ادخله بالأسفل.</p></div>
  <button class="btn wa" id="wa">إرسال إيصال الدفع على واتساب</button>
  <div class="card" style="margin-top:14px"><b>أو سجّل طلب تفعيل</b><p class="mut">اكتب رقم واتساب وبنتواصل معك بعد التأكد من الدفع.</p><input id="ph" inputmode="tel" placeholder="رقم الواتساب" dir="ltr"><button class="btn alt" id="rq">إرسال الطلب</button><p class="msg hidden" id="rqm"></p></div>
  <div class="card"><b>عندك كود تفعيل؟</b><input id="cd" placeholder="AREF-XXXX-XXXX" dir="ltr" style="text-transform:uppercase;margin-top:8px"><button class="btn" id="go" style="margin-top:8px">${sub?'تجديد الاشتراك':'تفعيل الاشتراك'}</button><p class="msg hidden" id="cm"></p></div>
  <a href="#/" class="mut">رجوع</a></section>`;
  $('#wa').onclick=()=>window.open('https://wa.me/'+WA+'?text='+encodeURIComponent('السلام عليكم، أريد تفعيل الاشتراك في اعرف شخصيتك.\nالمبلغ: 1 دينار\nمرفق إيصال الدفع عبر ومض.'),'_blank','noopener');
  const say=(id,t,ok)=>{const e=$(id);e.className='msg '+(ok?'o':'e');e.textContent=t};
  $('#rq').onclick=async()=>{const r=await api('request',{contact:$('#ph').value});say('#rqm',r.ok?'وصل طلبك، بنتواصل معك قريباً.':r.error==='rate'?'محاولات كثيرة، جرّب بعد شوي.':'تأكد من رقم الواتساب.',r.ok)};
  $('#go').onclick=async()=>{const code=$('#cd').value.trim().toUpperCase();if(!code){say('#cm','أدخل كود التفعيل.',0);return}
    say('#cm','جاري التحقق…',1);const r=await api('redeem',{code});
    if(r.ok){say('#cm','تم التفعيل ✅ ينتهي اشتراكك في '+fmt(r.ends_at),1);setTimeout(()=>{location.hash=LS.get('aaref_last',null)?'#/result':'#/'},1400)}
    else say('#cm',{invalid:'الكود غير صحيح.',used:'هذا الكود مستخدم من قبل.',format:'صيغة الكود غير صحيحة.',rate:'محاولات كثيرة، جرّب بعد قليل.',net:'تعذر الاتصال، حاول مرة ثانية.'}[r.error]||'حدث خطأ، حاول لاحقاً.',0)};
}

/* ===== الحساب والسجل ===== */
async function account(){
  await loadSub(); const h=LS.get('aaref_history',[]);
  view.innerHTML=`<section class="card fade"><h2>حسابي</h2><p class="mut">ما تحتاج تسجيل دخول. حسابك مرتبط بهالجهاز.</p>
  <p><b>الاشتراك:</b> ${sub?`فعال حتى ${fmt(sub.ends_at)}`:'غير مشترك'}</p><p><b>عدد التحليلات:</b> ${h.length}</p>
  <a class="btn" href="#/subscribe">${sub?'تجديد الاشتراك':'اشترك'}</a><a class="btn alt" href="#/history">سجل التحليلات</a>
  <button class="btn alt" id="del" style="color:var(--err)">حذف حسابي وبياناتي</button></section>`;
  $('#del').onclick=async()=>{if(!confirm('بنحذف سجلك وبياناتك واشتراكك من هالجهاز ومن الخادم. ما يمكن التراجع. متأكد؟'))return;
    const r=await api('delete'); if(r.ok){Object.keys(localStorage).filter(k=>k.startsWith('aaref_')&&k!=='aaref_theme').forEach(k=>localStorage.removeItem(k));alert('تم حذف بياناتك.');location.hash='#/';location.reload()}else alert('تعذر الحذف، حاول لاحقاً.')};
}
async function history(){
  const h=LS.get('aaref_history',[]); await loadSub();
  view.innerHTML=`<section class="card fade"><h2>سجل تحليلاتي</h2>${h.length?h.map((x,i)=>{const A=arch(x.a[0]);return `<div class="card" style="margin:8px 0"><b>${A.e} ${esc(A.n+' '+D.ADJ[x.a[1]])}</b><p class="mut">${fmt(x.ts)}</p><button class="btn alt" data-i="${i}">عرض</button></div>`}).join(''):'<p class="mut">ما عندك تحليلات بعد.</p>'}
  <a class="btn" href="#/">اختبار جديد</a></section>`;
  view.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{LS.set('aaref_last',h[Number(b.dataset.i)]);go('#/result')});
}

Promise.all([loadContent(),loadBank()]).then(route);
})();
