<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $modules = [
            'dashboard'      => ['view'],
            'barang_masuk'   => ['view', 'create', 'edit', 'delete'],
            'barang_keluar'  => ['view', 'create', 'edit', 'delete'],
            'barang_return'  => ['view', 'create', 'edit', 'delete'],
            'penyesuaian_stok' => ['view', 'create', 'edit', 'delete'],
            'makloon'        => ['view', 'create', 'edit', 'delete'],
            'master_barang'  => ['view', 'create', 'edit', 'delete'],
            'kategori'       => ['view', 'create', 'edit', 'delete'],
            'satuan'         => ['view', 'create', 'edit', 'delete'],
            'lokasi'         => ['view', 'create', 'edit', 'delete'],
            'supplier'       => ['view', 'create', 'edit', 'delete'],
            'pelanggan'      => ['view', 'create', 'edit', 'delete'],
            'laporan'        => ['view'],
            'manajemen_user' => ['view', 'create', 'edit', 'delete'],
            'ai_assistant'   => ['view'],
            'ai_forecasting' => ['view'],
        ];

        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(['name' => "{$action}_{$module}", 'guard_name' => 'web']);
            }
        }

        // Create roles
        $superadmin = Role::firstOrCreate(['name' => 'Superadmin', 'guard_name' => 'web']);
        $admin = Role::firstOrCreate(['name' => 'Admin', 'guard_name' => 'web']);
        $karyawan = Role::firstOrCreate(['name' => 'Karyawan', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'Guest', 'guard_name' => 'web']); // Zero default permissions

        // Superadmin & Admin get all permissions
        $superadmin->syncPermissions(Permission::all());
        $admin->syncPermissions(Permission::all());

        // Karyawan gets full CRUD on operational modules
        $karyawan->syncPermissions([
            'view_dashboard',
            'view_ai_assistant',
            'view_ai_forecasting',
            'view_barang_masuk', 'create_barang_masuk', 'edit_barang_masuk', 'delete_barang_masuk',
            'view_barang_keluar', 'create_barang_keluar', 'edit_barang_keluar', 'delete_barang_keluar',
            'view_barang_return', 'create_barang_return', 'edit_barang_return', 'delete_barang_return',
            'view_penyesuaian_stok', 'create_penyesuaian_stok', 'edit_penyesuaian_stok', 'delete_penyesuaian_stok',
            'view_makloon', 'create_makloon', 'edit_makloon', 'delete_makloon',
            'view_master_barang', 'create_master_barang', 'edit_master_barang', 'delete_master_barang',
            'view_kategori', 'create_kategori', 'edit_kategori', 'delete_kategori',
            'view_satuan', 'create_satuan', 'edit_satuan', 'delete_satuan',
            'view_lokasi', 'create_lokasi', 'edit_lokasi', 'delete_lokasi',
            'view_supplier', 'create_supplier', 'edit_supplier', 'delete_supplier',
            'view_pelanggan', 'create_pelanggan', 'edit_pelanggan', 'delete_pelanggan',
        ]);
    }
}
