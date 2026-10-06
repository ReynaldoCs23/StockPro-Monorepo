<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            ['idLokasi' => 'WH-INT-001', 'nama' => 'Rak Barang Jadi', 'tipe_lokasi' => 'internal'],
            ['idLokasi' => 'WH-INT-002', 'nama' => 'Rak Bahan Baku', 'tipe_lokasi' => 'internal'],
        ];

        foreach ($locations as $loc) {
            DB::table('locations')->updateOrInsert(
                ['idLokasi' => $loc['idLokasi']],
                ['nama' => $loc['nama'], 'tipe_lokasi' => $loc['tipe_lokasi'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
