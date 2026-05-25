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

The project is 100% static. You can simply double-click `index.html`, but for the most reliable
video playback (some browsers block `file://` media), serve it through a local HTTP server:

```bash
# Option 1: Python 3 (Linux / macOS, or Windows where `python3` is on PATH)
python3 -m http.server 8765

# Option 2: Python 3 on Windows (the recommended launcher)
py -3 -m http.server 8765

# Option 3: Node.js
npx serve . -p 8765
```

Then open http://localhost:8765 in your browser.

> **Windows tip:** If `python3 --version` prints nothing, you are hitting the
> Microsoft Store *App Execution Alias* stub. Use `py -3 ...` instead — or run
> the bundled helper script which auto-detects the real interpreter:
>
> ```powershell
> # Start (binds to 127.0.0.1:8765, runs hidden in the background)
> powershell -ExecutionPolicy Bypass -File .\.startserver.ps1
>
> # Stop
> powershell -ExecutionPolicy Bypass -File .\.stopserver.ps1
> ```

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
