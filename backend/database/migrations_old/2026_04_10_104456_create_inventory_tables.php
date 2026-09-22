<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        // 1. Data Master User & Entitas
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('namaLengkap');
            $table->string('password'); 
            $table->string('role')->default('Staff');
            $table->date('masaBerlaku')->nullable();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->string('idKategori')->primary();
            $table->string('nama');
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->string('idLokasi')->primary();
            $table->string('nama');
            $table->timestamps();
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->string('idSupplier')->primary();
            $table->string('nama');
            $table->text('alamat');
            $table->string('telp');
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->string('idPelanggan')->primary();
            $table->string('nama');
            $table->text('alamat');
            $table->string('telp');
            $table->timestamps();
        });

        // 2. Master Barang
        Schema::create('items', function (Blueprint $table) {
            $table->string('kodeBarang')->primary();
            $table->string('nama');
            $table->string('kategori');
            $table->string('tipeBarang');
            $table->string('satuan');
            $table->integer('stok')->default(0); 
            $table->integer('minStok')->default(0);
            $table->decimal('hargaBeli', 15, 2)->default(0); 
            $table->decimal('hargaJual', 15, 2)->default(0);
            $table->timestamps();
        });

        // 3. Tabel Header Transaksi (Kolom kodeBarang dihapus dari sini)
        Schema::create('transactions', function (Blueprint $table) {
            $table->string('idTransaksi')->primary();
            $table->enum('type', ['IN', 'OUT', 'RET']); 
            $table->date('tanggal');
            $table->string('sumber_tujuan')->nullable(); 
            $table->string('entitas')->nullable(); 
            $table->decimal('totalTransaksi', 15, 2)->nullable();
            $table->string('idReferensi')->nullable(); 
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });

        // TABEL BARU: Transaction Details
        Schema::create('transaction_details', function (Blueprint $table) {
            $table->id();
            $table->string('idTransaksi'); 
            $table->string('kodeBarang');
            $table->string('namaBarang');
            $table->integer('jumlah');
            $table->decimal('harga_satuan', 15, 2)->default(0);
            $table->timestamps();
            
            $table->index('idTransaksi');
        });

        // 4. Tabel Batches
        Schema::create('item_batches', function (Blueprint $table) {
            $table->string('id_batch')->primary(); 
            $table->string('kodeBarang');
            $table->string('idTransaksi_masuk'); 
            $table->date('tanggal_masuk'); 
            $table->integer('qty_awal'); 
            $table->integer('qty_sisa'); 
            $table->decimal('harga_modal_satuan', 15, 2)->default(0); 
            $table->string('lokasi_rak')->nullable(); 
            $table->timestamps();
            
            $table->index(['kodeBarang', 'tanggal_masuk', 'qty_sisa']);
        });

        // 5. Tabel Detail Pengambilan Batch
        Schema::create('transaction_batch_details', function (Blueprint $table) {
            $table->id();
            $table->string('idTransaksi'); 
            $table->string('id_batch'); 
            $table->integer('qty_diambil'); 
            $table->timestamps();
        });

        // 6. Log Sistem
        Schema::create('logs', function (Blueprint $table) {
            $table->string('idLog')->primary();
            $table->dateTime('waktu');
            $table->string('user');
            $table->string('aksi');
            $table->string('modul');
            $table->text('keterangan');
            $table->timestamps();
        });
    }

    public function down() {
        Schema::dropIfExists('logs');
        Schema::dropIfExists('transaction_batch_details');
        Schema::dropIfExists('item_batches');
        Schema::dropIfExists('transaction_details');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('items');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('users');
    }
};