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
        Schema::table('item_batches', function (Blueprint $table) {
            $table->integer('qty_booking')->default(0)->after('qty_sisa');
            $table->string('idLokasi')->nullable()->after('qty_booking');
            $table->foreign('idLokasi')->references('idLokasi')->on('locations')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('item_batches', function (Blueprint $table) {
            $table->dropForeign(['idLokasi']);
            $table->dropColumn(['idLokasi', 'qty_booking']);
        });
    }
};
