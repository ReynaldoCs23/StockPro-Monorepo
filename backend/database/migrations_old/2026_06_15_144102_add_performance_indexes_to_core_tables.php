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
        // 1. FIFO Engine Optimization (item_batches)
        Schema::table('item_batches', function (Blueprint $table) {
            // Composite index prioritizing exact lookup, range check, and chronological sorting
            $table->index(['kodeBarang', 'qty_sisa', 'tanggal_masuk'], 'idx_batches_fifo');
        });

        // 2. Transactions Optimization
        Schema::table('transactions', function (Blueprint $table) {
            // Optimizes Dashboard & Report aggregations by date and type
            $table->index(['type', 'tanggal'], 'idx_transactions_type_tanggal');
            // Optimizes filtering by Supplier/Customer ID
            $table->index('entitas', 'idx_transactions_entitas');
        });

        // 3. Transaction Details Optimization
        Schema::table('transaction_details', function (Blueprint $table) {
            // Optimizes grouping and joining items
            $table->index('kodeBarang', 'idx_td_kode_barang');
        });

        // 4. Transaction Batch Details Optimization
        Schema::table('transaction_batch_details', function (Blueprint $table) {
            // Optimizes the bridge table resolving which batches satisfied which transactions
            $table->index('idTransaksi', 'idx_tbd_idtransaksi');
            $table->index('id_batch', 'idx_tbd_idbatch');
        });

        // 5. Master Data Items Optimization
        Schema::table('items', function (Blueprint $table) {
            // Optimizes searches and filters by Category
            $table->index('kategori', 'idx_items_kategori');
        });

        // 6. Makloon & BOM Optimization
        Schema::table('makloon_orders', function (Blueprint $table) {
            $table->index('status', 'idx_makloon_status');
            // Explicit indexing for heavy JOINs on foreign keys
            $table->index('id_vendor', 'idx_makloon_vendor');
            $table->index('kode_produk', 'idx_makloon_produk');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('makloon_orders', function (Blueprint $table) {
            $table->dropIndex('idx_makloon_status');
            $table->dropIndex('idx_makloon_vendor');
            $table->dropIndex('idx_makloon_produk');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex('idx_items_kategori');
        });

        Schema::table('transaction_batch_details', function (Blueprint $table) {
            $table->dropIndex('idx_tbd_idtransaksi');
            $table->dropIndex('idx_tbd_idbatch');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropIndex('idx_td_kode_barang');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('idx_transactions_type_tanggal');
            $table->dropIndex('idx_transactions_entitas');
        });

        Schema::table('item_batches', function (Blueprint $table) {
            $table->dropIndex('idx_batches_fifo');
        });
    }
};
