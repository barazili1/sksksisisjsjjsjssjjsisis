type Reason = "invalid" | "expired";

function texts(reason: Reason, hadCookie: boolean) {
  if (reason === "expired" || hadCookie) {
    return {
      title: "انتهت صلاحية الكود",
      desc: "الكود اللي كنت بتستخدمه انتهى. ادخل كود جديد للاستمرار.",
    };
  }
  return {
    title: "ادخل كود الدخول",
    desc: "الموقع محمي بكود. اطلب الكود من الشخص المسؤول.",
  };
}

/**
 * Server-rendered code entry page. Contains a tiny inline script that POSTs
 * the code to /api/public/redeem — on success the browser reloads and the
 * middleware serves the real app. No app JS is shipped from here.
 */
export function renderCodeEntryPage(opts?: {
  reason?: Reason;
  hadCookie?: boolean;
}): Response {
  const reason = opts?.reason ?? "invalid";
  const hadCookie = opts?.hadCookie ?? false;
  const { title, desc } = texts(reason, hadCookie);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:#0b1220;color:#fff}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#020617,#0f172a,#111827)}
  .card{max-width:380px;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px;text-align:center;backdrop-filter:blur(10px);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
  .icon{width:56px;height:56px;border-radius:9999px;background:rgba(239,68,68,.15);color:#f87171;display:flex;align-items:center;justify-content:center;margin:0 auto}
  h1{font-size:20px;font-weight:800;margin:18px 0 6px}
  p{font-size:13px;line-height:1.7;color:rgba(255,255,255,.7);margin:0 0 18px}
  input{width:100%;padding:14px 16px;font-size:15px;letter-spacing:1px;text-align:center;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:#fff;outline:none;direction:ltr;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  input:focus{border-color:#f87171;background:rgba(0,0,0,.55)}
  button{width:100%;margin-top:12px;padding:14px;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,#ef4444,#b91c1c);border:0;border-radius:14px;cursor:pointer}
  button:disabled{opacity:.6;cursor:not-allowed}
  .err{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fecaca;font-size:13px;display:none}
  .err.show{display:block}
</style></head><body>
<div class="wrap"><div class="card">
<div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
<h1>${title}</h1><p>${desc}</p>
<form id="f" autocomplete="off">
  <input id="c" name="code" placeholder="ادخل الكود هنا" maxlength="64" autocapitalize="off" autocomplete="off" spellcheck="false" required />
  <div id="e" class="err"></div>
  <button id="b" type="submit">دخول</button>
</form>
</div></div>
<script>
(function(){
  var f=document.getElementById('f'),c=document.getElementById('c'),b=document.getElementById('b'),e=document.getElementById('e');
  function err(m){e.textContent=m;e.classList.add('show')}
  f.addEventListener('submit',function(ev){
    ev.preventDefault();e.classList.remove('show');
    var code=(c.value||'').trim();if(!code){return}
    b.disabled=true;b.textContent='جاري التحقق…';
    fetch('/api/public/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:code})})
      .then(function(r){return r.json().then(function(j){return{s:r.status,j:j}})})
      .then(function(x){
        if(x.j && x.j.ok){location.replace('/');return}
        var reason=x.j&&x.j.reason;
        err(reason==='expired'?'الكود ده انتهت صلاحيته.':reason==='no_balance'?'الرصيد بتاع الكود ده خلص.':'الكود غير صحيح.');
        b.disabled=false;b.textContent='دخول';
      })
      .catch(function(){err('حصل خطأ. حاول تاني.');b.disabled=false;b.textContent='دخول';});
  });
  c.focus();
})();
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
