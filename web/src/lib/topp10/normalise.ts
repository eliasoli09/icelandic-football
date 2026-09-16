/**
 * The single spelling both the list builder and the game reduce a name to, so
 * a guess and an accepted answer are compared on the same terms.
 *
 * Icelandic letters are spelled out rather than dropped - "Þórisson" becomes
 * "thorisson", which is how most people type it without an Icelandic keyboard
 * - and every other accent is removed.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    // letters that carry no separate accent to strip: Błaszczykowski, Đoković
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
