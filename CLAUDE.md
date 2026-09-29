# Besta spáin

Next.js app in `web/`, Supabase project `imzqngcwykvqxzylhujf`, live at
https://islensk-fotbolti.vercel.app

## Read the vault first

Project memory lives in an Obsidian vault, not in this file:

```
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Besta spáin/
```

Start at `START HÉR.md`. It indexes where every data source lives and how to
pull it, the database schema and the write discipline, each model with the
numbers it was actually measured at, and — most usefully — `Lærdómur/Gildrur.md`,
a register of mistakes that have already cost time here. Several of them are
invisible until somebody measures: an unpaged Supabase read silently returns
1,000 rows of 140,000; substring name matching once put Paris Saint-Germain on
Paris FC without erroring.

Check it before searching the code, and add to it when you learn something the
next agent would otherwise rediscover.

## Three rules

1. **A push does not deploy.** Releasing needs
   `npx vercel deploy --prod --yes --scope eliasoli09s-projects` from `web/`.
2. **No service-role key, ever.** Every write goes through a secret-guarded
   `security definer` RPC. Never overwrite an existing one without reading its
   definition out of `supabase_migrations.schema_migrations` first.
3. **Measure, don't guess.** Walk-forward, hyperparameters chosen on an earlier
   slice and only then scored on a later one, paired confidence intervals, and
   benchmarked against both Elo and the bookmakers. That discipline has caught
   three false findings so far.

## Before deploying

`npm test && npm run build` from `web/`. The build type-checks; the tests do not.
A deploy ships the whole working tree, so check `git status` — another session
may be mid-change in this repo.
