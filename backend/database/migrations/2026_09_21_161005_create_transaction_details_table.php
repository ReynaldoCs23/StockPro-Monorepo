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
        Schema::create('transaction_details', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('idTransaksi')->index();
            $table->string('kodeBarang')->index('idx_td_kode_barang');
            $table->string('namaBarang');
            $table->integer('jumlah');
            $table->string('satuan_transaksi')->nullable();
            $table->integer('jumlah_transaksi')->nullable();
            $table->decimal('harga_satuan', 15)->default(0);
            $table->string('lokasi_tujuan')->nullable();
            $table->string('lokasi_asal')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction_details');
    }
};
