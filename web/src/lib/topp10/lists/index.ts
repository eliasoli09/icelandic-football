// Written by scripts/topp10/build.mts: only lists whose two sources agreed.
import type { Topp10List } from '../types'
import enska_lokastada_2009 from './enska-lokastada-2009.json'
import enska_lokastada_2023 from './enska-lokastada-2023.json'
import enska_lokastada_2024 from './enska-lokastada-2024.json'
import enska_lokastada_2025 from './enska-lokastada-2025.json'
import enska_markahaestir_2023 from './enska-markahaestir-2023.json'
import enska_markahaestir_2025 from './enska-markahaestir-2025.json'
import evropa_evropudeild from './evropa-evropudeild.json'
import evropa_meistaradeild from './evropa-meistaradeild.json'
import evropa_titlar from './evropa-titlar.json'
import island_lokastada_2024 from './island-lokastada-2024.json'
import island_lokastada_2025 from './island-lokastada-2025.json'
import island_markakongar from './island-markakongar.json'
import island_titlar from './island-titlar.json'

export const LISTS = [enska_lokastada_2009, enska_lokastada_2023, enska_lokastada_2024, enska_lokastada_2025, enska_markahaestir_2023, enska_markahaestir_2025, evropa_evropudeild, evropa_meistaradeild, evropa_titlar, island_lokastada_2024, island_lokastada_2025, island_markakongar, island_titlar] as Topp10List[]
