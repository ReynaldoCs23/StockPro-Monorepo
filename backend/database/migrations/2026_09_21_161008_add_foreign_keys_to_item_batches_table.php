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
        Schema::table('item_batches', function (Blueprint $table) {
            $table->foreign(['idLokasi'])->references(['idLokasi'])->on('locations')->onUpdate('no action')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('item_batches', function (Blueprint $table) {
            $table->dropForeign('item_batches_idlokasi_foreign');
        });
    }
};
