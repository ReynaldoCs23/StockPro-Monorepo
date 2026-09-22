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
        Schema::create('item_batches', function (Blueprint $table) {
            $table->string('id_batch')->primary();
            $table->string('kodeBarang');
            $table->string('idTransaksi_masuk');
            $table->date('tanggal_masuk');
            $table->integer('qty_awal');
            $table->integer('qty_sisa');
            $table->integer('qty_booking')->default(0);
            $table->string('idLokasi')->nullable()->index('item_batches_idlokasi_foreign');
            $table->decimal('harga_modal_satuan', 15)->default(0);
            $table->string('lokasi_rak')->nullable();
            $table->timestamps();

            $table->index(['kodeBarang', 'qty_sisa', 'tanggal_masuk'], 'idx_batches_fifo');
            $table->index(['kodeBarang', 'tanggal_masuk', 'qty_sisa']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_batches');
    }
};
