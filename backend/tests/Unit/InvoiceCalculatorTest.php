<?php

namespace Tests\Unit;

use App\Services\InvoiceCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class InvoiceCalculatorTest extends TestCase
{
    /**
     * [lines, potongan, uang_muka, ppnbm, pajak_persen, dppNilaiLain, expected]
     * Nilai expected = nilai di faktur (dibulatkan ke rupiah, ditulis 2 desimal).
     */
    public static function fakturCases(): array
    {
        return [
            // Contoh dari user (INV-IN-2610-0009): 720.720,00 | 180.180,00 | 900.900,00
            'INV-IN-2610-0009 contoh user' => [
                [['qty' => 40, 'harga' => '18018.00'], ['qty' => 20, 'harga' => '9009.00']], 0, 0, 0, 11, true,
                ['lines' => ['720720.00', '180180.00'], 'subtotal' => '900900.00', 'dpp' => '825825.00', 'ppn' => '99099.00', 'total' => '999999.00'],
            ],
            // Faktur 04002600017168735: 2.160 x 909,91 = 1.965.405,60 -> harga jual 1.965.406,00 (dikonfirmasi user)
            'INV-IN-2610-0006 faktur Coretax' => [
                [['qty' => 2160, 'harga' => 909.91]], 0, 0, 0, 11, true,
                ['lines' => ['1965406.00'], 'subtotal' => '1965406.00', 'dpp' => '1801622.00', 'ppn' => '216195.00', 'total' => '2181601.00'],
            ],
            // Kombinasi lain (data nyata Januari 2026)
            'multi-item Cap + PET (INV-IN-2610-0007)' => [
                [['qty' => 5000, 'harga' => '72.97'], ['qty' => 3600, 'harga' => '909.91']], 0, 0, 0, 11, true,
                ['lines' => ['364850.00', '3275676.00'], 'subtotal' => '3640526.00', 'dpp' => '3337149.00', 'ppn' => '400458.00', 'total' => '4040984.00'],
            ],
            'pembelian box 1.380 x 5.310 (INV-IN-2610-0008)' => [
                [['qty' => 1380, 'harga' => '5310']], 0, 0, 0, 11, true,
                ['lines' => ['7327800.00'], 'subtotal' => '7327800.00', 'dpp' => '6717150.00', 'ppn' => '806058.00', 'total' => '8133858.00'],
            ],
            'Circle K 5.520 x 2.581,22 (INV-OUT-2610-0027)' => [
                [['qty' => 5520, 'harga' => '2581.22']], 0, 0, 0, 11, true,
                ['lines' => ['14248334.00'], 'subtotal' => '14248334.00', 'dpp' => '13060973.00', 'ppn' => '1567317.00', 'total' => '15815651.00'],
            ],
            'Jasa 68.403 x 202,70 (INV-OUT-2610-0061)' => [
                [['qty' => 68403, 'harga' => '202.70']], 0, 0, 0, 11, true,
                ['lines' => ['13865288.00'], 'subtotal' => '13865288.00', 'dpp' => '12709847.00', 'ppn' => '1525182.00', 'total' => '15390470.00'],
            ],
            'potongan & uang muka mengurangi DPP, PPN dan total' => [
                [['qty' => 10, 'harga' => '100000']], 50000, 50000, 0, 11, true,
                ['lines' => ['1000000.00'], 'subtotal' => '1000000.00', 'dpp' => '825000.00', 'ppn' => '99000.00', 'total' => '999000.00'],
            ],
            'tanpa DPP Nilai Lain (retur), PPN 11% dari DPP' => [
                [['qty' => 2160, 'harga' => '909.91']], 0, 0, 0, 11, false,
                ['lines' => ['1965406.00'], 'subtotal' => '1965406.00', 'dpp' => '1965406.00', 'ppn' => '216195.00', 'total' => '2181601.00'],
            ],
            'tanpa pajak' => [
                [['qty' => 3, 'harga' => '333.335']], 0, 0, 0, 0, true,
                ['lines' => ['1000.00'], 'subtotal' => '1000.00', 'dpp' => '917.00', 'ppn' => '0.00', 'total' => '1000.00'],
            ],
            'PPnBM ikut total' => [
                [['qty' => 1, 'harga' => '1000000']], 0, 0, '25000.50', 11, true,
                ['lines' => ['1000000.00'], 'subtotal' => '1000000.00', 'dpp' => '916667.00', 'ppn' => '110000.00', 'total' => '1135000.50'],
            ],
        ];
    }

    #[DataProvider('fakturCases')]
    public function test_hasil_sama_persis_dengan_faktur(array $lines, $potongan, $uangMuka, $ppnbm, $pajak, bool $nilaiLain, array $expected): void
    {
        $r = InvoiceCalculator::calculate($lines, $potongan, $uangMuka, $ppnbm, $pajak, $nilaiLain);

        foreach ($expected as $key => $value) {
            $this->assertSame($value, $r[$key], "Field {$key}");
        }
    }

    public function test_pembulatan_half_up_dan_tanpa_float(): void
    {
        $this->assertSame('1.00', InvoiceCalculator::lineTotal(1, '0.5'));
        $this->assertSame('0.00', InvoiceCalculator::lineTotal(1, '0.49'));
        $this->assertSame('-2', InvoiceCalculator::roundHalfUp('-1.5', 0));
        // 0.1 + 0.2 di float = 0.30000000000000004; bcmath tetap 0.30
        $this->assertSame('0.30', InvoiceCalculator::money(0.1 + 0.2));
        $this->assertSame('909.91', InvoiceCalculator::num(909.91));
        $this->assertSame('1588799.00', InvoiceCalculator::money('1588799'));
    }

    public function test_format_rupiah_backend_sama_dengan_faktur(): void
    {
        $this->assertSame('720.720,00', InvoiceCalculator::formatRupiah(720720));
        $this->assertSame('180.180,50', InvoiceCalculator::formatRupiah(180180.5));
        $this->assertSame('0,00', InvoiceCalculator::formatRupiah(0));
        $this->assertSame('1.588.799,00', InvoiceCalculator::formatRupiah('1588799.00'));
        $this->assertSame('-33.768.851,00', InvoiceCalculator::formatRupiah(-33768851));
        $this->assertSame(number_format(900900, 2, ',', '.'), InvoiceCalculator::formatRupiah(900900));
    }

    public function test_input_tidak_valid_ditolak(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        InvoiceCalculator::num('720.720,00');
    }
}
