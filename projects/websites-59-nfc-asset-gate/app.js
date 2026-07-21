/* بوابة بطاقات NFC للأصول — منطق التطبيق
 * Web NFC API (NDEFReader) + بديل محاكاة كامل + تخزين localStorage
 */
(function () {
  'use strict';

  /* ============ مفاتيح التخزين ============ */
  const LS_ASSETS = 'nfcgate.assets.v1';
  const LS_LOG = 'nfcgate.log.v1';

  /* ============ الحالة ============ */
  let assets = loadJSON(LS_ASSETS, []);
  let logs = loadJSON(LS_LOG, []);
  let lastScanned = null;           // آخر أصل مقروء من وسم
  let nfcSupported = false;
  let scanController = null;        // AbortController لجلسة المسح الحالية

  /* ============ عناصر DOM ============ */
  const $ = (id) => document.getElementById(id);
  const nfcStatus = $('nfcStatus');
  const simNotice = $('simNotice');
  const scanResult = $('scanResult');
  const assetTableBody = $('assetTableBody');
  const emptyAssets = $('emptyAssets');
  const assetCount = $('assetCount');
  const logList = $('logList');
  const searchBox = $('searchBox');
  const lastScannedEl = $('lastScanned');

  /* ============ فحص دعم NFC ============ */
  function detectNFC() {
    nfcSupported = ('NDEFReader' in window);
    if (nfcSupported) {
      setBadge('supported', 'NFC مدعوم');
      simNotice.classList.add('hidden');
      // إبقاء أزرار المحاكاة متاحة كاحتياط، لكن إخفاء الأبرز منها
      document.querySelectorAll('.sim-only').forEach((b) => b.classList.add('hidden'));
    } else {
      setBadge('unsupported', 'وضع المحاكاة');
      simNotice.classList.remove('hidden');
      document.querySelectorAll('.sim-only').forEach((b) => b.classList.remove('hidden'));
    }
  }

  function setBadge(cls, text) {
    nfcStatus.className = 'nfc-badge ' + cls;
    nfcStatus.querySelector('.label').textContent = text;
  }

  /* ============ المسح — حقيقي ============ */
  async function startScan() {
    if (!nfcSupported) {
      simulateScan();
      return;
    }
    try {
      if (scanController) scanController.abort();
      scanController = new AbortController();
      const reader = new NDEFReader();
      toast('info', 'جاهز للمسح', 'قرّب وسم NFC من الجهاز…');

      reader.onreadingerror = () => {
        toast('err', 'تعذّر قراءة الوسم', 'حاول تقريب الوسم مجدداً أو استخدم وسماً آخر.');
        addLog('err', 'فشل قراءة وسم NFC', 'خطأ في القراءة');
      };

      reader.onreading = (event) => {
        const data = parseNDEF(event.message);
        handleScanned(data, event.serialNumber || '');
      };

      await reader.scan({ signal: scanController.signal });
    } catch (err) {
      handleNFCError(err, 'المسح');
    }
  }

  /* فك ترميز رسالة NDEF إلى كائن أصل */
  function parseNDEF(message) {
    const decoder = new TextDecoder();
    let combined = '';
    for (const record of message.records) {
      if (record.recordType === 'text' || record.recordType === 'mime' || record.recordType === 'url') {
        try { combined += decoder.decode(record.data); } catch (e) { /* تجاهل */ }
      }
    }
    // نحاول تفسيرها كـ JSON بصيغتنا
    try {
      const obj = JSON.parse(combined);
      if (obj && obj.id) return normalizeAsset(obj);
    } catch (e) { /* ليست JSON */ }
    // وإلا نعيد النص الخام
    return { id: '', name: '', location: '', status: '', holder: '', raw: combined || '(وسم فارغ أو غير مقروء)' };
  }

  function handleScanned(asset, serial) {
    lastScanned = asset;
    renderScanResult(asset, serial);
    updateLastScannedLabel();
    addLog('scan', 'تم مسح وسم', describeAsset(asset) + (serial ? ' · رقم تسلسلي: ' + serial : ''));
    // إن كان الأصل غير موجود في الجدول، نضيفه تلقائياً
    if (asset.id && !assets.find((a) => a.id === asset.id)) {
      assets.unshift(stripRaw(asset));
      persistAssets();
      renderAssets();
      toast('ok', 'أصل جديد', 'أُضيف الأصل المقروء إلى الجدول.');
    }
  }

  /* ============ المسح — محاكاة ============ */
  function simulateScan() {
    // إن كان هناك أصول مخزّنة، نختار واحداً عشوائياً؛ وإلا ننشئ عيّنة
    let sample;
    if (assets.length) {
      sample = assets[Math.floor(Math.random() * assets.length)];
    } else {
      const samples = [
        { id: 'AST-1024', name: 'حاسوب محمول Dell Latitude', location: 'مبنى الإدارة — الدور الثاني', status: 'متوفّر', holder: '' },
        { id: 'AST-2087', name: 'جهاز عرض Epson', location: 'قاعة الاجتماعات الرئيسية', status: 'بعهدة موظف', holder: 'سالم الهنائي' },
        { id: 'AST-3310', name: 'كاميرا مراقبة Hikvision', location: 'البوابة الشمالية', status: 'تحت الصيانة', holder: '' },
      ];
      sample = samples[Math.floor(Math.random() * samples.length)];
    }
    const serial = 'SIM:' + Math.random().toString(16).slice(2, 10).toUpperCase();
    handleScanned(normalizeAsset(sample), serial);
    toast('info', 'محاكاة مسح', 'تمت قراءة وسم محاكى بنجاح.');
  }

  /* ============ الكتابة — حقيقي ============ */
  async function writeAsset(fromForm) {
    const asset = readForm();
    if (!validateAsset(asset, fromForm)) return;

    if (!nfcSupported) {
      simulateWrite(asset);
      return;
    }
    try {
      const writer = new NDEFReader();
      const payload = JSON.stringify(asset);
      toast('info', 'جاهز للكتابة', 'قرّب وسم NFC قابلاً للكتابة…');
      await writer.write({
        records: [{ recordType: 'text', data: payload, lang: 'ar' }],
      });
      onWriteSuccess(asset, false);
    } catch (err) {
      handleNFCError(err, 'الكتابة');
    }
  }

  /* ============ الكتابة — محاكاة ============ */
  function simulateWrite(asset) {
    if (!asset) { asset = readForm(); if (!validateAsset(asset, true)) return; }
    onWriteSuccess(asset, true);
  }

  function onWriteSuccess(asset, simulated) {
    upsertAsset(asset);
    renderAssets();
    lastScanned = asset;
    updateLastScannedLabel();
    addLog('write', (simulated ? 'محاكاة كتابة وسم' : 'كتابة على وسم NFC'), describeAsset(asset));
    toast('ok', simulated ? 'تمت المحاكاة' : 'تمت الكتابة', 'حُفظت بيانات الأصل ' + asset.id + '.');
    $('writeForm').reset();
  }

  /* ============ حفظ في الجدول فقط ============ */
  function saveOnly() {
    const asset = readForm();
    if (!validateAsset(asset, true)) return;
    upsertAsset(asset);
    renderAssets();
    addLog('info', 'حفظ أصل يدوياً', describeAsset(asset));
    toast('ok', 'تم الحفظ', 'حُفظ الأصل في الجدول دون كتابة وسم.');
    $('writeForm').reset();
  }

  /* ============ دخول/خروج العهدة ============ */
  function checkMovement(direction) {
    if (!lastScanned || !lastScanned.id) {
      toast('warn', 'لا يوجد وسم', 'امسح وسم الأصل أولاً قبل تسجيل الحركة.');
      return;
    }
    const idx = assets.findIndex((a) => a.id === lastScanned.id);
    const asset = idx >= 0 ? assets[idx] : stripRaw(lastScanned);

    if (direction === 'out') {
      let holder = asset.holder;
      if (!holder) holder = prompt('اسم الموظف المستلم للعهدة:', '') || 'غير محدد';
      asset.holder = holder;
      asset.status = 'بعهدة موظف';
      addLog('out', 'تسجيل خروج (تسليم عهدة)', describeAsset(asset) + ' · المستلم: ' + holder);
      toast('warn', 'خروج عهدة', 'سُجّل تسليم الأصل ' + asset.id + ' إلى ' + holder + '.');
    } else {
      addLog('in', 'تسجيل دخول (استرجاع عهدة)', describeAsset(asset) + (asset.holder ? ' · من: ' + asset.holder : ''));
      asset.holder = '';
      asset.status = 'متوفّر';
      toast('ok', 'دخول عهدة', 'سُجّل استرجاع الأصل ' + asset.id + '.');
    }

    if (idx >= 0) assets[idx] = asset; else assets.unshift(asset);
    lastScanned = asset;
    persistAssets();
    renderAssets();
    renderScanResult(asset, '');
    updateLastScannedLabel();
  }

  /* ============ معالجة أخطاء NFC ============ */
  function handleNFCError(err, ctx) {
    const name = err && err.name ? err.name : '';
    let msg;
    if (name === 'NotAllowedError') {
      msg = 'رُفض الإذن. فعّل صلاحية NFC في المتصفح وأعد المحاولة (يتطلب إجراءً من المستخدم وموقع HTTPS).';
    } else if (name === 'NotSupportedError') {
      msg = 'الجهاز لا يدعم NFC أو أنه معطّل. فعّل NFC من إعدادات النظام.';
    } else if (name === 'NotReadableError') {
      msg = 'تعذّر الوصول إلى عتاد NFC. قد يكون مشغولاً بتطبيق آخر.';
    } else if (name === 'AbortError') {
      return; // أُلغيت العملية عمداً
    } else {
      msg = 'حدث خطأ أثناء ' + ctx + ': ' + (err && err.message ? err.message : 'غير معروف');
    }
    toast('err', 'فشل ' + ctx, msg);
    addLog('err', 'خطأ في ' + ctx, msg);
  }

  /* ============ عرض نتيجة المسح ============ */
  function renderScanResult(asset, serial) {
    scanResult.classList.remove('empty');
    if (asset.raw && !asset.id) {
      scanResult.innerHTML =
        '<dl class="kv"><dt>محتوى الوسم</dt><dd>' + esc(asset.raw) + '</dd>' +
        (serial ? '<dt>الرقم التسلسلي</dt><dd>' + esc(serial) + '</dd>' : '') + '</dl>';
      return;
    }
    scanResult.innerHTML =
      '<dl class="kv">' +
      kv('رقم الأصل', asset.id) +
      kv('الاسم', asset.name) +
      kv('الموقع', asset.location) +
      '<dt>الحالة</dt><dd>' + statusTag(asset.status) + '</dd>' +
      (asset.holder ? kv('العهدة', asset.holder) : '') +
      (serial ? kv('الرقم التسلسلي', serial) : '') +
      '</dl>';
  }
  function kv(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v || '—') + '</dd>'; }

  /* ============ جدول الأصول ============ */
  function renderAssets() {
    const q = (searchBox.value || '').trim().toLowerCase();
    const filtered = assets.filter((a) => {
      if (!q) return true;
      return [a.id, a.name, a.location, a.status, a.holder]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    assetCount.textContent = assets.length + ' أصل';
    assetTableBody.innerHTML = '';

    if (!filtered.length) {
      emptyAssets.classList.remove('hidden');
      emptyAssets.textContent = assets.length
        ? 'لا نتائج مطابقة للبحث.'
        : 'لا توجد أصول مسجّلة بعد. اكتب وسماً أو احفظ أصلاً لإضافته.';
      return;
    }
    emptyAssets.classList.add('hidden');

    for (const a of filtered) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(a.id) + '</td>' +
        '<td>' + esc(a.name) + '</td>' +
        '<td>' + esc(a.location) + '</td>' +
        '<td>' + statusTag(a.status) + '</td>' +
        '<td>' + esc(a.holder || '—') + '</td>' +
        '<td><button class="row-del" data-id="' + esc(a.id) + '">حذف</button></td>';
      assetTableBody.appendChild(tr);
    }
    assetTableBody.querySelectorAll('.row-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteAsset(btn.getAttribute('data-id')));
    });
  }

  function deleteAsset(id) {
    assets = assets.filter((a) => a.id !== id);
    persistAssets();
    renderAssets();
    addLog('info', 'حذف أصل', 'رقم الأصل: ' + id);
    toast('warn', 'حُذف الأصل', 'أُزيل الأصل ' + id + ' من الجدول.');
  }

  function statusTag(status) {
    const map = {
      'متوفّر': 'st-avail', 'بعهدة موظف': 'st-held', 'تحت الصيانة': 'st-maint',
      'خارج الخدمة': 'st-out', 'مفقود': 'st-lost',
    };
    const cls = map[status] || 'st-out';
    return '<span class="status-tag ' + cls + '">' + esc(status || '—') + '</span>';
  }

  /* ============ سجل العمليات ============ */
  function addLog(type, title, meta) {
    logs.unshift({ type, title, meta, ts: Date.now() });
    if (logs.length > 200) logs = logs.slice(0, 200);
    saveJSON(LS_LOG, logs);
    renderLog();
  }

  function renderLog() {
    logList.innerHTML = '';
    if (!logs.length) {
      logList.innerHTML = '<li class="log-empty">لا توجد عمليات مسجّلة بعد.</li>';
      return;
    }
    const icons = { scan: '⤓', write: '✎', out: '↤', in: '↦', err: '!', info: 'i' };
    const clsmap = { scan: 'lg-scan', write: 'lg-write', out: 'lg-out', in: 'lg-in', err: 'lg-err', info: 'lg-info' };
    for (const l of logs) {
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="log-icon ' + (clsmap[l.type] || 'lg-info') + '">' + (icons[l.type] || 'i') + '</span>' +
        '<div class="log-body"><div class="t">' + esc(l.title) + '</div>' +
        '<div class="meta">' + esc(l.meta || '') + ' · ' + fmtTime(l.ts) + '</div></div>';
      logList.appendChild(li);
    }
  }

  function clearLog() {
    if (!logs.length) return;
    if (!confirm('هل تريد مسح سجل العمليات بالكامل؟')) return;
    logs = [];
    saveJSON(LS_LOG, logs);
    renderLog();
    toast('warn', 'مُسح السجل', 'حُذفت جميع العمليات من السجل.');
  }

  /* ============ أدوات مساعدة ============ */
  function readForm() {
    return normalizeAsset({
      id: $('assetId').value.trim(),
      name: $('assetName').value.trim(),
      location: $('assetLocation').value.trim(),
      status: $('assetStatus').value,
      holder: $('assetHolder').value.trim(),
    });
  }

  function validateAsset(a, fromForm) {
    if (!a.id) { toast('warn', 'بيانات ناقصة', 'أدخل رقم الأصل على الأقل.'); return false; }
    if (fromForm && (!a.name || !a.location)) {
      toast('warn', 'بيانات ناقصة', 'أكمل اسم الأصل والموقع.'); return false;
    }
    return true;
  }

  function upsertAsset(asset) {
    const idx = assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) assets[idx] = Object.assign({}, assets[idx], stripRaw(asset));
    else assets.unshift(stripRaw(asset));
    persistAssets();
  }

  function normalizeAsset(o) {
    return {
      id: String(o.id || '').trim(),
      name: String(o.name || '').trim(),
      location: String(o.location || '').trim(),
      status: String(o.status || 'متوفّر').trim(),
      holder: String(o.holder || '').trim(),
      raw: o.raw,
    };
  }
  function stripRaw(a) { const c = Object.assign({}, a); delete c.raw; return c; }
  function describeAsset(a) { return (a.id || '—') + ' — ' + (a.name || 'بدون اسم'); }

  function updateLastScannedLabel() {
    lastScannedEl.innerHTML = 'آخر وسم مقروء: <strong>' +
      (lastScanned && lastScanned.id ? esc(describeAsset(lastScanned)) : 'لا يوجد') + '</strong>';
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ assets, logs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nfc-assets-export.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('ok', 'تم التصدير', 'نُزّل ملف JSON بالأصول والسجل.');
  }

  function persistAssets() { saveJSON(LS_ASSETS, assets); }

  function loadJSON(k, fb) { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    try {
      return d.toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  /* ============ التنبيهات ============ */
  function toast(kind, title, body) {
    const zone = $('toastZone');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : kind === 'ok' ? 'ok' : '');
    el.innerHTML = '<div class="th">' + esc(title) + '</div><div class="tb">' + esc(body) + '</div>';
    zone.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 3600);
    setTimeout(() => el.remove(), 4000);
  }

  /* ============ ربط الأحداث ============ */
  function bind() {
    $('btnScan').addEventListener('click', startScan);
    $('btnSimScan').addEventListener('click', simulateScan);
    $('writeForm').addEventListener('submit', (e) => { e.preventDefault(); writeAsset(true); });
    $('btnSimWrite').addEventListener('click', () => simulateWrite());
    $('btnSaveOnly').addEventListener('click', saveOnly);
    $('btnCheckOut').addEventListener('click', () => checkMovement('out'));
    $('btnCheckIn').addEventListener('click', () => checkMovement('in'));
    $('btnClearLog').addEventListener('click', clearLog);
    $('btnExport').addEventListener('click', exportJSON);
    searchBox.addEventListener('input', renderAssets);
  }

  /* ============ تهيئة ============ */
  function init() {
    detectNFC();
    bind();
    renderAssets();
    renderLog();
    updateLastScannedLabel();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
