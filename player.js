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
      videoEl.load();
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          /* Autoplay may be blocked — user can press play manually. */
        });
      }
    }

    titleEl.textContent = localTitle;
    viewsEl.textContent = `${video.views} ${t("card.viewsSuffix")}`;
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
      const idx = videos.findIndex((v) => v.id === currentId);
      if (idx === -1) return;
      const next = videos[(idx + 1) % videos.length];
      if (next) navigateTo(next.id);
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
    bindHistory();

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
