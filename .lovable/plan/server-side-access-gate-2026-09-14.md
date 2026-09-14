# Server-side access gate

## What changes for the user

- أي حد يفتح الموقع من غير رابط صالح: السيرفر يرجّعله صفحة "الوصول مرفوض" فقط، من غير ما ينزّل كود التطبيق للمتصفح خالص.
- أول ما يفتح لينك صالح، السيرفر يسجّل الجهاز، يحط كوكي آمنة (HttpOnly)، ويحوّله على الرئيسية.
- لو الكوكي اتمسحت أو انتهت أو تعدّى عدد الأجهزة، السيرفر يرجّع صفحة الرفض من غير ما يخدم الموقع.
- صفحة الادمن الطويلة تفضل مفتوحة زي ما هي (مش محتاجة توكن).

## Technical

1. `src/lib/access-gate.server.ts` (جديد): دوال server-only بتستخدم `supabaseAdmin`:
   - `validateAndRegister(token, deviceId)` → بتتحقق من التوكن، صلاحيته، وتسجّل الجهاز لو تحت الحد.
   - `checkExistingAccess(token, deviceId)` → بتتأكد إن الجهاز مسجّل فعلاً وإن التوكن لسه شغّال.
2. `src/lib/access-gate-response.ts` (جديد): يبني `Response` بصفحة HTML رفض مضمّنة (نفس ستايل `AccessDenied`) بدون أي JS للتطبيق.
3. `src/start.ts`: يضاف `accessGateMiddleware` في أول `requestMiddleware`. المنطق:
   - تجاهل: أي مسار فيه `.` (ملفات ستاتيك)، `/_serverFn`, `/_build`, `/__l5e`, `/api`, `/assets`, ومسار الادمن الطويل.
   - لو المسار = `/<30 حرف أو رقم>`: يتحقق من التوكن، يضيف `Set-Cookie` للـ `lv_access` و`lv_device` (HttpOnly, SameSite=Lax, Secure)، ويعمل 302 على `/`.
   - أي مسار HTML تاني: يقرأ الكوكي، يتحقق منها بالـ DB؛ لو مش صالحة يرجّع HTML رفض بحالة 403 من غير ما يمرّر الطلب لـ SSR.
4. `src/routes/$token.tsx`: يتبسّط لصفحة انتظار بسيطة (المفروض middleware يعترض قبل ما يوصل هنا، لكن يفضل fallback).
5. صفحات `AccessGate` client-side تفضل زي ما هي كطبقة حماية إضافية.
