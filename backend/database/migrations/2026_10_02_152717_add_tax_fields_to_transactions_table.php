<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('potongan_harga', 15, 2)->default(0)->after('totalTransaksi');
            $table->decimal('uang_muka', 15, 2)->default(0)->after('potongan_harga');
            $table->decimal('dpp', 15, 2)->default(0)->after('uang_muka');
            $table->decimal('ppnbm', 15, 2)->default(0)->after('dpp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['potongan_harga', 'uang_muka', 'dpp', 'ppnbm']);
        });
    }
};
