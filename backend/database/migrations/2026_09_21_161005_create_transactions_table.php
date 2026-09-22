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
        Schema::create('transactions', function (Blueprint $table) {
            $table->string('idTransaksi')->primary();
            $table->enum('type', ['IN', 'OUT', 'RET', 'MAKLOON_OUT', 'MAKLOON_IN']);
            $table->string('status')->default('draft');
            $table->date('execution_date')->nullable();
            $table->date('tanggal')->index();
            $table->string('sumber_tujuan')->nullable();
            $table->string('entitas')->nullable()->index('idx_transactions_entitas');
            $table->decimal('totalTransaksi', 15)->nullable();
            $table->decimal('pajak_persen', 5)->default(0);
            $table->decimal('pajak_nominal', 15)->default(0);
            $table->string('idReferensi')->nullable();
            $table->string('target_kode_barang')->nullable();
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->index(['type', 'tanggal'], 'idx_transactions_type_tanggal');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
