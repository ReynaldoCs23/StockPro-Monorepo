<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ItemSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'kodeBarang' => 'BRG-0001',
                'nama' => 'Air Mineral Galon 19 Ltr',
                'kategori' => 'Air mineral Galon',
                'tipeBarang' => 'Produk Jadi',
                'satuan_dasar' => 'Unit',
                'satuan_besar' => null,
                'rasio_konversi' => 1,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 9910,
                'hargaJual' => 40000
            ],
            [
                'kodeBarang' => 'BRG-0002',
                'nama' => 'Air Mineral Gelas 250ml',
                'kategori' => 'Air Mineral Cup',
                'tipeBarang' => 'Produk Jadi',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => 'Box',
                'rasio_konversi' => 48,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 12000,
                'hargaJual' => 15000
            ],
            [
                'kodeBarang' => 'BRG-0003',
                'nama' => 'Circle K Favorite Mineral Water 1500ML',
                'kategori' => 'Air Mineral Besar',
                'tipeBarang' => 'Produk Jadi',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => 'Box',
                'rasio_konversi' => 12,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 555,
                'hargaJual' => 2581
            ],
            [
                'kodeBarang' => 'RM-0001',
                'nama' => 'Carton Box Polos 1500 ML',
                'kategori' => 'Bahan Baku dan Kemasan',
                'tipeBarang' => 'BAHAN BAKU',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => null,
                'rasio_konversi' => 1,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 4505,
                'hargaJual' => 0
            ],
            [
                'kodeBarang' => 'RM-0002',
                'nama' => 'Cap 3025 LW Blank Blue 12 DF',
                'kategori' => 'Bahan Baku dan Kemasan',
                'tipeBarang' => 'BAHAN BAKU',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => null,
                'rasio_konversi' => 1,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 73,
                'hargaJual' => 0
            ],
            [
                'kodeBarang' => 'RM-0003',
                'nama' => 'PET 3025 Natural Free Market-2 1500 ML',
                'kategori' => 'Bahan Baku dan Kemasan',
                'tipeBarang' => 'BAHAN BAKU',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => null,
                'rasio_konversi' => 1,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 910,
                'hargaJual' => 0
            ],
                        [
                'kodeBarang' => 'RM-0004',
                'nama' => 'Galon Kosong 19L',
                'kategori' => 'Bahan Baku dan Kemasan',
                'tipeBarang' => 'BAHAN BAKU',
                'satuan_dasar' => 'Pcs',
                'satuan_besar' => null,
                'rasio_konversi' => 1,
                'stok' => 0,
                'minStok' => 0,
                'hargaBeli' => 20000,
                'hargaJual' => 0
            ], 
        ];

        foreach ($items as $item) {
            DB::table('items')->updateOrInsert(
                ['kodeBarang' => $item['kodeBarang']],
                [
                    'nama' => $item['nama'],
                    'kategori' => $item['kategori'],
                    'tipeBarang' => $item['tipeBarang'],
                    'satuan_dasar' => $item['satuan_dasar'],
                    'satuan_besar' => $item['satuan_besar'],
                    'rasio_konversi' => $item['rasio_konversi'],
                    'stok' => $item['stok'],
                    'minStok' => $item['minStok'],
                    'hargaBeli' => $item['hargaBeli'],
                    'hargaJual' => $item['hargaJual'],
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }
    }
}
