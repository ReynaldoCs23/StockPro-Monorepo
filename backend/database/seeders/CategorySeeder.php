<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['idKategori' => 'KTG-001', 'nama' => 'Galon'],
            ['idKategori' => 'KTG-002', 'nama' => 'Gelas'],
            ['idKategori' => 'KTG-003', 'nama' => 'Botol'],
            ['idKategori' => 'KTG-004', 'nama' => 'Karton'],
            ['idKategori' => 'KTG-005', 'nama' => 'Tutup Botol'],
        ];

        foreach ($categories as $category) {
            DB::table('categories')->updateOrInsert(
                ['idKategori' => $category['idKategori']],
                ['nama' => $category['nama'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
