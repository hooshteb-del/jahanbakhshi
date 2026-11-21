
  // جلوگیری از تداخل با تابع $ موجود در shared.html
  const clinicJQuery = window.jQuery;

  if (clinicJQuery) {
    window.$ = clinicJQuery;
  }



let patient='',session=null,visit=null,draftRequest=uid(),confirmData=null;
const fields=['Diagnosis','VisitResult','MedicalRecommendations','FollowUpDate','DoctorNotes'];
const fieldLabels={Diagnosis:'تشخیص',VisitResult:'نتیجه ویزیت',MedicalRecommendations:'توصیه‌ها',FollowUpDate:'تاریخ پیگیری',DoctorNotes:'یادداشت'};
const medLabels = {
  name: 'نام دارو و دوز دارو',
  frequency: 'دفعات مصرف',
  notes: 'توضیحات'
};
function loginDoctor(){work(async()=>{const result=await rpc('doctorLogin',{nationalId:byId('doctorNationalId').value,password:byId('password').value});token=result.token;byId('password').value='';byId('login').hidden=true;byId('app').hidden=false;await search();});}
async function search(){const list=await rpc('searchPatients',{query:byId('query').value});byId('patients').replaceChildren();if(!list.length)byId('patients').append(el('p','بیماری یافت نشد.'));list.forEach(p=>{const b=el('button',(p.name||'بدون نام')+' · '+p.nationalId,'sessionButton');b.append(el('small',date(p.lastAt)+' · '+p.count+' شرح حال · '+p.pending+' در انتظار'));b.onclick=()=>work(async()=>{if(session&&!confirm('فرم باز کنار گذاشته شود؟'))return;cancelEdit();patient=p.nationalId;await loadPatient();});byId('patients').append(b);});}


function latinDigits(value){return String(value||'').trim().replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));}
function doctorDayKey(value){
  const text=latinDigits(value),match=/^(1[34]\d{2})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if(match)return match[1]+'/'+match[2].padStart(2,'0')+'/'+match[3].padStart(2,'0');
  if(!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text))return '';
  const d=new Date(text.length===10?text+'T12:00:00Z':text);if(isNaN(d.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t).value;return get('year')+'/'+get('month')+'/'+get('day');
}
function medicationList(value){const items=JSON.parse(value||'[]');if(!Array.isArray(items))throw new Error('اطلاعات دارو معتبر نیست.');return items;}

