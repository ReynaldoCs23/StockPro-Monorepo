<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use App\Models\Customer;
use App\Models\ItemBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Carbon\Carbon;

class FifoStockDeductionTest extends TestCase
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

        $permissionWeb = Permission::firstOrCreate(['name' => 'create_barang_keluar', 'guard_name' => 'web']);
        $this->admin->givePermissionTo($permissionWeb);
    }

    public function test_fifo_deduction_handles_multiple_batches()
    {
        // Seed an Item
        $item = Item::create([
            'kodeBarang' => 'ITM-FIFO-01',
            'nama' => 'Test FIFO Item',
            'stok' => 60,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $customer = Customer::create([
            'idPelanggan' => 'CUS-01',
            'nama' => 'Test Customer',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        // Oldest Batch: 10 qty
        ItemBatch::create([
            'id_batch' => 'BCH-OLD-01',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'INV-IN-01',
            'tanggal_masuk' => Carbon::now()->subDays(5)->format('Y-m-d H:i:s'),
            'qty_awal' => 10,
            'qty_sisa' => 10,
            'qty_booking' => 0,
            'harga_modal_satuan' => 100,
            'lokasi_rak' => 'Rak A',
        ]);

        // Newer Batch: 50 qty
        ItemBatch::create([
            'id_batch' => 'BCH-NEW-01',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'INV-IN-02',
            'tanggal_masuk' => Carbon::now()->subDays(1)->format('Y-m-d H:i:s'),
            'qty_awal' => 50,
            'qty_sisa' => 50,
            'qty_booking' => 0,
            'harga_modal_satuan' => 100,
            'lokasi_rak' => 'Rak B',
        ]);

        $payload = [
            'idTransaksi' => 'INV-OUT-0001',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Customer',
            'namaPembeli' => $customer->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 15,
                    'satuan_transaksi' => 'Pcs',
                    'harga_satuan' => 150,
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test FIFO Outbound'
        ];

        // Execute a POST request to create an Outbound transaction (INV-OUT) for 15 qty
        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/OUT', $payload);
        $response->assertStatus(200);

        // Critical Assertion: Assert that the oldest batch is fully depleted (0 qty)
        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'BCH-OLD-01',
            'qty_sisa' => 0
        ]);

        // Critical Assertion: Assert that the remaining 5 qty is deducted from the newer batch (45 qty remaining)
        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'BCH-NEW-01',
            'qty_sisa' => 45
        ]);

        // Critical Assertion: Assert the total item stock is properly synced
        $this->assertDatabaseHas('items', [
            'kodeBarang' => $item->kodeBarang,
            'stok' => 45
        ]);
    }
}
