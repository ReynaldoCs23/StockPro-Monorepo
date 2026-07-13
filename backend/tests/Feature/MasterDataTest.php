<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MasterDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_access_master_data_without_authentication()
    {
        // Attempt to fetch the /api/items endpoint WITHOUT authentication
        // Note: Using POST here as it is the guarded endpoint in MasterDataController
        $response = $this->postJson('/api/items', [
            'nama' => 'Test Item'
        ]);

        // Assert a 401 (Unauthorized) status
        $response->assertStatus(401);
    }

    public function test_admin_can_access_master_data()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        // Setup Role
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        
        // Authenticate as an Admin
        $admin = User::forceCreate([
            'username' => 'testadmin',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Test',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $admin->assignRole($role);

        $permissionWeb = Permission::firstOrCreate(['name' => 'create_master_barang', 'guard_name' => 'web']);
        $admin->givePermissionTo($permissionWeb);

        // Fetch /api/items
        Sanctum::actingAs($admin, ['*']);
        $this->withoutExceptionHandling();
        $response = $this->postJson('/api/items', [
            'nama' => 'Test Item Baru',
            'tipeBarang' => 'Bahan Baku',
            'stok' => 0,
            'satuan_dasar' => 'Pcs',
            'kategori' => 'Kategori A',
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        // Assert a 200 status with the correct JSON structure
        $response->assertStatus(200)
                 ->assertJson(['status' => 'success']);
                 
        // Clean up or verify in DB
        $this->assertDatabaseHas('items', [
            'nama' => 'Test Item Baru'
        ]);
    }
}
