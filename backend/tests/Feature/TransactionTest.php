<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use App\Models\Supplier;
use App\Models\Customer;
use App\Models\ItemBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected function setUp(): void
    {
        parent::setUp();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Setup Admin User with Transaction Permission
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        
        $this->admin = User::forceCreate([
            'username' => 'testadmin',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Test',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $this->admin->assignRole($role);

        // Grant explicit permissions for IN, OUT, and RET transactions
        $permInWeb = Permission::firstOrCreate(['name' => 'create_barang_masuk', 'guard_name' => 'web']);
        $permOutWeb = Permission::firstOrCreate(['name' => 'create_barang_keluar', 'guard_name' => 'web']);
        $permRetWeb = Permission::firstOrCreate(['name' => 'create_barang_return', 'guard_name' => 'web']);
        
        $this->admin->givePermissionTo($permInWeb);
        $this->admin->givePermissionTo($permOutWeb);
        $this->admin->givePermissionTo($permRetWeb);
    }

    public function test_can_create_inbound_transaction()
    {
        // Seed a mock Item and Supplier
        $item = Item::create([
            'kodeBarang' => 'ITM-TEST-01',
            'nama' => 'Test Inbound Item',
            'stok' => 0,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $supplier = Supplier::create([
            'idSupplier' => 'SUP-TEST-01',
            'nama' => 'Test Supplier',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        $payload = [
            'idTransaksi' => 'INV-IN-0001',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Supplier',
            'namaSupplier' => $supplier->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 50,
                    'satuan_transaksi' => 'Pcs',
                    'harga_modal_satuan' => 100,
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test Inbound'
        ];

        // Send a POST request to create an Inbound (INV-IN) transaction
        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/IN', $payload);

        // Assert the response is successful
        $response->assertStatus(200);
        
        // Approve transaction to trigger batch creation
        $actualId = $response->json('idTransaksi');
        $this->postJson('/api/transaction/' . $actualId . '/approve');

        // Critical Assertion: item_batches table has a new row
        $this->assertDatabaseHas('item_batches', [
            'kodeBarang' => $item->kodeBarang,
            'qty_awal' => 50,
        ]);

        // Critical Assertion: items stock has increased accurately
        $this->assertDatabaseHas('items', [
            'kodeBarang' => $item->kodeBarang,
            'stok' => 50
        ]);
    }

    public function test_outbound_deducts_stock_correctly()
    {
        // Seed an Item, Customer, and an existing item_batches record with 100 stock
        $item = Item::create([
            'kodeBarang' => 'ITM-TEST-02',
            'nama' => 'Test Outbound Item',
            'stok' => 100,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $customer = Customer::create([
            'idPelanggan' => 'CUS-TEST-01',
            'nama' => 'Test Customer',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        ItemBatch::create([
            'id_batch' => 'BCH-TEST-001',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'INV-IN-PREV',
            'tanggal_masuk' => now()->subDay()->format('Y-m-d H:i:s'),
            'qty_awal' => 100,
            'qty_sisa' => 100,
            'qty_booking' => 0,
            'harga_modal_satuan' => 100,
            'lokasi_rak' => 'Rak A',
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
                    'jumlah' => 20,
                    'satuan_transaksi' => 'Pcs',
                    'harga_satuan' => 150,
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test Outbound'
        ];

        // Send a POST request to create an Outbound (INV-OUT) transaction for 20 qty
        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/OUT', $payload);

        $response->assertStatus(200);
        
        // Approve transaction to trigger stock deduction
        $actualId = $response->json('idTransaksi');
        $this->postJson('/api/transaction/' . $actualId . '/approve');

        // Critical Assertion: item_batches quantity is reduced to 80
        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'BCH-TEST-001',
            'qty_sisa' => 80
        ]);

        // Critical Assertion: items stock has decreased accurately
        $this->assertDatabaseHas('items', [
            'kodeBarang' => $item->kodeBarang,
            'stok' => 80
        ]);

        // Critical Assertion: transactions table has the record
        $this->assertDatabaseHas('transactions', [
            'type' => 'OUT',
            'sumber_tujuan' => 'Customer'
        ]);

        // Critical Assertion: System Logs (Audit Trail) recorded the action
        $this->assertDatabaseHas('logs', [
            'user' => $this->admin->namaLengkap,
            'aksi' => 'CREATE',
            'modul' => 'transactions'
        ]);
    }

    public function test_return_vendor_uses_fifo_cost()
    {
        $this->withoutExceptionHandling();
        // Seed an Item, Supplier, and an existing item_batches record with 100 stock
        $item = Item::create([
            'kodeBarang' => 'ITM-TEST-RET',
            'nama' => 'Test Return Item',
            'stok' => 100,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 200, // This is selling price, should NOT be used for return
            'hargaBeli' => 120  // Master buy price, may differ from batch
        ]);

        $supplier = Supplier::create([
            'idSupplier' => 'SUP-TEST-RET',
            'nama' => 'Test Supplier Return',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        ItemBatch::create([
            'id_batch' => 'BCH-TEST-RET',
            'kodeBarang' => $item->kodeBarang,
            'idTransaksi_masuk' => 'INV-IN-RET',
            'tanggal_masuk' => now()->subDay()->format('Y-m-d H:i:s'),
            'qty_awal' => 100,
            'qty_sisa' => 100,
            'qty_booking' => 0,
            'harga_modal_satuan' => 150, // THIS is the FIFO cost that MUST be used
            'lokasi_rak' => 'Rak A',
        ]);

        $payload = [
            'idTransaksi' => 'RET-OUT-0001',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Supplier',
            'namaSupplier' => $supplier->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 10,
                    'satuan_transaksi' => 'Pcs',
                    'harga_satuan' => $item->hargaJual, // Client might send wrong price, backend should recalculate using FIFO!
                    'id_batch' => 'BCH-TEST-RET'
                ]
            ],
            'log_user' => $this->admin->namaLengkap,
            'log_detail' => 'Test Return FIFO',
            'jenisReturn' => 'RET_OUT_RETURN_SUPPLIER' // Required to trigger the correct logic
        ];

        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/RET', $payload);

        $response->assertStatus(200);

        // Fetch the generated ID dynamically
        $generatedId = \Illuminate\Support\Facades\DB::table('transactions')
            ->where('type', 'RET')
            ->orderByDesc('created_at')
            ->value('idTransaksi');

        $this->assertNotNull($generatedId, 'Generated RET_OUT transaction ID should not be null');

        // Assertion: Stock deducted properly
        $this->assertDatabaseHas('item_batches', [
            'id_batch' => 'BCH-TEST-RET',
            'qty_sisa' => 90
        ]);

        $this->assertDatabaseHas('items', [
            'kodeBarang' => $item->kodeBarang,
            'stok' => 90
        ]);

        // Critical Assertion: The recorded detail must use harga_modal_satuan (150) instead of hargaJual (200)
        // Check transaction details
        $this->assertDatabaseHas('transaction_details', [
            'idTransaksi' => $generatedId,
            'kodeBarang' => $item->kodeBarang,
            'harga_satuan' => 150 // Must be 150
        ]);

        // Menghitung ekspektasi total dengan PPN 11%
        $expectedBaseTotal = 1500;
        $taxRate = 0.11;
        $expectedTotalWithTax = $expectedBaseTotal + ($expectedBaseTotal * $taxRate); // 1665

        $this->assertDatabaseHas('transactions', [
            'idTransaksi' => $generatedId,
            'totalTransaksi' => $expectedTotalWithTax 
        ]);
    }
}