async function loadPatient(){
  const timeline=byId('timeline'),old=new Map();
  timeline.querySelectorAll('details[data-day]').forEach(d=>old.set(d.dataset.day,d.open));
  const same=timeline.dataset.patient===patient;
  const list=await rpc('getPatientDetails',{nationalId:patient});
  byId('patientTitle').textContent='پرونده '+patient;timeline.replaceChildren();timeline.dataset.patient=patient;
  const groups=new Map();
  function group(day){day=day||'تاریخ نامشخص';if(!groups.has(day))groups.set(day,{histories:[],visits:[],sessions:new Map()});return groups.get(day);}
  list.forEach(data=>{
    const s=data.session;
    (data.messages||[]).filter(m=>m.RecordType==='PATIENT_MESSAGE').forEach(m=>{
      const g=group(doctorDayKey(m.CreatedAt||s.CreatedAt));g.histories.push({s,m});g.sessions.set(s.SessionID,s);
    });
    (data.visits||[]).forEach(v=>{const g=group(doctorDayKey(v.VisitDate)||doctorDayKey(v.CreatedAt)||doctorDayKey(s.CreatedAt));g.visits.push({s,v});});
  });
  const days=[...groups.keys()].sort((a,b)=>a==='تاریخ نامشخص'?1:b==='تاریخ نامشخص'?-1:b.localeCompare(a));
  if(!days.length)timeline.append(el('p','هنوز شرح حال یا ویزیتی ثبت نشده است.'));
  days.forEach((day,index)=>{
    const g=groups.get(day),section=el('details',undefined,'daily-section');section.dataset.day=day;section.open=same&&old.has(day)?old.get(day):index===0;
    section.append(el('summary',day+' · '+g.histories.length+' شرح حال · '+g.visits.length+' ویزیت'));
    const content=el('div',undefined,'daily-content');
    g.histories.forEach(({s,m})=>{
      const card=el('section',undefined,'card'),heading=el('div',undefined,'ai-header');
      heading.append(el('h3','شرح حال بیمار'),el('span',date(m.CreatedAt||s.CreatedAt)+' · '+(labels[s.SessionStatus]||s.SessionStatus||''),'muted'));card.append(heading);
      card.append(el('div',m.MessageText||'','patient-history-text'));
      const aiHeading=el('div',undefined,'ai-actions');aiHeading.append(el('h3','تحلیل AI'));
      const summary=String(m.AISummary||'').trim();
      if (!summary || isTemporaryAISummary(summary)) {const button=el('button','دریافت تحلیل AI');button.type='button';button.onclick=()=>requestDoctorAI(s.SessionID);aiHeading.append(button);}
      card.append(aiHeading);
      if(summary)card.append(summaryNode(summary));
      else {const statuses={IDLE:'تحلیل هنوز دریافت نشده است.',PENDING:'تحلیل در انتظار اجراست.',PROCESSING:'پردازش آغاز شده است؛ امکان درخواست مجدد وجود دارد.',ERROR:'پردازش قبلی ناموفق بوده است.'};card.append(el('p',statuses[m.AIStatus]||'تحلیل هنوز دریافت نشده است.','muted'));}
      content.append(card);
    });
    g.visits.forEach(({s,v})=>{
      const card=el('section',undefined,'card');card.append(el('h3','ویزیت · '+(labels[v.Status]||v.Status||'')));
      fields.forEach(k=>{if(v[k])card.append(el('p',fieldLabels[k]+': '+(k==='FollowUpDate'?(doctorDayKey(v[k])||v[k]):v[k])));});
      try{medicationList(v.PrescribedMedications).forEach(m=>card.append(el('p',Object.entries(m).filter(([k,x])=>x).map(([k,x])=>(medLabels[k]||k)+': '+x).join(' | '))));}catch(e){card.append(el('p','اطلاعات دارو قابل نمایش نیست.'));}
      
      const isToday =
  doctorDayKey(v.VisitDate) ===
  doctorDayKey(new Date().toISOString());

  if (
    v.Status === 'DRAFT' ||
    (v.Status === 'FINAL' && isToday)
  ) {
    const button = el(
      'button',
      v.Status === 'FINAL'
        ? 'ویرایش نتیجه ویزیت'
        : 'ویرایش پیش‌نویس',
      'secondary'
    );

    button.type = 'button';

    button.onclick = function () {
      startVisit(s, v);
    };

    card.append(button);
  }
      
      content.append(card);
    });
  g.sessions.forEach(function (s) {
    if (!['SUBMITTED', 'COMPLETED'].includes(s.SessionStatus)) {
      return;
    }

    const today = doctorDayKey(new Date().toISOString());

    const relatedVisits = list
      .filter(function (data) {
        return data.session.SessionID === s.SessionID;
      })
      .flatMap(function (data) {
        return data.visits || [];
      });

    const editableVisit = relatedVisits
      .filter(function (v) {
        return v.Status === 'DRAFT' ||
          (
            v.Status === 'FINAL' &&
            doctorDayKey(v.VisitDate) === today
          );
      })
      .sort(function (a, b) {
        return String(b.UpdatedAt || b.CreatedAt || '')
          .localeCompare(
            String(a.UpdatedAt || a.CreatedAt || '')
          );
      })[0] || null;

    const button = el(
      'button',
      editableVisit
        ? 'ویرایش اطلاعات ویزیت'
        : 'ثبت ویزیت جدید' +
          (doctorDayKey(s.CreatedAt) || ''),
      'secondary'
    );

    

    button.type = 'button';

    button.onclick = function () {
      startVisit(s, editableVisit);
    };

    content.append(button);
  });

  section.append(content);
  timeline.append(section);

  });
}

