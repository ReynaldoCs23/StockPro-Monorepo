import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRupiah, formatRp, parseNominal } from './money.js';

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
