<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\User;
use App\Services\InvoiceCalculator as C;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Baris penutup tiap bagian Laporan Mutasi: Subtotal (tanpa PPN), DPP = Subtotal x 11/12, PPN = Subtotal x 11%,
 * Total = Subtotal + PPN; dibulatkan 2 desimal per baris lalu dijumlahkan. Selisih dengan subtotal lama dicatat di log.
 */
class LaporanMutasiRincianPpnTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $u = User::forceCreate(['username' => 'lm', 'password' => bcrypt('x'), 'namaLengkap' => 'LM', 'status' => 'aktif', 'role' => 'Superadmin']);
        $u->assignRole($role);
        foreach (['create_barang_masuk', 'create_barang_keluar'] as $p) {
            $u->givePermissionTo(Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']));
        }
        Sanctum::actingAs($u, ['*']);
        Supplier::create(['idSupplier' => 'S1', 'nama' => 'SUP', 'alamat' => '-', 'npwp' => '0', 'telp' => '-']);
        Customer::create(['idPelanggan' => 'C1', 'nama' => 'CUS', 'alamat' => '-', 'npwp' => '0', 'telp' => '-']);
        Item::create(['kodeBarang' => 'PET', 'nama' => 'PET', 'stok' => 0, 'stok_booking' => 0, 'tipeBarang' => 'Bahan Baku', 'kategori' => 'T', 'satuan_dasar' => 'Pcs', 'hargaJual' => 0, 'hargaBeli' => 0]);
    }

    private function masuk(string $tgl, int $qty, $harga): void
    {
        $id = $this->postJson('/api/transaction/IN', [
            'idTransaksi' => 'INV-IN-LM-' . uniqid(), 'tanggal' => $tgl, 'sumber_tujuan' => 'Dari Supplier', 'namaSupplier' => 'SUP', 'pajak_persen' => 11,
            'items' => [['kodeBarang' => 'PET', 'namaBarang' => 'PET', 'jumlah' => $qty, 'jumlah_transaksi' => $qty, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => $harga]],
            'log_user' => 'LM', 'log_detail' => 'x',
        ])->assertStatus(200)->json('idTransaksi');
        $this->postJson("/api/transaction/{$id}/approve")->assertStatus(200);
    }

    public function test_empat_baris_penutup_bagian_dan_pembanding_subtotal_lama(): void
    {
        Log::spy();
        $this->masuk('2026-01-22', 2160, 909.91);   // harga jual 1.965.406 ; PPN faktur 216.195 ; total 2.181.601
        $this->masuk('2026-01-25', 10, 100000);     // 1.000.000 ; DPP 916.667 ; PPN faktur 110.000 ; total 1.110.000

        $r = $this->getJson('/api/reports/mutasi?start_date=2026-01-01&end_date=2026-01-31')->assertOk()->json();
        $rin = $r['summary']['inbound']['rincian'];

        // Subtotal = nilai sebelum PPN tersimpan ; DPP 11/12 ; PPN 11% ; per baris 2 desimal lalu dijumlah
        //  baris 1: 1.965.406,00 -> DPP 1.801.622,17 ; PPN 216.194,66 ; total 2.181.600,66
        //  baris 2: 1.000.000,00 -> DPP   916.666,67 ; PPN 110.000,00 ; total 1.110.000,00
        $this->assertSame('2965406.00', $rin['subtotal']);
        $this->assertSame('2718288.84', $rin['dpp']);
        $this->assertSame('326194.66', $rin['ppn']);
        $this->assertSame('3291600.66', $rin['total']);

        // Total = Subtotal + PPN ; PPN = Subtotal x 11% ; DPP x 12% = PPN (per baris)
        $this->assertSame($rin['total'], bcadd($rin['subtotal'], $rin['ppn'], 2));
        foreach ($r['inbound_data'] as $row) {
            $b = $row['rincian_ppn'];
            $this->assertSame($b['ppn'], C::roundHalfUp(bcmul($b['subtotal'], '0.11', 6), 2));
            $this->assertSame($b['ppn'], C::roundHalfUp(bcmul($b['dpp'], '0.12', 6), 2));
        }

        // Pembanding subtotal lama (jumlah Total Nilai per baris dibulatkan ke rupiah): 2.181.601 + 1.110.000
        $this->assertSame('3291601.00', $rin['subtotal_lama']);
        $this->assertSame('-0.34', $rin['selisih_vs_lama']);
        Log::shouldHaveReceived('warning')->withArgs(fn ($m) => str_contains($m, 'Bagian I (Barang Masuk)') && str_contains($m, 'selisih -0.34'));

        // Bagian akhir (rekonsiliasi) tetap ada dan tidak terpengaruh — nilai persediaan dari batch (harga per unit x qty)
        $this->assertArrayHasKey('rekonsiliasi', $r);
        $this->assertSame('2965405.60', $r['rekonsiliasi']['persediaan']['masuk']['pembelian']); // 2.160 x 909,91 + 10 x 100.000
    }

    public function test_tanpa_selisih_tidak_ada_peringatan(): void
    {
        Log::spy();
        $this->masuk('2026-02-10', 10, 100000); // total lama 1.110.000 = 1.000.000 + 110.000
        $r = $this->getJson('/api/reports/mutasi?start_date=2026-02-01&end_date=2026-02-28')->assertOk()->json();
        $this->assertSame('0.00', $r['summary']['inbound']['rincian']['selisih_vs_lama']);
        $this->assertSame('1110000.00', $r['summary']['inbound']['rincian']['total']);
        Log::shouldNotHaveReceived('warning', [\Mockery::on(fn ($m) => str_contains((string) $m, 'Total baru'))]);
    }
}
