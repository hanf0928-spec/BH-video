# BH Video — Demo Video-on-Demand Platform

A lightweight, dependency-free video-on-demand platform built with plain HTML, CSS and JavaScript.

## Features

- Modern dark, responsive UI
- Home page with hero banner, category filters, search, and a thumbnail grid
- Click any thumbnail → opens a **new tab** with a dedicated player page (`player.html?id=<videoId>`)
- Player page with metadata, like/share buttons, auto-play next, and an "Up Next" sidebar
- Sample videos sourced from Google's public demo bucket

## Project Structure

```
BH-video/
├── index.html      # Home page (overview + thumbnails)
├── player.html     # Player page (opened in a new tab)
├── styles.css      # Shared stylesheet
├── videos.js       # Video catalog (data)
├── app.js          # Home page logic
└── player.js       # Player page logic
```

## How to Run

The front-end is 100% static, but a tiny Python server (`server.py`) ships with
the project to provide a play-count API and persist counts to `views.json`
inside the project folder. Run it like this:

```bash
# Linux / macOS
python3 server.py            # binds 127.0.0.1:8765
python3 server.py 8080       # custom port

# Windows
py -3 server.py
```

Then open http://localhost:8765 in your browser.

> If you skip `server.py` and just open `index.html` directly, the site still
> works, but play counts will not be recorded.

> **Windows tip:** If `python3 --version` prints nothing, you are hitting the
> Microsoft Store *App Execution Alias* stub. Use `py -3 ...` instead — or run
> the bundled helper script which auto-detects the real interpreter and starts
> `server.py` in the background:
>
> ```powershell
> # Start (binds to 127.0.0.1:8765, runs hidden in the background)
> powershell -ExecutionPolicy Bypass -File .\.startserver.ps1
>
> # Stop
> powershell -ExecutionPolicy Bypass -File .\.stopserver.ps1
> ```

## Play-count tracking

`server.py` exposes a tiny JSON API that records three counters per video:

| Counter   | When it is incremented                                |
|-----------|-------------------------------------------------------|
| `opens`   | Every time `player.html` is loaded (or switched to)   |
| `plays`   | The first time the `<video>` actually starts playing  |
| `ends`    | Every time playback reaches the end of the video      |

All counters are persisted to `views.json` in the project root. The home page
shows the real `plays` number on each card; if the API is unreachable (e.g.
the page was opened via `file://`), the static fallback in `videos.js` is
used instead.

API quick reference:

```
GET  /api/stats                          → { "<videoId>": { opens, plays, ends }, ... }
POST /api/stats   { "id":"<videoId>",
                    "event":"open"|"play"|"ended" }
```

## How It Works

1. `videos.js` exposes a global `window.VIDEOS` array. Each entry has an `id`, `title`, `thumbnail`, `src`, etc.
2. `app.js` renders the grid on `index.html`. Clicking a card calls
   `window.open('player.html?id=' + id, '_blank')`, opening the player in a new tab.
3. `player.js` reads the `id` from the URL query string, finds the matching entry in `VIDEOS`, and
   sets `<video>.src` accordingly. The "Up Next" list lets the user switch videos without leaving the page.

## Adding Your Own Videos

Open `videos.js` and append a new object to the array:

```js
{
  id: "my-clip",                      // unique
  title: "My Awesome Clip",
  author: "Me",
  duration: "2:34",
  views: "0",
  category: "Custom",
  description: "Short summary here.",
  thumbnail: "https://example.com/cover.jpg",
  src: "https://example.com/video.mp4",
}
```

That's it — the home page will pick it up automatically.
