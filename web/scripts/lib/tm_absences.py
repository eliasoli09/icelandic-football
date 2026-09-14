"""Who is unavailable, for the eight leagues the site covers.

Transfermarkt is the one source for this that permits reading: understat
disallows crawling outright, fbref sits behind a bot challenge, and sofascore
refuses. Its robots.txt allows all agents, and this waits between requests
anyway.

Two pages per club: the squad, for each player's market value, and the
injury-and-suspension list. A club's "missing share" is the share of its squad
value that will not be available.

Market value is NOT the same measure as the expected-involvement share the
Premier League model uses — across the 20 Premier League clubs the two
correlate at only r = 0.32, because value counts defenders and goalkeepers that
attacking output scores at nearly zero. They are recorded separately and the
difference is not papered over.

Usage: python3 scripts/lib/tm_absences.py [output.json]
"""
import json, os, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tmparse import read_rows

CACHE = os.environ.get("TM_CACHE", "/tmp/tm-cache")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
PAUSE = 1.5

LEAGUES = [
    ("premier", "GB1"), ("championship", "GB2"), ("laliga", "ES1"),
    ("seriea", "IT1"), ("bundesliga", "L1"), ("ligue1", "FR1"),
    ("eredivisie", "NL1"), ("primeira", "PO1"),
]


def fetch(url, cache_name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path) and os.path.getsize(path) > 2000:
        return open(path, encoding="utf-8", errors="ignore").read()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=40) as r:
        html = r.read().decode("utf-8", "ignore")
    open(path, "w", encoding="utf-8").write(html)
    time.sleep(PAUSE)
    return html


def money(text):
    """'€45.00m' -> 45000 (thousands of euros). Returns 0 when there is no figure."""
    m = re.search(r"€\s*([\d.,]+)\s*(bn|m|k)?", text or "", re.I)
    if not m:
        return 0.0
    value = float(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").lower()
    return value * 1_000_000 if unit == "bn" else value * 1000 if unit == "m" else value if unit == "k" else value / 1000


def player_id(links):
    for href in links:
        m = re.search(r"/profil/spieler/(\d+)", href)
        if m:
            return m.group(1)
    return None


def clubs_in(code):
    html = fetch(
        f"https://www.transfermarkt.com/x/startseite/wettbewerb/{code}/plus/?saison_id=2026",
        f"league_{code}.html",
    )
    found = {}
    for m in re.finditer(r"/([a-z0-9-]+)/startseite/verein/(\d+)", html):
        found.setdefault(m.group(2), m.group(1))
    return found


DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def tidy_name(cell):
    """Pull the player's name out of Transfermarkt's player cell.

    The cell holds the name twice and then the position — 'Pedri Pedri
    Midfield' — and for a player on loan it puts the parent club first:
    'SS Lazio Ivan Provedel Ivan Provedel Goalkeeper'. So the name is the
    longest run of words that repeats immediately, wherever it starts.
    """
    words = re.sub(r"\s+", " ", cell or "").strip().split()
    best = ""
    for start in range(len(words)):
        for k in range((len(words) - start) // 2, 0, -1):
            if words[start:start + k] == words[start + k:start + 2 * k]:
                if k * 2 > len(best.split()):
                    best = " ".join(words[start:start + k])
                break
    return best or " ".join(words[:3])


def club_absences(club_id, slug):
    squad = read_rows(fetch(
        f"https://www.transfermarkt.com/{slug}/kader/verein/{club_id}/saison_id/2026",
        f"squad_{club_id}.html"))
    value, name_of = {}, {}
    for row in squad:
        pid = player_id(row["links"])
        if not pid:
            continue
        value[pid] = next((money(c) for c in reversed(row["cells"]) if "€" in c), 0.0)
        name_of[pid] = row["cells"][1] if len(row["cells"]) > 1 else ""

    # The injury table's columns are fixed: player, age, reason, since,
    # expected return, matches missed. Searching the cells instead of indexing
    # them put a loan club in the name and the name in the reason.
    absent = []
    for row in read_rows(fetch(
        f"https://www.transfermarkt.com/{slug}/sperrenundverletzungen/verein/{club_id}",
        f"inj_{club_id}.html")):
        pid = player_id(row["links"])
        cells = row["cells"]
        if not pid or len(cells) < 5:      # the Injuries/Suspensions headings
            continue
        since, until = cells[3], cells[4]
        absent.append({
            "player_id": pid,
            "name": tidy_name(cells[0]) or tidy_name(name_of.get(pid, "")),
            "reason": cells[2].strip(),
            "since": since if DATE.match(since) else None,
            "until": until if DATE.match(until) else None,
            "value": round(value.get(pid, 0.0)),
        })

    total = sum(value.values())
    missing = sum(a["value"] for a in absent)
    return {
        "squad_size": len(value),
        "squad_value": round(total),
        "missing_value": round(missing),
        "missing_share": round(missing / total, 4) if total else 0.0,
        "absent": absent,
    }


def main():
    out = {"captured": time.strftime("%Y-%m-%d"), "source": "transfermarkt.com", "clubs": {}}
    for league, code in LEAGUES:
        clubs = clubs_in(code)
        print(f"{league}: {len(clubs)} félög", file=sys.stderr)
        for cid, slug in clubs.items():
            try:
                info = club_absences(cid, slug)
            except Exception as err:                     # one club must not stop the run
                print(f"  {slug}: {err}", file=sys.stderr)
                continue
            info["league"] = league
            info["slug"] = slug
            out["clubs"][f"{league}|{slug}"] = info
            print(f"  {slug:<30} {info['squad_size']:>2} leikmenn, "
                  f"{len(info['absent']):>2} fjarverandi, {100 * info['missing_share']:>5.1f}%",
                  file=sys.stderr)
    target = sys.argv[1] if len(sys.argv) > 1 else "absences.json"
    json.dump(out, open(target, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nskrifað: {target}  ({len(out['clubs'])} félög)", file=sys.stderr)


if __name__ == "__main__":
    main()
