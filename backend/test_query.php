<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$startBound = '2026-07-01';
$endBound = '2026-07-31';

$analytics = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
    ->leftJoin('transaction_batch_details', 'transactions.idTransaksi', '=', 'transaction_batch_details.idTransaksi')
    ->leftJoin('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
    ->select(
        DB::raw('COALESCE(NULLIF(items.kategori, ""), "Lainnya") as kategori'),
        DB::raw("
            SUM(
                CASE 
                    WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                        ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * transaction_details.harga_satuan)
                    ELSE 0 
                END
            ) as revenue_out,
            SUM(
                CASE 
                    WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                        ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * transaction_details.harga_satuan)
                    ELSE 0 
                END
            ) as revenue_ret,
            SUM(
                CASE 
                    WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                        ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                    WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                        -ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                    ELSE 0 
                END
            ) as net_cogs
        ")
    )
    ->whereIn('transactions.type', ['OUT', 'RET'])
    ->where(function($q) {
        $q->where('transactions.sumber_tujuan', 'LIKE', '%Penjualan%')
          ->orWhere('transactions.sumber_tujuan', 'LIKE', '%RET_IN%');
    })
    ->where('transactions.sumber_tujuan', 'NOT LIKE', '%Makloon%')
    ->whereRaw('(item_batches.kodeBarang = transaction_details.kodeBarang OR item_batches.id_batch IS NULL)')
    ->whereBetween('transactions.tanggal', [$startBound, $endBound])
    ->where('transactions.status', 'completed')
    ->groupBy('kategori')
    ->get();

echo json_encode($analytics);
