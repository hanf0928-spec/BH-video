#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BH Video — Tiny static server with a play-count API.

Why this file exists
--------------------
The project is a pure static front-end, but the user wants the play counts
to be persisted into a file *inside the project folder*. Browsers cannot
write local files directly, so we extend Python's built-in
`http.server` with a tiny JSON API that the front-end can call.

Endpoints
---------
GET  /api/stats
    -> { "<videoId>": { "opens": N, "plays": N, "ends": N }, ... }

POST /api/stats
    Body: { "id": "<videoId>", "event": "open" | "play" | "ended" }
    -> { "ok": true, "id": "...", "stats": { ... } }

Everything else is delegated to SimpleHTTPRequestHandler so existing
static assets (index.html, app.js, etc.) keep working unchanged.

Run
---
    python3 server.py            # binds 127.0.0.1:8765
    python3 server.py 8080       # custom port
"""

import json
import os
import sys
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT_DIR, "views.json")
VALID_EVENTS = ("open", "play", "ended")
EVENT_FIELD = {"open": "opens", "play": "plays", "ended": "ends"}

# A single lock guards every read/modify/write of views.json so concurrent
# requests cannot lose updates.
_data_lock = threading.Lock()


def _load_stats():
    """Read views.json (if any). Always return a dict."""
    if not os.path.isfile(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_stats(stats):
    """Atomically persist the stats dict back to views.json."""
    tmp_path = DATA_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp_path, DATA_FILE)


def _ensure_entry(stats, video_id):
    """Make sure stats[video_id] has all three counters."""
    entry = stats.get(video_id)
    if not isinstance(entry, dict):
        entry = {}
    for field in EVENT_FIELD.values():
        if not isinstance(entry.get(field), int):
            entry[field] = 0
    stats[video_id] = entry
    return entry


class BHVideoHandler(SimpleHTTPRequestHandler):
    """Static file server with extra /api/stats endpoints."""

    # Force a fixed root so the script can be launched from anywhere.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    # ---- API helpers ------------------------------------------------------
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status, message):
        self._send_json(status, {"ok": False, "error": message})

    # ---- Routing ----------------------------------------------------------
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/stats":
            with _data_lock:
                stats = _load_stats()
            self._send_json(HTTPStatus.OK, stats)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/stats":
            self._send_error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 4096:
            self._send_error_json(HTTPStatus.BAD_REQUEST, "empty or oversized body")
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._send_error_json(HTTPStatus.BAD_REQUEST, "invalid JSON body")
            return

        video_id = (payload.get("id") or "").strip()
        event = (payload.get("event") or "").strip()
        if not video_id or len(video_id) > 128:
            self._send_error_json(HTTPStatus.BAD_REQUEST, "missing or invalid 'id'")
            return
        if event not in VALID_EVENTS:
            self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "'event' must be one of: " + ", ".join(VALID_EVENTS),
            )
            return

        field = EVENT_FIELD[event]
        with _data_lock:
            stats = _load_stats()
            entry = _ensure_entry(stats, video_id)
            entry[field] = int(entry.get(field, 0)) + 1
            _save_stats(stats)
            updated = dict(entry)

        self._send_json(
            HTTPStatus.OK,
            {"ok": True, "id": video_id, "stats": updated},
        )

    # Keep the default logging tidy.
    def log_message(self, fmt, *args):
        sys.stderr.write("[bh-video] %s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = 8765
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port:", sys.argv[1], file=sys.stderr)
            sys.exit(2)

    bind = "127.0.0.1"
    server = ThreadingHTTPServer((bind, port), BHVideoHandler)
    print("BH-video server running at http://%s:%d/" % (bind, port))
    print("Stats file: %s" % DATA_FILE)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
