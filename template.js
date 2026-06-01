// Excel template generator for the BH-video import dialog.
//
// Usage in a browser console (with SheetJS already loaded by app.js after
// the user opens the import modal):
//
//   buildBHVideoTemplate();   // → triggers download of bh-video-template.xlsx
//
// Two layouts are produced inside the same workbook:
//   1) Sheet "single-sheet" — one row per episode, series metadata
//      repeated only on the first row of each series.
//   2) Sheets "series" + "episodes" — relational layout linked by series_id.
//
// Either layout is auto-detected by the importer (see app.js → parseWorkbook).

/* eslint-disable no-undef */
function buildBHVideoTemplate() {
  if (typeof XLSX === "undefined") {
    alert("SheetJS not loaded yet — open the Import dialog first.");
    return;
  }

  const single = [
    {
      series_id: "drama01",
      series_title: "City Lights — Demo",
      author: "BH Studio",
      category: "Drama",
      description: "A demo short-drama series.",
      thumbnail: "https://media.w3.org/2010/05/bunny/poster.png",
      ep: 1,
      ep_title: "Episode 1 — First Encounter",
      src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
      duration: "0:33",
    },
    {
      series_id: "drama01",
      series_title: "",
      author: "",
      category: "",
      description: "",
      thumbnail: "",
      ep: 2,
      ep_title: "Episode 2 — Heartbeat",
      src: "https://media.w3.org/2010/05/bunny/movie.mp4",
      duration: "1:00",
    },
  ];

  const series = [
    {
      series_id: "drama02",
      title: "Midnight Promise",
      author: "BH Studio",
      category: "Drama",
      description: "Another demo series, defined in two sheets.",
      thumbnail: "https://media.w3.org/2010/05/sintel/poster.png",
    },
  ];
  const episodes = [
    {
      series_id: "drama02",
      ep: 1,
      title: "Pilot",
      src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
      duration: "0:52",
      thumbnail: "",
    },
    {
      series_id: "drama02",
      ep: 2,
      title: "Confession",
      src: "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
      duration: "0:52",
      thumbnail: "",
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(single),
    "single-sheet"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series), "series");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(episodes),
    "episodes"
  );

  XLSX.writeFile(wb, "bh-video-template.xlsx");
}

if (typeof window !== "undefined") {
  window.buildBHVideoTemplate = buildBHVideoTemplate;
}
