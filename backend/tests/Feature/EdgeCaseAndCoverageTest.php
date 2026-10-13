<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EdgeCaseAndCoverageTest extends TestCase
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

        // Grant explicit permissions for both IN and OUT transactions
        $permInWeb = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'create_barang_masuk', 'guard_name' => 'web']);
        $permOutWeb = \Spatie\Permission\Models\Permission::firstOrCreate(['name' => 'create_barang_keluar', 'guard_name' => 'web']);
        
        $this->admin->givePermissionTo($permInWeb);
        $this->admin->givePermissionTo($permOutWeb);
    }

    public function test_transaction_rejects_missing_required_fields()
    {
        $payload = [
            'idTransaksi' => 'INV-IN-BAD',
            'tanggal' => now()->format('Y-m-d'),
            // 'items' is missing entirely
        ];

        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/IN', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
    }

    public function test_transaction_rejects_negative_or_zero_quantity()
    {
        $item = Item::create([
            'kodeBarang' => 'ITM-BAD-01',
            'nama' => 'Test Item',
            'stok' => 0,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0,
        ]);

        $payload = [
            'idTransaksi' => 'INV-IN-BAD2',
            'tanggal' => now()->format('Y-m-d'),
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'jumlah' => 0, // Invalid quantity
                    'satuan_transaksi' => 'Pcs',
                ]
            ],
        ];

        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/IN', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items.0.jumlah']);
    }

    public function test_outbound_transaction_rejects_insufficient_stock()
    {
        $item = Item::create([
            'kodeBarang' => 'ITM-TEST-OVR',
            'nama' => 'Test Outbound Item',
            'stok' => 10, // Only 10 available
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0,
        ]);

        $payload = [
            'idTransaksi' => 'INV-OUT-OVR',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Customer',
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 100, // Try to overdraft
                ]
            ]
        ];

        Sanctum::actingAs($this->admin, ['*']);
        $response = $this->postJson('/api/transaction/OUT', $payload);

        // Expected 400 Bad Request
        $response->assertStatus(400);
        $response->assertJsonFragment(['status' => 'error']);
        
        // Assert stock was not deducted
        $this->assertDatabaseHas('items', [
            'kodeBarang' => $item->kodeBarang,
            'stok' => 10
        ]);
    }

    public function test_transaction_index_filtering()
    {
        Sanctum::actingAs($this->admin, ['*']);
        
        $response = $this->getJson('/api/transactions?category=inbound&filter=supplier');
        $response->assertStatus(200);

        $response = $this->getJson('/api/transactions?category=outbound&filter=makloon');
        $response->assertStatus(200);
    }

    public function test_satuan_crud_operations()
    {
        Sanctum::actingAs($this->admin, ['*']);

        // Create
        $response = $this->postJson('/api/satuans', ['nama_satuan' => 'Kilogram']);
        $response->assertStatus(200);
        $this->assertDatabaseHas('satuans', ['nama_satuan' => 'Kilogram']);
        $satuanId = $response->json('data.id');

        // Read
        $response = $this->getJson('/api/satuans');
        $response->assertStatus(200);

        // Update
        $response = $this->putJson("/api/satuans/{$satuanId}", ['nama_satuan' => 'Kg']);
        $response->assertStatus(200);
        $this->assertDatabaseHas('satuans', ['nama_satuan' => 'Kg']);

        // Delete
        $response = $this->deleteJson("/api/satuans/{$satuanId}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('satuans', ['nama_satuan' => 'Kg']);
    }

    public function test_company_profile_update()
    {
        Sanctum::actingAs($this->admin, ['*']);

        $payload = [
            'nama' => 'PT Test Corp',
            'alamat' => 'Jalan Test',
            'npwp' => '123456789',
            'penanggung_jawab' => 'Test PIC'
        ];

        $response = $this->postJson('/api/company-profile', $payload);
        $response->assertStatus(200);

        $this->assertDatabaseHas('company_profiles', ['nama' => 'PT Test Corp']);
    }

    public function test_dashboard_endpoint_returns_success()
    {
        // Seed an inventaris item and a barang jadi item with stock > 0
        \App\Models\Item::create([
            'kodeBarang' => 'INV-TEST-99',
            'nama' => 'Meja Kantor Inventaris',
            'stok' => 5,
            'stok_booking' => 0,
            'tipeBarang' => 'Barang Non Produksi/Inventaris',
            'kategori' => 'Inventaris',
            'satuan_dasar' => 'Unit',
            'hargaJual' => 0,
            'hargaBeli' => 500000
        ]);

        \App\Models\Item::create([
            'kodeBarang' => 'BRG-DEAD-99',
            'nama' => 'Barang Jadi Dead Stock',
            'stok' => 10,
            'stok_booking' => 0,
            'tipeBarang' => 'Barang Jadi',
            'kategori' => 'Produk',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 20000,
            'hargaBeli' => 10000
        ]);

        Sanctum::actingAs($this->admin, ['*']);

        $response = $this->getJson('/api/dashboard');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'pengeluaranVendor',
            'penjualanDistributor',
            'labaBersih',
            'chartData',
            'deadStock',
        ]);

        $deadStockCodes = collect($response->json('deadStock'))->pluck('kodeBarang')->toArray();
        $this->assertNotContains('INV-TEST-99', $deadStockCodes, 'Inventaris item should not be in deadStock');
        $this->assertContains('BRG-DEAD-99', $deadStockCodes, 'Barang Jadi item should be in deadStock');
    }

    public function test_api_responses_always_return_arrays_for_list_data()
    {
        Sanctum::actingAs($this->admin, ['*']);

        // Assert empty items endpoint
        $response = $this->getJson('/api/init');
        $response->assertStatus(200);
        
        // Use PHPUnit assertions to guarantee it's an array to prevent frontend UI crash
        $this->assertIsArray($response->json('items'), 'Items response data MUST be an array to prevent frontend `.some()` crash');
        $this->assertIsArray($response->json('suppliers'), 'Suppliers response data MUST be an array');

        // Assert empty transactions
        $response = $this->getJson('/api/transactions?category=inbound');
        $response->assertStatus(200);
        $this->assertIsArray($response->json('data'), 'Transactions data MUST be an array');

        // Dashboard specific assertion: when completely empty, chartData should still be structured correctly
        $response = $this->getJson('/api/dashboard');
        $response->assertStatus(200);
        $this->assertIsArray($response->json('chartData'), 'Dashboard chartData MUST be an array');
    }

    public function test_unauthenticated_user_cannot_access_secure_endpoints()
    {
        // No Sanctum authentication applied here intentionally for negative testing!
        
        $response = $this->getJson('/api/dashboard');
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);

        $response = $this->getJson('/api/transactions');
        $response->assertStatus(401);

        $payload = [
            'idTransaksi' => 'INV-OUT-HACK',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Customer',
            'items' => []
        ];

        $response = $this->postJson('/api/transaction/OUT', $payload);
        $response->assertStatus(401);
    }
}
