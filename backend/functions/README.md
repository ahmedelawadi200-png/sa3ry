# نشر Backend سعري (Cloud Functions)

## 1) تفعيل خطة Blaze (لازمة - Cloud Functions مش شغالة على الخطة المجانية)

1. ادخل [Firebase Console](https://console.firebase.google.com) → مشروعك (sa3ry-pro)
2. تحت (⚙️ Project settings) أو من رسالة تظهرلك تلقائي، دوس **Upgrade to Blaze plan**
3. هيطلب منك تربط حساب فوترة (بطاقة بنكية) — الخطة فيها **free tier كبير جداً** (2 مليون استدعاء Cloud Function شهرياً مجاناً، وCloud Scheduler أول 3 jobs مجانية)، يعني غالباً مش هتدفع حاجة فعلياً على استخدام بحجم تطبيق زي سعري.

## 2) تثبيت Firebase CLI (لو معندكش)
```bash
npm install -g firebase-tools
firebase login
```

## 3) ربط المشروع
من جوه مجلد `backend/` (اللي فيه `functions/`):
```bash
cd backend
firebase init functions
```
لما يسألك:
- **"Use an existing project"** → اختار `sa3ry-pro`
- **"What language?"** → JavaScript
- **"Overwrite functions/package.json?"** → **لأ** (already موجود بالبيانات الصح)
- **"Install dependencies now?"** → أيوه

## 4) تثبيت المكتبات
```bash
cd functions
npm install
```

## 5) النشر
```bash
firebase deploy --only functions
```
هينشر الاتنين: `scheduledPriceSync` (بتشتغل كل 12 ساعة تلقائي) و`triggerPriceSync` (بتتنادى من زرار "شغّل التحديث دلوقتي" في لوحة الإدارة).

## 6) التأكد إن الجدولة اشتغلت
1. Firebase Console → **Functions**
2. هتلاقي `scheduledPriceSync` في الليستة، وجنبها **Cloud Scheduler** trigger كل 12 ساعة
3. تقدر تدوس عليها وتشوف الـ **Logs** لأي تشغيلة

## 7) الاختبار المحلي (اختياري، قبل النشر)
```bash
firebase emulators:start --only functions,firestore
```
ده بيشغّل نسخة محلية من غير ما يلمس بياناتك الحقيقية على Firestore.

---

## ملاحظات تشغيلية مهمة

- **أول تشغيلة:** هتلاقي كل المنتجات الموجودة عندك دلوقتي (من `manual.provider.js`) بترجع تتكتب تاني بنفس البيانات تقريباً — ده **متوقع وآمن**، الهدف إنه يثبت إن الأنابيب كلها شغالة صح قبل ما نضيف مصادر خارجية.
- **لإضافة أمازون لاحقاً:** لما يبقى عندك حساب Amazon Associate فعّال، شغّل:
  ```bash
  firebase functions:config:set amazon.access_key="..." amazon.secret_key="..." amazon.partner_tag="..."
  firebase deploy --only functions
  ```
  ومفيش أي تعديل تاني مطلوب — الملف `amazon.provider.js` هيشتغل تلقائي أول ما الإعدادات دي تتحط.
- **تغيير مدة الجدولة:** عدّل السطر `'every 12 hours'` في `functions/index.js` (مثلاً `'every 6 hours'` أو `'every 24 hours'`) وأعد النشر.
- **تغيير حد الثقة في المطابقة:** `FUZZY_CONFIDENCE_THRESHOLD` و`FUZZY_REVIEW_FLOOR` في `functions/src/matching/matchProducts.js`.
