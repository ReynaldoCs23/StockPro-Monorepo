<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('makloon_orders', function (Blueprint $table) {
            $table->id();
            $table->string('wo_number')->unique();
            $table->string('id_vendor'); // Match locations.idLokasi which is string
            $table->string('kode_produk');
            $table->integer('target_qty');
            $table->enum('status', ['Pending', 'On-Process', 'Completed'])->default('Pending');
            $table->timestamps();

            $table->foreign('id_vendor')->references('idLokasi')->on('locations')->onDelete('cascade');
            $table->foreign('kode_produk')->references('kodeBarang')->on('items')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('makloon_orders');
    }
};
