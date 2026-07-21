# السيرة الذاتية — حزمة نشر

مجلد مكتفٍ ذاتياً لنشر صفحة السيرة الذاتية والمشاريع المختارة على **GitHub Pages**.
مولّد آلياً بـ `export-cv.py` — لا تحرّره يدوياً؛ أعد التصدير بدلاً من ذلك.

## النشر على GitHub Pages

1. أنشئ مستودعاً جديداً على GitHub (خاصاً أو عاماً — الصفحة تعمل في الحالتين
   ما دامت Pages مفعّلة).
2. ارفع **محتوى هذا المجلد** إلى فرع `main`:
   ```
   cd _cv-site
   git init && git add -A && git commit -m "نشر السيرة الذاتية"
   git branch -M main
   git remote add origin <رابط-المستودع>
   git push -u origin main
   ```
3. في المستودع: Settings ← Pages ← Source: `main` / `/ (root)` ← Save.
4. بعد دقيقة يصبح الرابط جاهزاً: `https://<الحساب>.github.io/<المستودع>/`

## التحديث

بعد أي تغيير في السيرة أو المشاريع المختارة:
```
python export-cv.py      # يعيد بناء _cv-site
cd _cv-site && git add -A && git commit -m "تحديث" && git push
```

> ملف `.nojekyll` موجود عمداً كي تخدم Pages المجلدات التي تبدأ بشرطة سفلية دون معالجة.
