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
        Schema::create('transaction_batch_details', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('idTransaksi')->index('idx_tbd_idtransaksi');
            $table->string('id_batch')->index('idx_tbd_idbatch');
            $table->integer('qty_diambil');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction_batch_details');
    }
};
