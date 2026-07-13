<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('pajak_persen', 5, 2)->default(0)->after('totalTransaksi');
            $table->decimal('pajak_nominal', 15, 2)->default(0)->after('pajak_persen');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['pajak_persen', 'pajak_nominal']);
        });
    }
};
