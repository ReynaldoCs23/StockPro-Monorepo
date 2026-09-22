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
            $table->dropForeign(['id_vendor']);
            $table->foreign('id_vendor')->references('idSupplier')->on('suppliers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('makloon_orders', function (Blueprint $table) {
            $table->dropForeign(['id_vendor']);
            $table->foreign('id_vendor')->references('idLokasi')->on('locations')->onDelete('cascade');
        });
    }
};
