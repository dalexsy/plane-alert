import { ENGINE_ICON_INFO_MAP, PlaneIconData, TWIN_ENGINE_SVG } from '../plane-icon-paths/plane-icon-paths';

export const ENGINE_MODEL_MAPPINGS =       [
        {
          engines: 4,
          patterns: [
            'b747',
            'b74',
            '747',
            '744',
            '748', // Boeing 747 variants
            'a380',
            'a388', // Airbus A380
            'a340',
            'a340-200',
            'a340-300',
            'a340-500',
            'a340-600', // Airbus A340 variants
            'c130',
            'c30j',
            'l100', // Lockheed C-130 Hercules / L-100
            'il76', // Ilyushin Il-76
            'an124', // Antonov An-124
            'an22', // Antonov An-22
            'c5', // Lockheed C-5 Galaxy
            'b707',
            '707', // Boeing 707
            'dc8', // Douglas DC-8
            'c17',
            'c-17',
            'globemaster',
            'bae146',
            'avro rj',
            'avro rj85',
            'avro rj100', // Bae 146/Avro RJ
          ],
        },
        {
          engines: 3,
          patterns: [
            'dc10',
            'md11',
            'l1011',
            'tu154', // Classic tri-jets
            'falcon 900',
            'fa900',
            'falcon 7x',
            'fa7x',
            'falcon 8x',
            'fa8x', // Dassault Falcon tri-jets
          ],
        },
        {
          engines: 2,
          patterns: [
            'a300',
            'a310', // Airbus A300/A310
            'a318',
            'a319',
            'a320',
            'a321', // Airbus A320 family
            'a330', // Airbus A330
            'a350', // Airbus A350
            'b737',
            'b738',
            'b736',
            'b731',
            'b732',
            'b733',
            'b734',
            'b735',
            'b739', // Boeing 737 variants
            'b757',
            '757', // Boeing 757
            'b767',
            '767', // Boeing 767
            'b777',
            'b772',
            'b773',
            'b77l',
            'b77w', // Boeing 777 variants
            'b787',
            '787', // Boeing 787
            'dh8',
            'dash8',
            'q400',
            'q200',
            'q300', // De Havilland Canada Dash 8 / Bombardier Q-Series
            'atr42',
            'atr72', // ATR 42/72
            'crj',
            'crj2',
            'crj7',
            'crj9',
            'cl60', // Bombardier CRJ series (CRJ200, CRJ700, CRJ900)
            'e170',
            'e175',
            'e190',
            'e195',
            'emb170',
            'emb175',
            'emb190',
            'emb195', // Embraer E-Jet family
            'erj135',
            'erj140',
            'erj145', // Embraer ERJ family
            'b200',
            'be20',
            'be9l',
            'king air', // Beechcraft King Air series
            'g650',
            'glf5',
            'glf6',
            'glex',
            'gulfstream', // Gulfstream large jets
            'falcon',
            'fa7x',
            'fa8x',
            'fa900',
            'fa2000', // Dassault Falcon (Note: some Falcons are tri-jets, this is a simplification)
            'md80',
            'md81',
            'md82',
            'md83',
            'md87',
            'md88',
            'md90', // McDonnell Douglas MD-80/MD-90
            'dc9', // Douglas DC-9
            'fokker 70',
            'f70',
            'fokker 100',
            'f100', // Fokker 70/100
            'tu154', // Tupolev Tu-154 (Tri-jet, but often grouped with twins for simplicity in icons)
            'l1011', // Lockheed L-1011 Tristar (Tri-jet)
            'dc10',
            'md11', // Douglas DC-10 / MD-11 (Tri-jet)
          ],
        },
        {
          engines: 1,
          patterns: [
            'c150',
            'c152',
            'c172',
            'c182',
            'c206',
            'c208',
            'cessna', // Cessna single-engine
            'pa28',
            'pa32',
            'pa46',
            'piper', // Piper single-engine
            'sr20',
            'sr22',
            'cirrus', // Cirrus single-engine
            'pc12', // Pilatus PC-12
            'tbm', // Daher TBM series
            'bonanza',
            'be35',
            'be36', // Beechcraft Bonanza
            'mooney', // Mooney M20
            'diamond da20',
            'da20',
            'diamond da40',
            'da40', // Diamond DA20/DA40,
            'PILATUS',
            'shark',
          ],
        },
      ];;

export function matchEngineModel(m: string): PlaneIconData | undefined {
  for (const { engines, patterns } of ENGINE_MODEL_MAPPINGS) {
    if (patterns.some((p) => m.includes(p)) && ENGINE_ICON_INFO_MAP[engines]) return ENGINE_ICON_INFO_MAP[engines];
  }
  return undefined;
}
