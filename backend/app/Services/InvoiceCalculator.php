<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * Satu-satunya sumber perhitungan nominal transaksi (subtotal, DPP, PPN, total).
 * Seluruh aritmetika memakai bcmath (string desimal), tanpa float.
 *
 * Aturan pembulatan (disamakan dengan faktur Coretax, lihat contoh INV-IN-2610-0006):
 *   1. Harga jual per baris = qty x harga satuan, dibulatkan ke RUPIAH penuh (half-up).
 *      Contoh: 2.160 x 909,91 = 1.965.405,60  ->  1.965.406,00
 *   2. Subtotal (harga jual) = jumlah harga jual per baris.
 *   3. Dasar = subtotal - potongan harga - uang muka.
 *   4. DPP:
 *        - DPP Nilai Lain (PMK 131/2024): 11/12 x dasar, dibulatkan ke rupiah.
 *        - selain itu: dasar, dibulatkan ke rupiah.
 *   5. PPN dibulatkan ke rupiah:
 *        - DPP Nilai Lain: DPP x (pajak_persen x 12/11)%   (pajak_persen 11 -> tarif 12%)
 *        - selain itu:      DPP x pajak_persen%
 *   6. Total = dasar + PPN + PPnBM.
 *
 * Semua nilai keluaran berupa string desimal 2 digit ("1965406.00") agar presisi terjaga
 * sampai disimpan ke kolom DECIMAL.
 */
class InvoiceCalculator
{
    private const SCALE = 10; // presisi perhitungan antara

    /**
     * @param array<int, array{qty: mixed, harga: mixed}> $lines
     * @return array{
     *   lines: string[], subtotal: string, dasar: string, dpp: string, tarif_ppn: string,
     *   ppn: string, ppnbm: string, total: string
     * }
     */
    public static function calculate(
        array $lines,
        mixed $potongan = 0,
        mixed $uangMuka = 0,
        mixed $ppnbm = 0,
        mixed $pajakPersen = 0,
        bool $dppNilaiLain = true
    ): array {
        $lineTotals = [];
        $subtotal = '0';
        foreach ($lines as $line) {
            $amount = self::lineTotal($line['qty'] ?? 0, $line['harga'] ?? 0);
            $lineTotals[] = $amount;
            $subtotal = bcadd($subtotal, $amount, 2);
        }

        $dasar = bcsub(bcsub($subtotal, self::num($potongan), self::SCALE), self::num($uangMuka), self::SCALE);
        if (bccomp($dasar, '0', self::SCALE) < 0) {
            $dasar = '0';
        }

        $pajak = self::num($pajakPersen);
        if ($dppNilaiLain) {
            $dpp = self::roundHalfUp(bcdiv(bcmul($dasar, '11', self::SCALE), '12', self::SCALE), 0);
            $tarif = bcdiv(bcmul($pajak, '12', self::SCALE), '11', self::SCALE);
        } else {
            $dpp = self::roundHalfUp($dasar, 0);
            $tarif = $pajak;
        }

        $ppn = self::roundHalfUp(bcdiv(bcmul($dpp, $tarif, self::SCALE), '100', self::SCALE), 0);
        $ppnbmVal = self::roundHalfUp(self::num($ppnbm), 2);
        $total = bcadd(bcadd($dasar, $ppn, self::SCALE), $ppnbmVal, self::SCALE);

        return [
            'lines' => $lineTotals,
            'subtotal' => self::money($subtotal),
            'dasar' => self::money($dasar),
            'dpp' => self::money($dpp),
            'tarif_ppn' => self::roundHalfUp($tarif, 4),
            'ppn' => self::money($ppn),
            'ppnbm' => self::money($ppnbmVal),
            'total' => self::money($total),
        ];
    }

    /** Harga jual satu baris: qty x harga, dibulatkan ke rupiah penuh. */
    public static function lineTotal(mixed $qty, mixed $harga): string
    {
        return self::money(self::roundHalfUp(bcmul(self::num($qty), self::num($harga), self::SCALE), 0));
    }

    /** Pembulatan half-up (menjauhi nol pada .5) ke $scale digit desimal. */
    public static function roundHalfUp(string $value, int $scale = 0): string
    {
        $value = self::num($value);
        $offset = '0.' . str_repeat('0', $scale) . '5';
        $rounded = str_starts_with($value, '-')
            ? bcsub($value, $offset, $scale)  // bcmath memotong ke arah nol
            : bcadd($value, $offset, $scale);
        return bccomp($rounded, '0', $scale) === 0 ? bcadd('0', '0', $scale) : $rounded;
    }

    /**
     * Format tampilan nominal untuk dokumen backend (PDF/Excel/log), sama dengan faktur:
     * 1588799 -> "1.588.799,00". Setara number_format($v, 2, ',', '.') tetapi tanpa float.
     */
    public static function formatRupiah(mixed $value): string
    {
        $v = self::money($value);
        $neg = str_starts_with($v, '-');
        [$int, $dec] = explode('.', ltrim($v, '-'));
        $int = strrev(implode('.', str_split(strrev($int), 3)));
        return ($neg ? '-' : '') . $int . ',' . $dec;
    }

    /** Normalisasi ke string desimal 2 digit untuk disimpan / dikirim API. */
    public static function money(mixed $value): string
    {
        return self::roundHalfUp(self::num($value), 2);
    }

    /**
     * Normalisasi masukan numerik (int, float, string desimal) ke string bcmath.
     * Float dikonversi lewat representasi terpendek PHP agar 909.91 tetap "909.91".
     */
    public static function num(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '0';
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            if (!is_finite($value)) {
                throw new InvalidArgumentException('Nilai nominal tidak valid.');
            }
            $value = rtrim(rtrim(sprintf('%.10F', $value), '0'), '.');
        }
        $value = trim((string) $value);
        if (!preg_match('/^[+-]?(\d+(\.\d*)?|\.\d+)$/', $value)) {
            throw new InvalidArgumentException("Nilai nominal tidak valid: {$value}");
        }
        if ($value[0] === '+') {
            $value = substr($value, 1);
        }
        if ($value[0] === '.' || str_starts_with($value, '-.')) {
            $value = str_replace('.', '0.', $value);
        }
        return rtrim($value, '.');
    }
}
