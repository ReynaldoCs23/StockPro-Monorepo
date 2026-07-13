<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['idKategori' => 'KTG-001', 'nama' => 'Air mineral Galon'],
            ['idKategori' => 'KTG-002', 'nama' => 'Air Mineral Besar'],
            ['idKategori' => 'KTG-003', 'nama' => 'Air Mineral Sedang'],
            ['idKategori' => 'KTG-004', 'nama' => 'Air Mineral Kecil'],
            ['idKategori' => 'KTG-005', 'nama' => 'Air Mineral Cup'],
            ['idKategori' => 'KTG-006', 'nama' => 'Bahan Baku dan Kemasan'],
        ];

        foreach ($categories as $category) {
            DB::table('categories')->updateOrInsert(
                ['idKategori' => $category['idKategori']],
                ['nama' => $category['nama'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
