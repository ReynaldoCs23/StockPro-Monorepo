<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            $table->string('satuan_transaksi')->nullable()->after('jumlah');
            $table->integer('jumlah_transaksi')->nullable()->after('satuan_transaksi');
        });
    }

    public function down()
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropColumn(['satuan_transaksi', 'jumlah_transaksi']);
        });
    }
};
