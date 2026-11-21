# رابط GitHub Pages

این پوشه شامل صفحات ثابت و دارایی‌های رابط کاربری است. GitHub Pages فقط این فایل‌های ثابت را میزبانی می‌کند؛ عملیات ورود، پرونده، گفت‌وگو و AI باید از API Flask انجام شوند.

## راه‌اندازی

1. در `static/js/config.js` مقدار `API_BASE_URL` را روی آدرس HTTPS API بگذارید.
2. این پوشه را در مخزن GitHub قرار دهید و GitHub Pages را روی شاخه یا پوشهٔ همین سایت فعال کنید.
3. در `.env` سمت Flask، origin دقیق GitHub Pages را در `CORS_ORIGINS` ثبت کنید.

برای API عمومی، URL باید گواهی HTTPS معتبر داشته باشد. این مخزن نباید شامل رمز SQL Server، کلید AI یا فایل `.env` باشد.
