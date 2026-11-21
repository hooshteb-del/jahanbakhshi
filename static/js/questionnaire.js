
const nodes=new Map();let schema=[],port;
const get=id=>document.getElementById(id);
function reason(){return nodes.get('reason').querySelector('select').value;}
function branches(){const b=String(schema[0].options.indexOf(reason()));schema.forEach(s=>nodes.get(s.id).hidden=s.id!=='reason'&&(!reason()||(s.branch!=='*'&&!s.branch.split(',').includes(b))));}
window.addEventListener('message',e=>{
 if(port||e.source!==parent||e.data?.type!=='Q_INIT'||!e.ports[0])return;
 port=e.ports[0];port.onmessage=e=>{get('status').textContent=e.data.error||'';};schema=e.data.schema;
 const saved=e.data.answers||{};
 schema.forEach(s=>{const f=document.createElement('fieldset'),l=document.createElement('legend');l.textContent=s.label;f.append(l);nodes.set(s.id,f);
 if(s.multi){s.options.forEach(v=>{const label=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.value=v;i.checked=(saved[s.id]||[]).includes(v);label.append(i,document.createTextNode(v));f.append(label);});}
 else{const i=document.createElement(s.options.length?'select':'textarea');i.setAttribute('aria-label',s.label);
 if(s.options.length){i.add(new Option('انتخاب کنید…',''));s.options.forEach(v=>i.add(new Option(v,v)));}else i.maxLength=300;
 i.value=saved[s.id]||'';if(s.id==='reason'){i.required=true;i.onchange=branches;}f.append(i);}
 get('items').append(f);});branches();
});
get('apply').onclick=()=>{
 if(!port||!nodes.has('reason')){get('status').textContent='اتصال به فرم بیمار برقرار نشده است. پرسش‌نامه را ببندید و دوباره باز کنید.';return;}
 if(!reason()){get('status').textContent='ابتدا علت اصلی مراجعه را انتخاب کنید.';nodes.get('reason').querySelector('select').focus();return;}
 get('status').textContent='';const answers={};schema.forEach(s=>{const box=nodes.get(s.id);if(box.hidden)return;const v=s.multi?Array.from(box.querySelectorAll(':checked'),i=>i.value):box.querySelector('select,textarea').value.trim();if(v.length)answers[s.id]=v;});port.postMessage({answers});};
get('cancel').onclick=()=>port?.postMessage({cancel:true});

