/**
 * Turn the soccer-dataset parquet files into the CSVs the backtest reads.
 * Downloads from Hugging Face (eatpizzanot/soccer-dataset) on first run.
 *
 * Needs python3 with pyarrow (`python3 -m pip install pyarrow`).
 * Usage: cd web && npx tsx scripts/export-backtest-data.mts [outDir]
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = process.argv[2] ?? '/private/tmp/claude-501/-Users-elias-FH-leikmenn-/5a1239f1-ef56-4f70-95e0-a2d6c66305c7/scratchpad/sd'
const BASE = 'https://huggingface.co/datasets/eatpizzanot/soccer-dataset/resolve/main'
mkdirSync(OUT, { recursive: true })

for (const f of ['fixtures', 'odds', 'leagues']) {
  const path = join(OUT, `${f}.parquet`)
  if (existsSync(path)) { console.log(`${f}.parquet er þegar til`); continue }
  console.log(`sæki ${f}.parquet …`)
  execFileSync('curl', ['-sL', `${BASE}/${f}.parquet`, '-o', path])
}

// Pinnacle CLOSING only — the sharpest benchmark. known_at is the dataset's
// leakage guard; rows timed after kickoff are dropped rather than trusted.
const py = `
import pyarrow.parquet as pq, csv, os
OUT = ${JSON.stringify(OUT)}
fx = pq.read_table(os.path.join(OUT,'fixtures.parquet')).to_pydict()
od = pq.read_table(os.path.join(OUT,'odds.parquet')).to_pydict()
lg = pq.read_table(os.path.join(OUT,'leagues.parquet')).to_pydict()

date = {}
rows = []
for i in range(len(fx['id'])):
    d = fx['date_utc'][i]
    date[fx['id'][i]] = d
    if not fx['is_played'][i] or d is None: continue
    if fx['goals_home'][i] is None or fx['goals_away'][i] is None: continue
    rows.append((fx['id'][i], str(d)[:10], fx['league_id'][i], fx['home_team_id'][i],
                 fx['away_team_id'][i], fx['goals_home'][i], fx['goals_away'][i]))
rows.sort(key=lambda r: (r[1], r[0]))
with open(os.path.join(OUT,'bt_fixtures.csv'),'w',newline='') as f:
    w = csv.writer(f); w.writerow(['id','date','league','home','away','gh','ga']); w.writerows(rows)

kept = dropped = 0
with open(os.path.join(OUT,'bt_odds.csv'),'w',newline='') as f:
    w = csv.writer(f); w.writerow(['fixture_id','h','d','a'])
    for i in range(len(od['fixture_id'])):
        if od['bookmaker'][i] != 'Pinnacle' or od['source'][i] != 'API-Football-closing': continue
        h, dr, a = od['home_win'][i], od['draw'][i], od['away_win'][i]
        if not h or not dr or not a: continue
        ka, fd = od['known_at'][i], date.get(od['fixture_id'][i])
        if ka is None or (fd is not None and ka > fd): dropped += 1; continue
        w.writerow([od['fixture_id'][i], h, dr, a]); kept += 1

with open(os.path.join(OUT,'bt_leagues.csv'),'w',newline='') as f:
    w = csv.writer(f); w.writerow(['id','name','country'])
    for i in range(len(lg['id'])): w.writerow([lg['id'][i], lg['name'][i], lg['country'][i]])

print(f'leikir {len(rows)}  stuðlar {kept}  hent vegna known_at {dropped}  deildir {len(lg["id"])}')
`
console.log(execFileSync('python3', ['-c', py], { encoding: 'utf-8' }).trim())
