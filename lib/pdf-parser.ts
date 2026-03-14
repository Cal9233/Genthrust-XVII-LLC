import { ParsedPdfRow } from '@/types/pdf'

let idCounter = 0
function nextId(): string {
  idCounter++
  return `pdf-row-${Date.now()}-${idCounter}`
}

/**
 * Parse C Check pre-draw PDF text into structured rows.
 *
 * Handles three table formats:
 *  - Work Request tables: Work Request | DESCRIPTION | PART NUMBER | NAME | QTY
 *  - Task Card tables:    TASK CARD | DESCRIPTION | PART NUMBER | NAME | QTY
 *  - Engine Change parts: NAME | PART NUMBER | QTY
 *
 * ALT part numbers appear as "ALT: XXXXX" below primary PN.
 * QTY includes units (EACH, GALLON, OUNCE, INCH, etc.)
 */
export function parseCCheckPdf(rawText: string): ParsedPdfRow[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const rows: ParsedPdfRow[] = []

  let currentSection: ParsedPdfRow['referenceType'] = 'work_request'
  let currentReference = ''

  // Regex for part number patterns: at least 2 alphanumeric, dash, then more alphanumeric
  // Also matches pure numeric PNs (e.g., "123456") and alphanumeric without dash (e.g., "MS21042L3")
  const partNumberPattern = /\b([A-Z0-9]{2,}[-][A-Z0-9][-A-Z0-9]*|[A-Z]{1,3}\d{3,}[A-Z0-9]*|\d{4,}[-]?[A-Z0-9]*)\b/

  // Known units
  const UNITS = ['EACH', 'EA', 'GALLON', 'GAL', 'OUNCE', 'OZ', 'INCH', 'IN', 'FOOT', 'FT', 'SET', 'PAIR', 'LITER', 'LT', 'QUART', 'QT', 'PINT', 'PT', 'TUBE', 'CAN', 'ROLL', 'YARD', 'YD']
  const unitPattern = new RegExp(`\\b(${UNITS.join('|')})\\b`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upper = line.toUpperCase()

    // Detect section headers
    if (upper.includes('WORK REQUEST') && (upper.includes('DESCRIPTION') || upper.includes('PART NUMBER'))) {
      currentSection = 'work_request'
      continue
    }
    if (upper.includes('TASK CARD') && (upper.includes('DESCRIPTION') || upper.includes('PART NUMBER'))) {
      currentSection = 'task_card'
      continue
    }
    if (upper.includes('ENGINE CHANGE') || (upper.includes('ENGINE') && upper.includes('NAME') && upper.includes('PART'))) {
      currentSection = 'engine_change'
      continue
    }

    // Skip pure header rows
    if (/^(WORK REQUEST|TASK CARD|DESCRIPTION|PART NUMBER|NAME|QTY|QUANTITY)$/i.test(upper)) {
      continue
    }

    // Skip page headers/footers
    if (/^page\s+\d+/i.test(line) || /^\d+\s*of\s*\d+$/i.test(line)) {
      continue
    }

    // Check for ALT part number lines - attach to previous row
    const altMatch = line.match(/ALT[:\s]+([A-Z0-9][-A-Z0-9]+)/i)
    if (altMatch && rows.length > 0) {
      const altPn = altMatch[1].toUpperCase()
      rows[rows.length - 1].altPartNumbers.push(altPn)

      // Check for additional ALTs on the same line
      const remainingAlts = line.replace(altMatch[0], '')
      const additionalAlts = remainingAlts.match(/[A-Z0-9]{2,}[-][A-Z0-9][-A-Z0-9]*/gi)
      if (additionalAlts) {
        for (const alt of additionalAlts) {
          rows[rows.length - 1].altPartNumbers.push(alt.toUpperCase())
        }
      }
      continue
    }

    // Try to extract a part number from this line
    const pnMatch = line.match(partNumberPattern)
    if (!pnMatch) {
      // Check if this line is a reference number (e.g., "WR-12345" or "TC-001")
      const refMatch = line.match(/^(WR[-\s]?\d+|TC[-\s]?\d+|\d{2,}-\d{2,})/i)
      if (refMatch) {
        currentReference = refMatch[1]
      }
      continue
    }

    const partNumber = pnMatch[1].toUpperCase()

    // Extract quantity - look for digits possibly followed by unit
    let qty = 1
    let unit = 'EACH'

    // Match quantity patterns: "2 EACH", "1", "3 GALLON", etc.
    const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:(EACH|EA|GALLON|GAL|OUNCE|OZ|INCH|IN|FOOT|FT|SET|PAIR|LITER|LT|QUART|QT|PINT|PT|TUBE|CAN|ROLL|YARD|YD)\b)?/i)
    if (qtyMatch) {
      // Make sure we're not picking up the part number digits as quantity
      const qtyStr = qtyMatch[0]
      const pnIdx = line.indexOf(partNumber)
      const qtyIdx = line.indexOf(qtyStr)

      // Quantity typically appears after the part number or at the end of the line
      if (qtyIdx > pnIdx || qtyIdx === -1) {
        qty = parseFloat(qtyMatch[1]) || 1
        if (qtyMatch[2]) {
          unit = qtyMatch[2].toUpperCase()
          // Normalize abbreviated units
          const unitMap: Record<string, string> = { EA: 'EACH', GAL: 'GALLON', OZ: 'OUNCE', IN: 'INCH', FT: 'FOOT', LT: 'LITER', QT: 'QUART', PT: 'PINT', YD: 'YARD' }
          unit = unitMap[unit] || unit
        }
      }
    }

    // Try harder to find quantity at end of line
    const endQtyMatch = line.match(/\b(\d+)\s*(EACH|EA|GALLON|GAL|OUNCE|OZ|INCH|IN|FOOT|FT|SET|PAIR|LITER|LT|QUART|QT|PINT|PT|TUBE|CAN|ROLL|YARD|YD)?\s*$/i)
    if (endQtyMatch) {
      const candidate = parseFloat(endQtyMatch[1])
      if (candidate > 0 && candidate < 10000) {
        qty = candidate
        if (endQtyMatch[2]) {
          unit = endQtyMatch[2].toUpperCase()
          const unitMap: Record<string, string> = { EA: 'EACH', GAL: 'GALLON', OZ: 'OUNCE', IN: 'INCH', FT: 'FOOT', LT: 'LITER', QT: 'QUART', PT: 'PINT', YD: 'YARD' }
          unit = unitMap[unit] || unit
        }
      }
    }

    // Extract name/description - text that isn't the PN or qty
    let description = ''
    let name = ''

    // Split the line around the part number
    const beforePn = line.substring(0, line.indexOf(partNumber)).trim()
    const afterPn = line.substring(line.indexOf(partNumber) + partNumber.length).trim()

    if (currentSection === 'engine_change') {
      // Engine change: NAME | PART NUMBER | QTY
      name = beforePn
      description = ''
    } else {
      // Work Request / Task Card: Reference | DESCRIPTION | PART NUMBER | NAME | QTY
      // Try to split beforePn into reference + description
      const refParts = beforePn.match(/^((?:WR|TC|[A-Z]{2})[-\s]?\d+[-\d]*)\s+(.*)$/i)
      if (refParts) {
        currentReference = refParts[1]
        description = refParts[2]
      } else if (beforePn) {
        description = beforePn
      }

      // After PN: NAME then QTY
      // Remove the quantity portion from the end
      const afterClean = afterPn.replace(/\s*\d+(?:\.\d+)?\s*(?:EACH|EA|GALLON|GAL|OUNCE|OZ|INCH|IN|FOOT|FT|SET|PAIR|LITER|LT|QUART|QT|PINT|PT|TUBE|CAN|ROLL|YARD|YD)?\s*$/i, '').trim()
      name = afterClean
    }

    // Don't add rows where we only matched noise
    if (partNumber.length < 3) continue

    rows.push({
      id: nextId(),
      reference: currentReference,
      referenceType: currentSection,
      description: description.replace(/\s+/g, ' ').trim(),
      partNumber,
      altPartNumbers: [],
      name: name.replace(/\s+/g, ' ').trim(),
      qty,
      unit,
      selected: true,
    })
  }

  return rows
}
