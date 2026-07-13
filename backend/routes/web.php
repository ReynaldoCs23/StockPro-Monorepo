<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'StockPro API',
        'status' => 'active',
        'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173')
    ]);
});