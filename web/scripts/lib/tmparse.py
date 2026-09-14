"""A tolerant table reader for Transfermarkt pages.

Their rows nest whole tables inside a cell, so a regex for <tr>...</tr> stops at
the first inner </tr> and returns a third of the row. This walks the document
with the standard library parser and keeps a depth counter, so a nested table
belongs to its cell instead of ending the row it sits in.
"""
from html.parser import HTMLParser


class TableReader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0            # table nesting
        self.rows = []            # rows of the outermost table only
        self._row = None
        self._cell = None
        self._cell_depth = 0
        self._links = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.depth += 1
        elif tag == "tr" and self.depth == 1:
            self._row, self._links = [], []
        elif tag == "td" and self.depth == 1 and self._row is not None:
            self._cell, self._cell_depth = [], 0
        elif tag == "a" and self._links is not None:
            href = a.get("href", "")
            if href:
                self._links.append(href)
        elif tag == "img" and self._cell is not None:
            t = a.get("title") or a.get("alt")
            if t:
                self._cell.append(t)

    def handle_endtag(self, tag):
        if tag == "table":
            self.depth -= 1
        elif tag == "td" and self.depth == 1 and self._cell is not None:
            text = " ".join(" ".join(self._cell).split())
            self._row.append(text)
            self._cell = None
        elif tag == "tr" and self.depth == 1 and self._row is not None:
            if self._row:
                self.rows.append({"cells": self._row, "links": self._links or []})
            self._row, self._links = None, None

    def handle_data(self, data):
        if self._cell is not None:
            s = data.strip()
            if s:
                self._cell.append(s)


def read_rows(html):
    """Rows of the page's widest top-level table, as cells plus the links in them."""
    best = []
    for chunk in _top_level_tables(html):
        r = TableReader()
        r.feed(chunk)
        if len(r.rows) > len(best):
            best = r.rows
    return best


def _top_level_tables(html):
    out, i = [], 0
    while True:
        start = html.find("<table", i)
        if start < 0:
            return out
        depth, j = 0, start
        while j < len(html):
            nt = html.find("<table", j)
            ct = html.find("</table", j)
            if ct < 0:
                return out
            if 0 <= nt < ct:
                depth += 1
                j = nt + 6
            else:
                depth -= 1
                j = ct + 7
                if depth == 0:
                    out.append(html[start:j])
                    i = j
                    break
        else:
            return out
