// Video catalog data
// Each item has a unique id used to look up the video on the player page.
//
// All `src` URLs below have been verified reachable (HTTP 200) from the
// current network. They are well-known public demo videos hosted by
// W3Schools, W3C and the Blender Foundation.
//
// Localised strings live under `i18n.<lang>`. Top-level fields (title,
// description, …) are kept as English fallbacks for code that does not
// go through window.I18N.pickLocalized().
window.VIDEOS = [
  {
    id: "bunny",
    title: "Big Buck Bunny",
    author: "Blender Foundation",
    duration: "0:33",
    views: "1.2M",
    category: "Animation",
    description:
      "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
    thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    i18n: {
      en: {
        title: "Big Buck Bunny",
        description:
          "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
      },
      id: {
        title: "Big Buck Bunny",
        description:
          "Seekor kelinci besar yang menggemaskan menghadapi tiga pengganggu kecil, dipimpin oleh seekor tupai terbang, yang bertekad menghancurkan kebahagiaannya.",
      },
    },
  },
  {
    id: "bunny-full",
    title: "Big Buck Bunny — Full Movie Clip",
    author: "Blender Foundation",
    duration: "1:00",
    views: "980K",
    category: "Animation",
    description:
      "An extended preview clip of the iconic open-source short film by the Blender Institute.",
    thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
    src: "https://media.w3.org/2010/05/bunny/movie.mp4",
    i18n: {
      en: {
        title: "Big Buck Bunny — Full Movie Clip",
        description:
          "An extended preview clip of the iconic open-source short film by the Blender Institute.",
      },
      id: {
        title: "Big Buck Bunny — Cuplikan Film Penuh",
        description:
          "Cuplikan pratinjau yang lebih panjang dari film pendek sumber terbuka ikonik karya Blender Institute.",
      },
    },
  },
  {
    id: "sintel",
    title: "Sintel — Trailer",
    author: "Blender Foundation",
    duration: "0:52",
    views: "2.1M",
    category: "Fantasy",
    description:
      "A lonely young woman befriends a baby dragon she names Scales, and embarks on a journey to find him after they are separated.",
    thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    i18n: {
      en: {
        title: "Sintel — Trailer",
        description:
          "A lonely young woman befriends a baby dragon she names Scales, and embarks on a journey to find him after they are separated.",
      },
      id: {
        title: "Sintel — Cuplikan",
        description:
          "Seorang gadis muda yang kesepian berteman dengan seekor naga kecil yang ia beri nama Scales, dan melakukan perjalanan untuk menemukannya setelah mereka terpisah.",
      },
    },
  },
  {
    id: "sintel-blender",
    title: "Sintel — 480p Trailer (Blender.org)",
    author: "Durian Open Movie Project",
    duration: "0:52",
    views: "612K",
    category: "Fantasy",
    description:
      "The official 480p trailer for Sintel, served directly from blender.org.",
    thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
    src: "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
    i18n: {
      en: {
        title: "Sintel — 480p Trailer (Blender.org)",
        description:
          "The official 480p trailer for Sintel, served directly from blender.org.",
      },
      id: {
        title: "Sintel — Cuplikan 480p (Blender.org)",
        description:
          "Cuplikan resmi 480p untuk Sintel, disajikan langsung dari blender.org.",
      },
    },
  },
  {
    id: "demo-300",
    title: "W3C Sample Movie",
    author: "W3C",
    duration: "0:30",
    views: "342K",
    category: "Demo",
    description:
      "A short HTML5 video demonstration clip used by the W3C to showcase the <video> element.",
    thumbnail:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    i18n: {
      en: {
        title: "W3C Sample Movie",
        description:
          "A short HTML5 video demonstration clip used by the W3C to showcase the <video> element.",
      },
      id: {
        title: "Film Contoh W3C",
        description:
          "Klip demonstrasi video HTML5 singkat yang digunakan W3C untuk memperkenalkan elemen <video>.",
      },
    },
  },
  {
    id: "bbb-w3s",
    title: "Big Buck Bunny — Short Clip",
    author: "W3Schools",
    duration: "0:10",
    views: "455K",
    category: "Demo",
    description:
      "A tiny Big Buck Bunny clip hosted by W3Schools — perfect for quickly testing HTML5 video playback.",
    thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    i18n: {
      en: {
        title: "Big Buck Bunny — Short Clip",
        description:
          "A tiny Big Buck Bunny clip hosted by W3Schools — perfect for quickly testing HTML5 video playback.",
      },
      id: {
        title: "Big Buck Bunny — Cuplikan Singkat",
        description:
          "Cuplikan singkat Big Buck Bunny yang di-hosting oleh W3Schools — cocok untuk menguji pemutaran video HTML5 dengan cepat.",
      },
    },
  },
  {
    id: "bear",
    title: "Bear — Walking In The Woods",
    author: "W3Schools",
    duration: "0:08",
    views: "210K",
    category: "Demo",
    description:
      "A short demonstration clip of a bear walking through the woods, hosted by W3Schools.",
    thumbnail:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
    src: "https://www.w3schools.com/html/movie.mp4",
    i18n: {
      en: {
        title: "Bear — Walking In The Woods",
        description:
          "A short demonstration clip of a bear walking through the woods, hosted by W3Schools.",
      },
      id: {
        title: "Beruang — Berjalan di Hutan",
        description:
          "Klip demonstrasi singkat seekor beruang yang berjalan melewati hutan, di-hosting oleh W3Schools.",
      },
    },
  },
  {
    id: "bunny-blender",
    title: "Big Buck Bunny — 320×180",
    author: "Peach Open Movie Project",
    duration: "9:56",
    views: "523K",
    category: "Animation",
    description:
      "The full Big Buck Bunny short film at 320×180, served directly from blender.org.",
    thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    i18n: {
      en: {
        title: "Big Buck Bunny — 320×180",
        description:
          "The full Big Buck Bunny short film at 320×180, served directly from blender.org.",
      },
      id: {
        title: "Big Buck Bunny — 320×180",
        description:
          "Film pendek Big Buck Bunny lengkap dalam resolusi 320×180, disajikan langsung dari blender.org.",
      },
    },
  },
];
