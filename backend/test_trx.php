<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
$trx = DB::table('transactions')->where('idTransaksi', 'INV-IN-2609-0009')->first();
print_r($trx);
