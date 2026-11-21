
    let doctors = [];
    let pending = null;
    let currentState = null;

    const initialDoctorId = new URLSearchParams(location.search).get('DoctorID') || '110';

    function updateDoctorName() {
      const doctor = doctors.find(function (item) {
        return String(item.id) === String(initialDoctorId);
      });

      byId('doctorName').textContent = doctor
        ? ' · ' + doctor.name
        : '';
    }

    function renderState(data) {
      currentState = data;
      if (!data.canSubmit) cancelDictation();

      byId('title').textContent = data.name || 'شرح حال بیمار';

      const messages = (data.messages || []).filter(function (item) {
        return item.RecordType === 'PATIENT_MESSAGE';
      });

      // فقط متن‌های بیمار نمایش داده می‌شوند.
      showMessages(byId('conversation'), messages);

      if (!messages.length) {
        byId('conversation').append(
          el('p', 'هنوز شرح حالی ثبت نکرده‌اید.', 'muted')
        );
      }

      // کادر متن و دکمه ثبت مخفی نمی‌شوند.
      byId('composer').hidden = false;

      byId('message').readOnly = !data.canSubmit;
      byId('sendMessageButton').disabled = busy || !data.canSubmit;
      byId('closed').hidden = data.canSubmit;

      byId('message').placeholder = data.canSubmit
        ? 'علت مراجعه و علائم خود را بنویسید…'
        : 'شرح حال امروز شما ثبت شده است.';

      updateDoctorName();

      byId('conversation').scrollTop =
        byId('conversation').scrollHeight;
    }

    async function enterPatient() {
      const state = await rpc('getPatientDailyState', {
        doctorId: initialDoctorId
      });

      renderState(state);

      byId('login').hidden = true;
      byId('registration').hidden = true;
      byId('app').hidden = false;
    }

    async function loginPatient() {
      await work(async function () {
        const result = await rpc('patientLogin', {
          nationalId: byId('nationalId').value.trim(),
          entryCode: byId('entryCode').value.trim()
        });

        resetQuestionnaire();
        token = result.token;
        pending = null;

        if (result.registrationRequired) {
          byId('registerNationalId').value = result.subject;

          byId('login').hidden = true;
          byId('registration').hidden = false;
          byId('app').hidden = true;
        } else {
          await enterPatient();
        }

        byId('entryCode').value = '';
      });
    }

    async function registerPatient() {
      await work(async function () {
        const name = byId('registerName').value.trim();
        const mobile = byId('registerMobile').value.trim();

        if (!name) {
          throw new Error('نام و نام خانوادگی را وارد کنید.');
        }

        if (!mobile) {
          throw new Error('شماره موبایل را وارد کنید.');
        }

        await rpc('registerPatient', {
          name: name,
          mobile: mobile,
          doctorId: initialDoctorId
        });

        await enterPatient();
      });
    }

    // نمایش وضعیت پایین فرم را با پیام پردازش بالای صفحه هماهنگ می‌کند.
    function syncSubmitProcessing() {
      const topStatus = byId('status');
      const bottomStatus = byId('submitProcessing');
      if (!topStatus || !bottomStatus) return;

      const topMessage = (topStatus.textContent || '').replace(/\s+/g, ' ').trim();
      const isProcessing = /در\s*حال\s*پردازش|processing/i.test(topMessage) ||
        topStatus.getAttribute('aria-busy') === 'true' ||
        topStatus.classList.contains('processing') ||
        topStatus.classList.contains('loading');

      bottomStatus.classList.toggle('visible', isProcessing || busy);
    }

    const topStatusObserver = new MutationObserver(syncSubmitProcessing);
    topStatusObserver.observe(byId('status'), {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
    syncSubmitProcessing();

    async function send() {
  if (busy) return;
  cancelDictation();
  const processing = byId('submitProcessing');
  processing.classList.add('visible');
  try {
    await work(async function () {
    if (!pending) {
      const state = await rpc('getPatientDailyState', {
        doctorId: initialDoctorId
      });

      renderState(state);

      if (!state.canSubmit) {
        throw new Error(
          'شرح حال امروز قبلاً ثبت شده است؛ ' +
          'از روز بعد می‌توانید دوباره ارسال کنید.'
        );
      }

      const text = byId('message').value.trim();

      if (!text) {
        throw new Error('شرح حال خود را بنویسید.');
      }

      pending = {
        text: text,
        questionnaire: qAttached,
        requestId: uid(),
        doctorId: initialDoctorId
      };
    }

    // در صورت قطع ارتباط، pending برای تلاش مجدد حفظ می‌شود.
    const result = await rpc('submitDailyPatient', pending);
    launchPatientAI(result.aiSessionId);
    

    pending = null;
    byId('message').value = '';

    // ابتدا نتیجه ثبت را نمایش بده.
    renderState(result);

    // سپس پیام‌های ذخیره‌شده را دوباره از سرور دریافت کن.
    try {
      await enterPatient();
    } catch (error) {
      throw new Error(
        'شرح حال ثبت شد، اما بازخوانی پیام‌ها ناموفق بود. ' +
        'نیازی به ثبت مجدد نیست.'
      );
    }

    requestAnimationFrame(function () {
      const conversation = byId('conversation');
      conversation.scrollTop = conversation.scrollHeight;
    });
    });
  } finally {
    processing.classList.remove('visible');
    syncSubmitProcessing();
  }
}

    // هنگام بازگشت به صفحه، وضعیت روز دوباره بررسی می‌شود.
    document.addEventListener('visibilitychange', function () {

      if (
        !document.hidden &&
        token &&
        !byId('app').hidden &&
        !busy
      ) {
        work(enterPatient);
      }
    });

    // دریافت نام پزشک برای سربرگ.
    rpc('getAppConfig').then(function (data) { doctors=data.doctors||[]; updateDoctorName(); }).catch(function (error) { byId('status').textContent=error.message||'دریافت نام پزشک ناموفق بود.'; });

    function launchPatientAI(sessionId) {
      if (!sessionId) return;

      // درخواست جداگانه؛ فرم بیمار منتظر نتیجه نمی‌ماند.
      rpc('requestPatientAI',{sessionId:sessionId}).catch(function () { /* ثبت شرح حال وابسته به پاسخ AI نیست. */ });
    }



    // Host voice.html at this exact HTTPS address, without an iframe.
    const VOICE_URL = 'https://hooshteb.ir/voice.html';
    const VOICE_ORIGIN = new URL(VOICE_URL).origin;
    let voiceWindow = null;
    let voiceNonce = '';
    let voiceLoginToken = '';
    let voiceAccepted = false;

    const qSchema = window.HTQ_SCHEMA;
    let qAttached=null, qSnippet='';
    let qPort;
    function closeQ(){
      const d=byId('qWindow');if(d.open)d.close();
      if(qPort)qPort.close();qPort=null;
      byId('qFrame').onload=null;byId('qFrame').removeAttribute('src');
    }
    byId('qWindow').oncancel=e=>{e.preventDefault();closeQ();};
    function resetQuestionnaire(){closeQ();qAttached=null;qSnippet='';byId('questionStatus').textContent='';}
    function openQ(){
      if(!token||busy||pending||!currentState?.canSubmit)return;
      const frame=byId('qFrame');byId('qWindow').showModal();
      frame.onload=()=>{
        const ch=new MessageChannel();qPort=ch.port1;
        qPort.onmessage=e=>{
          if(e.data.cancel){closeQ();return;}
          if(!currentState?.canSubmit||pending||!token){closeQ();return;}
          const a=e.data.answers,input=byId('message');
          const snippet=qSchema.filter(s=>a[s.id]).map(s=>s.label+': '+(Array.isArray(a[s.id])?a[s.id].join('، '):a[s.id])).join('؛ ')+'.';
          let next=input.value;
          if(qAttached&&next.includes(qSnippet))next=next.replace(qSnippet,()=>snippet);
          else{
            if(qAttached&&next.trim()&&!confirm('متن قبلی را ویرایش کرده‌اید. پاسخ تازه به انتهای نوشته اضافه شود؟'))return;
            next+=(next.trim()?'\n':'')+snippet;
          }
          if(next.length>input.maxLength){qPort.postMessage({error:'متن در کادر شرح حال جا نمی‌شود. پاسخ‌های اختیاری را کوتاه کنید.'});return;}
          input.value=next;input.dispatchEvent(new Event('input',{bubbles:true}));qAttached=a;qSnippet=snippet;closeQ();
          byId('questionStatus').textContent='پاسخ‌ها اضافه شدند. متن را بررسی کنید و «ثبت پیام» را بزنید.';
        };
        frame.contentWindow.postMessage({type:'Q_INIT',schema:qSchema,answers:qAttached},'*',[ch.port2]);
      };
      frame.src="./patient_questionnaire.html";
    }
    function syncVoiceControls() {
      const enabled = !!token && !byId('app').hidden && currentState &&
        currentState.canSubmit && !byId('message').readOnly && !busy;
      const qc=byId('questionControls');
      if(qc.disabled!==(!enabled||!!pending))qc.disabled=!enabled||!!pending;
      if(!currentState?.canSubmit && qAttached)resetQuestionnaire();
      const fieldset = byId('voiceControls');
      if (fieldset.disabled === !!enabled) fieldset.disabled = !enabled;
    }
    function cancelDictation() {
      voiceNonce = '';
      voiceLoginToken = '';
      if (voiceWindow) { try { voiceWindow.close(); } catch (error) {} }
      voiceWindow = null;
      voiceAccepted = false;
    }
    function startDictation() {
      if (busy || !token || !currentState || !currentState.canSubmit ||
          byId('message').readOnly || byId('app').hidden) return;
      if (voiceWindow && !voiceWindow.closed) { voiceWindow.focus(); return; }
      voiceNonce = crypto.randomUUID();
      voiceLoginToken = token;
      voiceAccepted = false;
      voiceWindow = window.open(VOICE_URL + '#request=' + encodeURIComponent(voiceNonce), '_blank');
      if (!voiceWindow) {
        byId('speechStatus').textContent = 'مرورگر صفحه دریافت گفتار را باز نکرد؛ اجازه بازشدن پنجره جدید را بدهید.';
        return;
      }
      byId('speechStatus').textContent = 'در صفحه دریافت گفتار، صحبت کنید و سپس «انتقال به شرح حال» را بزنید.';
    }
    window.addEventListener('message', function (event) {
      if (event.origin !== VOICE_ORIGIN || event.source !== voiceWindow || !voiceNonce) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.request !== voiceNonce) return;
      if (data.type === 'HT_VOICE_READY') {
        voiceWindow.postMessage({type: 'HT_VOICE_INIT', request: voiceNonce}, VOICE_ORIGIN);
        return;
      }
      if (data.type !== 'HT_VOICE_TEXT') return;
      function reply(ok, message) {
        voiceWindow.postMessage({type: 'HT_VOICE_ACK', request: voiceNonce, ok: ok, message: message}, VOICE_ORIGIN);
      }
      if (!token || token !== voiceLoginToken || busy || !currentState ||
          !currentState.canSubmit || byId('message').readOnly || byId('app').hidden) {
        reply(false, 'فرم بیمار آماده نیست یا شرح حال امروز ثبت شده است. به فرم برگردید.');
        return;
      }
      if (voiceAccepted) { reply(true, 'متن قبلاً منتقل شده است؛ به فرم بیمار برگردید.'); return; }
      if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 1500) {
        reply(false, 'متن باید بین ۱ تا ۱۵۰۰ کاراکتر باشد.'); return;
      }
      const input = byId('message');
      const addition = (input.value && !/\s$/.test(input.value) ? '\n' : '') + data.text.trim();
      if (input.value.length + addition.length > input.maxLength) {
        reply(false, 'متن به همراه نوشته قبلی بیش از ۱۵۰۰ کاراکتر است؛ متن این صفحه را کوتاه‌تر کنید.'); return;
      }
      input.value += addition;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      voiceAccepted = true;
      byId('speechStatus').textContent = 'متن گفتار اضافه شد؛ آن را بررسی و سپس ثبت پیام را بزنید.';
      reply(true, 'متن منتقل شد. به فرم بیمار برگردید و پس از بررسی، ثبت پیام را بزنید.');
    });
    async function patientLogout() {
      if (busy) return;
      cancelDictation(); pending = null; currentState = null;
      resetQuestionnaire();
      await logout(); syncVoiceControls();
    }
    const voiceObserver = new MutationObserver(syncVoiceControls);
    voiceObserver.observe(byId('composer'), {subtree: true, attributes: true, attributeFilter: ['disabled', 'readonly']});
    voiceObserver.observe(byId('app'), {attributes: true, attributeFilter: ['hidden']});
    window.addEventListener('pagehide', cancelDictation);
    syncVoiceControls();
  