function startVisit(s, v) {
  if (busy) return;

  if (session && !confirm('فرم فعلی کنار گذاشته شود؟')) {
    return;
  }

  session = s;
  visit = v || null;
  confirmData = null;
  draftRequest = uid();

  byId('selection').textContent =
    (s.PatientName || s.PatientNationalID) +
    ' · ' +
    (visit ? 'ویرایش ویزیت' : 'ویزیت جدید');

  byId('visitForm').hidden = false;

  // تکمیل فیلدها با اطلاعات قبلی
  fields.forEach(function (field) {
    let value = visit ? visit[field] || '' : '';

    if (field === 'FollowUpDate' && value) {
      value = doctorDayKey(value) || value;
    }

    byId(field).value = value;
  });

  // تکمیل داروهای قبلی
  byId('medications').replaceChildren();

  if (visit) {
    try {
      medicationList(visit.PrescribedMedications)
        .forEach(function (medicine) {
          addMedication(medicine);
        });
    } catch (error) {
      byId('status').textContent =
        'اطلاعات داروهای قبلی قابل خواندن نیست؛ پیش از ذخیره بررسی کنید.';
    }
  }

  byId('finalVisitButton').textContent = visit
    ? 'ثبت اصلاحات ویزیت'
    : 'ثبت نهایی ویزیت';

  const previousError = byId('finalizeError');

  if (previousError) {
    previousError.hidden = true;
    previousError.textContent = '';
  }

  requestAnimationFrame(function () {
    initializeFollowUpPicker();

    // حفظ تاریخ قبلی پس از راه‌اندازی تقویم
    byId('FollowUpDate').value = visit
      ? doctorDayKey(visit.FollowUpDate) ||
        visit.FollowUpDate || ''
      : '';

    byId('visitForm').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
}

function startVisit(s, v) {
  if (session && !confirm('فرم فعلی کنار گذاشته شود؟')) {
    return;
  }

  session = s;
  visit = v;
  confirmData = null;
  draftRequest = uid();

  byId('selection').textContent =
    (s.PatientName || s.PatientNationalID) +
    ' · ' + date(s.CreatedAt) +
    (v ? ' · ویرایش پیش‌نویس' : ' · ویزیت جدید');

  byId('visitForm').hidden = false;

  fields.forEach(function (field) {
    let value = v ? v[field] || '' : '';

    if (field === 'FollowUpDate' && value) {
      value = doctorDayKey(value) || value;
    }

    byId(field).value = value;
  });

  byId('medications').replaceChildren();

  if (v) {
    try {
      medicationList(v.PrescribedMedications)
        .forEach(addMedication);
    } catch (error) {
      byId('status').textContent = error.message;
    }
  }

  // تقویم پس از نمایان‌شدن فرم راه‌اندازی شود.
  requestAnimationFrame(function () {
    initializeFollowUpPicker();
  });
}

function cancelEdit(){session=null;visit=null;confirmData=null;draftRequest=uid();byId('visitForm').hidden=true;byId('selection').textContent='از تاریخچه، جلسه مورد نظر را انتخاب کنید.';}

function addMedication(values = {}) {
  if (byId('medications').children.length >= 20) {
    byId('status').textContent = 'حداکثر ۲۰ دارو مجاز است.';
    return;
  }

  values = Object.assign({}, values);

  values.name = [
    values.name,
    values.strength,
    values.form,
    values.dose ? 'دوز مصرف: ' + values.dose : ''
  ].filter(Boolean).join(' — ');

  values.notes = [
    values.notes,
    values.duration ? 'مدت مصرف: ' + values.duration : ''
  ].filter(Boolean).join('؛ ');

  const medicationFields = {
    name: 'نام دارو و دوز دارو',
    frequency: 'دفعات مصرف',
    notes: 'توضیحات'
  };

  const box = el('div', undefined, 'med');

  Object.entries(medicationFields).forEach(function ([key, title]) {
    const label = el('label', title);
    const input = el('input');

    input.dataset.key = key;
    input.maxLength =
      key === 'notes' ? 1200 :
      key === 'name' ? 600 : 120;

    input.value = values[key] || '';

    label.append(input);
    box.append(label);
  });

  const removeButton = el('button', 'حذف دارو', 'secondary');
  removeButton.type = 'button';
  removeButton.onclick = function () {
    box.remove();
  };

  box.append(removeButton);
  byId('medications').append(box);
}

function collect_old(){const d={sessionId:session.SessionID,requestId:draftRequest,uid:visit?.UID||'',expectedUpdatedAt:visit?.UpdatedAt||'',medications:[]};fields.forEach(k=>d[k]=k==='FollowUpDate'?latinDigits($(k).value):$(k).value);Array.from(byId('medications').children).forEach(box=>{const m={};box.querySelectorAll('input').forEach(i=>m[i.dataset.key]=i.value);d.medications.push(m);});return d;}

function collect() {
  if (!session) {
    throw new Error('ابتدا جلسه موردنظر را انتخاب کنید.');
  }

  const data = {
    sessionId: session.SessionID,
    requestId: draftRequest,
    uid: visit ? visit.UID : '',
    expectedUpdatedAt: visit ? visit.UpdatedAt : '',
    medications: []
  };

  fields.forEach(function (field) {
    const value = byId(field).value;

    data[field] = field === 'FollowUpDate'
      ? latinDigits(value)
      : value;
  });

  Array.from(byId('medications').children)
    .forEach(function (box) {
      const medication = {};

      box.querySelectorAll('input').forEach(function (input) {
        medication[input.dataset.key] = input.value;
      });

      data.medications.push(medication);
    });

  return data;
}

async function persist(data){visit=await rpc('saveDoctorVisit',data);return visit;}
function saveDraft(){work(async()=>{await persist(collect());await loadPatient();});}
function preview() {
  if (busy) return;

  try {
    confirmData = null;

    const data = collect();

    if (!String(data.VisitResult || '').trim()) {
      byId('status').textContent =
        'لطفاً فیلد «شرح نتیجه ویزیت» را تکمیل کنید.';

      byId('VisitResult').focus();
      return;
    }

    confirmData = data;
    byId('status').textContent = '';
    byId('preview').replaceChildren();

    fields.forEach(function (field) {
      byId('preview').append(
        el(
          'p',
          fieldLabels[field] + ': ' +
            (confirmData[field] || '—')
        )
      );
    });

    confirmData.medications.forEach(function (medicine) {
      const text = Object.entries(medicine)
        .filter(function ([key, value]) {
          return value;
        })
        .map(function ([key, value]) {
          return (medLabels[key] || key) + ': ' + value;
        })
        .join(' | ');

      byId('preview').append(el('p', text));
    });

    const previousError = byId('finalizeError');

    if (previousError) {
      previousError.hidden = true;
      previousError.textContent = '';
    }

    byId('confirmDialog').showModal();

  } catch (error) {
    byId('status').textContent = error.message;
  }
}

function finalize() {
  work(async function () {
    const dialog = byId('confirmDialog');

    let errorBox = byId('finalizeError');

    if (!errorBox) {
      errorBox = el('p', '', 'notice');
      errorBox.id = 'finalizeError';
      errorBox.style.color = '#a32020';
      errorBox.setAttribute('role', 'alert');
      dialog.prepend(errorBox);
    }

    errorBox.hidden = true;
    errorBox.textContent = '';

    try {
      if (!confirmData) {
        throw new Error(
          'پنجره را ببندید و دوباره «بررسی و ثبت نهایی» را بزنید.'
        );
      }

      if (!String(confirmData.VisitResult || '').trim()) {
        throw new Error('شرح نتیجه ویزیت را تکمیل کنید.');
      }

      console.info('مرحله ۱: ذخیره اطلاعات ویزیت');
      const savedVisit = await persist(confirmData);

      confirmData.uid = savedVisit.UID;
      confirmData.expectedUpdatedAt = savedVisit.UpdatedAt;
      
      console.info('مرحله ۲: نهایی‌کردن ویزیت');
      await rpc('finalizeDoctorVisit', {
        uid: savedVisit.UID,
        expectedUpdatedAt: savedVisit.UpdatedAt
      });
      console.info('ثبت نهایی موفق بود');

    } catch (error) {
      console.error('Finalizing visit failed:', error);

      errorBox.textContent =
        error.message || 'ثبت نهایی ناموفق بود.';

      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'nearest' });
      return;
    }

    dialog.close();
    cancelEdit();

    try {
      await loadPatient();
      await search();
    } catch (error) {
      throw new Error(
        'ویزیت نهایی ثبت شد، اما بازخوانی صفحه ناموفق بود؛ دوباره ثبت نکنید.'
      );
    }
  });
}

