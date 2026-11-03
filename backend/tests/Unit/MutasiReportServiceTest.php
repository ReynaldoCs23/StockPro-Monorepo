<?php

namespace Tests\Unit;

use App\Services\MutasiReportService;
use PHPUnit\Framework\TestCase;

class MutasiReportServiceTest extends TestCase
{
    private function sampleReport(): array
    {
        return [
            'periode' => ['start' => '01/01/2026', 'end' => '31/01/2026'],
            'summary' => ['inbound' => ['qty' => 16560.0, 'nilai' => 8133858.0, 'count' => 1]],
            'inbound_data' => [[
                'id_transaksi' => 'INV-IN-2610-0008',
                'total_nilai' => 8133858.0,
                'items' => [['kode_barang' => 'BRG-0003', 'qty' => 16560.0, 'harga_satuan' => 5310.0]],
            ]],
        ];
    }

    public function test_hash_is_valid_deterministic_and_verifiable(): void
    {
        $report = $this->sampleReport();
        $hash = MutasiReportService::computeHash($report);

        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $hash);

        // Deterministik: urutan key berbeda + blok audit tidak memengaruhi hash.
        $reordered = array_reverse($report, true);
        $reordered['audit'] = ['hash' => 'apa saja'];
        $this->assertSame($hash, MutasiReportService::computeHash($reordered));

        // Representasi int vs float yang sama nilainya -> hash sama.
        $asInt = $report;
        $asInt['inbound_data'][0]['total_nilai'] = 8133858;
        $this->assertSame($hash, MutasiReportService::computeHash($asInt));

        $this->assertTrue(MutasiReportService::verifyHash($report, $hash));
        $this->assertTrue(MutasiReportService::verifyHash($report, 'SHA256:' . strtoupper($hash)));

        // Data diubah 1 rupiah -> verifikasi gagal.
        $tampered = $report;
        $tampered['inbound_data'][0]['total_nilai'] = 8133859.0;
        $this->assertFalse(MutasiReportService::verifyHash($tampered, $hash));
        $this->assertFalse(MutasiReportService::verifyHash($report, 'SHA256:jf4lv7oo3egn3nnoi11kk'));
    }

    public function test_convert_box_to_base_unit(): void
    {
        $item = ['satuan_dasar' => 'Pcs', 'satuan_besar' => 'Box', 'rasio_konversi' => 12];
        $c = MutasiReportService::convertToBaseUnit(
            ['jumlah' => 16560, 'jumlah_transaksi' => 1380, 'satuan_transaksi' => 'Box', 'harga_satuan' => 5310],
            $item
        );

        $this->assertTrue($c['is_konversi']);
        $this->assertSame(16560.0, $c['qty_dasar']);
        $this->assertSame(12, $c['isi_per_satuan']);
        $this->assertSame(442.5, $c['harga_per_satuan_dasar']);
        $this->assertSame(8133858.0, round($c['nilai_dpp'] * 1.11, 2));
        $this->assertSame([], $c['peringatan']);

        // Transaksi dalam satuan dasar: tidak ada konversi.
        $p = MutasiReportService::convertToBaseUnit(
            ['jumlah' => 5520, 'jumlah_transaksi' => 5520, 'satuan_transaksi' => 'Pcs', 'harga_satuan' => 2581.22],
            $item
        );
        $this->assertFalse($p['is_konversi']);
        $this->assertSame(5520.0, $p['qty_dasar']);
    }

    public function test_suspicious_placeholder_value(): void
    {
        $this->assertTrue(MutasiReportService::isSuspiciousValue(999999.0));
        $this->assertFalse(MutasiReportService::isSuspiciousValue(8133858.0));
    }
}
