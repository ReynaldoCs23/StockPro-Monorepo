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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->string('idSupplier')->primary();
            $table->string('nama');
            $table->enum('tipe_partner', ['supplier', 'vendor'])->default('supplier');
            $table->text('alamat');
            $table->string('telp');
            $table->string('npwp')->nullable();
            $table->timestamps();
            $table->string('nik')->nullable();
            $table->string('penanggung_jawab')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
