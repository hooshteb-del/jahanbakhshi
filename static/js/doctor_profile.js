const profileFields = [
  'fullname', 'specialty', 'phonenumber', 'officephone', 'email',
  'pezeshk_id', 'clinic_desc', 'address'
];

async function loadDoctorProfile() {
  const apiBase = window.APP_CONFIG?.API_BASE_URL;
  const doctorId = new URLSearchParams(location.search).get('DoctorID');
  if (!apiBase || !doctorId) {
    document.querySelector('main').textContent = 'شناسه پزشک یا آدرس API تنظیم نشده است.';
    return;
  }

  try {
    const response = await fetch(
      `${apiBase.replace(/\/$/, '')}/api/public/doctors/${encodeURIComponent(doctorId)}`
    );
    const result = await response.json();
    if (!response.ok || !result.success || !result.data) throw new Error();
    const doctor = result.data;

    document.title = `${doctor.fullname || 'پزشک'} | هوش‌طب`;
    profileFields.forEach((field) => {
      const value = doctor[field] == null ? '' : String(doctor[field]);
      document.querySelectorAll(`[data-doctor-field="${field}"]`).forEach((node) => {
        node.textContent = value;
        if (!value) node.closest('.info-item, .clinic-desc, .address-box, .profile-specialty-wrap')?.setAttribute('hidden', '');
      });
      document.querySelectorAll(`[data-doctor-link="${field}"]`).forEach((node) => {
        if (value) node.href = field === 'email' ? `mailto:${value}` : `tel:${value.replace(/\s/g, '')}`;
      });
    });

    const photo = document.getElementById('doctorPhoto');
    photo.src = doctor.photo || `https://hooshteb.ir/photos/${encodeURIComponent(doctorId)}.png`;
    photo.alt = `عکس ${doctor.fullname || 'پزشک'}`;
    document.getElementById('patientPageLink').href = `./patient_chat.html?DoctorID=${encodeURIComponent(doctorId)}`;
  } catch (_) {
    document.querySelector('main').textContent = 'پروفایل پزشک دریافت نشد؛ اتصال API را بررسی کنید.';
  }
}

loadDoctorProfile();
