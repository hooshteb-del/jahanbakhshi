
'use strict';
let token='',busy=false;
const byId = id => document.getElementById(id);
const uid=()=>crypto.randomUUID();
const date=v=>/^1[34]\d{2}\/\d{2}\/\d{2}$/.test(v)?v:v?new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(v)):'—';
const labels={OPEN:'در حال تکمیل',SUBMITTED:'ارسال‌شده برای پزشک',COMPLETED:'ویزیت‌شده',CANCELLED:'لغوشده',DRAFT:'پیش‌نویس',FINAL:'نهایی'};
const summaryLabels={chiefComplaint:'علت مراجعه',currentSymptoms:'علائم فعلی',onsetAndCourse:'شروع و روند',severity:'شدت',associatedAndNegativeSymptoms:'علائم همراه و منفی',medicalHistory:'سوابق',currentMedications:'داروهای مصرفی',allergies:'حساسیت‌ها',otherInformation:'اطلاعات دیگر',unknowns:'موارد نامشخص'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
async function rpc(action,args={}){
  const base=window.APP_CONFIG?.API_BASE_URL;
  if(!base) throw new Error('آدرس API در config.js تنظیم نشده است.');
  let response;
  try { response=await fetch(`${base.replace(/\/$/,'')}/api`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,args})}); }
  catch(e){ throw new Error('ارتباط با سرویس برقرار نشد؛ آدرس و HTTPS را بررسی کنید.'); }
  let result; try{result=await response.json();}catch(e){throw new Error('پاسخ سرویس قابل خواندن نیست.');}
  if(!response.ok||!result.success) throw new Error(result.message||'درخواست ناموفق بود.');
  return result.data;
}


async function work(fn) {
  if (busy) return;

  busy = true;

  const status = byId('status');
  status.innerText = 'در حال پردازش…';
  status.style.fontSize = '22px';
  status.style.fontWeight = 'bold';
  status.style.color = 'blue';

  //byId('status').textContent = 'در حال پردازش…';


  
  document.querySelectorAll('button').forEach(function (button) {
    button.disabled = true;
  });

  try {
    await fn();
    byId('status').textContent = '';
  } catch (error) {
    byId('status').textContent = error.message;
  } finally {
    busy = false;

    document.querySelectorAll('button').forEach(function (button) {
      button.disabled = false;
    });

    const sendButton = byId('sendMessageButton');
    const messageInput = byId('message');

    if (sendButton && messageInput) {
      sendButton.disabled = messageInput.readOnly;
    }
  }
}

function summaryNode(raw){const box=el('div',undefined,'summary');try{Object.entries(JSON.parse(raw)).forEach(([k,v])=>box.append(el('p',(summaryLabels[k]||k)+': '+v)));}catch(e){box.textContent='خلاصه قابل نمایش نیست.';}return box;}
function showMessages(container,messages){container.replaceChildren();messages.forEach(m=>{if(m.RecordType==='AI_SUMMARY'){container.append(el('h3','خلاصه AI برای پزشک'),summaryNode(m.AISummary));return;}const box=el('div',m.MessageText,'message '+m.Role);box.append(el('small',(m.Role==='patient'?'بیمار':'دستیار')+' · '+date(m.CreatedAt)));container.append(box);});}

async function logout_old()
{
  if(busy)return;busy=true;try{if(token)await rpc('logout');}catch(e){/* Local exit remains available after expiry or network failure. */}finally{token='';location.reload();}
}

async function logout() {
  if (busy) return;

  busy = true;

  try {
    if (token) {
      await rpc('logout');
    }
  } catch (error) {
    // حتی اگر نشست منقضی شده باشد، خروج محلی انجام می‌شود.
  } finally {
    token = '';
    busy = false;

    const app = byId('app');
    const login = byId('login');
    const registration = byId('registration');

    if (app) app.hidden = true;
    if (registration) registration.hidden = true;
    if (login) login.hidden = false;

    // پاک‌کردن اطلاعات ورودی بیمار و رمز ورود
    [
      'nationalId',
      'entryCode',
      'password',
      'registerNationalId',
      'registerName',
      'registerMobile',
      'message'
    ].forEach(function (id) {
      const input = byId(id);

      if (input) {
        input.value = '';
        input.readOnly = id === 'registerNationalId';
      }
    });

    const conversation = byId('conversation');
    if (conversation) conversation.replaceChildren();

    const status = byId('status');
    if (status) status.textContent = '';

    document.querySelectorAll('dialog[open]').forEach(function (dialog) {
      dialog.close();
    });

    if (login) {
      login.querySelectorAll('button').forEach(function (button) {
        button.disabled = false;
      });

      const firstInput = login.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }
}


