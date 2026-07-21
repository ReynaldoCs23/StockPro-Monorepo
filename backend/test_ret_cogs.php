<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$q = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
    ->select('transactions.idTransaksi', 'transaction_details.kodeBarang', 'transaction_details.jumlah', DB::raw("
        COALESCE(
            (SELECT SUM(COALESCE(tbd.qty_diambil, td.jumlah) * COALESCE(ib.harga_modal_satuan, i.hargaBeli)) / NULLIF(SUM(COALESCE(tbd.qty_diambil, td.jumlah)), 0)
             FROM transaction_details td 
             LEFT JOIN items i ON td.kodeBarang = i.kodeBarang 
             LEFT JOIN transaction_batch_details tbd ON td.idTransaksi = tbd.idTransaksi 
             LEFT JOIN item_batches ib ON tbd.id_batch = ib.id_batch 
             WHERE td.idTransaksi = transactions.idReferensi AND td.kodeBarang = transaction_details.kodeBarang),
            items.hargaBeli
        ) as avg_cogs_per_unit
    "))
    ->where('transactions.idTransaksi', 'like', 'RET-IN%')
    ->get();

echo json_encode($q);
