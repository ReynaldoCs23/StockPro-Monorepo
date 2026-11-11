<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Nominal transaksi dihitung backend (InvoiceCalculator) dan sama persis dengan faktur Coretax;
 * nilai total/PPN/DPP kiriman frontend diabaikan.
 */
class NominalTransaksiTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected function setUp(): void
    {
        parent::setUp();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $this->admin = User::forceCreate([
            'username' => 'testnominal',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Nominal',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $this->admin->assignRole($role);
        $this->admin->givePermissionTo(Permission::firstOrCreate(['name' => 'create_barang_masuk', 'guard_name' => 'web']));

        Supplier::create(['idSupplier' => 'SUP-NOM', 'nama' => 'KARTIKA AGUNG DEWATA', 'alamat' => '-', 'npwp' => '0', 'telp' => '-']);
        foreach ([['RM-PET', 'PET 3025'], ['BRG-GLS', 'Air Mineral Gelas 250ml'], ['BRG-GLN', 'Air Mineral Galon 19 Ltr']] as [$kode, $nama]) {
            Item::create([
                'kodeBarang' => $kode, 'nama' => $nama, 'stok' => 0, 'stok_booking' => 0,
                'tipeBarang' => 'Bahan Baku', 'kategori' => 'Test', 'satuan_dasar' => 'Pcs',
                'hargaJual' => 0, 'hargaBeli' => 0,
            ]);
        }
    }

    private function postInbound(array $items, array $extra = []): string
    {
        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/IN', array_merge([
            'idTransaksi' => 'INV-IN-NOM-' . uniqid(),
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Dari Supplier',
            'namaSupplier' => 'KARTIKA AGUNG DEWATA',
            'pajak_persen' => 11,
            // Nilai "frontend" yang salah — harus diabaikan backend
            'totalTransaksi' => 1, 'pajak_nominal' => 1, 'dpp' => 1, 'subtotal' => 1,
            'items' => $items,
            'log_user' => 'Admin Nominal',
            'log_detail' => 'Test nominal',
        ], $extra));
        $response->assertStatus(200);
        return $response->json('idTransaksi');
    }

    public function test_faktur_coretax_inv_in_0006_harga_jual_dibulatkan_ke_rupiah(): void
    {
        $id = $this->postInbound([
            ['kodeBarang' => 'RM-PET', 'namaBarang' => 'PET 3025', 'jumlah' => 2160, 'jumlah_transaksi' => 2160, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => 909.91],
        ]);

        $trx = DB::table('transactions')->where('idTransaksi', $id)->first();
        $this->assertSame('1801622.00', $trx->dpp);
        $this->assertSame('216195.00', $trx->pajak_nominal);
        $this->assertSame('2181601.00', $trx->totalTransaksi);
    }

    public function test_contoh_user_multi_item_720720_180180_900900(): void
    {
        $id = $this->postInbound([
            ['kodeBarang' => 'BRG-GLS', 'namaBarang' => 'Gelas', 'jumlah' => 40, 'jumlah_transaksi' => 40, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => 18018],
            ['kodeBarang' => 'BRG-GLN', 'namaBarang' => 'Galon', 'jumlah' => 20, 'jumlah_transaksi' => 20, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => 9009],
        ]);

        $trx = DB::table('transactions')->where('idTransaksi', $id)->first();
        $this->assertSame('825825.00', $trx->dpp);
        $this->assertSame('99099.00', $trx->pajak_nominal);
        $this->assertSame('999999.00', $trx->totalTransaksi);

        // API daftar transaksi mengirim harga jual per baris & subtotal sebagai angka desimal (bukan string berformat)
        Sanctum::actingAs($this->admin, ['*']);
        $row = collect($this->getJson('/api/transactions?type=IN')->json('data'))->firstWhere('idTransaksi', $id);
        $this->assertNotNull($row, 'Transaksi harus muncul di API daftar transaksi');
        $this->assertSame('900900.00', $row['subtotal_harga_jual']);
        $this->assertEqualsCanonicalizing(['720720.00', '180180.00'], array_column($row['items'], 'subtotal_baris'));
    }

    public function test_potongan_mengurangi_dpp_ppn_dan_total(): void
    {
        $id = $this->postInbound([
            ['kodeBarang' => 'RM-PET', 'namaBarang' => 'PET 3025', 'jumlah' => 10, 'jumlah_transaksi' => 10, 'satuan_transaksi' => 'Pcs', 'harga_modal_satuan' => 100000],
        ], ['potongan_harga' => 100000]);

        $trx = DB::table('transactions')->where('idTransaksi', $id)->first();
        $this->assertSame('825000.00', $trx->dpp);
        $this->assertSame('99000.00', $trx->pajak_nominal);
        $this->assertSame('999000.00', $trx->totalTransaksi);
    }

    public function test_endpoint_pratinjau_sama_dengan_yang_disimpan_dan_butuh_login(): void
    {
        $this->postJson('/api/transactions/hitung-nominal', ['jenis' => 'IN', 'items' => []])->assertStatus(401);

        Sanctum::actingAs($this->admin, ['*']);
        $this->postJson('/api/transactions/hitung-nominal', [
            'jenis' => 'IN', 'pajak_persen' => 11,
            'items' => [['qty' => 2160, 'harga' => 909.91]],
        ])->assertOk()->assertJson([
            'lines' => ['1965406.00'], 'subtotal' => '1965406.00', 'dpp' => '1801622.00', 'ppn' => '216195.00', 'total' => '2181601.00',
        ]);

        // Kirim ke Vendor Makloon bukan penjualan: nominal tetap 0 (aturan lama)
        $this->postJson('/api/transactions/hitung-nominal', [
            'jenis' => 'OUT', 'is_makloon' => true, 'pajak_persen' => 11,
            'items' => [['qty' => 10, 'harga' => 1000]],
        ])->assertOk()->assertJson(['total' => '0.00', 'ppn' => '0.00']);
    }
}
