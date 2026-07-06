# Icelandic Football Match Predictor — Design

**Date:** 2026-07-06
**Status:** Draft for user review
**Inspired by:** [aziztitu/football-match-predictor](https://github.com/aziztitu/football-match-predictor)

## Goal

A public GitHub repo + Vercel-hosted website that predicts Icelandic football match
outcomes (home win / draw / away win) for **Besta deild karla** and **Lengjudeild karla**.
Two prediction modes:

1. **Pre-match:** pick home and away team → probabilities from team strength, form,
   and home advantage.
2. **Half-time update:** additionally enter the half-time score → updated probabilities.

A fun personal project, but genuinely usable during the 2026 season from a phone.

## Data sources

### 1. KSÍ match results (primary, historical)

Scraped from ksi.is tournament pages (server-rendered HTML, no API key needed).
Verified working on 2026-07-06; all 1,974 matches for 2019–2025 scraped and validated.

- **Tournament discovery:** `ksi.is/oll-mot/?name=<q>&season=<year>&pageSize=100`
- **Match lists:** `ksi.is/oll-mot/mot?id=<tid>&banner-tab=matches-and-results&page=<n>`
  (paginated, ~15 matches per page)
- **Official standings** (for validation): same URL with `banner-tab=overview`
- **Match events** (goal minutes → derive HT score; red cards with minutes):
  `ksi.is/leikir-og-urslit/felagslid/leikur?id=<match>` — events tab confirmed to exist;
  exact parsing to be validated early in implementation.

**League structure facts (verified against KSÍ official tables):**
- Top flight: *Pepsi Max deild karla* 2019–2021 (22 rounds), *Besta deild karla* from
  2022: 22 regular rounds + split into Efri/Neðri hluti (top 6 / bottom 6, 5 games each,
  points carry over; 27 games total). KSÍ lists the split phases as separate tournaments.
- Second tier: *Inkasso-deild karla* 2019, *Lengjudeild karla* from 2020; 22 rounds.
  Promotion playoffs (*Umspil*, 2023–2025) exist as separate tournaments; they are
  **excluded from league tables** but **included as training matches** with a
  phase flag, since they are competitive fixtures between known teams.
- 2026 season (ongoing, ~13–14 rounds played) will be scraped the same way.

**Known data quirks (discovered during verification):**
- Match cards can show a **0-0 placeholder** for abandoned/resumed matches. Two found and
  corrected via comparison with official standings: Valur 1–2 Stjarnan (2025),
  Þróttur R. 2–3 Leiknir R. (2024). The pipeline must validate computed tables against
  KSÍ's official standings wherever they exist and surface any new mismatch.
- 2019 Valur–ÍBV (card: 5–0): KSÍ's official table does not count it as a W/L for either
  side (disciplinary ruling; official rows sum to 21 games + adjusted points). Pending
  user adjudication; default: train on the 5–0 card result.
- KSÍ publishes **no standings tables** for Inkasso-deild 2019 and Lengjudeild 2020–2023;
  those seasons rely on computed tables (user spot-verified).
- Clubs without a crest render their full Comet name (e.g. "Kórdrengir Fullorðnir
  Karlar") — scraper strips the suffix.

### 2. SofaScore 2026 season data (user-provided, current-season enrichment)

Stored in `data-drops/` (to be moved into the repo's `data/` directory):
- `sofascore_team_stats_2026.json` — 53 team-level stats for all 12 Besta deild teams
  (goals, shots on target/game, big chances, possession, clean sheets, cards…).
- `Besta_deild_karla_Top_150_Players.xlsx` — top 150 players with ratings and
  detailed stats.

Used only for **current-season prediction enrichment and UI context** (attack/defence
profile per team, squad strength index), *not* as training features — no historical
equivalents exist. Covers Besta deild only. Requires a team-name mapping table
(SofaScore → KSÍ names, e.g. "Breidablik Kópavogur" → "Breiðablik").

## Architecture (Approach A: Python trains, JavaScript predicts)

```
icelandic-football-predictor/
├── data/                  # scraped CSVs + user-provided SofaScore data
├── scripts/               # Python pipeline (run locally, committed outputs)
│   ├── scrape_ksi.py      # results 2019–2026 + HT scores from match events
│   ├── build_features.py  # per-fixture features, no leakage
│   └── train.py           # compare LR / RF / NB, export winner to model/*.json
├── model/                 # exported model weights + team metadata (JSON)
├── web/                   # Next.js app → Vercel
└── README.md              # write-up in the spirit of the original repo
```

No backend at runtime: the site bundles the model JSON and computes probabilities
client-side (logistic regression inference is a dot product). Retraining = rerun
Python scripts, commit updated JSON, redeploy.

## Features & models

**Team strength:** Elo-style rating computed match-by-match over the full 2019–2026
history (handles promotion/relegation naturally; new teams start at league-tier
baseline). The SofaScore 2026 team profiles are **displayed as context** next to each
Besta deild team in the UI (attack/defence/rank); they do not feed the trained model.

**Pre-match features:** home/away Elo, Elo difference, recent form (points last 5),
goals for/against rate (last 5), home-advantage rate, league tier, head-to-head record.

**Half-time features:** all pre-match features + HT goal difference and HT scoreline
(derived from KSÍ goal-event minutes; red cards before HT if event data proves reliable).

**Models compared** (as in the original repo): Logistic Regression (one-vs-rest),
Random Forest, Gaussian Naive Bayes. **Time-based split:** train on 2019–2024,
test on 2025 (+2026 to date) — no future leakage. Export the best model per mode;
LR coefficients preferred for trivial JS inference, compact tree-dump JSON if RF
wins decisively (>3pp accuracy).

**Success criteria:** beat the always-predict-home-win baseline and the
bookmaker-free naive baseline (majority class ~45%); target ≥50% test accuracy
pre-match, ≥65% at half-time (the original hit 70% with richer in-match stats).

## Website (Next.js on Vercel)

Single page, mobile-first, English UI with Icelandic team/league names:
1. Pick league → pick home team, away team (dropdowns from model metadata).
2. See H/D/A probability bars + each team's current form/Elo and (Besta deild)
   SofaScore attack/defence context.
3. "Half-time?" toggle reveals HT score inputs → updated probabilities.

Edge cases: newly promoted teams with little history fall back to league-baseline
Elo with a "limited data" note. Unknown team pairs never error.

## Error handling

- Scraper: rate-limited (~0.6 s/request), retries, raw-HTML cache on disk so re-runs
  don't rehammer ksi.is; fails loudly (non-zero exit) on parse-count anomalies
  (e.g. a season with ≠132/162 matches or a team with unexpected game count).
- Standings validation is part of the pipeline: computed vs official tables where
  available; mismatches printed with the implicated fixture.
- Web app: pure client-side; the only failure mode is stale model JSON, shown via a
  "trained through <date>" stamp in the footer.

## Testing

- Unit tests: feature computation (form windows exclude the current match; Elo update
  math; no future leakage in training rows).
- Data tests: per-season match counts and games-per-team assertions; table-vs-official
  validation as above.
- Model sanity test: test accuracy > home-win baseline; probabilities sum to 1.
- Manual: deployed site spot-check on phone before calling it done.

## Out of scope (v1)

Women's leagues, cup matches, live minute-by-minute prediction, automatic weekly
retraining, player-level lineup features, betting-odds comparison.

## Open questions

1. 2019 Valur–ÍBV ruling: count as 5–0 win (current default) or mirror KSÍ's official
   non-result handling?
2. Half-time score derivation from KSÍ event minutes: feasibility to be confirmed in
   the first implementation task; if events are unreliable, the HT model falls back to
   HT score entered by the user at prediction time only (training on FT-only features
   would then drop the HT mode for the deploy — decision point mid-implementation).
