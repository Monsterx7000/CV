/* ═══ السيرة الذاتية ومعرض الأعمال — منطق العرض ثنائي اللغة ═══
   مصادر البيانات (كلاهما داخل data.js المولّد):
     window.CV_DATA     ← cv-data.json   (يدوي: الخبرة، التعليم، الشهادات…)
     window.SKILLS_AUTO ← skills-auto.json (آلي: مهارات مستخرجة من كل المشاريع)
   أعد التوليد بعد أي مشروع جديد:  python scan-skills.py
*/
(() => {
  "use strict";

  // ── الترجمات الثابتة للواجهة ──────────────────────────────────────────────
  const T = {
    ar: {
      docTitle: "السيرة الذاتية ومعرض الأعمال — عبدالله الذهلي",
      brandTitle: "السيرة الذاتية ومعرض الأعمال",
      printCv: "⬇ حفظ PDF",
      experience: "الخبرة العملية",
      autoSkills: "المهارات التقنية",
      myWork: "أعمالي",
      featured: "أعمالي",
      mSelected: "مختارة",
      mIndex: "فهرس المكتبة",
      mFull: "المكتبة كاملة",
      featuredHint: "نماذج تمثّل مجالات العمل المختلفة.",
      indexHint: n => `فهرس بكل المشاريع (${n}) — الاسم والقسم والتقنيات.`,
      fullHint: n => `كل المشاريع (${n}) — اضغط أي مشروع لفتحه.`,
      searchPh: "ابحث بالاسم أو التقنية…",
      more: "عرض المزيد",
      noMatch: "لا نتائج مطابقة.",
      portfolio: "المعرض الكامل",
      portfolioHint: "أقسام المعرض — اضغط أي قسم لفتح فهرسه الكامل.",
      capabilities: "القدرات والتخصصات",
      education: "المؤهلات العلمية",
      certifications: "الشهادات المهنية",
      awards: "التكريم والتقدير",
      statProjects: "مشروع منجز",
      statSections: "مجال تقني",
      statSkills: "مهارة مرصودة",
      statYears: "سنوات خبرة",
      skillsHint: n => `مستخرجة آلياً من ${n} مشروع في هذا المعرض — يُعاد حسابها مع كل مشروع جديد.`,
      projectsWord: n => `${n} مشروع`,
      usedIn: n => `${n} مشروع`,
      foot: d => `آخر تحديث للمهارات: ${d} • البيانات مولّدة آلياً من مجلدات المشاريع`,
      themeLight: "☀️", themeDark: "🌙", altLang: "EN"
    },
    en: {
      docTitle: "CV & Portfolio — Abdullah Al-Dhahli",
      brandTitle: "CV & Portfolio",
      printCv: "⬇ Save PDF",
      experience: "Professional Experience",
      autoSkills: "Technical Skills",
      myWork: "My Work",
      featured: "My Work",
      mSelected: "Selected",
      mIndex: "Library Index",
      mFull: "Full Library",
      featuredHint: "Samples representing different domains of work.",
      indexHint: n => `Index of all projects (${n}) — name, section, and tech.`,
      fullHint: n => `All projects (${n}) — click any to open.`,
      searchPh: "Search by name or tech…",
      more: "Show more",
      noMatch: "No matching results.",
      portfolio: "Full Portfolio",
      portfolioHint: "Portfolio sections — click any section to open its full index.",
      capabilities: "Capabilities & Domains",
      education: "Education",
      certifications: "Professional Certifications",
      awards: "Awards & Recognition",
      statProjects: "Projects Built",
      statSections: "Technical Domains",
      statSkills: "Tracked Skills",
      statYears: "Years Experience",
      skillsHint: n => `Extracted automatically from ${n} projects in this portfolio — recalculated with every new project.`,
      projectsWord: n => `${n} projects`,
      usedIn: n => `${n} projects`,
      foot: d => `Skills last updated: ${d} • Generated automatically from project folders`,
      themeLight: "☀️", themeDark: "🌙", altLang: "ع"
    }
  };

  const EXPERIENCE_SINCE = 2019;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let lang = localStorage.getItem("cv-lang") || "ar";
  const CV = window.CV_DATA, AUTO = window.SKILLS_AUTO;

  // ترجمة حقل ثنائي اللغة {ar,en} مع تراجع للغة الأخرى إن كان فارغاً
  const t = o => (typeof o === "string") ? o
    : (o && (o[lang] || o[lang === "ar" ? "en" : "ar"])) || "";

  // ── الرسم ────────────────────────────────────────────────────────────────
  function render() {
    const L = T[lang];
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    html.dataset.lang = lang;
    document.title = L.docTitle;
    $("#langLabel").textContent = L.altLang;
    document.querySelectorAll("[data-i18n]").forEach(n => {
      const v = L[n.dataset.i18n];
      if (typeof v === "string") n.textContent = v;
    });

    renderHero(L);
    renderExperience();
    renderSkills(L);
    renderWork(L);
    renderManual();
    renderEducation();
    renderList("#certList", CV.certifications);
    renderList("#awardList", CV.awards);
    renderTabs(L);

    $("#footNote").textContent = L.foot(new Date().toLocaleDateString(
      lang === "ar" ? "ar-OM" : "en-GB", { year: "numeric", month: "long", day: "numeric" }));

    requestAnimationFrame(() => document.querySelectorAll(".bar i")
      .forEach(b => { b.style.width = b.dataset.w + "%"; }));
  }

  function renderHero(L) {
    const p = CV.profile;
    $("#pName").textContent = t(p.name);
    $("#pTitle").textContent = t(p.title);
    $("#pSummary").textContent = t(p.summary);

    const c = p.contact;
    $("#pContact").innerHTML =
      `<li>📧 <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` +
      `<li>📱 <a href="tel:${esc(c.phone).replace(/\s/g, "")}" dir="ltr">${esc(c.phone)}</a></li>` +
      `<li>📍 ${esc(t(c.location))}</li>`;

    const years = new Date().getFullYear() - EXPERIENCE_SINCE;
    const tot = AUTO.totals;
    $("#heroStats").innerHTML = [
      [tot.projects, L.statProjects], [years + "+", L.statYears],
      [tot.skills, L.statSkills], [tot.sections, L.statSections]
    ].map(([n, lbl]) => `<div class="stat"><b>${n}</b><span>${esc(lbl)}</span></div>`).join("");
  }

  function renderExperience() {
    const box = $("#expList");
    box.innerHTML = "";
    (CV.experience || []).forEach(x => {
      const it = el("div", "tl-item" + (x.current ? " current" : ""));
      it.innerHTML =
        `<div class="tl-head"><span class="tl-role">${esc(t(x.role))}</span>` +
        `<span class="tl-period">${esc(t(x.period))}</span></div>` +
        `<div class="tl-org">${esc(t(x.org))}</div>` +
        `<ul class="bullets">${(x.points || []).map(p => `<li>${esc(t(p))}</li>`).join("")}</ul>`;
      box.appendChild(it);
    });
  }

  function renderSkills(L) {
    // المهارات مستمدّة من المشاريع المؤلَّفة فقط، لا من كل ما يعرضه المعرض
    $("#skillsHint").textContent =
      L.skillsHint(AUTO.totals.skill_sourced ?? AUTO.totals.projects);
    const box = $("#skillCats");
    box.innerHTML = "";
    (AUTO.categories || []).forEach(cat => {
      const list = (AUTO.skills || []).filter(s => s.cat === cat.key);
      if (!list.length) return;
      const g = el("div", "skillcat", `<h3>${esc(t(cat))}</h3>`);
      list.forEach(s => {
        g.appendChild(el("div", "skill",
          `<div class="skill-top"><b>${esc(t(s))}</b>` +
          `<span class="skill-n">${esc(L.usedIn(s.count))}</span></div>` +
          `<div class="bar"><i data-w="${s.level}"></i></div>`));
      });
      box.appendChild(g);
    });
  }

  // ── «أعمالي»: ثلاثة أوضاع — مختارة / فهرس المكتبة / المكتبة كاملة ──
  const PAGE = 60;                 // بطاقات تُعرض دفعةً في وضعَي المكتبة
  let workMode = "selected";       // selected | index | full
  let shown = PAGE;

  function catalogAvailable() { return (AUTO.catalog || []).length > 0; }

  function renderWork(L) {
    // أزرار التبديل — تظهر فقط عند توفّر الفهرس
    const modesBox = $("#libModes");
    const modes = [["selected", L.mSelected]];
    if (catalogAvailable()) modes.push(["index", L.mIndex], ["full", L.mFull]);
    modesBox.hidden = modes.length < 2;
    modesBox.innerHTML = modes.map(([m, lbl]) =>
      `<button data-mode="${m}" class="${m === workMode ? "on" : ""}">${esc(lbl)}</button>`).join("");

    const search = $("#libSearch");
    const isLib = workMode !== "selected";
    search.hidden = !isLib;
    search.placeholder = L.searchPh;

    // شبكة الأقسام: فقط في وضع «مختارة» وعلى النسخة المحلية (فهارسها غير منشورة)
    const secGrid = $("#secGrid");
    if (!isLib && !window.CV_EXPORT && (AUTO.sections || []).length) {
      secGrid.hidden = false;
      secGrid.innerHTML = AUTO.sections.map(s =>
        `<a class="seccard" style="--sc:${esc(s.color)}" href="../../${encodeURI(s.folder)}/index.html">` +
        `<div class="ic">${esc(s.icon || "📁")}</div>` +
        `<div class="nm">${esc(s.title || s.folder)}</div>` +
        `<div class="ct">${esc(L.projectsWord(s.count))}</div></a>`).join("");
    } else {
      secGrid.hidden = true;
    }

    if (workMode === "selected") {
      $("#libHint").textContent = L.featuredHint;
      $("#libMore").hidden = true;
      return renderCards(AUTO.featured || [], L, "selected");
    }

    // فلترة بالبحث ثم عرض تدريجي
    const q = search.value.trim().toLowerCase();
    const all = (AUTO.catalog || []).filter(c => {
      if (!q) return true;
      const hay = (t(c.name) + " " + (c.techs || []).map(x => x.ar + x.en).join(" ")).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    $("#libHint").textContent = (workMode === "index" ? L.indexHint : L.fullHint)(all.length);
    renderCards(all.slice(0, shown), L, workMode);

    const more = $("#libMore");
    if (all.length > shown) {
      more.hidden = false;
      more.innerHTML = `<button>${esc(L.more)} (${all.length - shown})</button>`;
    } else {
      more.hidden = true;
    }
    if (!all.length) $("#libGrid").innerHTML = `<p class="hint">${esc(L.noMatch)}</p>`;
  }

  function renderCards(list, L, mode) {
    const box = $("#libGrid");
    const compact = mode !== "selected" ? " compact" : "";
    // في «الفهرس» البطاقات غير قابلة للنقر (أسماء فقط)؛ في «مختارة»/«كامل» تفتح المشروع
    const linked = mode !== "index";
    box.innerHTML = list.map(p => {
      const s = p.section || {};
      const media = p.thumb
        ? `<img class="fthumb" src="${esc(p.thumb)}" alt="" loading="lazy">`
        : `<div class="fthumb ph">${esc(s.icon || "📁")}</div>`;
      const chips = (p.techs || []).map(x =>
        `<span class="fchip">${esc(x[lang] || x.ar)}</span>`).join("");
      const note = p.note ? `<p class="fnote">${esc(t(p.note))}</p>` : "";
      const body = `${media}<div class="fbody">` +
        `<div class="fsec">${esc(s.icon || "")} ${esc(s.title || "")}</div>` +
        `<div class="fname">${esc(t(p.name))}</div>${note}` +
        `<div class="fchips">${chips}</div></div>`;
      const cls = `fcard${compact}${linked ? "" : " plain"}`;
      return linked
        ? `<a class="${cls}" style="--sc:${esc(s.color || "#1f6fd4")}" href="${esc(p.link)}">${body}</a>`
        : `<div class="${cls}" style="--sc:${esc(s.color || "#1f6fd4")}">${body}</div>`;
    }).join("");
  }

  function renderManual() {
    $("#manualSkills").innerHTML = (CV.manual_skills || []).map(g =>
      `<dt>${esc(t(g.group))}</dt><dd>${esc(t(g.items))}</dd>`).join("");
  }

  function renderEducation() {
    $("#eduList").innerHTML = (CV.education || []).map(e => {
      const meta = t(e.period), note = t(e.note);
      return `<div class="edu"><b>${esc(t(e.degree))}</b>` +
        `<div class="org">${esc(t(e.org))}</div>` +
        (meta ? `<div class="meta">${esc(meta)}</div>` : "") +
        (note ? `<div class="meta">${esc(note)}</div>` : "") + `</div>`;
    }).join("");
  }

  function renderList(sel, arr) {
    $(sel).innerHTML = (arr || []).map(x => `<li>${esc(t(x))}</li>`).join("");
  }

  function renderTabs(L) {
    $("#tabs").innerHTML = [
      ["sec-experience", L.experience], ["sec-skills", L.autoSkills],
      ["sec-featured", L.myWork], ["sec-manual", L.capabilities],
      ["sec-education", L.education], ["sec-certs", L.certifications]
    ].map(([id, lbl]) => `<a href="#${id}">${esc(lbl)}</a>`).join("");
  }

  // ── الأزرار ──────────────────────────────────────────────────────────────
  function setTheme(mode) {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("cv-theme", mode);
    $("#themeBtn").textContent = mode === "dark" ? T[lang].themeLight : T[lang].themeDark;
  }

  function init() {
    if (!CV || !AUTO) {
      $("#loader").textContent =
        "لم يُعثر على data.js — شغّل:  python scan-skills.py";
      return;
    }
    setTheme(localStorage.getItem("cv-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

    $("#langBtn").addEventListener("click", () => {
      lang = lang === "ar" ? "en" : "ar";
      localStorage.setItem("cv-lang", lang);
      render();
      setTheme(document.documentElement.dataset.theme);
    });
    $("#themeBtn").addEventListener("click", () =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    $("#printBtn").addEventListener("click", () => window.print());

    // تبديل أوضاع «أعمالي»
    $("#libModes").addEventListener("click", e => {
      const b = e.target.closest("button[data-mode]");
      if (!b || b.dataset.mode === workMode) return;
      workMode = b.dataset.mode;
      shown = PAGE;
      $("#libSearch").value = "";
      renderWork(T[lang]);
    });
    // البحث في وضعَي المكتبة (بتأخير بسيط)
    let deb;
    $("#libSearch").addEventListener("input", () => {
      clearTimeout(deb);
      deb = setTimeout(() => { shown = PAGE; renderWork(T[lang]); }, 160);
    });
    // «عرض المزيد»
    $("#libMore").addEventListener("click", e => {
      if (!e.target.closest("button")) return;
      shown += PAGE;
      renderWork(T[lang]);
    });

    render();
    $("#loader").classList.add("hidden");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
