<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleBasedAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_can_access_restricted_module()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        // Create distinct users with different roles
        $superadminRole = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $superadmin = User::forceCreate([
            'username' => 'super_user',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Super Admin',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $superadmin->assignRole($superadminRole);

        $permissionWeb = Permission::firstOrCreate(['name' => 'create_master_barang', 'guard_name' => 'web']);
        $superadmin->givePermissionTo($permissionWeb);

        // Assert that a 'Superadmin' accessing a restricted module receives a 200 OK
        Sanctum::actingAs($superadmin, ['*']);
        $response = $this->postJson('/api/items', [
            'nama' => 'Testing Item Auth',
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'stok' => 0,
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $response->assertStatus(200);
    }

    public function test_guest_cannot_access_restricted_module()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $guestRole = Role::firstOrCreate(['name' => 'guest', 'guard_name' => 'web']);
        $guest = User::forceCreate([
            'username' => 'guest_user',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Guest User',
            'status' => 'aktif',
            'role' => 'guest',
        ]);
        $guest->assignRole($guestRole);

        // Assert that a 'Guest' accessing the same restricted module receives a 403 Forbidden
        Sanctum::actingAs($guest, ['*']);
        $response = $this->postJson('/api/items', [
            'nama' => 'Testing Item Auth Guest',
            'tipeBarang' => 'Bahan Baku',
            'kategori' => 'Kategori A',
            'satuan_dasar' => 'Pcs',
            'stok' => 0,
            'hargaJual' => 0,
            'hargaBeli' => 0
        ]);

        $response->assertStatus(403);
    }
}
