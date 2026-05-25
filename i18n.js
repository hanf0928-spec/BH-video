/* =========================================================
   BH Video — Lightweight i18n runtime
   ---------------------------------------------------------
   - Two locales: "id" (Bahasa Indonesia, DEFAULT) and "en".
   - The chosen locale is persisted in localStorage.
   - Static text is translated via [data-i18n="key"] / [data-i18n-attr="placeholder:key"].
   - Dynamic text is translated via window.I18N.t("key", {param}).
   - Re-render hooks can subscribe via window.I18N.onChange(fn).
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "bhvideo.lang";
  const DEFAULT_LANG = "id";
  const SUPPORTED = ["id", "en"];

  /* ---------- Dictionaries ---------- */
  const DICT = {
    id: {
      // Brand / generic
      "site.tagline": "Tonton di Mana Saja",
      "site.title.home": "BH Video — Tonton di Mana Saja",
      "site.title.player": "Pemutar — BH Video",

      // Header
      "header.search.placeholder": "Cari video, kreator, kategori…",
      "header.search.aria": "Cari",
      "nav.home": "Beranda",
      "nav.trending": "Trending",
      "nav.library": "Pustaka",
      "nav.back": "Kembali ke Beranda",

      // Language switcher
      "lang.label": "Bahasa",
      "lang.id": "ID",
      "lang.en": "EN",
      "lang.id.full": "Bahasa Indonesia",
      "lang.en.full": "English",

      // Home page
      "home.browse": "Jelajahi",
      "home.allVideos": "Semua Video",
      "home.empty": "Tidak ada video yang cocok dengan pencarian Anda. Coba kata kunci lain.",
      "home.results": 'Hasil untuk "{term}"',
      "home.featured": "Unggulan",
      "home.playNow": "Putar sekarang",

      // Categories (canonical keys = English)
      "category.All": "Semua",
      "category.Animation": "Animasi",
      "category.Fantasy": "Fantasi",
      "category.Demo": "Demo",

      // Card / meta
      "card.viewsSuffix": "x ditonton",
      "card.playAria": "Putar {title}",

      // Player page
      "player.loading": "Memuat…",
      "player.notFound.title": "Video tidak ditemukan",
      "player.notFound.desc":
        "Kami tidak dapat menemukan video yang Anda cari. Silakan kembali ke beranda dan pilih video lain.",
      "player.creator": "Kreator",
      "player.like": "Suka",
      "player.share": "Bagikan",
      "player.upNext": "Selanjutnya",
      "player.unsupported": "Browser Anda tidak mendukung tag video.",

      // Toast / share
      "toast.likeAdded": "Ditambahkan ke daftar suka",
      "toast.likeRemoved": "Dihapus dari daftar suka",
      "toast.linkCopied": "Tautan disalin ke clipboard",

      // Playback errors
      "error.title": "Kesalahan pemutaran",
      "error.code.1": "Pemutaran dibatalkan.",
      "error.code.2": "Terjadi kesalahan jaringan saat mengambil video.",
      "error.code.3": "Video rusak atau menggunakan codec yang tidak didukung.",
      "error.code.4": "Sumber video tidak dapat diakses atau tidak didukung oleh browser Anda.",
      "error.generic": "Video gagal dimuat. Silakan coba video lain.",

      // Footer
      "footer.home": "© 2025 BH Video — Platform demo video sesuai permintaan. Semua video sampel milik pemiliknya masing-masing.",
      "footer.player": "© 2025 BH Video — Platform demo video sesuai permintaan.",
    },
    en: {
      "site.tagline": "Watch Anywhere",
      "site.title.home": "BH Video — Watch Anywhere",
      "site.title.player": "Player — BH Video",

      "header.search.placeholder": "Search videos, creators, categories…",
      "header.search.aria": "Search",
      "nav.home": "Home",
      "nav.trending": "Trending",
      "nav.library": "Library",
      "nav.back": "Back to Home",

      "lang.label": "Language",
      "lang.id": "ID",
      "lang.en": "EN",
      "lang.id.full": "Bahasa Indonesia",
      "lang.en.full": "English",

      "home.browse": "Browse",
      "home.allVideos": "All Videos",
      "home.empty": "No videos match your search. Try a different keyword.",
      "home.results": 'Results for "{term}"',
      "home.featured": "Featured",
      "home.playNow": "Play now",

      "category.All": "All",
      "category.Animation": "Animation",
      "category.Fantasy": "Fantasy",
      "category.Demo": "Demo",

      "card.viewsSuffix": "views",
      "card.playAria": "Play {title}",

      "player.loading": "Loading…",
      "player.notFound.title": "Video not found",
      "player.notFound.desc":
        "We couldn't find the video you're looking for. Please return to the home page and pick another one.",
      "player.creator": "Creator",
      "player.like": "Like",
      "player.share": "Share",
      "player.upNext": "Up Next",
      "player.unsupported": "Your browser does not support the video tag.",

      "toast.likeAdded": "Added to your likes",
      "toast.likeRemoved": "Removed from your likes",
      "toast.linkCopied": "Link copied to clipboard",

      "error.title": "Playback error",
      "error.code.1": "Playback was aborted.",
      "error.code.2": "A network error occurred while fetching the video.",
      "error.code.3": "The video is corrupt or uses an unsupported codec.",
      "error.code.4": "The video source is not reachable or not supported by your browser.",
      "error.generic": "The video failed to load. Please try another one.",

      "footer.home":
        "© 2025 BH Video — A demo video-on-demand platform. All sample videos courtesy of their respective owners.",
      "footer.player": "© 2025 BH Video — A demo video-on-demand platform.",
    },
  };

  /* ---------- State ---------- */
  let current = readStoredLang();
  const listeners = new Set();

  function readStoredLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {
      /* ignore */
    }
    return DEFAULT_LANG;
  }

  function persist(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {
      /* ignore */
    }
  }

  /* ---------- Translation ---------- */
  function t(key, params) {
    const dict = DICT[current] || DICT[DEFAULT_LANG];
    let s = dict[key];
    if (s == null) s = (DICT.en && DICT.en[key]) || key;
    if (params && typeof s === "string") {
      s = s.replace(/\{(\w+)\}/g, (_, k) =>
        params[k] == null ? "" : String(params[k])
      );
    }
    return s;
  }

  /* ---------- DOM application ---------- */
  function applyI18n(root) {
    const scope = root || document;

    // Text content via [data-i18n]
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });

    // Attributes via [data-i18n-attr="placeholder:key;aria-label:key"]
    scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const spec = el.getAttribute("data-i18n-attr") || "";
      spec.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => (s || "").trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    // <title data-i18n-title="key">
    const titleEl = document.querySelector("title[data-i18n-title]");
    if (titleEl) {
      const key = titleEl.getAttribute("data-i18n-title");
      if (key) titleEl.textContent = t(key);
    }

    // <html lang="…">
    document.documentElement.setAttribute("lang", current);
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === current) return;
    current = lang;
    persist(lang);
    applyI18n();
    syncSwitcher();
    listeners.forEach((fn) => {
      try {
        fn(current);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[i18n] listener failed", e);
      }
    });
  }

  function getLang() {
    return current;
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ---------- Language switcher ---------- */
  function renderSwitcher() {
    const host = document.querySelector("[data-lang-switcher]");
    if (!host) return;
    host.innerHTML = `
      <div class="lang-switcher" role="group" aria-label="${escapeAttr(t("lang.label"))}">
        <button type="button" class="lang-btn" data-lang="id"
                aria-label="${escapeAttr(t("lang.id.full"))}">ID</button>
        <button type="button" class="lang-btn" data-lang="en"
                aria-label="${escapeAttr(t("lang.en.full"))}">EN</button>
      </div>
    `;
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-lang]");
      if (!btn) return;
      setLang(btn.getAttribute("data-lang"));
    });
    syncSwitcher();
  }

  function syncSwitcher() {
    document.querySelectorAll(".lang-switcher .lang-btn").forEach((btn) => {
      const isActive = btn.getAttribute("data-lang") === current;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- Helpers exposed to other scripts ---------- */
  /** Pick a localised field from a video object, with English fallback. */
  function pickLocalized(video, field) {
    if (!video) return "";
    const i18n = video.i18n || {};
    const langBlock = i18n[current];
    if (langBlock && langBlock[field] != null) return langBlock[field];
    const enBlock = i18n.en;
    if (enBlock && enBlock[field] != null) return enBlock[field];
    return video[field] != null ? video[field] : "";
  }

  /** Localise a category key (canonical English) for display. */
  function localizeCategory(cat) {
    if (!cat) return "";
    const key = "category." + cat;
    const dict = DICT[current] || {};
    if (dict[key]) return dict[key];
    return cat;
  }

  /* ---------- Boot ---------- */
  function boot() {
    renderSwitcher();
    applyI18n();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.I18N = {
    t,
    setLang,
    getLang,
    onChange,
    applyI18n,
    pickLocalized,
    localizeCategory,
    SUPPORTED,
    DEFAULT_LANG,
  };
})();
