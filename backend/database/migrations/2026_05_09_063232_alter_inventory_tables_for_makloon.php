<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (!Schema::hasColumn('items', 'tipe_barang')) {
                $table->enum('tipe_barang', ['bahan_baku', 'barang_jadi'])->default('bahan_baku')->after('tipeBarang');
            }
        });

        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'tipe_lokasi')) {
                $table->enum('tipe_lokasi', ['internal', 'vendor'])->default('internal')->after('nama');
            }
        });

        // Modify the enum for transactions type. 
        DB::statement("ALTER TABLE transactions MODIFY type ENUM('IN', 'OUT', 'RET', 'MAKLOON_OUT', 'MAKLOON_IN') NOT NULL");

        Schema::table('transaction_details', function (Blueprint $table) {
            if (!Schema::hasColumn('transaction_details', 'lokasi_tujuan')) {
                $table->string('lokasi_tujuan')->nullable()->after('harga_satuan');
            }
            if (!Schema::hasColumn('transaction_details', 'lokasi_rak')) {
                $table->string('lokasi_rak')->nullable()->after('lokasi_tujuan');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            if (Schema::hasColumn('transaction_details', 'lokasi_rak')) {
                $table->dropColumn('lokasi_rak');
            }
            if (Schema::hasColumn('transaction_details', 'lokasi_tujuan')) {
                $table->dropColumn('lokasi_tujuan');
            }
        });

        DB::statement("ALTER TABLE transactions MODIFY type ENUM('IN', 'OUT', 'RET') NOT NULL");

        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'tipe_lokasi')) {
                $table->dropColumn('tipe_lokasi');
            }
        });

        Schema::table('items', function (Blueprint $table) {
            if (Schema::hasColumn('items', 'tipe_barang')) {
                $table->dropColumn('tipe_barang');
            }
        });
    }
};
