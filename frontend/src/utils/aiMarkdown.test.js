import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiMarkdown, splitRow } from './aiMarkdown.js';

const BROKEN = "Ringkasan Mutasi Barang (Januari 2026)\n| Nama Barang | Jenis Mutasi | Kuantitas |\n\n| :--- | :--- | :--- |\n\n| Jasa SIPEMA ONLINE | Keluar | 68.403 |";

const tableLines = (md) => md.split('\n').filter((l) => l.startsWith('|'));

test('contoh output rusak menjadi tabel markdown valid', () => {
    const out = normalizeAiMarkdown(BROKEN);
    const lines = out.split('\n');

    // Judul bagian menjadi heading, dipisah satu baris kosong dari tabel
    assert.equal(lines[0], '### Ringkasan Mutasi Barang (Januari 2026)');
    assert.equal(lines[1], '');

    // Header, separator, data berurutan tanpa baris kosong
    const start = lines.findIndex((l) => l.startsWith('|'));
    assert.deepEqual(lines.slice(start), [
        '| Nama Barang | Jenis Mutasi | Kuantitas |',
        '| --- | --- | ---: |',
        '| Jasa SIPEMA ONLINE | Keluar | 68.403 |',
    ]);
    assert.ok(!/\n\n\|.*\n\n/.test(out.slice(out.indexOf('|'))), 'tidak ada baris kosong di dalam tabel');

    // Separator valid: jumlah kolom sama dengan header
    const [h, sep] = tableLines(out);
    assert.equal(splitRow(sep).length, splitRow(h).length);
    assert.ok(splitRow(sep).every((c) => /^:?-{3,}:?$/.test(c)));
});

test('baris kosong sebelum & sesudah tabel, maksimal satu baris kosong beruntun', () => {
    const out = normalizeAiMarkdown('Berikut datanya:\n| A | B |\n| --- | --- |\n| x | 1 |\nPenutup.\n\n\n\nAkhir   kalimat   ini.');
    assert.match(out, /Berikut datanya:\n\n\| A \| B \|/);
    assert.match(out, /\| x \| 1 \|\n\nPenutup\./);
    assert.ok(!out.includes('\n\n\n'));
    assert.ok(out.endsWith('Akhir kalimat ini.'));
});

test('separator yang hilang ditambahkan dan angka diformat gaya Indonesia', () => {
    const out = normalizeAiMarkdown('| Barang | Qty | Nilai |\n| Galon | 4860 | Rp 87918258 |');
    assert.deepEqual(tableLines(out), [
        '| Barang | Qty | Nilai |',
        '| --- | ---: | ---: |',
        '| Galon | 4.860 | Rp 87.918.258,00 |',
    ]);
});

test('sel rupiah di tabel AI selalu ber-,00; yang sudah berformat tidak diubah', () => {
    const out = normalizeAiMarkdown('| Barang | Nilai |\n| --- | --- |\n| A | Rp 87.918.258 |\n| B | Rp 720.720,00 |\n| C | -Rp 500 |');
    assert.deepEqual(tableLines(out).slice(2), [
        '| A | Rp 87.918.258,00 |',
        '| B | Rp 720.720,00 |',
        '| C | -Rp 500,00 |',
    ]);
});

test('judul setelah "Berikut..." menjadi heading; tidak diubah bila AI sudah memakai #', () => {
    const a = normalizeAiMarkdown('Berikut analisisnya.\nBusiness Insight & Analisis Strategis\n1. Poin satu');
    assert.match(a, /### Business Insight & Analisis Strategis/);

    const b = normalizeAiMarkdown('## Ringkasan\nBerikut analisisnya.\nBusiness Insight & Analisis Strategis\n1. Poin');
    assert.ok(!b.includes('### Business Insight'));
});

test('dua tabel terpisah tidak digabung; kode blok tidak disentuh', () => {
    const out = normalizeAiMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| C | D |\n| --- | --- |\n| 3 | 4 |\n\n```\n|  raw   |\n\n\n```');
    assert.equal(tableLines(out).filter((l) => /^\| -/.test(l) || /---/.test(l)).length, 2);
    assert.match(out, /```\n\|  raw   \|\n\n\n```/);
});

test('kolom tahun/kode tidak diberi pemisah ribuan', () => {
    const out = normalizeAiMarkdown('| Tahun | Qty |\n| --- | --- |\n| 2026 | 16560 |');
    assert.ok(out.includes('| 2026 | 16.560 |'));
});
