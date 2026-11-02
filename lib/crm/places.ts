/** Provincias y ciudades frecuentes → provincia, para leer origen/destino en mensajes. */
import { stripAccents } from './normalize'

export const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
] as const

export type Province = (typeof PROVINCES)[number]

/** nombre como aparece en el texto (sin acentos, minúsculas) → [nombre lindo, provincia] */
const PLACES: [string, string, Province][] = [
  // Ciudades primero (más específicas que la provincia)
  ['capital federal', 'CABA', 'CABA'], ['caba', 'CABA', 'CABA'], ['ciudad de buenos aires', 'CABA', 'CABA'],
  ['villa angela', 'Villa Ángela', 'Chaco'], ['resistencia', 'Resistencia', 'Chaco'], ['saenz pena', 'Sáenz Peña', 'Chaco'],
  ['san salvador de jujuy', 'San Salvador de Jujuy', 'Jujuy'],
  ['san miguel de tucuman', 'San Miguel de Tucumán', 'Tucumán'],
  ['san fernando del valle', 'Catamarca', 'Catamarca'],
  ['cipolletti', 'Cipolletti', 'Río Negro'], ['bariloche', 'Bariloche', 'Río Negro'], ['general roca', 'General Roca', 'Río Negro'], ['viedma', 'Viedma', 'Río Negro'],
  ['esquel', 'Esquel', 'Chubut'], ['trelew', 'Trelew', 'Chubut'], ['comodoro rivadavia', 'Comodoro Rivadavia', 'Chubut'], ['puerto madryn', 'Puerto Madryn', 'Chubut'],
  ['rio gallegos', 'Río Gallegos', 'Santa Cruz'], ['ushuaia', 'Ushuaia', 'Tierra del Fuego'],
  ['posadas', 'Posadas', 'Misiones'], ['obera', 'Oberá', 'Misiones'], ['eldorado', 'Eldorado', 'Misiones'],
  ['parana', 'Paraná', 'Entre Ríos'], ['concordia', 'Concordia', 'Entre Ríos'], ['gualeguaychu', 'Gualeguaychú', 'Entre Ríos'],
  ['rosario', 'Rosario', 'Santa Fe'], ['rafaela', 'Rafaela', 'Santa Fe'], ['venado tuerto', 'Venado Tuerto', 'Santa Fe'], ['reconquista', 'Reconquista', 'Santa Fe'],
  ['villa maria', 'Villa María', 'Córdoba'], ['rio cuarto', 'Río Cuarto', 'Córdoba'], ['san francisco', 'San Francisco', 'Córdoba'],
  ['mar del plata', 'Mar del Plata', 'Buenos Aires'], ['bahia blanca', 'Bahía Blanca', 'Buenos Aires'], ['la plata', 'La Plata', 'Buenos Aires'],
  ['san pedro', 'San Pedro', 'Buenos Aires'], ['san nicolas', 'San Nicolás', 'Buenos Aires'], ['pilar', 'Pilar', 'Buenos Aires'],
  ['zarate', 'Zárate', 'Buenos Aires'], ['campana', 'Campana', 'Buenos Aires'], ['pergamino', 'Pergamino', 'Buenos Aires'],
  ['tandil', 'Tandil', 'Buenos Aires'], ['junin', 'Junín', 'Buenos Aires'], ['olavarria', 'Olavarría', 'Buenos Aires'],
  ['mercado central', 'Mercado Central', 'Buenos Aires'], ['gba', 'GBA', 'Buenos Aires'], ['amba', 'AMBA', 'Buenos Aires'],
  ['san rafael', 'San Rafael', 'Mendoza'], ['villa mercedes', 'Villa Mercedes', 'San Luis'],
  ['santa rosa', 'Santa Rosa', 'La Pampa'], ['clorinda', 'Clorinda', 'Formosa'], ['goya', 'Goya', 'Corrientes'],
  ['oran', 'Orán', 'Salta'], ['tartagal', 'Tartagal', 'Salta'], ['chilecito', 'Chilecito', 'La Rioja'],
  ['termas de rio hondo', 'Termas de Río Hondo', 'Santiago del Estero'],
  // Provincias (y capitales homónimas)
  ['santiago del estero', 'Santiago del Estero', 'Santiago del Estero'],
  ['tierra del fuego', 'Tierra del Fuego', 'Tierra del Fuego'],
  ['buenos aires', 'Buenos Aires', 'Buenos Aires'], ['bs as', 'Buenos Aires', 'Buenos Aires'], ['bsas', 'Buenos Aires', 'Buenos Aires'],
  ['catamarca', 'Catamarca', 'Catamarca'], ['chaco', 'Chaco', 'Chaco'], ['chubut', 'Chubut', 'Chubut'],
  ['cordoba', 'Córdoba', 'Córdoba'], ['corrientes', 'Corrientes', 'Corrientes'], ['entre rios', 'Entre Ríos', 'Entre Ríos'],
  ['formosa', 'Formosa', 'Formosa'], ['jujuy', 'Jujuy', 'Jujuy'], ['la pampa', 'La Pampa', 'La Pampa'],
  ['la rioja', 'La Rioja', 'La Rioja'], ['mendoza', 'Mendoza', 'Mendoza'], ['misiones', 'Misiones', 'Misiones'],
  ['neuquen', 'Neuquén', 'Neuquén'], ['rio negro', 'Río Negro', 'Río Negro'], ['salta', 'Salta', 'Salta'],
  ['san juan', 'San Juan', 'San Juan'], ['san luis', 'San Luis', 'San Luis'], ['santa cruz', 'Santa Cruz', 'Santa Cruz'],
  ['santa fe', 'Santa Fe', 'Santa Fe'], ['tucuman', 'Tucumán', 'Tucumán'],
]

export type PlaceHit = { name: string; province: Province; index: number; end: number }

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PLACE_RES = PLACES.map(([key, name, province]) => ({
  re: new RegExp(`(?<![a-z])${escapeRe(key).replace(/ /g, '\\s+')}(?![a-z])`, 'g'),
  name,
  province,
}))

/** Busca lugares en un texto ya pasado a minúsculas y sin acentos. No superpone hits. */
export function findPlaces(textNorm: string): PlaceHit[] {
  const hits: PlaceHit[] = []
  for (const { re, name, province } of PLACE_RES) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(textNorm))) {
      const start = m.index
      const end = start + m[0].length
      if (hits.some((h) => start < h.end && end > h.index)) continue
      hits.push({ name, province, index: start, end })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}

export function provinceOf(raw: string | null | undefined): Province | undefined {
  if (!raw) return undefined
  const hits = findPlaces(stripAccents(raw).toLowerCase())
  return hits[0]?.province
}
