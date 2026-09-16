# Tenaball: progressive hints and fixed answer slots

## Behavior

- Each round has ten fixed slots. Answers may be entered in any order and appear in their actual slot.
- A selector chooses an unanswered slot. The hint button reveals, in order: first letter of the displayed full name; represented country for players / home country for clubs; club during the question's season / club's home city or town.
- Historical player questions use the club in that season, explicitly labeled “Félag á tímabilinu”. Multi-club seasons name both clubs. This was the stated default while the optional clarification was unanswered.
- Hints are free, capped at three per answer, stored with the round, and unavailable after a win/loss or for an already found answer.
- Existing blue/cyan/purple presentation, rotating 3D starball and pyramid remain.

## Ordering policy

The full generated, two-source answer sets remain untouched in `topp10/lists`. The Tenaball view derives exactly ten answers:

- League tables: official finishing positions.
- Scorers: goals descending; Icelandic alphabetical order by displayed name for ties.
- Champions: title count descending (both-era question uses the sum); same alphabetical tiebreak.
- Unranked team rosters: first ten alphabetically, explicitly stated in the rewritten question.
- Icelandic Golden Boot winners: first winning year ascending, then alphabetically.

Questions show the rule, including the ten-answer cutoff. Previous “all tied players count” copy is removed from the transformed view. Versioned save keys prevent old any-ten rounds from being interpreted under the new fixed-ten rules; old storage is left intact.

## Data maintenance

`hint-data.ts` holds stable geographical and represented-country metadata outside generated files. Season clubs for English questions come directly from verified `answer.detail`; the ten Icelandic Golden Boot clubs have a separate mapping. Coverage tests require three nonempty hints for every playable answer.

Supplementary source checks used:
- Garðar Gunnlaugsson / ÍA: https://www.ksi.is/library/Skrar/arsthing-KSi/Arsskyrsla-2017-KSI.pdf
- Andri Rúnar Bjarnason / Grindavík: https://www.ksi.is/leikmenn/leikmadur?id=25234
- Gary Martin's 2019 Valur–ÍBV transfer: https://www.visir.is/g/2019190609639/gary-martin-folk-vill-bara-einhverjar-brjalaedislegar-sogur
- Igor Thiago's represented country: https://www.premierleague.com/en/players/502500/igor-thiago/overview
- Hoffenheim's home city, Sinsheim: https://s3.tsg-hoffenheim.de/public/Downloads/SWEG-Fahrplan-Heidenheim-v2.pdf

## Validation

- Domain tests: staged clues, per-answer isolation, no life cost, terminal/found guards, persistence/corrupt saves, complete metadata, season clubs, fixed ranks, ties and accurate cutoff wording.
- Browser: Liverpool entered first appears at #3 in 2023/24 table; hint progression leaves lives unchanged; Haaland's three clues survive reload; second answer has its own hint count; loss removes controls and reveals answers in fixed slots.
- Responsive check at 390×844: no horizontal overflow; controls visible and usable. Desktop screenshot at 1280×1000.
- Independent code review found an outdated tie rule in inherited context; fixed with a failing regression assertion before the code change.
