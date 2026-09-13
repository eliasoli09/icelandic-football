'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { formatUefaNumber, probabilityLabel, probabilityWidth, sortStandings, type StandingsSort, type SortDirection, type SortableStanding } from '@/lib/uefaDisplay'
import styles from './Uefa.module.css'

export interface UefaStanding extends SortableStanding {
  assoc?: string
  rated?: boolean
  /** UEFA's own country coefficient, shown beside the rating; feeds nothing */
  coefficient?: number | null
  coefficientRank?: number | null
}
const columns: {key:StandingsSort;label:string}[] = [
  {key:'rank',label:'#'}, {key:'club',label:'Lið'}, {key:'rating',label:'Einkunn / UEFA'},
  {key:'proj_points',label:'Stig'}, {key:'p_top8',label:'8 efstu'},
  {key:'p_playoff',label:'Umspil'}, {key:'p_out',label:'Úr leik'},
]

export function UefaStandings({ rows }: { rows: UefaStanding[] }) {
  const [sort,setSort] = useState<{key:StandingsSort;direction:SortDirection}>({key:'proj_points',direction:'desc'})
  const sorted = useMemo(()=>sortStandings(rows,sort.key,sort.direction),[rows,sort])
  function select(key: StandingsSort) {
    setSort(current=>({key,direction:current.key===key ? current.direction==='asc'?'desc':'asc' : key==='club'||key==='rank'?'asc':'desc'}))
  }
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Spáð lokastaða — skrunanleg tafla">
    <table className={styles.standings}>
      <caption className="sr-only">Spáð lokastaða allra {rows.length} liða. Prósentustikur nota sameiginlegan kvarða frá 0 til 100%. Raða má með dálkahausunum.</caption>
      <thead><tr>{columns.map(({key,label})=><th key={key} scope="col" aria-sort={sort.key===key ? sort.direction==='asc'?'ascending':'descending':'none'}>
        <button onClick={()=>select(key)} aria-label={`Raða eftir ${label==='#'?'sæti':label}`}>
          {label}{sort.key===key ? sort.direction==='asc'?<ArrowUp size={11}/>:<ArrowDown size={11}/>:<ChevronsUpDown size={11}/>}
        </button>
      </th>)}</tr></thead>
      <tbody data-rank-order={sort.key==='proj_points' && sort.direction==='desc' || sort.key==='rank' && sort.direction==='asc'}>{sorted.map(row=><tr key={row.club} tabIndex={0}>
        <td>{row.rank}</td>
        <th scope="row"><span className={styles.clubName}>{row.club}</span> <span className={styles.assoc}>{row.assoc}</span>
          {row.rated===false && <span className={styles.estimate} title="Félagið er ekki í einkunnagrunni; notast er við styrk deildarinnar.">metið af deild</span>}
        </th>
        <td>
          {formatUefaNumber(row.rating)}
          {row.coefficient != null && <span className={styles.coefficient}
            title={`Stuðull UEFA fyrir landið, fimm tímabil${row.coefficientRank ? ` — ${row.coefficientRank}. sæti` : ''}. Hann hefur engin áhrif á spána.`}>
            {row.coefficient.toFixed(1)}
          </span>}
        </td><td>{formatUefaNumber(row.proj_points,1)}</td>
        {(['p_top8','p_playoff','p_out'] as const).map((key,i)=><td key={key}>
          <span className={styles.probability} data-outcome={i}>
            <span className={styles.track} aria-hidden="true"><span style={{width:`${probabilityWidth(row[key])}%`}} /></span>
            <span>{probabilityLabel(row[key])}</span>
          </span>
        </td>)}
      </tr>)}</tbody>
    </table>
    {!rows.length && <p className={styles.empty}>Hermispá birtist hér þegar gögnin hafa verið reiknuð.</p>}
  </div>
}
