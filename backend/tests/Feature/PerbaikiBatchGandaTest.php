<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Services\RekonsiliasiPersediaanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PerbaikiBatchGandaTest extends TestCase
{
    use RefreshDatabase;

    private function siapkanKasusDobel(): void
    {
        Item::create(['kodeBarang' => 'BRG-X', 'nama' => 'X', 'stok' => 0, 'stok_booking' => 0, 'tipeBarang' => 'Barang Jadi',
            'kategori' => 'T', 'satuan_dasar' => 'Pcs', 'hargaJual' => 0, 'hargaBeli' => 0]);
        DB::table('users')->insert(['id' => 99, 'username' => 'u', 'password' => 'x', 'namaLengkap' => 'U', 'status' => 'aktif', 'role' => 'Superadmin']);
        DB::table('stock_adjustments')->insert(['adjustment_number' => 'ADJ-T-1', 'item_id' => 'BRG-X', 'user_id' => 99,
            'adjustment_type' => 'addition', 'quantity' => 90, 'reason' => 'Sisa Stok', 'created_at' => now(), 'updated_at' => now()]);
        // Batch pembelian dikoreksi jadi 100, tetapi hanya 10 dipakai darinya; 90 sisanya ditambal lewat batch penyesuaian
        DB::table('item_batches')->insert([
            ['id_batch' => 'B-BELI', 'kodeBarang' => 'BRG-X', 'idTransaksi_masuk' => 'INV-IN-T', 'tanggal_masuk' => '2026-01-10', 'qty_awal' => 100, 'qty_sisa' => 0, 'qty_booking' => 0, 'harga_modal_satuan' => 500],
            ['id_batch' => 'B-ADJ', 'kodeBarang' => 'BRG-X', 'idTransaksi_masuk' => 'ADJ-T-1', 'tanggal_masuk' => '2026-10-06', 'qty_awal' => 90, 'qty_sisa' => 0, 'qty_booking' => 0, 'harga_modal_satuan' => 500],
        ]);
        DB::table('transaction_batch_details')->insert([
            ['idTransaksi' => 'OUT-1', 'id_batch' => 'B-BELI', 'qty_diambil' => 10],
            ['idTransaksi' => 'OUT-1', 'id_batch' => 'B-ADJ', 'qty_diambil' => 40],
            ['idTransaksi' => 'OUT-2', 'id_batch' => 'B-ADJ', 'qty_diambil' => 50],
        ]);
    }

    public function test_mode_uji_tidak_mengubah_data(): void
    {
        $this->siapkanKasusDobel();
        $this->artisan('stok:perbaiki-batch-ganda', ['batch_tujuan' => 'B-BELI', 'batch_sumber' => 'B-ADJ'])->assertSuccessful();
        $this->assertSame(90, (int) DB::table('item_batches')->where('id_batch', 'B-ADJ')->value('qty_awal'));
        $this->assertSame(2, DB::table('transaction_batch_details')->where('id_batch', 'B-ADJ')->count());
    }

    public function test_jalankan_menghapus_catatan_dobel_tanpa_mengubah_stok_dan_hpp(): void
    {
        $this->siapkanKasusDobel();
        $svc = new RekonsiliasiPersediaanService();
        $this->assertSame('45000.00', $svc->build('2026-01-01', '2026-12-31')['cek_batch']['selisih']); // 90 x 500

        $this->artisan('stok:perbaiki-batch-ganda', ['batch_tujuan' => 'B-BELI', 'batch_sumber' => 'B-ADJ', '--jalankan' => true])->assertSuccessful();

        $this->assertSame(100, (int) DB::table('transaction_batch_details')->where('id_batch', 'B-BELI')->sum('qty_diambil'));
        $this->assertSame(0, (int) DB::table('item_batches')->where('id_batch', 'B-ADJ')->value('qty_awal'));
        $this->assertStringContainsString('Koreksi', DB::table('stock_adjustments')->where('adjustment_number', 'ADJ-T-1')->value('reason'));

        $r = $svc->build('2026-01-01', '2026-12-31');
        $this->assertSame('0.00', $r['cek_batch']['selisih']);
        $this->assertSame('0.00', $r['persediaan']['saldo_akhir']); // = sisa fisik (0)

        // Dijalankan lagi: ditolak, tidak ada perubahan
        $this->artisan('stok:perbaiki-batch-ganda', ['batch_tujuan' => 'B-BELI', 'batch_sumber' => 'B-ADJ', '--jalankan' => true])->assertFailed();
    }

    public function test_menolak_bila_harga_batch_berbeda(): void
    {
        $this->siapkanKasusDobel();
        DB::table('item_batches')->where('id_batch', 'B-ADJ')->update(['harga_modal_satuan' => 600]);
        $this->artisan('stok:perbaiki-batch-ganda', ['batch_tujuan' => 'B-BELI', 'batch_sumber' => 'B-ADJ', '--jalankan' => true])->assertFailed();
        $this->assertSame(90, (int) DB::table('item_batches')->where('id_batch', 'B-ADJ')->value('qty_awal'));
    }
}
