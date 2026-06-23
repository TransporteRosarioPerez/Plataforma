/** Parser CSV genérico — maneja campos entre comillas y comas internas */

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      field = ''
      if (char === '\r') i++
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }

  return rows
}

export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? '').trim()
    })
    return record
  })
}

/** Número con coma como separador de miles (Shell) o punto decimal */
export function parseLocaleNumber(value: string): number {
  const trimmed = value.trim().replace(/"/g, '')
  if (!trimmed) return 0
  // "1,872.32" → miles con coma
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed.replace(/,/g, ''))
  }
  // "445.822,62" estilo AR
  if (/^\d+(\.\d{3})*,\d+$/.test(trimmed)) {
    return Number(trimmed.replace(/\./g, '').replace(',', '.'))
  }
  return Number(trimmed.replace(/,/g, ''))
}

export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, '')
}

export function classifyProduct(product: string): import('./types').FuelProductKind {
  const p = product.toUpperCase()
  if (p.includes('DIESEL') || p.includes('GASOIL') || p.includes('INFINIA DIESEL')) return 'diesel'
  if (p.includes('UREA') || p.includes('AZUL') || p.includes('ADBLUE')) return 'urea'
  if (p.includes('ELAION') || p.includes('LUBRI') || p.includes('ACEITE')) return 'lubricant'
  return 'other'
}

export function hashExternalId(parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join('|')
}
