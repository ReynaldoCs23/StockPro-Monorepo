<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'nik')) {
                $table->string('nik')->nullable();
            }
        });
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'nik')) {
                $table->string('nik')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('nik');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('nik');
        });
    }
};
