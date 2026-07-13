<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $units = [
            ['id' => 1, 'nama_satuan' => 'Pcs'],
            ['id' => 2, 'nama_satuan' => 'Box'],
            ['id' => 3, 'nama_satuan' => 'Kg'],
            ['id' => 4, 'nama_satuan' => 'Litter'],
            ['id' => 5, 'nama_satuan' => 'Unit'],
        ];

        foreach ($units as $unit) {
            DB::table('satuans')->updateOrInsert(
                ['id' => $unit['id']],
                ['nama_satuan' => $unit['nama_satuan'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
