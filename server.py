#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BH Video — Tiny static server with a play-count + library API.

Why this file exists
--------------------
The project is a pure static front-end, but the user wants
- play counts persisted into a file inside the project folder, and
- user-imported series (from the Excel-import dialog) persisted too.
Browsers cannot write local files directly, so we extend Python's built-in
`http.server` with two tiny JSON APIs that the front-end calls.

Endpoints
---------
GET  /api/stats
    -> { "<episodeKey>": { "opens": N, "plays": N, "ends": N }, ... }
       Episode keys look like "<seriesId>:ep<n>".

POST /api/stats
    Body: { "id": "<episodeKey>", "event": "open" | "play" | "ended" }
    -> { "ok": true, "id": "...", "stats": { ... } }

GET  /api/library
    -> { "imported": [ Series, ... ] }
       Returns the user-imported series (videos.local.json). The built-in
       catalog still ships in videos.js on the client.

POST /api/import
    Body: { "series": [ Series, ... ] }
    -> { "ok": true, "added": N, "imported": [ Series, ... ] }
       Validates and merges the supplied series into videos.local.json
       (overwriting existing entries with the same id).

Everything else is delegated to SimpleHTTPRequestHandler so existing
static assets (index.html, app.js, etc.) keep working unchanged.

Run
---
    python3 server.py            # binds 0.0.0.0:8765
    python3 server.py 8080       # custom port
