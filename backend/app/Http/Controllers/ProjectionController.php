<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; // WAJIB DITAMBAHKAN

class ProjectionController extends Controller
{
    public function getProjections() 
    {
        $projections = DB::table('product_projections')
            ->join('items', 'product_projections.kodeBarang', '=', 'items.kodeBarang')
            ->select('items.nama as namaBarang', 'items.stok as qty_sisa', 'product_projections.estimasi_qty', 'product_projections.periode_target')
            ->orderBy('product_projections.estimasi_qty', 'desc')
            ->get();

        return response()->json($projections);
    }
}