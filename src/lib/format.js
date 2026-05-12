import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || 'KSh';
const CURRENCY_CODE = import.meta.env.VITE_CURRENCY || 'KES';

const numberFormatter = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(amount, { showSymbol = true, fractionDigits } = {}) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return '—';
  const formatter =
    fractionDigits !== undefined
      ? new Intl.NumberFormat('en-KE', {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        })
      : numberFormatter;
  const formatted = formatter.format(n);
  return showSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
}

export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return numberFormatter.format(n);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDate(value, fmt = 'd MMM yyyy') {
  const d = toDate(value);
  return d ? format(d, fmt) : '—';
}

export function formatDateTime(value, fmt = 'd MMM yyyy, HH:mm') {
  const d = toDate(value);
  return d ? format(d, fmt) : '—';
}

export function timeAgo(value) {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}

export const CURRENCY = { symbol: CURRENCY_SYMBOL, code: CURRENCY_CODE };

/**
 * Build a wa.me link from any Kenyan phone format.
 *   "+254712345678" → https://wa.me/254712345678
 *   "0712345678"    → https://wa.me/254712345678
 *   "0712 345 678"  → https://wa.me/254712345678
 *   "712345678"     → https://wa.me/254712345678
 * Returns null for unusable input.
 */
export function whatsappLink(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '254' + digits.slice(1);
  else if (digits.length === 9) digits = '254' + digits;
  else if (digits.startsWith('254')) { /* already in international format */ }
  else if (digits.length === 12 && digits.startsWith('254')) { /* ok */ }
  if (digits.length < 11) return null; // too short to be valid
  return `https://wa.me/${digits}`;
}

/**
 * Convert a positive integer to English words. Used for receipts.
 *   1500 → "One thousand five hundred"
 */
export function numberToWords(num) {
  if (num === null || num === undefined) return '';
  num = Math.floor(Number(num));
  if (Number.isNaN(num)) return '';
  if (num === 0) return 'zero';
  const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function below1000(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + below1000(n % 100) : '');
  }
  let result = '';
  if (num >= 1000000) {
    result += below1000(Math.floor(num / 1000000)) + ' million ';
    num %= 1000000;
  }
  if (num >= 1000) {
    result += below1000(Math.floor(num / 1000)) + ' thousand ';
    num %= 1000;
  }
  if (num > 0) result += below1000(num);
  // Capitalize first letter
  result = result.trim().replace(/\s+/g, ' ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}
