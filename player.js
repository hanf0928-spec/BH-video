/* =========================================================
   BH Video — Player page logic
   - Reads ?id=<videoId> from the URL.
   - Loads the matching video into the <video> element.
   - Renders an "Up Next" sidebar of other videos.
   - All user-facing strings go through window.I18N.
   ========================================================= */

(function () {
  "use strict";

  const videos = window.VIDEOS || [];

  const videoEl = document.getElementById("videoPlayer");
  const titleEl = document.getElementById("videoTitle");
  const viewsEl = document.getElementById("videoViews");
  const categoryEl = document.getElementById("videoCategory");
  const authorEl = document.getElementById("videoAuthor");
  const descEl = document.getElementById("videoDescription");
  const avatarEl = document.getElementById("creatorAvatar");
  const upNextList = document.getElementById("upNextList");
  const likeBtn = document.getElementById("likeBtn");
  const shareBtn = document.getElementById("shareBtn");

  const i18n = window.I18N || {
    t: (k) => k,
    pickLocalized: (v, f) => (v ? v[f] : ""),
    localizeCategory: (c) => c,
    onChange: () => () => {},
  };
  const t = (k, p) => i18n.t(k, p);

  // Latest play counts fetched from /api/stats. Shape:
  //   { "<videoId>": { opens, plays, ends } }
  // Used to render the real "plays" number on the player page.
  let playStats = {};

  /** Format a play count (e.g. 1.2M, 12.3K, 999). */
  function formatCount(n) {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
  }

  /** Pick the label to show next to the views suffix for a given video. */
  function viewsLabel(video) {
    if (!video) return "";
    const entry = playStats && playStats[video.id];
    if (entry && typeof entry.plays === "number" && entry.plays > 0) {
      return formatCount(entry.plays);
    }
    return video.views;
  }

  /** Refresh the views line of the currently displayed video. */
  function refreshViewsLine() {
    const id = (videoEl && videoEl.dataset.currentId) || getRequestedId();
    const v = pickVideo(id);
    if (!v || !viewsEl) return;
    viewsEl.textContent = `${viewsLabel(v)} ${t("card.viewsSuffix")}`;
  }

  /** Pull the latest stats from the backend, then update the views line. */
  function fetchPlayStats() {
    return fetch("/api/stats", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        playStats = data && typeof data === "object" ? data : {};
        refreshViewsLine();
      })
      .catch(() => {
        /* offline / no backend — keep static fallback */
      });
  }

  /**
   * Fire-and-forget play-count reporter.
   * Sends { id, event } to /api/stats on the static server (server.py).
   * On success, applies the returned counters locally and refreshes the
   * views line so the page reflects the new value immediately.
   * Failures are silenced so a missing backend never breaks playback.
   */
  function reportStat(id, event) {
    if (!id || !event) return;
    try {
      fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, event }),
        keepalive: true,
      })
        .then((r) => (r && r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.ok && data.stats) {
            playStats[id] = data.stats;
            refreshViewsLine();
          }
        })
        .catch(() => {
          /* offline / no backend — ignore */
        });
    } catch (_) {
      /* fetch unavailable — ignore */
    }
  }

  // Track which video already reported the 'play' event so we count at most
  // once per navigation (a single video may pause/resume many times).
  let playReportedFor = null;

  /** Read the requested video id from the URL query string. */
  function getRequestedId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  /** Locate a video by id, falling back to the first one if missing. */
  function pickVideo(id) {
    return videos.find((v) => v.id === id) || videos[0];
  }

  /** Render the main video and its metadata. */
  function loadVideo(video) {
    if (!video) {
      titleEl.textContent = t("player.notFound.title");
      descEl.textContent = t("player.notFound.desc");
      viewsEl.textContent = "";
      categoryEl.textContent = "";
      authorEl.textContent = "";
      return;
    }

    const localTitle = i18n.pickLocalized(video, "title");
    const localDesc = i18n.pickLocalized(video, "description");
    const localAuthor = i18n.pickLocalized(video, "author") || video.author;

    document.title = `${localTitle} — BH Video`;

    // Reset any previous error overlay.
    hidePlaybackError();

    // Only reset src/poster when actually switching videos to avoid
    // restarting playback on a simple language change.
    if (videoEl.dataset.currentId !== video.id) {
      videoEl.src = video.src;
      videoEl.poster = video.thumbnail;
      videoEl.dataset.currentId = video.id;
      // New video → reset the per-navigation "play already reported" guard.
      playReportedFor = null;
      videoEl.load();
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          /* Autoplay may be blocked — user can press play manually. */
        });
      }
    }

    titleEl.textContent = localTitle;
    viewsEl.textContent = `${viewsLabel(video)} ${t("card.viewsSuffix")}`;
    categoryEl.textContent = i18n.localizeCategory(video.category || "");
    authorEl.textContent = localAuthor;
    descEl.textContent = localDesc;

    avatarEl.textContent = (localAuthor || "?")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  /** Render the Up Next sidebar with all OTHER videos. */
  function renderUpNext(currentId) {
    const others = videos.filter((v) => v.id !== currentId);
    upNextList.innerHTML = others
      .map((v) => {
        const title = i18n.pickLocalized(v, "title");
        const author = i18n.pickLocalized(v, "author") || v.author;
        return `
        <div class="up-next-item" data-id="${escapeAttr(v.id)}" role="button" tabindex="0"
             aria-label="${escapeAttr(t("card.playAria", { title }))}">
          <div class="thumb">
            <img src="${escapeAttr(v.thumbnail)}" alt="${escapeAttr(title)}" loading="lazy" />
            <span class="duration">${escapeHtml(v.duration)}</span>
          </div>
          <div>
            <h3 class="un-title">${escapeHtml(title)}</h3>
            <div class="un-meta">${escapeHtml(author)} • ${escapeHtml(v.views)} ${escapeHtml(t("card.viewsSuffix"))}</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function bindUpNextEvents() {
    upNextList.addEventListener("click", (e) => {
      const item = e.target.closest(".up-next-item");
      if (!item) return;
      navigateTo(item.dataset.id);
    });

    upNextList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".up-next-item");
      if (!item) return;
      e.preventDefault();
      navigateTo(item.dataset.id);
    });
  }

  /** Switch to another video in the same player tab. */
  function navigateTo(id) {
    const video = pickVideo(id);
    if (!video) return;
    // Update the URL so the page can be refreshed/shared.
    const newUrl = `player.html?id=${encodeURIComponent(id)}`;
    window.history.pushState({ id }, "", newUrl);
    loadVideo(video);
    renderUpNext(id);
    // Count one "open" per navigation to a different video.
    reportStat(video.id, "open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Bind the like / share buttons. */
  function bindActions() {
    likeBtn.addEventListener("click", () => {
      likeBtn.classList.toggle("liked");
      showToast(
        likeBtn.classList.contains("liked")
          ? t("toast.likeAdded")
          : t("toast.likeRemoved")
      );
    });

    shareBtn.addEventListener("click", async () => {
      const shareUrl = window.location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: shareUrl });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          showToast(t("toast.linkCopied"));
        } else {
          showToast(shareUrl);
        }
      } catch (_) {
        /* User cancelled — ignore */
      }
    });
  }

  /** Auto-play the next video when the current one ends. */
  function bindAutoPlayNext() {
    videoEl.addEventListener("ended", () => {
      const currentId = getRequestedId();
      // Count one "completed" view per finish event.
      reportStat(currentId, "ended");
      const idx = videos.findIndex((v) => v.id === currentId);
      if (idx === -1) return;
      const next = videos[(idx + 1) % videos.length];
      if (next) navigateTo(next.id);
    });
  }

  /** Report the first real "play" for whichever video is currently loaded. */
  function bindFirstPlayReporter() {
    videoEl.addEventListener("play", () => {
      const id = videoEl.dataset.currentId || getRequestedId();
      if (!id) return;
      if (playReportedFor === id) return; // already counted for this load
      playReportedFor = id;
      reportStat(id, "play");
    });
  }

  /** Handle the browser back/forward buttons. */
  function bindHistory() {
    window.addEventListener("popstate", () => {
      const id = getRequestedId();
      const video = pickVideo(id);
      loadVideo(video);
      renderUpNext(video ? video.id : null);
    });
  }

  /** Tiny toast notification. */
  let toastEl;
  let toastTimer;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /** Show / hide a friendly error overlay on top of the player. */
  let errorOverlay;
  function showPlaybackError(message) {
    const shell = videoEl.parentElement;
    if (!shell) return;
    if (!errorOverlay) {
      errorOverlay = document.createElement("div");
      errorOverlay.style.cssText =
        "position:absolute;inset:0;display:grid;place-items:center;text-align:center;" +
        "padding:24px;color:#fff;background:rgba(0,0,0,0.78);font-size:14px;" +
        "line-height:1.6;border-radius:inherit;z-index:5;";
      shell.style.position = "relative";
      shell.appendChild(errorOverlay);
    }
    errorOverlay.innerHTML = `
      <div>
        <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
        <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(t("error.title"))}</div>
        <div style="color:#bbb;max-width:480px;">${escapeHtml(message)}</div>
      </div>`;
    errorOverlay.style.display = "grid";
  }
  function hidePlaybackError() {
    if (errorOverlay) errorOverlay.style.display = "none";
  }

  function bindPlaybackErrors() {
    videoEl.addEventListener("error", () => {
      const err = videoEl.error;
      const msg =
        (err && t("error.code." + err.code)) ||
        t("error.generic");
      showPlaybackError(msg);
    });

    // Also catch the rare case where `<source>` children all fail.
    videoEl.addEventListener("stalled", () => {
      // Just a hint in the console — do not show overlay for transient stalls.
      // eslint-disable-next-line no-console
      console.warn("[player] network stalled while loading", videoEl.currentSrc);
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

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const id = getRequestedId();
    const video = pickVideo(id);
    bindPlaybackErrors();
    loadVideo(video);
    renderUpNext(video ? video.id : null);
    bindUpNextEvents();
    bindActions();
    bindAutoPlayNext();
    bindFirstPlayReporter();
    bindHistory();

    // Pull the latest play counts so the views line shows the real number
    // even before the user does anything on this page.
    fetchPlayStats();

    // Count one "open" each time the player page is loaded for a video.
    if (video) reportStat(video.id, "open");

    if (window.I18N && typeof window.I18N.onChange === "function") {
      window.I18N.onChange(() => {
        const curId = getRequestedId();
        const v = pickVideo(curId);
        loadVideo(v);
        renderUpNext(v ? v.id : null);
      });
    }
  });
})();
