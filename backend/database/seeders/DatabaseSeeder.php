<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command->info('Starting Database Seeding...');

        $this->call(PermissionSeeder::class);

        // Password hashing is handled by User model's 'hashed' cast
        $user = User::create([
            'username'     => 'MJDS-SuperAdmin',
            'namaLengkap'  => 'Administrator Super',
            'password'     => 'Mjds@123',
            'role'         => 'Superadmin',
        ]);

        $user->assignRole('Superadmin');

        // Explicit relational order to prevent Foreign Key constraints
        $this->call([
            // Independent Tables
            CompanyProfileSeeder::class,
            CategorySeeder::class,
            UnitSeeder::class,
            LocationSeeder::class,
            PartnerSeeder::class,
            
            // Dependent Tables (requires Category, Unit, Location, Partner)
            ItemSeeder::class,
        ]);

        $this->command->info('All seeders executed successfully!');
    }
}