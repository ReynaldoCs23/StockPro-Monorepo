<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Item;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use App\Events\StokUpdated;

class RealtimeBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_inbound_transaction_dispatches_realtime_event()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        // Use Laravel's Event::fake()
        Event::fake();

        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $admin = User::forceCreate([
            'username' => 'testadmin',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Test',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $admin->assignRole($role);

        $permissionWeb = Permission::firstOrCreate(['name' => 'create_barang_masuk', 'guard_name' => 'web']);
        $admin->givePermissionTo($permissionWeb);

        $item = Item::create([
            'kodeBarang' => 'ITM-SYNC-01',
            'nama' => 'Sync Item',
            'stok' => 0,
            'stok_booking' => 0,
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $supplier = Supplier::create([
            'idSupplier' => 'SUP-SYNC-01',
            'nama' => 'Test Supplier',
            'alamat' => 'Alamat Test',
            'npwp' => '000000000',
            'telp' => '08123456789'
        ]);

        $payload = [
            'idTransaksi' => 'INV-IN-SYNC',
            'tanggal' => now()->format('Y-m-d'),
            'sumber_tujuan' => 'Supplier',
            'namaSupplier' => $supplier->nama,
            'items' => [
                [
                    'kodeBarang' => $item->kodeBarang,
                    'namaBarang' => $item->nama,
                    'jumlah' => 10,
                    'satuan_transaksi' => 'Pcs',
                    'harga_modal_satuan' => 100,
                ]
            ],
            'log_user' => $admin->namaLengkap,
            'log_detail' => 'Sync Test'
        ];

        // Execute an Inbound stock mutation
        Sanctum::actingAs($admin, ['*']);
        $response = $this->postJson('/api/transaction/IN', $payload);
        $response->assertStatus(200);

        // Critical Assertion: Assert that the specific event was dispatched accurately
        Event::assertDispatched(StokUpdated::class);
    }
}
