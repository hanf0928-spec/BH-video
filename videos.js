// Video catalog data — short-drama series model.
//
// A "series" is a show users browse on the home page. Each series owns a
// list of "episodes". The home grid renders one card per series, the
// player page plays one episode at a time and shows the series' episode
// list in the sidebar.
//
// Shape (TypeScript-ish) :
//
//   interface Series {
//     id:          string;          // unique series id
//     title:       string;          // series title shown on the home grid
//     description: string;          // long-form description / synopsis
//     tags:        string[];        // free-form labels, e.g. ["都市","言情"]
//     category:    string;          // chip filter on the home page
//                                   //   (usually = tags[0])
//     thumbnail:   string;          // cover image (also used as fallback
//                                   //   poster for episodes that don't
//                                   //   ship their own thumbnail)
//     i18n?:       { [lang]: { title?, description? } };
//     episodes:    Episode[];
//   }
//   interface Episode {
//     ep:        number;            // 1-based episode number
//     title:     string;            // optional, falls back to "第N集"
//     src:       string;            // video URL
//     duration?: string;            // "mm:ss" — optional
//     thumbnail?:string;            // optional per-episode poster
//     views?:    string;            // static fallback views label
//   }
//
// Each episode is identified across the app by the composite id
// "<seriesId>:ep<n>" (see episodeKey() below). That composite id is what
// the play-stats backend stores under, so per-episode counters stay
// independent while the series total is just the sum of its episodes.

(function () {
  "use strict";

  const BUILTIN_SERIES = [
    {
      id: "bunny-saga",
      title: "兔兔传奇",
      description:
        "一只可爱的大兔子要面对三个由飞鼠领头的小恶霸。它们一心想破坏它的好心情，于是一场温馨又欢乐的反击悄然展开。",
      tags: ["动画", "喜剧", "短剧"],
      category: "动画",
      thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
      episodes: [
        {
          ep: 1,
          title: "第一集 初遇恶霸",
          src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
          duration: "0:33",
          thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
          views: "1.2M",
        },
        {
          ep: 2,
          title: "第二集 反击之路",
          src: "https://media.w3.org/2010/05/bunny/movie.mp4",
          duration: "1:00",
          thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
          views: "980K",
        },
        {
          ep: 3,
          title: "第三集 完整版",
          src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
          duration: "9:56",
          thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
          views: "523K",
        },
      ],
    },
    {
      id: "sintel-saga",
      title: "辛特尔传说",
      description:
        "一个孤独的少女与一只小龙建立了深厚的友谊，并将它取名为「鳞片」。在被迫分离之后，她踏上了寻找它的奇幻旅程。",
      tags: ["奇幻", "冒险", "情感"],
      category: "奇幻",
      thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
      episodes: [
        {
          ep: 1,
          title: "第一集 初识小龙",
          src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
          duration: "0:52",
          thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
          views: "2.1M",
        },
        {
          ep: 2,
          title: "第二集 踏上旅途",
          src: "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
          duration: "0:52",
          thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
          views: "612K",
        },
      ],
    },
    {
      id: "demo-shorts",
      title: "示例短片合集",
      description:
        "一组用于快速验证播放器的迷你 HTML5 演示片段，方便测试导入与播放流程。",
      tags: ["演示", "测试"],
      category: "演示",
      thumbnail:
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
      episodes: [
        {
          ep: 1,
          title: "第一集 W3C 示例片段",
          src: "https://media.w3.org/2010/05/video/movie_300.mp4",
          duration: "0:30",
          thumbnail:
            "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
          views: "342K",
        },
        {
          ep: 2,
          title: "第二集 兔兔短片",
          src: "https://www.w3schools.com/html/mov_bbb.mp4",
          duration: "0:10",
          thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
          views: "455K",
        },
        {
          ep: 3,
          title: "第三集 林间漫步",
          src: "https://www.w3schools.com/html/movie.mp4",
          duration: "0:08",
          thumbnail:
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
          views: "210K",
        },
      ],
    },
  ];

  /** Composite id used by /api/stats for a single episode. */
  function episodeKey(seriesId, ep) {
    return `${seriesId}:ep${ep}`;
  }

  /** Find a series by id. */
  function findSeries(seriesId) {
    return (window.VIDEOS || []).find((s) => s.id === seriesId) || null;
  }

  /** Find an episode inside a series. Falls back to the first episode. */
  function findEpisode(series, ep) {
    if (!series || !Array.isArray(series.episodes) || !series.episodes.length)
      return null;
    const num = Number(ep);
    return (
      series.episodes.find((e) => Number(e.ep) === num) || series.episodes[0]
    );
  }

  /**
   * Merge user-imported series (from /api/library) into the catalog. Imported
   * series with the same id override the built-in entry so authors can fix
   * typos by re-uploading the same Excel.
   */
  function mergeImported(imported) {
    const byId = new Map();
    BUILTIN_SERIES.forEach((s) => byId.set(s.id, s));
    (imported || []).forEach((s) => {
      if (s && s.id) byId.set(s.id, s);
    });
    window.VIDEOS = Array.from(byId.values());
  }

  // Initial export — built-ins only. app.js / player.js will call
  // VideoCatalog.mergeImported() once /api/library resolves.
  window.VIDEOS = BUILTIN_SERIES.slice();
  window.VideoCatalog = {
    episodeKey,
    findSeries,
    findEpisode,
    mergeImported,
    BUILTIN_SERIES,
  };
})();
