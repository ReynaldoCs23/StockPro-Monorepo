<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$q = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
    ->leftJoin('transaction_batch_details', 'transactions.idTransaksi', '=', 'transaction_batch_details.idTransaksi')
    ->leftJoin('item_batches', 'transaction_batch_details.id_batch', '=', 'item_batches.id_batch')
    ->select(
        'transactions.idTransaksi',
        DB::raw("SUM(
            CASE 
                WHEN transactions.idTransaksi LIKE 'INV-OUT%' THEN 
                    ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                WHEN transactions.idTransaksi LIKE 'RET-IN%' THEN 
                    -ABS(COALESCE(transaction_batch_details.qty_diambil, transaction_details.jumlah) * COALESCE(item_batches.harga_modal_satuan, items.hargaBeli, 0))
                ELSE 0 
            END
        ) as net_cogs")
    )
    ->where('transactions.idTransaksi', 'like', 'RET-IN%')
    ->groupBy('transactions.idTransaksi')
    ->get();

echo json_encode($q);
