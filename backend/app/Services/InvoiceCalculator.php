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
 *   5. PPN dibulatkan KE ATAS ke rupiah penuh (ceiling), mis. 110.000,04 -> 110.001,00:
 *        - DPP Nilai Lain: DPP x (pajak_persen x 12/11)%   (pajak_persen 11 -> tarif 12%)
 *        - selain itu:      DPP x pajak_persen%
 *      PPN yang sudah bulat tidak berubah (99.099,00 tetap 99.099,00).
 *   6. Total = dasar + PPN + PPnBM.
 *
 * PPN_PER_BARIS = false (dipakai): DPP & PPN dihitung SEKALI dari total dasar, lalu PPN dibulatkan
 *   ke atas ke ,00. Contoh INV-IN-2610-0009: PPN 12% x 825.825 = 99.099,00.
 * PPN_PER_BARIS = true (cadangan): DPP & PPN dihitung per baris barang lalu dijumlahkan; potongan +
 *   uang muka dialokasikan proporsional (sisa pembulatan di baris terakhir). 0009 -> 79.280 + 19.820 = 99.100.
 * Untuk transaksi satu baris kedua mode menghasilkan nilai yang sama.
 *
 * Semua nilai keluaran berupa string desimal 2 digit ("1965406.00") agar presisi terjaga
 * sampai disimpan ke kolom DECIMAL.
 */
class InvoiceCalculator
{
    private const SCALE = 10; // presisi perhitungan antara

    /** Saklar aturan DPP/PPN: true = per baris barang, false = sekali di total. */
    public const PPN_PER_BARIS = false;

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
        bool $dppNilaiLain = true,
        ?bool $perBaris = null // null = ikuti PPN_PER_BARIS
    ): array {
        $perBaris ??= self::PPN_PER_BARIS;
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
        $tarif = $dppNilaiLain ? bcdiv(bcmul($pajak, '12', self::SCALE), '11', self::SCALE) : $pajak;

        // Dasar per baris: harga jual baris dikurangi alokasi potongan + uang muka
        $potTotal = bcadd(self::num($potongan), self::num($uangMuka), self::SCALE);
        $bases = ($perBaris && count($lineTotals) > 0)
            ? self::allocateBases($lineTotals, $subtotal, $potTotal)
            : [$dasar];

        $dpp = '0';
        $ppn = '0';
        $lineDpp = [];
        $linePpn = [];
        foreach ($bases as $base) {
            $d = self::dppOf($base, $dppNilaiLain);
            $p = self::roundUp(bcdiv(bcmul($d, $tarif, self::SCALE), '100', self::SCALE), 0);
            $lineDpp[] = self::money($d);
            $linePpn[] = self::money($p);
            $dpp = bcadd($dpp, $d, 2);
            $ppn = bcadd($ppn, $p, 2);
        }
        $ppnbmVal = self::roundHalfUp(self::num($ppnbm), 2);
        $total = bcadd(bcadd($dasar, $ppn, self::SCALE), $ppnbmVal, self::SCALE);

        return [
            'lines' => $lineTotals,
            // DPP & PPN per baris (hanya pada mode per baris; mode total: satu elemen = nilai total)
            'lines_dpp' => $lineDpp,
            'lines_ppn' => $linePpn,
            'mode_ppn' => $perBaris ? 'per_baris' : 'total',
            'subtotal' => self::money($subtotal),
            'dasar' => self::money($dasar),
            'dpp' => self::money($dpp),
            'tarif_ppn' => self::roundHalfUp($tarif, 4),
            'ppn' => self::money($ppn),
            'ppnbm' => self::money($ppnbmVal),
            'total' => self::money($total),
        ];
    }

    /** DPP dari dasar: Nilai Lain 11/12 atau dasar itu sendiri, dibulatkan ke rupiah (half-up). */
    private static function dppOf(string $base, bool $dppNilaiLain): string
    {
        return $dppNilaiLain
            ? self::roundHalfUp(bcdiv(bcmul($base, '11', self::SCALE), '12', self::SCALE), 0)
            : self::roundHalfUp($base, 0);
    }

    /**
     * Bagi potongan (+ uang muka) ke tiap baris secara proporsional terhadap harga jual baris,
     * dibulatkan ke sen; sisa pembulatan masuk ke baris terakhir sehingga jumlahnya tepat.
     * @return string[] dasar per baris (tidak negatif)
     */
    private static function allocateBases(array $lineTotals, string $subtotal, string $potTotal): array
    {
        $bases = [];
        $sisa = self::money($potTotal);
        $last = count($lineTotals) - 1;
        foreach ($lineTotals as $i => $line) {
            if ($i === $last) {
                $alloc = $sisa;
            } elseif (bccomp($subtotal, '0', 2) === 0) {
                $alloc = '0.00';
            } else {
                $alloc = self::roundHalfUp(bcdiv(bcmul($potTotal, $line, self::SCALE), $subtotal, self::SCALE), 2);
            }
            $sisa = bcsub($sisa, $alloc, 2);
            $base = bcsub($line, $alloc, 2);
            $bases[] = bccomp($base, '0', 2) < 0 ? '0.00' : $base;
        }
        return $bases;
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
     * Pembulatan ke atas (ceiling, ke arah +tak hingga) ke $scale digit desimal.
     * Nilai yang sudah tepat di $scale digit tidak berubah: 99099.00 -> 99099, 110000.04 -> 110001.
     */
    public static function roundUp(string $value, int $scale = 0): string
    {
        $value = self::num($value);
        $truncated = bcadd($value, '0', $scale); // bcmath memotong ke arah nol
        if (bccomp($value, $truncated, self::SCALE) === 0 || str_starts_with($value, '-')) {
            // sudah bulat, atau negatif (memotong ke arah nol = ke atas untuk bilangan negatif)
            return bccomp($truncated, '0', $scale) === 0 ? bcadd('0', '0', $scale) : $truncated;
        }
        $unit = $scale === 0 ? '1' : '0.' . str_repeat('0', $scale - 1) . '1';
        return bcadd($truncated, $unit, $scale);
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
