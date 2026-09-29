#!/usr/bin/env python3
"""Generate seed SQL for season_standings (1912-1984) and champions (1912-2025)."""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'data' / 'seed'
OUT = SEED / 'sql'
q = lambda s: "'" + str(s).replace("'", "''") + "'"
clean = lambda s: re.sub(r'\s+Fullorðnir\s+(Karlar|Konur)$', '', s.strip())

def main():
    rows = [r for r in csv.DictReader(open(SEED / 'standings_1912_1984.csv'))]
    champs = {int(k): v for k, v in json.load(open(SEED / 'champions.json')).items()
              if not k.startswith('_')}
    teams = sorted({clean(r['team']) for r in rows} | set(champs.values()))

    with open(OUT / '07_standings.sql', 'w') as f:
        f.write('insert into teams (name) values\n')
        f.write(',\n'.join(f'({q(t)})' for t in teams))
        f.write('\non conflict (name) do nothing;\n\n')
        f.write('insert into season_standings (season, position, team_id, played, won, drawn, lost, gf, ga)\n')
        f.write("select v.season, v.pos, t.id, v.p, v.w, v.d, v.l, v.gf, v.ga\nfrom (values\n")
        f.write(',\n'.join(
            f"({r['season']}, {r['pos']}, {q(clean(r['team']))}, {r['p']}, {r['w']}, {r['d']}, {r['l']}, {r['gf']}, {r['ga']})"
            for r in rows))
        f.write('\n) as v(season, pos, team, p, w, d, l, gf, ga)\n')
        f.write('join teams t on t.name = v.team\n')
        f.write('on conflict (season, team_id) do nothing;\n\n')
        f.write('insert into champions (season, team_id)\n')
        f.write('select v.season, t.id from (values\n')
        f.write(',\n'.join(f'({s}, {q(c)})' for s, c in sorted(champs.items())))
        f.write('\n) as v(season, team) join teams t on t.name = v.team\n')
        f.write('on conflict (season) do update set team_id = excluded.team_id;\n')
    print(len(rows), 'standings rows,', len(champs), 'champions,', len(teams), 'teams')

if __name__ == '__main__':
    main()
