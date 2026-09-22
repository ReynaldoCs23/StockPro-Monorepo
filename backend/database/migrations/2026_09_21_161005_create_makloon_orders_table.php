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
        Schema::create('makloon_orders', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('wo_number')->unique();
            $table->string('id_vendor')->index('idx_makloon_vendor');
            $table->string('kode_produk')->index('idx_makloon_produk');
            $table->integer('target_qty');
            $table->enum('status', ['Pending', 'On-Process', 'Completed', 'Cancelled'])->nullable()->default('Pending')->index('idx_makloon_status');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('makloon_orders');
    }
};
