import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRupiah, formatRp, parseNominal, formatNominalInput } from './money.js';

test('formatNominalInput: langsung terformat ,00 saat mengetik dan kursor tetap benar', () => {
    const step = (raw, caret, prev) => formatNominalInput(raw, caret, prev);
    assert.deepEqual(step('', 0, ''), { text: '', caret: 0, value: '' });
    // mulai mengetik dari kosong
    assert.deepEqual(step('7', 1, ''), { text: '7,00', caret: 1, value: 7 });
    assert.deepEqual(step('72,00', 2, '7,00'), { text: '72,00', caret: 2, value: 72 });
    // ribuan otomatis, kursor mengikuti digit
    assert.deepEqual(step('7202,00', 4, '720,00'), { text: '7.202,00', caret: 5, value: 7202 });
    assert.deepEqual(step('72.0207,00', 7, '72.020,00'), { text: '720.207,00', caret: 7, value: 720207 });
    // ketik koma -> pindah ke bagian desimal
    assert.deepEqual(step('72,,00', 3, '72,00'), { text: '72,00', caret: 3, value: 72 });
    // ketik desimal
    assert.deepEqual(step('72,500', 4, '72,00'), { text: '72,50', caret: 4, value: 72.5 });
    // backspace di desimal
    assert.deepEqual(step('72,0', 4, '72,00'), { text: '72,00', caret: 4, value: 72 });
    // koma terhapus -> teks dikembalikan
    assert.deepEqual(step('7200', 2, '72,00'), { text: '72,00', caret: 2, value: 72 });
    // ketik dengan titik ribuan sendiri
    assert.deepEqual(step('720.720', 7, ''), { text: '720.720,00', caret: 7, value: 720720 });
    // nol di depan dibuang
    assert.deepEqual(step('05,00', 2, '0,00'), { text: '5,00', caret: 1, value: 5 });
});

test('formatRupiah: format faktur (titik ribuan, koma desimal, 2 digit)', () => {
    assert.equal(formatRupiah(720720), '720.720,00');
    assert.equal(formatRupiah(180180.5), '180.180,50');
    assert.equal(formatRupiah(0), '0,00');
    assert.equal(formatRupiah(900900), '900.900,00');
    assert.equal(formatRupiah(1588799), '1.588.799,00');
    assert.equal(formatRupiah('1965406.00'), '1.965.406,00'); // nilai DECIMAL dari API (string)
    assert.equal(formatRupiah(null), '0,00');
    assert.equal(formatRupiah(-0), '0,00');
});

test('formatRp: awalan Rp dan tanda negatif', () => {
    assert.equal(formatRp(720720), 'Rp 720.720,00');
    assert.equal(formatRp(-33768851), '-Rp 33.768.851,00');
});

test('parseNominal: titik/koma tidak salah dibaca', () => {
    assert.equal(parseNominal('720.720,00'), 720720);
    assert.equal(parseNominal('180.180,5'), 180180.5);
    assert.equal(parseNominal('Rp 1.588.799'), 1588799);
    assert.equal(parseNominal('720720.00'), 720720);
    assert.equal(parseNominal('909.91'), 909.91);
    assert.equal(parseNominal('909,91'), 909.91);
    assert.equal(parseNominal('720.720'), 720720);
    assert.equal(parseNominal('720,720.00'), 720720);
    assert.equal(parseNominal('1.234.567,89'), 1234567.89);
    assert.equal(parseNominal(' 5310 '), 5310);
    assert.equal(parseNominal(442.5), 442.5);
    assert.ok(Number.isNaN(parseNominal('abc')));
    assert.ok(Number.isNaN(parseNominal('')));
});
