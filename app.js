/* =========================================================
   BH Video — Home page logic
   - Renders the hero, category chips and the video grid.
   - Clicking a thumbnail opens player.html?id=<videoId>
     in a NEW TAB/WINDOW (per user requirement).
   - All user-facing strings go through window.I18N.
   ========================================================= */

(function () {
  "use strict";

  const videos = window.VIDEOS || [];
  const heroEl = document.getElementById("hero");
  const categoryBar = document.getElementById("categoryBar");
  const grid = document.getElementById("videoGrid");
  const gridTitle = document.getElementById("gridTitle");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  // Real play counts fetched from the backend (server.py + views.json).
  // Shape: { "<videoId>": { opens, plays, ends } }. Empty until /api/stats
  // resolves — the grid renders immediately with the static fallback in
  // videos.js and is re-rendered as soon as the real numbers arrive.
  let playStats = {};

  const i18n = window.I18N || {
    t: (k) => k,
    pickLocalized: (v, f) => (v ? v[f] : ""),
    localizeCategory: (c) => c,
    onChange: () => () => {},
  };
  const t = (k, p) => i18n.t(k, p);

  /**
   * Fetch real play counts from the backend. Falls back to the static
   * `views` field embedded in videos.js if the API is unreachable (e.g. the
   * page is opened directly via file:// without server.py).
   */
  function fetchPlayStats() {
    return fetch("/api/stats", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        playStats = data && typeof data === "object" ? data : {};
      })
      .catch(() => {
        playStats = {};
      });
  }

  /** Format a play count for display on a card (e.g. 1.2M, 12.3K, 999). */
  function formatCount(n) {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
  }

  /**
   * Returns the string that should appear on a video card next to the views
   * suffix. If the backend reported a "plays" count for this video we show
   * that real number; otherwise we keep the static fallback in videos.js.
   */
  function viewsLabel(video) {
    const entry = playStats && playStats[video.id];
    if (entry && typeof entry.plays === "number" && entry.plays > 0) {
      return formatCount(entry.plays);
    }
    return video.views;
  }

  /** Open the player page in a new tab. */
  function openPlayer(id) {
    const url = `player.html?id=${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener");
  }

  /** Build the hero / featured banner using the first video. */
  function renderHero() {
    if (!videos.length) return;
    const featured = videos[0];
    const title = i18n.pickLocalized(featured, "title");
    const desc = i18n.pickLocalized(featured, "description");

    heroEl.innerHTML = `
      <div class="hero-bg" style="background-image:url('${featured.thumbnail}')"></div>
      <div class="hero-content">
        <span class="hero-badge">${escapeHtml(t("home.featured"))}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(desc)}</p>
        <button class="play-now" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M8 5v14l11-7z"></path>
          </svg>
          ${escapeHtml(t("home.playNow"))}
        </button>
      </div>
    `;

    heroEl.onclick = () => openPlayer(featured.id);
  }

  /** Build category chips from the unique set of categories. */
  function renderCategories() {
    const set = new Set(videos.map((v) => v.category).filter(Boolean));
    // Preserve previous selection across language changes / re-renders.
    const previouslyActive =
      (categoryBar.querySelector(".chip.active") || {}).dataset?.category ||
      "All";
    const categories = ["All", ...Array.from(set)];

    categoryBar.innerHTML = categories
      .map(
        (c) =>
          `<button class="chip ${c === previouslyActive ? "active" : ""}" data-category="${escapeAttr(
            c
          )}">${escapeHtml(i18n.localizeCategory(c))}</button>`
      )
      .join("");
  }

  function bindCategoryEvents() {
    categoryBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      [...categoryBar.querySelectorAll(".chip")].forEach((c) =>
        c.classList.remove("active")
      );
      btn.classList.add("active");
      applyFilters();
    });
  }

  /** Render the grid of video cards based on the supplied list. */
  function renderGrid(list) {
    if (!list.length) {
      grid.innerHTML = "";
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    grid.innerHTML = list
      .map((v) => {
        const title = i18n.pickLocalized(v, "title");
        const author = i18n.pickLocalized(v, "author") || v.author;
        const views = viewsLabel(v);
        return `
        <article class="video-card" data-id="${escapeAttr(v.id)}" tabindex="0" role="button"
                 aria-label="${escapeAttr(t("card.playAria", { title }))}">
          <div class="thumb">
            <img src="${escapeAttr(v.thumbnail)}" alt="${escapeAttr(title)}"
                 loading="lazy"
                 onerror="this.style.background='linear-gradient(135deg,#2a2a36,#16161c)';this.removeAttribute('src');" />
            <span class="duration">${escapeHtml(v.duration)}</span>
            <div class="play-overlay"></div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(title)}</h3>
            <div class="card-meta">${escapeHtml(author)} • ${escapeHtml(views)} ${escapeHtml(t("card.viewsSuffix"))}</div>
          </div>
        </article>
      `;
      })
      .join("");
  }

  /** Apply both the category filter and the search filter. */
  function applyFilters() {
    const activeChip = categoryBar.querySelector(".chip.active");
    const category = activeChip ? activeChip.dataset.category : "All";
    const term = (searchInput.value || "").trim().toLowerCase();

    let list = videos.slice();
    if (category && category !== "All") {
      list = list.filter((v) => v.category === category);
    }
    if (term) {
      list = list.filter((v) => {
        const title = i18n.pickLocalized(v, "title") || "";
        const desc = i18n.pickLocalized(v, "description") || "";
        const author = i18n.pickLocalized(v, "author") || v.author || "";
        return (
          title.toLowerCase().includes(term) ||
          author.toLowerCase().includes(term) ||
          desc.toLowerCase().includes(term) ||
          (v.category || "").toLowerCase().includes(term) ||
          i18n.localizeCategory(v.category || "").toLowerCase().includes(term)
        );
      });
    }

    if (term && category === "All") {
      gridTitle.textContent = t("home.results", { term });
    } else if (category === "All") {
      gridTitle.textContent = t("home.allVideos");
    } else {
      gridTitle.textContent = i18n.localizeCategory(category);
    }

    renderGrid(list);
  }

  /** Click delegation for the grid → open player in a new tab. */
  function bindGridEvents() {
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".video-card");
      if (!card) return;
      openPlayer(card.dataset.id);
    });

    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".video-card");
      if (!card) return;
      e.preventDefault();
      openPlayer(card.dataset.id);
    });
  }

  function bindSearch() {
    let timer;
    searchInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(applyFilters, 150);
    });
    searchBtn.addEventListener("click", applyFilters);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters();
    });
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  /** Re-render every dynamic block when the language changes. */
  function refreshAll() {
    renderHero();
    renderCategories();
    applyFilters();
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderHero();
    renderCategories();
    bindCategoryEvents();
    renderGrid(videos);
    bindGridEvents();
    bindSearch();

    // Pull real play counts from the backend, then re-render the grid so
    // each card shows its true "plays" number. Re-fetch when the page
    // becomes visible again so counts stay roughly fresh after the user
    // came back from a player tab.
    fetchPlayStats().then(() => applyFilters());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        fetchPlayStats().then(() => applyFilters());
      }
    });

    if (window.I18N && typeof window.I18N.onChange === "function") {
      window.I18N.onChange(refreshAll);
    }
  });
})();
