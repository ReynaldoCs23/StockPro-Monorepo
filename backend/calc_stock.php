<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$kode = 'BRG-0001';

$in = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->where('kodeBarang', $kode)->where('transactions.status', 'completed')
    ->whereIn('type', ['IN', 'MAKLOON_IN'])->sum('jumlah');

$out = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->where('kodeBarang', $kode)->where('transactions.status', 'completed')
    ->whereIn('type', ['OUT', 'MAKLOON_OUT'])->sum('jumlah');

$ret_in = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->where('kodeBarang', $kode)->where('transactions.status', 'completed')
    ->where('type', 'RET')->where('transactions.idTransaksi', 'LIKE', 'RET-IN%')->sum('jumlah');

$ret_out = DB::table('transaction_details')
    ->join('transactions', 'transaction_details.idTransaksi', '=', 'transactions.idTransaksi')
    ->where('kodeBarang', $kode)->where('transactions.status', 'completed')
    ->where('type', 'RET')->where('transactions.idTransaksi', 'LIKE', 'RET-OUT%')->sum('jumlah');

$adj_add = DB::table('stock_adjustments')
    ->where('item_id', $kode)->where('adjustment_type', 'addition')->sum('quantity');

$adj_sub = DB::table('stock_adjustments')
    ->where('item_id', $kode)->where('adjustment_type', 'subtraction')->sum('quantity');

$net = $in - $out + $ret_in - $ret_out + $adj_add - $adj_sub;

echo "IN: $in\n";
echo "OUT: $out\n";
echo "RET_IN: $ret_in\n";
echo "RET_OUT: $ret_out\n";
echo "ADJ_ADD: $adj_add\n";
echo "ADJ_SUB: $adj_sub\n";
echo "NET CALCULATED STOCK: $net\n";
