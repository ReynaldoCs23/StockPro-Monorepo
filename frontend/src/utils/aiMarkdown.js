// Normalisasi output markdown dari Asisten AI sebelum dirender (layar & PDF).
// Modul murni (tanpa React/DOM) agar bisa diuji dengan `node --test`.

const TABLE_LINE = /^\s*\|/;
const SEPARATOR_CELL = /^\s*:?-{3,}:?\s*$/;
const FENCE = /^\s*(```|~~~)/;
const NUMBER_HEADER_EXCLUDE = /(tahun|year|periode|kode|id\b|^no\.?$|nomor|telp|npwp)/i;

const isBlank = (l) => l.trim() === '';
const isTableLine = (l) => TABLE_LINE.test(l);

/** Pecah baris tabel menjadi sel (tanpa pipa pembuka/penutup). */
export const splitRow = (line) => {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let cur = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue; }
        if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
        cur += s[i];
    }
    cells.push(cur.trim());
    return cells;
};

const isSeparatorRow = (line) => {
    if (!isTableLine(line)) return false;
    const cells = splitRow(line);
    return cells.length > 0 && cells.every((c) => SEPARATOR_CELL.test(c));
};

const joinRow = (cells) => `| ${cells.join(' | ')} |`;

/** Format angka gaya Indonesia: 68403 -> 68.403, Rp 87918258 -> Rp 87.918.258. */
const addThousandDots = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatNumberCell = (cell) => {
    // Rupiah tanpa desimal ("Rp 87918258" / "Rp 87.918.258") -> format faktur "Rp 87.918.258,00"
    const rp = cell.match(/^(-)?\s?Rp\.?\s?(\d+|\d{1,3}(?:\.\d{3})+)$/i);
    if (rp) return `${rp[1] ? '-' : ''}Rp ${addThousandDots(rp[2].replace(/\./g, ''))},00`;
    const m = cell.match(/^(-|\+)?(\d{4,})(\s?%|\s?[A-Za-z]{1,10})?$/);
    if (!m) return cell;
    const [, sign = '', digits, suffix = ''] = m;
    return `${sign}${addThousandDots(digits)}${suffix}`;
};

/** Sel dianggap numerik: angka (opsional Rp, %, tanda, satuan pendek) atau tanda kosong "-". */
export const isNumericCell = (cell) => {
    const c = cell.replace(/\*\*/g, '').trim();
    return /^(-|\+)?(Rp\s?)?\d[\d.,]*(\s?%)?(\s?[A-Za-z]{1,10})?$/.test(c);
};

const isEmptyish = (cell) => /^(-|–|—)?$/.test(cell.replace(/\*\*/g, '').trim());

/** Rapikan satu blok tabel: separator valid, jumlah kolom konsisten, kolom angka rata kanan + format ribuan. */
const normalizeTableBlock = (rows) => {
    let header = splitRow(rows[0]);
    let body = rows.slice(1);
    let sepCells = null;

    if (body.length && isSeparatorRow(body[0])) {
        sepCells = splitRow(body[0]);
        body = body.slice(1);
    }
    // Separator yang muncul di tengah blok (sisa output rusak) dibuang.
    body = body.filter((r) => !isSeparatorRow(r)).map(splitRow);

    const nCols = Math.max(header.length, ...body.map((r) => r.length));
    const pad = (cells) => [...cells, ...Array(Math.max(0, nCols - cells.length)).fill('')].slice(0, nCols);
    header = pad(header);
    body = body.map(pad);

    const align = Array.from({ length: nCols }, (_, i) => {
        const s = sepCells?.[i]?.trim() || '';
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        if (s.startsWith(':')) return 'left';
        return null;
    });

    for (let col = 0; col < nCols; col++) {
        const values = body.map((r) => r[col]).filter((v) => !isEmptyish(v));
        const numeric = values.length > 0 && values.every(isNumericCell);
        if (!numeric) continue;
        if (!NUMBER_HEADER_EXCLUDE.test(header[col])) {
            body.forEach((r) => { r[col] = formatNumberCell(r[col]); });
            align[col] = 'right';
        }
    }

    const sep = align.map((a) => (a === 'right' ? '---:' : a === 'center' ? ':---:' : '---'));
    return [joinRow(header), joinRow(sep), ...body.map(joinRow)];
};

/** Pisahkan baris tabel yang tersambung "||" (tanpa spasi) bila hasilnya konsisten. */
const splitJoinedRows = (line) => {
    if (!isTableLine(line) || !line.includes('||')) return [line];
    const parts = line.split(/\|\|/).map((p, i, arr) => {
        let s = p;
        if (i > 0) s = '|' + s;
        if (i < arr.length - 1) s = s + '|';
        return s.trim();
    });
    const counts = new Set(parts.map((p) => splitRow(p).length));
    return parts.length > 1 && counts.size === 1 ? parts : [line];
};

const HEADING_CANDIDATE = (line) => {
    const t = line.trim().replace(/^\*\*(.+)\*\*$/, '$1').trim();
    if (!t || t.length > 80) return null;
    if (/^([-*+>|#]|\d+[.)]\s)/.test(t)) return null;
    if (/[.,;:!?]$/.test(t)) return null;
    if (!/^[A-Z0-9]/.test(t)) return null;
    if (t.split(/\s+/).length < 2) return null;
    if (/^berikut\b/i.test(t)) return null;
    return t;
};

/**
 * @param {string} text  markdown mentah dari AI
 * @returns {string}     markdown yang rapi & valid untuk GFM
 */
export function normalizeAiMarkdown(text) {
    if (!text || typeof text !== 'string') return '';

    // 1. Baris & spasi dasar
    let lines = text.replace(/\r\n?/g, '\n').split('\n').flatMap(splitJoinedRows);
    let inFence = false;
    lines = lines.map((l) => {
        if (FENCE.test(l)) { inFence = !inFence; return l.trimEnd(); }
        if (inFence) return l;
        const indent = l.match(/^\s*/)[0];
        return indent + l.slice(indent.length).replace(/[ \t]{2,}/g, ' ').trimEnd();
    });

    // 2. Kumpulkan blok tabel, abaikan baris kosong yang menyelip di antara baris tabel
    const out = [];
    inFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (FENCE.test(line)) inFence = !inFence;
        if (inFence || !isTableLine(line)) { out.push(line); continue; }

        const block = [line];
        let j = i + 1;
        while (j < lines.length) {
            if (isTableLine(lines[j])) { block.push(lines[j]); j++; continue; }
            if (isBlank(lines[j])) {
                let k = j;
                while (k < lines.length && isBlank(lines[k])) k++;
                if (k < lines.length && isTableLine(lines[k])) {
                    // Tabel baru (header + separator) setelah tabel yang sudah lengkap -> jangan digabung
                    const hasSep = block.slice(1).some(isSeparatorRow);
                    let n = k + 1;
                    while (n < lines.length && isBlank(lines[n])) n++;
                    const startsNewTable = hasSep && n < lines.length && isSeparatorRow(lines[n]) && !isSeparatorRow(lines[k]);
                    if (!startsNewTable) { j = k; continue; }
                }
            }
            break;
        }
        // Satu baris kosong sebelum & sesudah tabel
        if (out.length && !isBlank(out[out.length - 1])) out.push('');
        out.push(...normalizeTableBlock(block), '');
        i = j - 1;
    }
    lines = out;

    // 3. Judul bagian tanpa "#" -> heading ### (hanya bila AI tidak memakai heading sama sekali)
    const usesHeadings = lines.some((l) => /^\s{0,3}#{1,6}\s/.test(l));
    if (!usesHeadings) {
        const prevNonBlank = (idx) => { for (let k = idx - 1; k >= 0; k--) if (!isBlank(lines[k])) return lines[k]; return null; };
        const nextNonBlank = (idx) => { for (let k = idx + 1; k < lines.length; k++) if (!isBlank(lines[k])) return lines[k]; return null; };
        lines = lines.map((l, idx) => {
            const title = HEADING_CANDIDATE(l);
            if (!title) return l;
            const prev = prevNonBlank(idx);
            const next = nextNonBlank(idx);
            const afterBerikut = prev !== null && /^\s*berikut\b/i.test(prev);
            const beforeBlock = next !== null && (isTableLine(next) || /^\s*([-*+]|\d+[.)])\s/.test(next));
            const standalone = (idx === 0 || isBlank(lines[idx - 1]) || afterBerikut) ;
            return (afterBerikut || (beforeBlock && standalone)) ? `### ${title}` : l;
        });
        // Heading butuh baris kosong sebelum & sesudahnya
        lines = lines.flatMap((l, idx) => (/^### /.test(l) && idx > 0 && !isBlank(lines[idx - 1]) ? ['', l, ''] : /^### /.test(l) ? [l, ''] : [l]));
    }

    // 4. Maksimal satu baris kosong beruntun
    const collapsed = [];
    inFence = false;
    for (const l of lines) {
        if (FENCE.test(l)) inFence = !inFence;
        if (!inFence && isBlank(l) && collapsed.length && isBlank(collapsed[collapsed.length - 1])) continue;
        collapsed.push(inFence ? l : (isBlank(l) ? '' : l));
    }
    return collapsed.join('\n').trim();
}

export default normalizeAiMarkdown;
