<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$items = DB::table('items')->get();
$fixedCount = 0;
foreach ($items as $item) {
    $sumBatches = DB::table('item_batches')->where('kodeBarang', $item->kodeBarang)->sum('qty_sisa');
    if ($sumBatches != $item->stok) {
        echo "Fixing {$item->kodeBarang}: stok was {$item->stok}, now {$sumBatches}\n";
        DB::table('items')->where('kodeBarang', $item->kodeBarang)->update(['stok' => $sumBatches]);
        $fixedCount++;
    }
}
echo "Total items fixed: $fixedCount\n";
