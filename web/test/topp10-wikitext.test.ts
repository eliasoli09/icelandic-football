import { describe, it, expect } from 'vitest'
import { plain, plainList, splitTop, sportsTables, readSportsTable, tableAfter, dataRows } from '../scripts/topp10/wikitext'

describe('plain', () => {
  it('keeps the label of a piped link and drops flags', () => {
    expect(plain("{{flagicon|DEN}} [[Nikolaj Hansen (footballer, born 1993)|Nikolaj Hansen]]")).toBe('Nikolaj Hansen')
    expect(plain('{{#invoke:flag|icon|NOR}} [[Erling Haaland]]')).toBe('Erling Haaland')
    expect(plain("{{nowrap|[[Paris Saint-Germain FC|Paris Saint-Germain]]}}")).toBe('Paris Saint-Germain')
  })

  it('removes bold and references', () => {
    expect(plain("'''133'''<ref name=x>{{cite web|url=a}}</ref>")).toBe('133')
  })

  it('splits people who share a cell', () => {
    expect(plainList('{{flagicon|ISL}} [[Nökkvi Þeyr Þórisson]]<br>{{flagicon|ISL}} [[Guðmundur Magnússon]]'))
      .toEqual(['Nökkvi Þeyr Þórisson', 'Guðmundur Magnússon'])
  })
})

describe('splitTop', () => {
  it('does not split inside links or templates', () => {
    expect(splitTop('a|[[b|c]]|{{d|e}}', '|')).toEqual(['a', '[[b|c]]', '{{d|e}}'])
  })
})

describe('sports table', () => {
  // the parser this replaces stopped at the "|" inside [[X|Y]]
  it('reads a team_order table with piped names and deductions', () => {
    const wt = `{{#invoke:Sports table|main|style=WDL
|team_order=VÍK, FH , POR
|win_VÍK=17|draw_VÍK=5|loss_VÍK=5|gf_VÍK=60|ga_VÍK=30
|name_VÍK=[[Knattspyrnufélagið Víkingur|Víkingur Reykjavík]]
|win_FH =10|draw_FH =5|loss_FH =12|gf_FH =40|ga_FH =45
|win_POR=7|draw_POR=7|loss_POR=24|gf_POR=34|ga_POR=66|adjust_points_POR=−9
|name_POR={{nowrap|[[Portsmouth F.C.|Portsmouth]]}}
}}`
    const rows = readSportsTable(sportsTables(wt)[0])
    expect(rows.map((r) => r.name)).toEqual(['Víkingur Reykjavík', 'FH', 'Portsmouth'])
    expect(rows[0].pts).toBe(56)
    expect(rows[2].pts).toBe(19)
  })

  it('ignores editor comments inside the arguments', () => {
    const wt = `{{#invoke:Sports table|main
|team_order=A, B

<!--Update team qualifications here (defined below)-->
|win_A=1|draw_A=0|loss_A=0|gf_A=1|ga_A=0 <!-- Matchday 3 -->
|win_B=0|draw_B=0|loss_B=1|gf_B=0|ga_B=1
}}`
    expect(readSportsTable(sportsTables(wt)[0]).map((r) => `${r.code}:${r.pts}`)).toEqual(['A:3', 'B:0'])
  })

  it('reads the team1=, team2= layout in numeric order', () => {
    const wt = `{{#invoke:Sports table|main
|team2=B|team1=A|team10=C
|win_A=1|draw_A=0|loss_A=0|gf_A=1|ga_A=0
|win_B=0|draw_B=1|loss_B=0|gf_B=0|ga_B=0
|win_C=0|draw_C=0|loss_C=1|gf_C=0|ga_C=1
}}`
    expect(readSportsTable(sportsTables(wt)[0]).map((r) => r.code)).toEqual(['A', 'B', 'C'])
  })

  it('refuses a table with a missing figure rather than inventing one', () => {
    const wt = `{{#invoke:Sports table|main|team_order=A|win_A=1|draw_A=0|gf_A=1|ga_A=0}}`
    expect(() => readSportsTable(sportsTables(wt)[0])).toThrow(/loss_A/)
  })
})

describe('wikitableRows', () => {
  it('fills a rowspan tie into every row it covers', () => {
    const wt = `== Top scorers ==
{| class="wikitable"
|-
!Rank
!Player
!Goals
|-
|3
|[[Alexander Isak]]
|21
|-
|rowspan="3"|4
|align="left"|[[Phil Foden]]
|rowspan="3"|19
|-
|align="left"|[[Dominic Solanke]]
|-
|align="left"|[[Ollie Watkins]]
|}`
    const rows = dataRows(tableAfter(wt, 'Top scorers')).map((r) => r.map(plain))
    expect(rows).toEqual([
      ['3', 'Alexander Isak', '21'],
      ['4', 'Phil Foden', '19'],
      ['4', 'Dominic Solanke', '19'],
      ['4', 'Ollie Watkins', '19'],
    ])
  })

  it('handles inline cells, row headers and blank rank cells', () => {
    const wt = `{| class="wikitable"
|-
! Röð !! Sigurlið !! Titlar
|-
| 3-4 || [[Liverpool (knattspyrnufélag)|Liverpool]] || 6
|-
|  || [[Bayern München]] || 6
|-
! scope="row" | {{fbaicon|ESP}} [[Real Madrid CF|Real Madrid]]
| 15
|}`
    const rows = dataRows(tableAfter(wt, '{|')).map((r) => r.map(plain))
    expect(rows).toEqual([['3-4', 'Liverpool', '6'], ['', 'Bayern München', '6'], ['Real Madrid', '15']])
  })

  it('keeps a multi-line cell together', () => {
    const wt = `{| class="wikitable"
|-
|1981
|Sigurlás Þorleifsson
Larus Gudmundsson
|''12''
|}`
    const [row] = dataRows(tableAfter(wt, '{|'))
    expect(plainList(row[1])).toEqual(['Sigurlás Þorleifsson', 'Larus Gudmundsson'])
    expect(plain(row[2])).toBe('12')
  })

  it('does not read a link pipe as an attribute separator', () => {
    const wt = `{| class="wikitable"
|-
|[[Knattspyrnufélag Reykjavíkur|KR]]||27
|}`
    expect(dataRows(tableAfter(wt, '{|')).map((r) => r.map(plain))).toEqual([['KR', '27']])
  })
})
