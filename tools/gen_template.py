#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate the BH-video Excel import template (bh-video-template.xlsx).

This template intentionally collects only the fields the home / player
pages actually display:

    * 作品名称 (title)
    * 简介     (description)
    * 标签     (tags) — comma / 顿号 / semicolon separated
    * 集数     — derived from the number of rows that share series_id
    * 每集 URL (src)
    * 首页图片 (thumbnail)

The structural columns `series_id` and `ep` are also required so the
parser can group rows into series and order the episodes — they are not
"content" but identifiers.

The script uses ONLY the Python standard library (no openpyxl / pandas)
because a .xlsx file is just a ZIP archive with a few XML parts.

Run
---
    python3 tools/gen_template.py
    # → writes <project root>/bh-video-template.xlsx
"""

import os
import sys
import zipfile
from datetime import datetime
from xml.sax.saxutils import escape as xml_escape

# ---------------------------------------------------------------------------
# Sample data — a single sheet, two demo series, all in Chinese.
# ---------------------------------------------------------------------------

SHEET_HEADERS = [
    "series_id",      # 作品ID（必填，相同 ID 的多行会合并成一个作品）
    "title",          # 作品名称
    "description",    # 简介
    "tags",           # 标签（逗号、顿号或分号分隔）
    "thumbnail",      # 首页图片 URL
    "ep",             # 集数序号（1, 2, 3…）
    "src",            # 每集的视频 URL
]

# 同一 series_id 的第一行需要填写作品级字段（title/description/tags/thumbnail），
# 后续行可以留空，解析器会自动沿用第一行的作品级信息。
SHEET_ROWS = [
    # ----- drama01 《霸总的逆袭》 共 3 集 -----
    [
        "drama01",
        "霸总的逆袭",
        "一段都市甜虐爱情故事，霸道总裁与平凡女孩的双向奔赴。",
        "都市,言情,甜宠",
        "https://media.w3.org/2010/05/bunny/poster.png",
        1,
        "https://media.w3.org/2010/05/bunny/trailer.mp4",
    ],
    [
        "drama01", "", "", "", "",
        2,
        "https://media.w3.org/2010/05/bunny/movie.mp4",
    ],
    [
        "drama01", "", "", "", "",
        3,
        "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    ],

    # ----- drama02 《午夜誓言》 共 2 集 -----
    [
        "drama02",
        "午夜誓言",
        "一通深夜来电揭开尘封多年的秘密，悬疑短剧。",
        "悬疑,爱情",
        "https://media.w3.org/2010/05/sintel/poster.png",
        1,
        "https://media.w3.org/2010/05/sintel/trailer.mp4",
    ],
    [
        "drama02", "", "", "", "",
        2,
        "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
    ],
]

SHEETS = [
    ("作品导入", SHEET_HEADERS, SHEET_ROWS),
]

# ---------------------------------------------------------------------------
# Minimal OOXML builders.
# ---------------------------------------------------------------------------

def col_letter(idx_one_based):
    """Convert 1-based column index to Excel letters (1->A, 27->AA)."""
    s = ""
    n = idx_one_based
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(ord("A") + r) + s
    return s


def cell_ref(col_one_based, row_one_based):
    return "%s%d" % (col_letter(col_one_based), row_one_based)


def build_sheet_xml(headers, rows, shared_strings):
    """Build the inner XML for a single worksheet.

    Strings go through the shared-strings table. Numbers are written
    inline. The function mutates `shared_strings` in place.
    """
    def s_index(value):
        text = "" if value is None else str(value)
        if text not in shared_strings:
            shared_strings[text] = len(shared_strings)
        return shared_strings[text]

    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    parts.append(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    )

    # Reasonable column widths so the sample file looks tidy in Excel.
    parts.append("<cols>")
    for i, h in enumerate(headers, start=1):
        name = (h or "").lower()
        if name in ("src", "thumbnail"):
            width = 60
        elif name == "description":
            width = 50
        elif name == "tags":
            width = 24
        elif name == "ep":
            width = 6
        else:
            width = 22
        parts.append(
            '<col min="%d" max="%d" width="%d" customWidth="1"/>'
            % (i, i, width)
        )
    parts.append("</cols>")

    parts.append("<sheetData>")

    # Header row (row 1) — all strings.
    parts.append('<row r="1">')
    for col_i, h in enumerate(headers, start=1):
        idx = s_index(h)
        parts.append(
            '<c r="%s" t="s"><v>%d</v></c>'
            % (cell_ref(col_i, 1), idx)
        )
    parts.append("</row>")

    # Data rows.
    for row_i, row in enumerate(rows, start=2):
        parts.append('<row r="%d">' % row_i)
        for col_i, value in enumerate(row, start=1):
            ref = cell_ref(col_i, row_i)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                parts.append('<c r="%s"><v>%s</v></c>' % (ref, value))
            else:
                text = "" if value is None else str(value)
                if text == "":
                    # Skip empty cells — Excel handles missing cells fine.
                    continue
                idx = s_index(text)
                parts.append('<c r="%s" t="s"><v>%d</v></c>' % (ref, idx))
        parts.append("</row>")

    parts.append("</sheetData>")
    parts.append("</worksheet>")
    return "".join(parts)


def build_shared_strings_xml(shared_strings):
    items = sorted(shared_strings.items(), key=lambda kv: kv[1])
    parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    parts.append(
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'count="%d" uniqueCount="%d">' % (len(items), len(items))
    )
    for text, _ in items:
        # preserve leading/trailing whitespace just in case
        parts.append(
            '<si><t xml:space="preserve">%s</t></si>' % xml_escape(text)
        )
    parts.append("</sst>")
    return "".join(parts)


def build_workbook_xml(sheet_names):
    parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    parts.append(
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    )
    parts.append("<sheets>")
    for i, name in enumerate(sheet_names, start=1):
        parts.append(
            '<sheet name="%s" sheetId="%d" r:id="rId%d"/>'
            % (xml_escape(name), i, i)
        )
    parts.append("</sheets>")
    parts.append("</workbook>")
    return "".join(parts)


def build_workbook_rels_xml(sheet_count):
    parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    parts.append(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    )
    for i in range(1, sheet_count + 1):
        parts.append(
            '<Relationship Id="rId%d" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            'Target="worksheets/sheet%d.xml"/>' % (i, i)
        )
    # Shared strings rel uses the next id.
    next_id = sheet_count + 1
    parts.append(
        '<Relationship Id="rId%d" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
        'Target="sharedStrings.xml"/>' % next_id
    )
    # Styles rel uses the id after that.
    next_id += 1
    parts.append(
        '<Relationship Id="rId%d" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>' % next_id
    )
    parts.append("</Relationships>")
    return "".join(parts)


def build_root_rels_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def build_content_types_xml(sheet_count):
    parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    parts.append(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    )
    parts.append(
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    )
    parts.append('<Default Extension="xml" ContentType="application/xml"/>')
    parts.append(
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    )
    for i in range(1, sheet_count + 1):
        parts.append(
            '<Override PartName="/xl/worksheets/sheet%d.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            % i
        )
    parts.append(
        '<Override PartName="/xl/sharedStrings.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    )
    parts.append(
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    )
    parts.append("</Types>")
    return "".join(parts)


def build_styles_xml():
    """Minimal but valid styles.xml so Excel doesn't complain."""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        "</fills>"
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def build_xlsx(out_path):
    shared_strings = {}
    sheet_xmls = []
    for name, headers, rows in SHEETS:
        sheet_xmls.append(build_sheet_xml(headers, rows, shared_strings))

    workbook_xml = build_workbook_xml([name for name, _, _ in SHEETS])
    workbook_rels_xml = build_workbook_rels_xml(len(SHEETS))
    root_rels_xml = build_root_rels_xml()
    content_types_xml = build_content_types_xml(len(SHEETS))
    styles_xml = build_styles_xml()
    sst_xml = build_shared_strings_xml(shared_strings)

    with zipfile.ZipFile(
        out_path, "w", zipfile.ZIP_DEFLATED, allowZip64=False
    ) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/styles.xml", styles_xml)
        zf.writestr("xl/sharedStrings.xml", sst_xml)
        for i, xml in enumerate(sheet_xmls, start=1):
            zf.writestr("xl/worksheets/sheet%d.xml" % i, xml)


def main():
    project_root = os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
    out_path = os.path.join(project_root, "bh-video-template.xlsx")
    build_xlsx(out_path)
    size = os.path.getsize(out_path)
    print(
        "Wrote %s (%d bytes) at %s"
        % (out_path, size, datetime.now().isoformat(timespec="seconds"))
    )


if __name__ == "__main__":
    sys.exit(main())
