(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const config = window.AGRIFUND_CONFIG || {};
  let supabase = null, authMode = 'signup', currentUser = null, lastReport = null;
  const roleFields = {
    farmer: [
      ['full_name','Full name','text','e.g. Amina Wanjiku'],['national_id','National ID','text','Enter your government ID number'],['phone','Phone number','tel','e.g. +254 7xx xxx xxx'],['county','County','text','e.g. Nakuru'],['payment_method','Preferred payment method','select',['M-Pesa','Bank transfer','Other']],['mpesa_number','M-Pesa number (if selected)','tel','e.g. +254 7xx xxx xxx']
    ],
    administrator: [['full_name','Full name','text',''],['official_email','Official email address','email','name@organization.org'],['phone','Phone number','tel',''],['employee_id','Employee ID','text',''],['department','Department','text','']],
    extension_officer: [['full_name','Full name','text',''],['phone','Phone number','tel',''],['email','Email address','email',''],['staff_id','Staff / employer ID','text',''],['organization','Organization / institution','text',''],['county','County','text',''],['verification_status','Verification status','select',['Pending verification','Verified','Needs review']],['specialization','Areas of specialization','text','e.g. soil health, maize']],
    bank: [['bank_name','Bank name','text',''],['registration','Bank registration','text',''],['head_office','Head office address','text',''],['official_email','Official email address','email',''],['official_phone','Official phone number','tel',''],['partnership_status','Partnership status','select',['Pending','Active','Suspended']]]
  };
  const profileKeys = {farmer:['full_name','national_id','phone','county','payment_method','mpesa_number'],administrator:['full_name','official_email','phone','employee_id','department'],extension_officer:['full_name','phone','email','staff_id','organization','county','verification_status','specialization'],bank:['bank_name','registration','head_office','official_email','official_phone','partnership_status']};
  function makeRoleFields() {
    const role = $('#role').value;
    $('#roleFields').className = 'role-fields';
    $('#roleFields').innerHTML = (roleFields[role] || []).map(([name,label,type,opts]) => {
      if(type === 'select') return `<label class="field-label">${label}<select name="${name}" data-required="true" required>${opts.map((o,i)=>`<option value="${i===0?o:o.toLowerCase().replace(/[^a-z]+/g,'_')}">${o}</option>`).join('')}</select></label>`;
      const required = name === 'mpesa_number' ? '' : 'required';
      return `<label class="field-label">${label}<input name="${name}" type="${type}" placeholder="${opts}" data-required="${required?'true':'false'}" ${required} /></label>`;
    }).join('');
    if(role === 'administrator' || role === 'bank') $('#roleFields').insertAdjacentHTML('beforeend','<p class="field-hint">Access for this role requires verification by AgriFund. New accounts begin with pending access.</p>');
    const payment = $('[name="payment_method"]');if(payment){const mpesa=$('[name="mpesa_number"]');payment.addEventListener('change',()=>{mpesa.dataset.required=String(payment.value==='M-Pesa');mpesa.required=payment.value==='M-Pesa'});mpesa.dataset.required=String(payment.value==='M-Pesa');mpesa.required=payment.value==='M-Pesa'}
  }
  function setAuthMode(mode) {
    authMode = mode;
    $$('.auth-tabs button').forEach(b => b.classList.toggle('active',b.dataset.authTab===mode));
    $('#authTitle').textContent = mode === 'signup' ? 'Welcome to AgriFund' : 'Welcome back';
    $('#role').closest('label').style.display = mode === 'signup' ? '' : 'none';
    $('#roleFields').style.display = mode === 'signup' ? '' : 'none';
    $$('#roleFields input, #roleFields select').forEach(field=>field.required=mode==='signup'&&field.dataset.required==='true');
    $('#passwordField').style.display = mode === 'signup' ? '' : '';
    $('#authForm [name="password"]').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#authForm [name="password"]').minLength = mode === 'signup' ? 8 : 1;
    $('#consent').closest('label').style.display = mode === 'signup' ? '' : 'none';
    $('#consent').required = mode === 'signup';
    $('#authSubmit').innerHTML = mode === 'signup' ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    $('#authMessage').textContent = '';
  }
  function openModal(id) { const m = document.getElementById(id); m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open'); }
  function closeModal(modal) { modal.classList.remove('open');modal.setAttribute('aria-hidden','true');if(!$('.modal-backdrop.open'))document.body.classList.remove('modal-open'); }
  function message(el,text,error=false){el.textContent=text;el.classList.toggle('error',error)}
  function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function formObject(form){return Object.fromEntries(new FormData(form).entries())}
  function getSupabase(){
    if(supabase)return supabase;
    if(config.supabaseUrl && config.supabaseAnonKey && window.supabase){supabase=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);return supabase}
    return null;
  }
  function showAuth(){setAuthMode('signup');openModal('authModal')}
  $('#role').addEventListener('change',makeRoleFields);makeRoleFields();
  $('#openAuth').addEventListener('click',showAuth);$('#ctaCreate').addEventListener('click',showAuth);
  $$('[data-auth]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();showAuth()}));
  $('#requestAssessment').addEventListener('click',()=>openModal('assessmentModal'));
  $('#rubricDetails').addEventListener('click',()=>openModal('rubricModal'));$('#showRubric').addEventListener('click',e=>{e.preventDefault();openModal('rubricModal')});
  $$('.auth-tabs button').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authTab)));
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop'))));
  $$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal-backdrop.open').forEach(closeModal)});
  $('#mobileMenu').addEventListener('click',()=>{const nav=$('.topnav');const visible=nav.style.display==='flex';nav.style.cssText=visible?'':'display:flex;position:absolute;left:0;right:0;top:64px;padding:20px 6%;background:#f7f6ef;flex-direction:column;gap:20px;box-shadow:0 8px 14px #193c2014'});

  $('#authForm').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('#authSubmit'),msg=$('#authMessage');message(msg,'');button.disabled=true;
    const data=formObject(e.currentTarget),client=getSupabase();
    try{
      if(!client){
        if(authMode==='signin') {const saved=JSON.parse(localStorage.getItem('agrifundDemoUser')||'null');if(!saved||saved.email.toLowerCase()!==data.email.toLowerCase()){throw new Error('No demo account found for this email. Create an account first.')};currentUser={id:saved.id,email:saved.email,role:saved.role,profile:saved.profile};}
        else {const role=data.role;const profile=Object.fromEntries((profileKeys[role]||[]).map(k=>[k,data[k]||'']));currentUser={id:crypto.randomUUID(),email:data.email,role,profile};localStorage.setItem('agrifundDemoUser',JSON.stringify(currentUser));}
        $('#openAuth').textContent='My account ↗';message(msg,authMode==='signup'?'Demo profile created. You can now request an assessment.':'Signed in to your local demo account.');
        setTimeout(()=>closeModal($('#authModal')),700);return;
      }
      if(authMode==='signup'){
        const role=data.role, profile=Object.fromEntries((profileKeys[role]||[]).map(k=>[k,data[k]||null]));
        const {data:authData,error}=await client.auth.signUp({email:data.email,password:data.password,options:{data:{requested_role:role,full_name:profile.full_name||profile.bank_name||null,profile_data:profile}}});if(error)throw error;
        message(msg,'Check your email to confirm your account. Privileged access is reviewed before activation.');
      } else {
        const {data:authData,error}=await client.auth.signInWithPassword({email:data.email,password:data.password});if(error)throw error;currentUser=authData.user;$('#openAuth').textContent='My account ↗';message(msg,'Signed in. You can now request an assessment.');setTimeout(()=>closeModal($('#authModal')),500);
      }
    }catch(err){message(msg,err.message||'Unable to complete sign-in.',true)}finally{button.disabled=false}
  });
  (async()=>{const c=getSupabase();if(c){const {data}=await c.auth.getUser();if(data?.user){currentUser=data.user;$('#openAuth').textContent='My account ↗'}}})();

  const cropProfiles={maize:{min:400,max:800,tmin:18,tmax:30},corn:{min:400,max:800,tmin:18,tmax:30},beans:{min:300,max:500,tmin:18,tmax:28},wheat:{min:350,max:600,tmin:12,tmax:25},sorghum:{min:300,max:600,tmin:20,tmax:32},millet:{min:250,max:500,tmin:22,tmax:32},tea:{min:1200,max:2000,tmin:18,tmax:25},coffee:{min:1000,max:1800,tmin:18,tmax:26},rice:{min:800,max:1600,tmin:20,tmax:32}};
  const monthMap={'Long rains (Mar–May)':[3,4,5],'Short rains (Oct–Dec)':[10,11,12],'Year-round / irrigated':[1,2,3,4,5,6,7,8,9,10,11,12],Other:[1,2,3,4,5,6,7,8,9,10,11,12]};
  async function fetchClimate(f){
    const lat=n(f.latitude),lon=n(f.longitude);if(lat < -90||lat>90||lon < -180||lon>180)throw new Error('Latitude or longitude is outside the valid range.');
    const now=new Date(), startYear=now.getFullYear()-3, start=`${startYear}0101`,end=`${now.getFullYear()-1}1231`;
    const params=new URLSearchParams({start,end,latitude:String(lat),longitude:String(lon),community:'AG',parameters:'PRECTOTCORR,T2M,T2M_MAX,T2M_MIN',format:'JSON',units:'metric'});
    const url=`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`;
    const res=await fetch(url);if(!res.ok)throw new Error(`NASA POWER responded with ${res.status}. Please retry later.`);
    const json=await res.json(), p=json?.properties?.parameter;if(!p?.PRECTOTCORR)throw new Error('NASA POWER returned no usable data for this location.');
    const wanted=monthMap[f.season]||monthMap.Other, records=[];
    Object.entries(p.PRECTOTCORR).forEach(([date,rain])=>{const month=Number(date.slice(4,6)), vals={rain:n(rain),t:n(p.T2M?.[date]),tmax:n(p.T2M_MAX?.[date]),tmin:n(p.T2M_MIN?.[date])};if(wanted.includes(month)&&vals.rain>=0&&vals.rain<900&&vals.t>-90)records.push(vals)});
    if(!records.length)throw new Error('NASA POWER has no valid daily observations for the selected season.');
    const yearlyRain={};Object.entries(p.PRECTOTCORR).forEach(([date,value])=>{const year=date.slice(0,4),month=Number(date.slice(4,6)),rain=n(value);if(wanted.includes(month)&&rain>=0&&rain<900)(yearlyRain[year]??=[]).push(rain)});
    const seasonTotals=Object.values(yearlyRain).map(days=>days.reduce((a,b)=>a+b,0));
    const sum=seasonTotals.length?seasonTotals.reduce((a,b)=>a+b,0)/seasonTotals.length:0, avgT=records.reduce((s,x)=>s+x.t,0)/records.length, maxT=records.reduce((s,x)=>s+x.tmax,0)/records.length, minT=records.reduce((s,x)=>s+x.tmin,0)/records.length;
    const dry=records.filter(x=>x.rain<1).length/records.length, heavy=records.filter(x=>x.rain>50).length/records.length;
    return {url,start,end,records:records.length,rainTotal:sum,yearCount:seasonTotals.length,avgT,maxT,minT,dryShare:dry,heavyShare:heavy,years:3};
  }
  function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
  function buildScore(f,climate){
    const crop=(f.crop||'').toLowerCase(), profile=Object.entries(cropProfiles).find(([key])=>crop.includes(key))?.[1]||{min:350,max:800,tmin:16,tmax:30};
    const rain=climate.rainTotal, mid=(profile.min+profile.max)/2, half=(profile.max-profile.min)/2;
    const rainPts=climate?clamp(7*(1-Math.max(0,Math.abs(rain-mid)-half)/Math.max(mid,1)),0,7):0;
    const outOfTemp=Math.max(0,profile.tmin-climate.avgT,climate.avgT-profile.tmax);
    const tempPts=climate?clamp(5*(1-outOfTemp/12),0,5):0;
    const exposure=climate?clamp(1-(climate.dryShare*.75+climate.heavyShare*3),0,1):0;
    const hazardPts=5*exposure;
    const resilience=n(f.resilience);const climatePts=rainPts+tempPts+hazardPts+resilience;
    const farmSize=n(f.farm_size), revenue=n(f.farm_revenue), costs=n(f.farm_costs), net=revenue-costs, other=n(f.other_income), existing=n(f.existing_repayments), planned=n(f.planned_repayment), available=net+other-existing;
    const planPts=5+(farmSize>0?5:0)+(revenue>costs?10:revenue>0?5:0)+(f.harvest_date?5:3);
    const marketPts={none:0,informal:6,repeat:11,contract:15}[f.market_evidence]||0;
    const obligation=planned>0?planned:n(f.loan_amount)*.3;
    const capacityRatio=obligation>0?available/obligation:(available>0?2:0);
    const capacityPts=clamp(capacityRatio*8,0,8)+(available>0?7:0)+(other>0?2:0)+(planned>0?3:0);
    const trackPts={0:0,1:4,2:7,3:10}[f.history]||0;
    const bufferPts=({0:0,1:5,2:8}[f.buffer]||0)+(resilience>=2?2:0);
    const categories=[
      {name:'Climate suitability & resilience',score:climatePts,max:20,description:'NASA POWER season history plus reported farm practices.',components:[['Rainfall suitability',rainPts,7],['Temperature suitability',tempPts,5],['Drought & extreme-weather exposure',hazardPts,5],['Environmental resilience',resilience,3]]},
      {name:'Farm plan & production evidence',score:planPts,max:25,description:'Farm size, crop plan, budget and harvest timing.',components:[]},
      {name:'Market & income outlook',score:marketPts,max:15,description:'Buyer evidence selected in your request.',components:[]},
      {name:'Repayment capacity',score:capacityPts,max:20,description:'Seasonal surplus compared with the planned repayment.',components:[]},
      {name:'Financial track record',score:trackPts,max:10,description:'Financial evidence selected in your request.',components:[]},
      {name:'Risk buffers & safeguards',score:bufferPts,max:10,description:'Savings, insurance and climate safeguards reported.',components:[]}
    ].map(c=>({...c,score:Math.round(clamp(c.score,0,c.max)*10)/10}));
    const total=Math.round(categories.reduce((s,c)=>s+c.score,0));
    const evidence=[
      `<b>Climate source:</b> NASA POWER daily point API (AG community), ${climate.start}–${climate.end}; ${climate.records.toLocaleString()} valid season-day observations across 3 historical years.`,
      `<b>Seasonal rainfall proxy:</b> ${rain.toFixed(0)} mm average per year across ${climate.yearCount} historical seasons, with ${climate.records.toLocaleString()} matching season-day observations. It is not a forecast.`,
      `<b>Temperature:</b> mean daily T2M ${climate.avgT.toFixed(1)}°C (mean min ${climate.minT.toFixed(1)}°C; mean max ${climate.maxT.toFixed(1)}°C). Crop thresholds are indicative defaults and need local agronomic review.`,
      `<b>Weather exposure proxy:</b> ${(climate.dryShare*100).toFixed(1)}% of selected season days below 1 mm/day; ${(climate.heavyShare*100).toFixed(1)}% above 50 mm/day. Historical grid data cannot predict future hazards.`,
      `<b>Seasonal cash estimate:</b> farm revenue ${fmt(revenue)} − farm costs ${fmt(costs)} + other income ${fmt(other)} − existing repayments ${fmt(existing)} = ${fmt(available)} available before the new facility.`,
      `<b>Repayment check:</b> stated planned seasonal repayment ${planned>0?fmt(planned):'not supplied'}; ${planned>0?`${fmt(available)} available / ${fmt(planned)} stated repayment = ${capacityRatio.toFixed(2)}x coverage.`:'No repayment schedule supplied, so capacity is provisional; 30% of requested amount is used only as a rough placeholder.'}`,
      `<b>Market evidence:</b> ${esc(({none:'not identified',informal:'known local market',repeat:'repeat buyer / sales records',contract:'offtake agreement / contract'})[f.market_evidence]||'not supplied')}. <b>Farmer supplied fields:</b> crop ${esc(f.crop)}, county ${esc(f.county)}, ${esc(f.farm_size)} acres.`,
      `<b>Important limits:</b> farmer-entered values are not independently verified by this prototype. Scores show input completeness and simple rule-based indicators, not calibrated probability of default.`
    ];
    return {total,categories,evidence,climate,finance:{net,other,existing,available,planned,capacityRatio},farm:f,cropProfile:profile};
  }
  function fmt(x){return `KES ${Math.round(x).toLocaleString()}`}
  function renderReport(report){
    lastReport=report;const band=report.total>=80?'Strong readiness':report.total>=60?'Developing readiness':'More evidence may help';
    $('#reportScore').textContent=report.total;$('#reportBand').textContent=band;$('#reportScoreBar').style.width=`${report.total}%`;
    $('#reportMeta').textContent=`${report.farm.crop} · ${report.farm.county} County · ${report.farm.season} · ${new Date().toLocaleDateString()}`;
    $('#reportSummary').textContent=report.total>=80?'The information provided shows positive readiness signals. Review the category details and evidence gaps with a participating lender before making a borrowing decision.':report.total>=60?'Your information shows some positive readiness signals and some gaps. You can strengthen this assessment with verified sales, cash-flow and repayment evidence.':'This assessment has limited evidence or signals that may need attention. An extension officer can help check your farm plan and identify practical next steps.';
    $('#reportCategories').innerHTML=report.categories.map(c=>`<div class="report-category"><div class="report-cat-head"><b>${esc(c.name)}</b><span>${c.score} / ${c.max}</span></div><div class="report-cat-desc">${esc(c.description)}</div><div class="report-cat-bar"><i style="width:${Math.max(0,c.score/c.max*100)}%"></i></div>${c.components?.map(x=>`<div class="report-cat-desc">${esc(x[0])}: ${x[1].toFixed(1)} / ${x[2]}</div>`).join('')||''}</div>`).join('');
    $('#evidenceList').innerHTML=report.evidence.map(x=>`<div class="evidence-item">${x}</div>`).join('');closeModal($('#assessmentModal'));openModal('reportModal');
  }
  $('#assessmentForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('#runAssessment'),msg=$('#assessmentMessage');btn.disabled=true;btn.innerHTML='Loading climate evidence…';message(msg,'Fetching recent historical data from NASA POWER. This can take a few seconds.');
    const f=formObject(e.currentTarget);
    try{
      const c=await fetchClimate(f),report=buildScore(f,c);
      const client=getSupabase();
      if(client){let user=currentUser;if(!user){const {data}=await client.auth.getUser();user=data?.user}if(user){const {error}=await client.from('assessments').insert({farmer_id:user.id,request_data:f,result:report,agriscore:report.total});if(error)throw error}}
      else {const entries=JSON.parse(localStorage.getItem('agrifundAssessments')||'[]');entries.unshift({created_at:new Date().toISOString(),result:report});localStorage.setItem('agrifundAssessments',JSON.stringify(entries.slice(0,10)))}
      renderReport(report);
    }catch(err){message(msg,err.message||'Assessment failed. Check the coordinates and try again.',true)}finally{btn.disabled=false;btn.innerHTML='Calculate my AgriScore <span>→</span>'}
  });
  $('#printReport').addEventListener('click',()=>window.print());$('#closeReport').addEventListener('click',()=>closeModal($('#reportModal')));
})();
