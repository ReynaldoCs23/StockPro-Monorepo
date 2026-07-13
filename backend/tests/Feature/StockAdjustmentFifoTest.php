<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use App\Models\ItemBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockAdjustmentFifoTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected function setUp(): void
    {
        parent::setUp();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // 2. Create the Role explicitly for the web guard
        $role = \Spatie\Permission\Models\Role::firstOrCreate([
            'name' => 'Superadmin', 
            'guard_name' => 'web'
        ]);

        // 3. Mock the User (bypass mass assignment)
        $this->admin = \App\Models\User::forceCreate([
            'username' => 'testcoverage',
            'namaLengkap' => 'Coverage Admin',
            'password' => bcrypt('password'),
        ]);

        // 4. Assign the Role object
        $this->admin->assignRole($role);

        // Grant explicit permissions
        $permInWeb = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'create_barang_masuk', 'guard_name' => 'web']);
        $permOutWeb = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'create_barang_keluar', 'guard_name' => 'web']);
        $permRetWeb = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'create_barang_return', 'guard_name' => 'web']);
        $permEditItems = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'edit_items', 'guard_name' => 'web']);
        
        $this->admin->givePermissionTo($permInWeb);
        $this->admin->givePermissionTo($permOutWeb);
        $this->admin->givePermissionTo($permRetWeb);
        $this->admin->givePermissionTo($permEditItems);
    }

    public function test_manual_stock_increase_automatically_creates_fifo_batch()
    {
        Sanctum::actingAs($this->admin, ['*']);

        $item = Item::create([
            'kodeBarang' => 'ITM-ADJ-01',
            'nama' => 'Test Item Adjustment',
            'stok' => 10,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 15000,
            'hargaBeli' => 10000,
        ]);

        $payload = [
            'kodeBarang' => 'ITM-ADJ-01',
            'nama' => 'Test Item Adjustment',
            'stok' => 15,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 15000,
            'hargaBeli' => 10000,
        ];

        // Ensure we send id_key=kodeBarang for MasterDataController@update
        $this->withoutExceptionHandling();
        Sanctum::actingAs($this->admin, ['*']);
        $this->withoutMiddleware();
        $response = $this->putJson("/api/items/{$item->kodeBarang}?id_key=kodeBarang", $payload);
        
        $response->assertSuccessful();

        $this->assertDatabaseHas('items', [
            'kodeBarang' => 'ITM-ADJ-01',
            'stok' => 15
        ]);

        $this->assertDatabaseHas('item_batches', [
            'kodeBarang' => 'ITM-ADJ-01',
            'idTransaksi_masuk' => 'MANUAL-ADJUSTMENT',
            'qty_awal' => 5,
            'qty_sisa' => 5,
        ]);
    }

    public function test_return_inbound_automatically_creates_fifo_batches()
    {
        Sanctum::actingAs($this->admin, ['*']);

        $item = Item::create([
            'kodeBarang' => 'ITM-RET-01',
            'nama' => 'Test Item Return',
            'stok' => 0,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 15000,
            'hargaBeli' => 10000,
        ]);

        $customer = \App\Models\Customer::create([
            'idPelanggan' => 'CUS-TEST-01',
            'nama' => 'Test Customer',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        $payload = [
            'idTransaksi' => 'RET-IN-TEST-01',
            'tanggal' => now()->format('Y-m-d H:i:s'),
            'jenisReturn' => 'RET_IN_RETURN_CUSTOMER',
            'sumber_tujuan' => 'Customer',
            'entitas' => $customer->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 5,
                    'satuan_transaksi' => 'Pcs',
                    'harga_satuan' => 15000,
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test Return Inbound',
        ];

        $this->withoutExceptionHandling();
        $response = $this->postJson('/api/transaction/RET', $payload);

        $response->assertSuccessful();

        $this->assertDatabaseHas('item_batches', [
            'kodeBarang' => 'ITM-RET-01',
            'qty_sisa' => 5,
        ]);
    }

    public function test_outbound_engine_can_deduct_from_non_standard_batches()
    {
        Sanctum::actingAs($this->admin, ['*']);

        $item = Item::create([
            'kodeBarang' => 'ITM-OUT-01',
            'nama' => 'Test Outbound Deduction',
            'stok' => 15,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 15000,
            'hargaBeli' => 10000,
        ]);

        ItemBatch::create([
            'id_batch' => 'ADJ-LOG-01',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'MANUAL-ADJUSTMENT',
            'qty_awal' => 5,
            'qty_sisa' => 5,
            'qty_booking' => 0,
            'tanggal_masuk' => now()->subDays(2)->format('Y-m-d H:i:s'),
            'harga_modal_satuan' => 10000,
            'idLokasi' => null,
            'lokasi_rak' => '-',
        ]);

        ItemBatch::create([
            'id_batch' => 'RET-IN-01',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'RET-IN-TEST-01',
            'qty_awal' => 10,
            'qty_sisa' => 10,
            'qty_booking' => 0,
            'tanggal_masuk' => now()->subDays(1)->format('Y-m-d H:i:s'),
            'harga_modal_satuan' => 10000,
            'idLokasi' => null,
            'lokasi_rak' => '-',
        ]);

        $customer = \App\Models\Customer::create([
            'idPelanggan' => 'CUS-TEST-02',
            'nama' => 'Test Customer 2',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        $payload = [
            'idTransaksi' => 'INV-OUT-TEST-01',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Customer',
            'namaPembeli' => $customer->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 7,
                    'satuan_transaksi' => 'Pcs',
                    'harga_satuan' => 15000,
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test Outbound Deduction',
        ];

        $this->withoutExceptionHandling();
        $response = $this->postJson('/api/transaction/OUT', $payload);

        $response->assertSuccessful();

        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'ADJ-LOG-01',
            'qty_sisa' => 0,
        ]);

        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'RET-IN-01',
            'qty_sisa' => 8,
        ]);
    }
}
