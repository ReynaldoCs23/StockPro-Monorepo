<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use App\Models\ItemBatch;
use App\Models\Bom;
use App\Models\BomDetail;
use App\Models\Supplier;
use App\Models\MakloonOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MakloonBomTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $this->admin = User::forceCreate([
            'username' => 'testadmin',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Test',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $this->admin->assignRole($role);

        $permissionWeb = Permission::firstOrCreate(['name' => 'create_makloon', 'guard_name' => 'web']);
        $this->admin->givePermissionTo($permissionWeb);
    }

    public function test_makloon_outbound_deducts_raw_materials_via_bom()
    {
        // Seed a 'Produk Jadi' (Finished Good)
        $finishedGood = Item::create([
            'kodeBarang' => 'ITM-FG-01',
            'nama' => 'Produk Jadi Test',
            'stok' => 0,
            'tipeBarang' => 'Produk Jadi',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        // Seed multiple 'Bahan Baku' (Raw Materials)
        $rawA = Item::create([
            'kodeBarang' => 'ITM-RAW-A',
            'nama' => 'Raw Material A',
            'stok' => 50,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori B',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);
        ItemBatch::create([
            'id_batch' => 'BCH-RAWA', 'kodeBarang' => $rawA->kodeBarang, 'qty_sisa' => 50, 'qty_awal' => 50, 'qty_booking' => 0, 'tanggal_masuk' => now(), 'idTransaksi_masuk' => 'INV-IN-TEST-SETUP'
        ]);

        $rawB = Item::create([
            'kodeBarang' => 'ITM-RAW-B',
            'nama' => 'Raw Material B',
            'stok' => 100,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori B',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);
        ItemBatch::create([
            'id_batch' => 'BCH-RAWB', 'kodeBarang' => $rawB->kodeBarang, 'qty_sisa' => 100, 'qty_awal' => 100, 'qty_booking' => 0, 'tanggal_masuk' => now(), 'idTransaksi_masuk' => 'INV-IN-TEST-SETUP'
        ]);

        // Seed a BOM linking them (1 FG = 2 Raw A and 5 Raw B)
        $bom = Bom::create([
            'id_bom' => 'BOM-TEST-01',
            'kode_produk' => $finishedGood->kodeBarang,
        ]);

        BomDetail::create(['id_bom' => $bom->id_bom, 'kode_bahan_baku' => $rawA->kodeBarang, 'jumlah_per_unit' => 2]);
        BomDetail::create(['id_bom' => $bom->id_bom, 'kode_bahan_baku' => $rawB->kodeBarang, 'jumlah_per_unit' => 5]);

        $vendor = Supplier::create([
            'idSupplier' => 'VEN-01',
            'nama' => 'Test Vendor',
            'tipe_partner' => 'vendor',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        $order = MakloonOrder::create([
            'wo_number' => 'WO-MKL-01',
            'id_vendor' => $vendor->idSupplier,
            'kode_produk' => $finishedGood->kodeBarang,
            'target_qty' => 10,
            'status' => 'Pending'
        ]);

        // Execute a Makloon activation/outbound transaction POST request
        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson("/api/makloon-orders/{$order->id}/send");
        $response->assertStatus(200);

        // Critical Assertion: Assert that the database correctly deducts the raw materials based on the BOM multiplier
        // Target FG Qty = 10. Multipliers: Raw A = 2, Raw B = 5.
        // Raw A: 50 - (10 * 2) = 30
        $this->assertDatabaseHas('items', ['kodeBarang' => $rawA->kodeBarang, 'stok' => 30]);
        // Raw B: 100 - (10 * 5) = 50
        $this->assertDatabaseHas('items', ['kodeBarang' => $rawB->kodeBarang, 'stok' => 50]);
        // Finished Good stock shouldn't change yet (it changes on receive)
        $this->assertDatabaseHas('items', ['kodeBarang' => $finishedGood->kodeBarang, 'stok' => 0]);
    }
}
