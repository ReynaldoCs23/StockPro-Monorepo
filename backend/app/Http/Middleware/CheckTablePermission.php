<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckTablePermission
{
    private const TABLE_TO_MODULE = [
        'items' => 'master_barang',
        'categories' => 'kategori',
        'satuans' => 'satuan',
        'locations' => 'lokasi',
        'suppliers' => 'supplier',
        'customers' => 'pelanggan',
    ];

    private const METHOD_TO_ACTION = [
        'POST' => 'create',
        'PUT' => 'edit',
        'PATCH' => 'edit',
        'DELETE' => 'delete',
    ];

    public function handle(Request $request, Closure $next)
    {
        $table = $request->route('table');
        $module = self::TABLE_TO_MODULE[$table] ?? null;

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
