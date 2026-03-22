// Part number extraction utility
// Ported from Genthrust_Inventory partNumberExtractor.js

const partNumberPatterns: RegExp[] = [
  /\b[A-Z]{2,}[-][0-9]{2,}\b/g,          // ABC-123
  /\b[A-Z]{2,}[0-9]{3,}\b/g,              // ABC123
  /\b[0-9]{3,}[-][A-Z]{2,}\b/g,           // 123-ABC
  /\b(?:[A-Z][0-9]){2,}\b/g,              // A1B2C3
  /\b[0-9]{2,}[-\.][0-9]{2,}[-\.][0-9]{2,}\b/g,  // 12-34-56 or 12.34.56
  /\b[A-Z]{2,}[-][0-9]{2,}[-][A-Z]{2,}\b/g,      // ABC-123-XYZ
  /\b(?:P\/N|PN|Part\s*Number)[\s:]+([A-Z0-9-]+)\b/gi,  // P/N: 12345
  /\b(?:#|No\.?)\s*([A-Z0-9-]+)\b/gi,     // #12345 or No.12345
]

const excludePatterns = new Set([
  'USD', 'USA', 'EUR', 'GBP', 'CAD',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'AM', 'PM', 'EST', 'PST', 'GMT', 'UTC',
  'LLC', 'INC', 'CORP', 'LTD', 'CO',
  'WWW', 'HTTP', 'HTTPS', 'COM', 'NET', 'ORG',
  'PDF', 'DOC', 'XLS', 'ZIP', 'PNG', 'JPG',
])

export function extractPartNumbers(text: string): string[] {
  if (!text) return []

  const foundParts = new Set<string>()
  const upperText = text.toUpperCase()

  for (const pattern of partNumberPatterns) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0
    const matches = upperText.match(pattern) || []
    for (const match of matches) {
      let partNumber = match.trim()

      // Extract from P/N: format
      const pnMatch = match.match(/(?:P\/N|PN|Part\s*Number)[\s:]+([A-Z0-9-]+)/i)
      if (pnMatch) partNumber = pnMatch[1]

      // Extract from # or No. format
      const numMatch = match.match(/(?:#|No\.?)\s*([A-Z0-9-]+)/i)
      if (numMatch) partNumber = numMatch[1]

      if (!excludePatterns.has(partNumber) && partNumber.length >= 3 && partNumber.length <= 30) {
        foundParts.add(partNumber)
      }
    }
  }

  return Array.from(foundParts)
}

export function parseEmailForParts(email: {
  subject?: string
  body?: { content?: string }
}): string[] {
  const parts: string[] = []

  if (email.subject) {
    parts.push(...extractPartNumbers(email.subject))
  }

  if (email.body?.content) {
    const plainText = email.body.content.replace(/<[^>]*>/g, ' ')
    parts.push(...extractPartNumbers(plainText))
  }

  return Array.from(new Set(parts))
}
