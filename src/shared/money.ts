const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('it-IT', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    formatters.set(currency, f)
  }
  return f
}

export function formatMoney(cents: number, currency = 'EUR', opts: { sign?: boolean } = {}): string {
  const text = formatter(currency).format(Math.abs(cents) / 100)
  if (cents < 0) return `−${text}`
  if (opts.sign && cents > 0) return `+${text}`
  return text
}

/** Formato compatto per assi dei grafici: 1,2k € */
export function formatMoneyShort(cents: number, currency = 'EUR'): string {
  const v = cents / 100
  const abs = Math.abs(v)
  const symbol = currencySymbol(currency)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}M ${symbol}`
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k ${symbol}`
  return `${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })} ${symbol}`
}

export function currencySymbol(currency: string): string {
  const part = formatter(currency)
    .formatToParts(0)
    .find((p) => p.type === 'currency')
  return part?.value ?? currency
}

/**
 * Converte un importo digitato dall'utente in centesimi interi, senza errori di virgola mobile.
 * Accetta "12", "12,5", "12.50", "1.234,56", "1,234.56", "1 234,56", "€ 12,00".
 * Restituisce null se l'input non è un importo valido e positivo.
 */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/[€$£\s ']/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  if (!s || !/^[\d.,]+$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let intPart: string
  let fracPart = ''

  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot)
    intPart = s.slice(0, dec).replace(/[.,]/g, '')
    fracPart = s.slice(dec + 1)
  } else if (lastComma >= 0) {
    if (s.indexOf(',') !== lastComma) {
      // più virgole: separatori delle migliaia (1,234,567)
      intPart = s.replace(/,/g, '')
    } else {
      intPart = s.slice(0, lastComma)
      fracPart = s.slice(lastComma + 1)
    }
  } else if (lastDot >= 0) {
    const after = s.slice(lastDot + 1)
    if (s.indexOf('.') !== lastDot || after.length === 3) {
      // "1.234" o "1.234.567": punto come separatore delle migliaia (convenzione italiana)
      intPart = s.replace(/\./g, '')
    } else {
      intPart = s.slice(0, lastDot)
      fracPart = after
    }
  } else {
    intPart = s
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null
  if (fracPart.length > 2) return null
  if (!intPart && !fracPart) return null

  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

/** Rappresentazione modificabile (12,50) di un importo in centesimi. */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents)
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}
