<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('satuan_besar')->nullable()->after('satuan');
            $table->integer('rasio_konversi')->default(1)->after('satuan_besar');
        });

        // Rename 'satuan' to 'satuan_dasar' for clarity
        Schema::table('items', function (Blueprint $table) {
            $table->renameColumn('satuan', 'satuan_dasar');
        });
    }

    public function down()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->renameColumn('satuan_dasar', 'satuan');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['satuan_besar', 'rasio_konversi']);
        });
    }
};
