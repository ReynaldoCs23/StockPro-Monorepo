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
 * Format kolom input nominal SAAT DIKETIK: selalu tampil "720.720,00" dan posisi kursor dijaga.
 * Saat mengetik, titik = pemisah ribuan dan koma = desimal (maks 2 digit). Tempelan (paste) memakai parseNominal.
 * @param {string} raw      isi input setelah diketik
 * @param {number} caret    posisi kursor di raw
 * @param {string} prevText isi input sebelumnya (untuk mendeteksi koma yang terhapus)
 * @returns {{ text: string, caret: number, value: number|'' }}
 */
export function formatNominalInput(raw, caret, prevText = '') {
    const s = String(raw ?? '');
    if (s.replace(/[^\d]/g, '') === '' && !s.includes(',')) return { text: '', caret: 0, value: '' };

    const firstComma = s.indexOf(',');
    // Koma desimal terhapus (mis. backspace tepat di koma): kembalikan teks sebelumnya, kursor di kiri koma
    if (firstComma === -1 && prevText.includes(',')) {
        return { text: prevText, caret: prevText.indexOf(','), value: toNumber(prevText) };
    }

    const intRaw = firstComma === -1 ? s : s.slice(0, firstComma);
    const decRaw = firstComma === -1 ? '' : s.slice(firstComma + 1);
    const intDigits = intRaw.replace(/\D/g, '');
    const decDigits = decRaw.replace(/\D/g, '').slice(0, 2);
    const value = Number(`${intDigits || '0'}.${decDigits || '0'}`);
    const text = formatRupiah(value);
    const commaAt = text.indexOf(',');

    // Petakan kursor: hitung digit di kiri kursor pada bagian bilangan bulat / desimal
    let newCaret;
    const typedExtraComma = firstComma !== -1 && s.indexOf(',', firstComma + 1) !== -1;
    if (typedExtraComma || (firstComma !== -1 && caret > firstComma)) {
        // kursor berada di bagian desimal (atau baru mengetik koma): letakkan setelah koma + digit desimal yang sudah dilewati
        const decBefore = typedExtraComma ? 0 : s.slice(firstComma + 1, caret).replace(/\D/g, '').length;
        newCaret = commaAt + 1 + Math.min(decBefore, 2);
    } else {
        const intLen = text.slice(0, commaAt).replace(/\D/g, '').length;
        const leadingZeros = (intDigits.match(/^0+(?=\d)/) || [''])[0].length;
        let k = Math.max(0, s.slice(0, caret).replace(/\D/g, '').length - leadingZeros);
        k = Math.min(k, intLen);
        newCaret = 0;
        if (k > 0) {
            let seen = 0;
            for (let i = 0; i < commaAt; i++) {
                if (/\d/.test(text[i])) seen++;
                if (seen === k) { newCaret = i + 1; break; }
            }
        }
    }
    return { text, caret: newCaret, value };
}

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
