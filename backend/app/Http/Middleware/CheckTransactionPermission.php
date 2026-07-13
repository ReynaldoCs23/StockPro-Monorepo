<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckTransactionPermission
{
    private const TYPE_TO_MODULE = [
        'IN' => 'barang_masuk',
        'OUT' => 'barang_keluar',
        'RET' => 'barang_return',
    ];

    private const METHOD_TO_ACTION = [
        'POST' => 'create',
        'PUT' => 'edit',
        'PATCH' => 'edit',
        'DELETE' => 'delete',
    ];

    public function handle(Request $request, Closure $next)
    {
        $type = $request->route('type');
        $module = self::TYPE_TO_MODULE[$type] ?? null;

        if (!$module) {
            return $next($request);
        }

        $action = self::METHOD_TO_ACTION[$request->method()] ?? 'view';
        $permission = "{$action}_{$module}";

        $user = $request->user();
        if (!$user || !$user->can($permission)) {
            return response()->json(['message' => 'Akses ditolak. Anda tidak memiliki izin: ' . $permission], 403);
        }

        return $next($request);
    }
}
