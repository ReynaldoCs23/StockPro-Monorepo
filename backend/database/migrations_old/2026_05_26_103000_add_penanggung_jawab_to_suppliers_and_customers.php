<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'penanggung_jawab')) {
                $table->string('penanggung_jawab')->nullable();
            }
        });
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'penanggung_jawab')) {
                $table->string('penanggung_jawab')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('penanggung_jawab');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('penanggung_jawab');
        });
    }
};
