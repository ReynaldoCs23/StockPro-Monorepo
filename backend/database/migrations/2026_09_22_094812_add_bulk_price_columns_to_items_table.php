<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->decimal('hargaBeli_besar', 15, 2)->default(0)->after('hargaBeli');
            $table->decimal('hargaJual_besar', 15, 2)->default(0)->after('hargaJual');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['hargaBeli_besar', 'hargaJual_besar']);
        });
    }
};
