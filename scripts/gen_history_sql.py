#!/usr/bin/env python3
"""Generate SQL for the 1912-2018 top-flight history from the scraped CSV.
Outputs data/seed/sql/05_history_teams.sql and 06a/06b/06c_history_matches.sql
(matches joined to teams by name so no id mapping is needed)."""
import csv, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'seed' / 'sql'
q = lambda s: "'" + str(s).replace("'", "''") + "'"

def main(csv_path):
    rows = list(csv.DictReader(open(csv_path)))
    teams = sorted({r['home'] for r in rows} | {r['away'] for r in rows})
    with open(OUT / '05_history_teams.sql', 'w') as f:
        f.write('insert into teams (name) values\n')
        f.write(',\n'.join(f'({q(t)})' for t in teams))
        f.write('\non conflict (name) do nothing;\n')

    def emit(chunk, name):
        with open(OUT / name, 'w') as f:
            f.write('insert into matches (id, season, league, phase, date, venue, home_team, away_team, home_goals, away_goals, status)\n')
            f.write('select v.ksi_id, v.season, \'besta\', v.phase, nullif(v.d,\'\')::timestamptz, nullif(v.venue,\'\'), th.id, ta.id, v.hg, v.ag, \'played\'\nfrom (values\n')
            f.write(',\n'.join(
                f"({r['ksi_id']}, {r['season']}, {q(r['phase'])}, {q(r['date'])}, {q(r['venue'])}, {q(r['home'])}, {q(r['away'])}, {r['hg']}, {r['ag']})"
                for r in chunk))
            f.write('\n) as v(ksi_id, season, phase, d, venue, home, away, hg, ag)\n')
            f.write('join teams th on th.name = v.home\njoin teams ta on ta.name = v.away\n')
            f.write('on conflict (id) do nothing;\n')

    third = (len(rows) + 2) // 3
    emit(rows[:third], '06a_history_matches.sql')
    emit(rows[third:2*third], '06b_history_matches.sql')
    emit(rows[2*third:], '06c_history_matches.sql')
    print(f'{len(teams)} teams, {len(rows)} matches → 4 SQL files')

if __name__ == '__main__':
    main(sys.argv[1])