let debounce;byId('query').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(!busy)work(search);},450);});

function requestDoctorAI(sessionId) {
  work(async function () {
    const result = await rpc('requestPatientAI',{sessionId:sessionId});

    if (!result.success) {
      throw new Error(
        result.message || 'دریافت تحلیل AI ناموفق بود.'
      );
    }

    await loadPatient();
  });
}

let followUpPickerInitialized = false;

function initializeFollowUpPicker() {
  if (followUpPickerInitialized) return;

  if (
    !clinicJQuery ||
    typeof clinicJQuery.fn.persianDatepicker !== 'function' ||
    typeof window.persianDate !== 'function'
  ) {
    byId('status').textContent =
      'کتابخانه تقویم بارگذاری نشده است؛ اتصال به CDN را بررسی کنید.';
    return;
  }

  try {
    clinicJQuery('#FollowUpDate').persianDatepicker({
      calendarType: 'persian',
      initialValue: false,
      initialValueType: 'persian',
      format: 'YYYY/MM/DD',
      autoClose: true,

      calendar: {
        persian: {
          locale: 'fa'
        }
      },

      timePicker: {
        enabled: false
      },

      formatter: function (unixDate) {
        return new persianDate(unixDate)
          .format('YYYY/MM/DD')
          .replace(/[۰-۹]/g, function (digit) {
            return '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);
          })
          .replace(/[٠-٩]/g, function (digit) {
            return '٠١٢٣٤٥٦٧٨٩'.indexOf(digit);
          });
      }
    });

    followUpPickerInitialized = true;

  } catch (error) {
    console.error('Datepicker initialization failed:', error);

    byId('status').textContent =
      'راه‌اندازی تقویم ناموفق بود: ' + error.message;
  }
}

function isTemporaryAISummary(value) {
  try {
    const summary = JSON.parse(value || '{}');

    return summary.currentSymptoms ===
      'این متن، پاسخ آزمایشی AI است.';
  } catch (error) {
    return false;
  }
}


