<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        // 1. Tabel Header BOM (Menyimpan ID Resep dan Produk Jadinya)
        Schema::create('boms', function (Blueprint $table) {
            $table->string('id_bom')->primary();
            $table->string('kode_produk'); 
            $table->timestamps();

            // Relasi ke tabel items (Produk Jadi)
            $table->foreign('kode_produk')
                  ->references('kodeBarang')
                  ->on('items')
                  ->onDelete('cascade');
        });

        // 2. Tabel Detail BOM (Menyimpan daftar komponen/bahan baku per 1 unit)
        Schema::create('bom_details', function (Blueprint $table) {
            $table->id();
            $table->string('id_bom');
            $table->string('kode_bahan_baku'); 
            $table->decimal('jumlah_per_unit', 10, 2); // Mendukung angka desimal (misal 0.5 kg)
            $table->timestamps();

            // Relasi ke header BOM
            $table->foreign('id_bom')
                  ->references('id_bom')
                  ->on('boms')
                  ->onDelete('cascade');
                  
            // Relasi ke tabel items (Bahan Baku)
            $table->foreign('kode_bahan_baku')
                  ->references('kodeBarang')
                  ->on('items')
                  ->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('bom_details');
        Schema::dropIfExists('boms');
    }
};