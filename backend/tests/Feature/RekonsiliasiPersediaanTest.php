<?php

namespace Tests\Feature;

use App\Http\Controllers\DashboardController;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\User;
use App\Services\RekonsiliasiPersediaanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Rekonsiliasi Laporan Mutasi: persediaan dari buku batch FIFO (saldo awal + masuk - keluar = saldo akhir),
 * laba kotor konsisten dengan Dashboard, PPN kurang bayar.
 */
class RekonsiliasiPersediaanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $admin = User::forceCreate(['username' => 'rekon', 'password' => bcrypt('x'), 'namaLengkap' => 'Admin Rekon', 'status' => 'aktif', 'role' => 'Superadmin']);
        $admin->assignRole($role);
        foreach (['create_barang_masuk', 'create_barang_keluar'] as $p) {
            $admin->givePermissionTo(Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']));
        }
        Sanctum::actingAs($admin, ['*']);

        Supplier::create(['idSupplier' => 'SUP-R', 'nama' => 'SUPPLIER R', 'alamat' => '-', 'npwp' => '0', 'telp' => '-']);
        Customer::create(['idPelanggan' => 'CUS-R', 'nama' => 'CUSTOMER R', 'alamat' => '-', 'npwp' => '0', 'telp' => '-']);
        Item::create(['kodeBarang' => 'BRG-R', 'nama' => 'Barang R', 'stok' => 0, 'stok_booking' => 0, 'tipeBarang' => 'Barang Jadi',
            'kategori' => 'Test', 'satuan_dasar' => 'Pcs', 'hargaJual' => 2000, 'hargaBeli' => 0]);
    }

    private function beli(string $tanggal, int $qty, int $harga): void
    {
        $id = $this->postJson('/api/transaction/IN', [
            'idTransaksi' => 'INV-IN-R-' . uniqid(), 'tanggal' => $tanggal, 'sumber_tujuan' => 'Dari Supplier',
            'namaSupplier' => 'SUPPLIER R', 'pajak_persen' => 11,
            'items' => [['kodeBarang' => 'BRG-R', 'namaBarang' => 'Barang R', 'jumlah' => $qty, 'jumlah_transaksi' => $qty, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => $harga]],
            'log_user' => 'Admin Rekon', 'log_detail' => 'beli',
        ])->assertStatus(200)->json('idTransaksi');
        $this->postJson("/api/transaction/{$id}/approve")->assertStatus(200);
    }

    private function jual(string $tanggal, int $qty, int $harga): void
    {
        $id = $this->postJson('/api/transaction/OUT', [
            'idTransaksi' => 'INV-OUT-R-' . uniqid(), 'tanggal' => $tanggal, 'tujuan' => 'Penjualan ke Customer', 'sumber_tujuan' => 'Penjualan ke Customer',
            'namaPembeli' => 'CUSTOMER R', 'pajak_persen' => 11,
            'items' => [['kodeBarang' => 'BRG-R', 'namaBarang' => 'Barang R', 'jumlah' => $qty, 'jumlah_transaksi' => $qty, 'satuan_transaksi' => 'Pcs', 'harga_satuan' => $harga]],
            'log_user' => 'Admin Rekon', 'log_detail' => 'jual',
        ])->assertStatus(200)->json('idTransaksi');
        $this->postJson("/api/transaction/{$id}/approve")->assertStatus(200);
    }

    public function test_saldo_awal_hpp_fifo_laba_dan_ppn(): void
    {
        $this->beli('2026-01-10', 100, 1000);   // batch 100 @ 1.000
        $this->jual('2026-01-20', 30, 2000);    // HPP 30.000
        $this->beli('2026-02-05', 50, 1200);    // batch 50 @ 1.200
        $this->jual('2026-02-10', 80, 2000);    // FIFO: 70 @ 1.000 + 10 @ 1.200 = 82.000

        $svc = new RekonsiliasiPersediaanService();

        $jan = $svc->build('2026-01-01', '2026-01-31');
        $this->assertSame('0.00', $jan['persediaan']['saldo_awal']);
        $this->assertSame('100000.00', $jan['persediaan']['masuk']['pembelian']);
        $this->assertSame('30000.00', $jan['persediaan']['keluar']['hpp_penjualan']);
        $this->assertSame('70000.00', $jan['persediaan']['saldo_akhir']);

        $feb = $svc->build('2026-02-01', '2026-02-28');
        // Saldo awal Februari = saldo akhir Januari
        $this->assertSame('70000.00', $feb['persediaan']['saldo_awal']);
        $this->assertSame('60000.00', $feb['persediaan']['masuk']['pembelian']);
        $this->assertSame('82000.00', $feb['persediaan']['keluar']['hpp_penjualan']);
        $this->assertSame('-22000.00', $feb['persediaan']['perubahan']);
        // Saldo akhir = sisa fisik batch: 40 pcs x 1.200
        $this->assertSame('48000.00', $feb['persediaan']['saldo_akhir']);
        $this->assertSame('0.00', $feb['cek_batch']['selisih']);

        // Penjualan & laba kotor (tanpa PPN)
        $this->assertSame('160000.00', $feb['penjualan']['penjualan_barang']);
        $this->assertSame('78000.00', $feb['penjualan']['laba_kotor_barang']);
        $this->assertSame('48.75', $feb['penjualan']['margin_barang_persen']);

        // PPN: keluaran DPP 146.667 x 12% = 17.600,04 -> 17.600 (desimal < 0,50 turun) ; masukan 55.000 x 12% = 6.600
        $this->assertSame('17600.00', $feb['pajak']['ppn_keluaran']);
        $this->assertSame('6600.00', $feb['pajak']['ppn_masukan']);
        $this->assertSame('11000.00', $feb['pajak']['ppn_kurang_bayar']);

        // Laba kotor total sama dengan perhitungan laba Dashboard
        $dash = app(DashboardController::class)->getProfitAnalyticsBase('2026-02-01 00:00:00', '2026-02-28 23:59:59');
        $this->assertEqualsWithDelta((float) $feb['penjualan']['laba_kotor_total'], $dash['grand_total_profit'], 0.001);
    }

    public function test_laporan_mutasi_memuat_rekonsiliasi_baru(): void
    {
        $this->beli('2026-01-10', 10, 1000);
        $this->jual('2026-01-20', 4, 2000);

        $r = $this->getJson('/api/reports/mutasi?start_date=2026-01-01&end_date=2026-01-31')->assertOk()->json();
        $this->assertSame('6000.00', $r['rekonsiliasi']['persediaan']['saldo_akhir']); // 10.000 - 4.000
        $this->assertSame('4000.00', $r['rekonsiliasi']['penjualan']['laba_kotor_barang']); // 8.000 - 4.000
        $this->assertSame(2, $r['audit']['canonical_version']);
    }
}
