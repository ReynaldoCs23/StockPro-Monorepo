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
            $table->index(['tanggal', 'type', 'status'], 'idx_trx_tanggal_type_status');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->index(['idTransaksi', 'kodeBarang'], 'idx_td_idtrx_kode');
        });

        Schema::table('transaction_batch_details', function (Blueprint $table) {
            $table->index(['idTransaksi', 'id_batch'], 'idx_tbd_idtrx_batch');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('idx_trx_tanggal_type_status');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropIndex('idx_td_idtrx_kode');
        });

        Schema::table('transaction_batch_details', function (Blueprint $table) {
            $table->dropIndex('idx_tbd_idtrx_batch');
        });
    }
};
