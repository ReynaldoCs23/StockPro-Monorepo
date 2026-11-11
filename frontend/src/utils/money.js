// Format & parsing nominal uang — SATU-SATUNYA tempat format nominal di frontend.
// Hanya untuk tampilan/input. Perhitungan nominal (subtotal, DPP, PPN, total) dilakukan di backend.

const ID_2DP = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === '') return 0;
    const n = parseNominal(value);
    return Number.isFinite(n) ? n : 0;
};

/** 720720 -> "720.720,00" (format faktur: titik ribuan, koma desimal, selalu 2 desimal). */
export const formatRupiah = (value) => {
    const s = ID_2DP.format(toNumber(value));
    return s === '-0,00' ? '0,00' : s;
};

/** 720720 -> "Rp 720.720,00"; -5 -> "-Rp 5,00". */
export const formatRp = (value) => {
    const n = toNumber(value);
    return n < 0 ? `-Rp ${formatRupiah(-n)}` : `Rp ${formatRupiah(n)}`;
};

/**
 * Baca input nominal menjadi angka. Menerima format Indonesia maupun angka biasa dari API:
 *   "720.720,00" -> 720720     "180.180,5" -> 180180.5    "Rp 1.588.799" -> 1588799
 *   "720720.00"  -> 720720     "909.91"    -> 909.91      "720,720.00"   -> 720720
 * Aturan pemisah:
 *   - ada titik & koma: pemisah yang muncul terakhir = desimal.
 *   - hanya koma: satu koma = desimal (gaya Indonesia), lebih dari satu = ribuan.
 *   - hanya titik: lebih dari satu = ribuan; satu titik diikuti tepat 3 digit = ribuan ("720.720"), selain itu desimal.
 * Mengembalikan NaN bila bukan angka.
 */
export function parseNominal(input) {
    if (typeof input === 'number') return input;
    if (input === null || input === undefined) return NaN;
    let s = String(input).trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '');
    let sign = '';
    if (s.startsWith('-')) { sign = '-'; s = s.slice(1); }
    if (s === '' || !/^[\d.,]+$/.test(s)) return NaN;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let intPart = s;
    let decPart = '';

    if (lastDot >= 0 && lastComma >= 0) {
        const decSep = lastDot > lastComma ? '.' : ',';
        const idx = Math.max(lastDot, lastComma);
        intPart = s.slice(0, idx);
        decPart = s.slice(idx + 1);
        if (decPart.includes(decSep === '.' ? ',' : '.')) return NaN;
    } else if (lastComma >= 0) {
        const parts = s.split(',');
        if (parts.length === 2) { intPart = parts[0]; decPart = parts[1]; }
        else intPart = parts.join('');
    } else if (lastDot >= 0) {
        const parts = s.split('.');
        if (parts.length > 2 || (parts[1].length === 3 && parts[0].length > 0)) intPart = parts.join('');
        else { intPart = parts[0]; decPart = parts[1]; }
    }

    intPart = intPart.replace(/[.,]/g, '');
    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart) || (intPart === '' && decPart === '')) return NaN;
    return Number(`${sign}${intPart || '0'}${decPart ? '.' + decPart : ''}`);
}
