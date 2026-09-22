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
        Schema::create('items', function (Blueprint $table) {
            $table->string('kodeBarang')->primary();
            $table->string('nama');
            $table->string('kategori')->index('idx_items_kategori');
            $table->string('tipeBarang');
            $table->enum('tipe_barang', ['bahan_baku', 'barang_jadi'])->default('bahan_baku');
            $table->string('satuan_dasar');
            $table->string('satuan_besar')->nullable();
            $table->integer('rasio_konversi')->default(1);
            $table->integer('stok')->default(0);
            $table->integer('stok_booking')->default(0);
            $table->integer('minStok')->default(0);
            $table->decimal('hargaBeli', 15)->default(0);
            $table->decimal('hargaJual', 15)->default(0);
            $table->timestamps();
            $table->timestamp('last_sold_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
