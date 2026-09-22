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
        Schema::create('product_projections', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('kodeBarang')->index();
            $table->date('periode_target');
            $table->integer('estimasi_qty');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_projections');
    }
};
