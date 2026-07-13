<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CompanyProfileSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('company_profiles')->insert([
            'nama' => 'PT Mara Jaya Dewi Sakti',
            'alamat' => 'Jl. Kumba Karna No.1, Baktiseraga, Buleleng, Bali 81119',
            'npwp' => '0016249542902000',
            'penanggung_jawab' => 'GEDE ARIADI',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
