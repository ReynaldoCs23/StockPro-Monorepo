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
        Schema::table('makloon_orders', function (Blueprint $table) {
            $table->foreign(['id_vendor'])->references(['idSupplier'])->on('suppliers')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['kode_produk'])->references(['kodeBarang'])->on('items')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('makloon_orders', function (Blueprint $table) {
            $table->dropForeign('makloon_orders_id_vendor_foreign');
            $table->dropForeign('makloon_orders_kode_produk_foreign');
        });
    }
};