"""

import json
import os
import re
import sys
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT_DIR, "views.json")
LIBRARY_FILE = os.path.join(ROOT_DIR, "videos.local.json")
VALID_EVENTS = ("open", "play", "ended")
EVENT_FIELD = {"open": "opens", "play": "plays", "ended": "ends"}

# Conservative limits to keep imports sane.
MAX_IMPORT_BYTES = 4 * 1024 * 1024  # 4 MiB JSON body
MAX_SERIES_PER_IMPORT = 500
MAX_EPISODES_PER_SERIES = 500
MAX_STR_LEN = 2000

# A single lock guards every read/modify/write so concurrent requests
# cannot lose updates.
_data_lock = threading.Lock()
_library_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Stats persistence (views.json)
# ---------------------------------------------------------------------------

def _load_stats():
    if not os.path.isfile(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}

def _save_stats(stats):
    tmp_path = DATA_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp_path, DATA_FILE)

def _ensure_entry(stats, video_id):
    entry = stats.get(video_id)
    if not isinstance(entry, dict):
        entry = {}
    for field in EVENT_FIELD.values():
        if not isinstance(entry.get(field), int):
            entry[field] = 0
    stats[video_id] = entry
    return entry

# ---------------------------------------------------------------------------
# Imported library persistence (videos.local.json)
# ---------------------------------------------------------------------------

_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-:.]{0,127}$")


def _load_library():
    """Load videos.local.json. Returns a list of Series dicts (possibly empty)."""
    if not os.path.isfile(LIBRARY_FILE):
        return []
    try:
        with open(LIBRARY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("imported"), list):
            return data["imported"]
        return []
    except (OSError, ValueError):
        return []


def _save_library(series_list):
    tmp_path = LIBRARY_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(
            {"imported": series_list},
            f,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    os.replace(tmp_path, LIBRARY_FILE)


def _clean_str(value, max_len=MAX_STR_LEN):
    """Coerce arbitrary input to a trimmed string with a hard length cap."""
    if value is None:
        return ""
    s = str(value).strip()
    if len(s) > max_len:
        s = s[:max_len]
    return s


def _validate_series(raw):
    """
    Validate one Series dict from /api/import.

    Returns the cleaned Series dict on success, or None if invalid.
    """
    if not isinstance(raw, dict):
        return None

    series_id = _clean_str(raw.get("id"), 128)
    if not series_id or not _ID_RE.match(series_id):
        return None

    episodes_raw = raw.get("episodes")
    if not isinstance(episodes_raw, list) or not episodes_raw:
        return None

    cleaned_eps = []
    for idx, ep in enumerate(episodes_raw[:MAX_EPISODES_PER_SERIES], start=1):
        if not isinstance(ep, dict):
            continue
        src = _clean_str(ep.get("src"), 2048)
        if not src:
            continue
        try:
            ep_num = int(ep.get("ep") or idx)
        except (TypeError, ValueError):
            ep_num = idx
        if ep_num <= 0:
            ep_num = idx

        cleaned_eps.append(
            {
                "ep": ep_num,
                "title": _clean_str(ep.get("title")) or f"EP{ep_num}",
                "src": src,
                "duration": _clean_str(ep.get("duration"), 32),
                "thumbnail": _clean_str(ep.get("thumbnail"), 2048),
                "views": _clean_str(ep.get("views"), 32),
            }
        )

    if not cleaned_eps:
        return None

    cleaned_eps.sort(key=lambda e: e["ep"])

    # Tags: accept a list of short strings, keep the original order, dedupe.
    tags_raw = raw.get("tags")
    cleaned_tags = []
    if isinstance(tags_raw, list):
        seen = set()
        for t in tags_raw[:32]:  # hard cap on tag count
            tag = _clean_str(t, 64)
            if tag and tag not in seen:
                seen.add(tag)
                cleaned_tags.append(tag)

    # Category falls back to the first tag (mirrors the client-side parser),
    # so the home-page filter chips stay populated even if the user only
    # filled in `tags`.
    category = _clean_str(raw.get("category"), 64)
    if not category:
        category = cleaned_tags[0] if cleaned_tags else "Drama"

    cleaned = {
        "id": series_id,
        "title": _clean_str(raw.get("title")) or series_id,
        "author": _clean_str(raw.get("author")),
        "category": category,
        "tags": cleaned_tags,
        "description": _clean_str(raw.get("description"), 4000),
        "thumbnail": _clean_str(raw.get("thumbnail"), 2048),
        "episodes": cleaned_eps,
    }

    # Optional: keep i18n block if it looks well-formed.
    i18n = raw.get("i18n")
    if isinstance(i18n, dict):
        clean_i18n = {}
        for lang, block in i18n.items():
            if not isinstance(block, dict):
                continue
            lang_key = _clean_str(lang, 8)
            if not lang_key:
                continue
            clean_block = {}
            for k in ("title", "description", "author"):
                if k in block:
                    clean_block[k] = _clean_str(block.get(k))
            if clean_block:
                clean_i18n[lang_key] = clean_block
        if clean_i18n:
            cleaned["i18n"] = clean_i18n

    return cleaned


def _merge_series(existing, incoming):
    """Merge `incoming` into `existing` by id (incoming wins). Returns new list."""
    by_id = {s["id"]: s for s in existing if isinstance(s, dict) and s.get("id")}
    for s in incoming:
        by_id[s["id"]] = s
    return list(by_id.values())


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class BHVideoHandler(SimpleHTTPRequestHandler):
    """Static file server with extra /api/* endpoints."""

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

    def _read_json_body(self, max_bytes):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > max_bytes:
            return None, "empty or oversized body"
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8")), None
        except (ValueError, UnicodeDecodeError):
            return None, "invalid JSON body"

    # ---- Routing ----------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/stats":
            with _data_lock:
                stats = _load_stats()
            self._send_json(HTTPStatus.OK, stats)
            return
        if path == "/api/library":
            with _library_lock:
                imported = _load_library()
            self._send_json(HTTPStatus.OK, {"imported": imported})
            return
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/stats":
            return self._handle_stats_post()
        if path == "/api/import":
            return self._handle_import_post()
        self._send_error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")

    # ---- /api/stats POST --------------------------------------------------
    def _handle_stats_post(self):
        payload, err = self._read_json_body(4096)
        if err:
            self._send_error_json(HTTPStatus.BAD_REQUEST, err)
            return

        video_id = (payload.get("id") or "").strip()
        event = (payload.get("event") or "").strip()
        if not video_id or len(video_id) > 256:
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

    # ---- /api/import POST -------------------------------------------------
    def _handle_import_post(self):
        payload, err = self._read_json_body(MAX_IMPORT_BYTES)
        if err:
            self._send_error_json(HTTPStatus.BAD_REQUEST, err)
            return
        if not isinstance(payload, dict):
            self._send_error_json(HTTPStatus.BAD_REQUEST, "expected JSON object")
            return

        raw_list = payload.get("series")
        if not isinstance(raw_list, list) or not raw_list:
            self._send_error_json(
                HTTPStatus.BAD_REQUEST, "'series' must be a non-empty array"
            )
            return
        if len(raw_list) > MAX_SERIES_PER_IMPORT:
            self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "too many series (max %d)" % MAX_SERIES_PER_IMPORT,
            )
            return

        cleaned = []
        for raw in raw_list:
            s = _validate_series(raw)
            if s is not None:
                cleaned.append(s)

        if not cleaned:
            self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "no valid series found (each series needs an 'id' and at least one episode with 'src')",
            )
            return

        with _library_lock:
            existing = _load_library()
            merged = _merge_series(existing, cleaned)
            _save_library(merged)

        self._send_json(
            HTTPStatus.OK,
            {"ok": True, "added": len(cleaned), "imported": merged},
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

    bind = "0.0.0.0"
    server = ThreadingHTTPServer((bind, port), BHVideoHandler)
    print("BH-video server running at http://%s:%d/" % (bind, port))
    print("Stats file:    %s" % DATA_FILE)
    print("Library file:  %s" % LIBRARY_FILE)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
