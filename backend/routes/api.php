<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MasterDataController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\BomController;
use App\Http\Controllers\DashboardController; 
use App\Http\Controllers\MakloonController;
use App\Http\Controllers\SatuanController;
use App\Http\Controllers\UserController;

// ==========================================
// AUTH (Public)
// ==========================================
Route::post('/login', [AuthController::class, 'login']);
Route::get('/init', [MasterDataController::class, 'getInitialData']);

// ==========================================
// AUTH (Protected) - ALL ROUTES MOVED HERE
// ==========================================
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/change-password', [UserController::class, 'changePassword']);

    // 1. INIT & DASHBOARD
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/item-batches/available', [TransactionController::class, 'availableBatches']);

    // ==========================================
    // 1.5 COMPANY PROFILE & TRANSACTIONS
    // ==========================================
    Route::get('/company-profile', [\App\Http\Controllers\CompanyProfileController::class, 'show']);
    Route::post('/company-profile', [\App\Http\Controllers\CompanyProfileController::class, 'update']);
    Route::get('/transactions', [TransactionController::class, 'index']);

    // ==========================================
    // 2. API BOM
    // ==========================================
    Route::get('/boms', [BomController::class, 'index']);
    Route::post('/boms', [BomController::class, 'store'])->middleware('permission:create_makloon');
    Route::delete('/boms/{id_bom}', [BomController::class, 'destroy'])->middleware('permission:create_makloon');

    // ==========================================
    // 3. API PRODUKSI ATOMIK
    // ==========================================
    Route::get('/transactions/{id}/fifo-trace', [TransactionController::class, 'fifoTrace']);
    Route::post('/produksi', [TransactionController::class, 'storeProduksi']);

    // ==========================================
    // 3.5 API MAKLOON — Permission-guarded
    // ==========================================
    Route::get('/makloon-references', [TransactionController::class, 'makloonReferences']);
    Route::get('/makloon-orders', [MakloonController::class, 'index']);
    Route::middleware('permission:create_makloon')->group(function () {
        Route::post('/makloon-orders', [MakloonController::class, 'store']);
        Route::post('/makloon-orders/{id}/send', [MakloonController::class, 'send']);
        Route::post('/makloon-orders/{id}/receive', [MakloonController::class, 'receive']);
    });

    // ==========================================
    // 3.6 API MASTER SATUAN
    // ==========================================
    Route::get('/satuans', [SatuanController::class, 'index']);
    Route::post('/satuans', [SatuanController::class, 'store']);
    Route::put('/satuans/{id}', [SatuanController::class, 'update']);
    Route::delete('/satuans/{id}', [SatuanController::class, 'destroy']);

    // ==========================================
    // 3.7 API PERMISSIONS (RBAC)
    // ==========================================
    Route::get('/permissions', [UserController::class, 'permissions']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{username}/permissions', [UserController::class, 'userPermissions']);
    Route::get('/users/{username}/direct-permissions', [UserController::class, 'userDirectPermissions']);
    Route::put('/users/{username}/permissions', [UserController::class, 'syncPermissions']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{username}', [UserController::class, 'update']);
    Route::delete('/users/{username}', [UserController::class, 'destroy']);

    // ==========================================
    // 4. API MASTER DATA UMUM (/{table}) — Permission-guarded
    // ==========================================
    Route::middleware('check.table.permission')->group(function () {
        Route::post('/{table}', [MasterDataController::class, 'store']);
        Route::put('/{table}/{id}', [MasterDataController::class, 'update']);
        Route::delete('/{table}/{id}', [MasterDataController::class, 'destroy']);
    });

    // ==========================================
    // 5. API TRANSAKSI REGULER — Permission-guarded
    // ==========================================
    Route::middleware('check.transaction.permission')->group(function () {
        Route::post('/transaction/{type}', [TransactionController::class, 'store']);
        Route::put('/transaction/{type}/{id}', [TransactionController::class, 'updateTransaction']); 
        Route::post('/transaction/{id}/execute', [TransactionController::class, 'executeScheduledTransaction']);
        Route::delete('/transaction/{type}/{id}', [TransactionController::class, 'destroy']);
    });
});