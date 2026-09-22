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
        Schema::create('bom_details', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('id_bom')->index('bom_details_id_bom_foreign');
            $table->string('kode_bahan_baku')->index('bom_details_kode_bahan_baku_foreign');
            $table->decimal('jumlah_per_unit', 10);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bom_details');
    }
};
