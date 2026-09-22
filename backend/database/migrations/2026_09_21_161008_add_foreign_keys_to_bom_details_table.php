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
        Schema::table('bom_details', function (Blueprint $table) {
            $table->foreign(['id_bom'])->references(['id_bom'])->on('boms')->onUpdate('no action')->onDelete('cascade');
            $table->foreign(['kode_bahan_baku'])->references(['kodeBarang'])->on('items')->onUpdate('no action')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bom_details', function (Blueprint $table) {
            $table->dropForeign('bom_details_id_bom_foreign');
            $table->dropForeign('bom_details_kode_bahan_baku_foreign');
        });
    }
};
