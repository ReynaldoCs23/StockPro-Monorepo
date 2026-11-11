<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seragamkan kolom nominal uang menjadi DECIMAL(18,2).
 * Hanya MEMPERLEBAR presisi (15,2 -> 18,2): tidak ada data yang hilang atau berubah nilainya.
 * Default dan nullable tiap kolom dipertahankan.
 */
return new class extends Migration
{
    /** tabel => [kolom => nullable?] */
    private array $columns = [
        'transactions' => [
            'totalTransaksi' => true,
            'potongan_harga' => false,
            'uang_muka' => false,
            'dpp' => false,
            'ppnbm' => false,
            'pajak_nominal' => false,
        ],
        'transaction_details' => ['harga_satuan' => false],
        'items' => ['hargaBeli' => false, 'hargaBeli_besar' => false, 'hargaJual' => false, 'hargaJual_besar' => false],
        'item_batches' => ['harga_modal_satuan' => false],
    ];

    public function up(): void
    {
        $this->alter(18);
    }

    public function down(): void
    {
        $this->alter(15);
    }

    private function alter(int $precision): void
    {
        foreach ($this->columns as $table => $cols) {
            Schema::table($table, function (Blueprint $t) use ($cols, $precision) {
                foreach ($cols as $col => $nullable) {
                    $c = $t->decimal($col, $precision, 2);
                    $nullable ? $c->nullable()->change() : $c->default(0)->change();
                }
            });
        }
    }
};
