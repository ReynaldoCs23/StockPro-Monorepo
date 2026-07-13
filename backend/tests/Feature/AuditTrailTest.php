<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    public function test_transaction_deletion_logs_to_audit_trail()
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $role = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $admin = User::forceCreate([
            'username' => 'testadmin',
            'password' => bcrypt('password'),
            'namaLengkap' => 'Admin Test',
            'status' => 'aktif',
            'role' => 'Superadmin',
        ]);
        $admin->assignRole($role);

        $permissionWeb = Permission::firstOrCreate(['name' => 'delete_barang_masuk', 'guard_name' => 'web']);
        $admin->givePermissionTo($permissionWeb);

        // Create an existing transaction in the setup phase
        Transaction::create([
            'idTransaksi' => 'INV-TEST-DELETE',
            'type' => 'IN',
            'tanggal' => now()->format('Y-m-d'),
            'status' => 'completed',
        ]);

        // Execute a DELETE request on that transaction
        Sanctum::actingAs($admin, ['*']);
        $response = $this->deleteJson('/api/transaction/IN/INV-TEST-DELETE', [
            'log_user' => $admin->namaLengkap,
            'log_detail' => 'Hapus Transaksi INV-TEST-DELETE'
        ]);

        // Critical Assertion: Assert the response is 200
        $response->assertStatus(200);

        // Assert transaction is deleted
        $this->assertDatabaseMissing('transactions', [
            'idTransaksi' => 'INV-TEST-DELETE'
        ]);

        // Critical Assertion: Assert the system_logs (or logs) database table has a new record
        $this->assertDatabaseHas('logs', [
            'user' => $admin->namaLengkap,
            'aksi' => 'DELETE',
            'modul' => 'transactions',
            'keterangan' => 'Hapus Transaksi INV-TEST-DELETE'
        ]);
    }
}
