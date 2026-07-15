<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BomController extends Controller
{
    // Mengambil semua resep BOM
    public function index()
    {
        $boms = DB::table('boms')->get();
        $result = [];

        foreach ($boms as $bom) {
            $details = DB::table('bom_details')
                ->where('id_bom', $bom->id_bom)
                ->select('kode_bahan_baku', 'jumlah_per_unit')
                ->get();

            $result[] = [
                'id_bom' => $bom->id_bom,
                'kode_produk' => $bom->kode_produk,
                'bahan_baku' => $details
            ];
        }

        return response()->json($result);
    }

    // Menyimpan resep BOM Baru ATAU Mengedit yang sudah ada
    public function store(Request $request)
    {
        $request->validate([
            'id_bom' => 'required|string',
            'kode_produk' => 'required|string',
            'bahan_baku' => 'required|array'
        ]);

        try {
            DB::beginTransaction();

            // 1. CEK APAKAH RESEP UNTUK PRODUK INI SUDAH ADA?
            $existingBom = DB::table('boms')->where('kode_produk', $request->kode_produk)->first();

            if ($existingBom) {
                // ==========================================
                // LOGIKA EDIT: Jika sudah ada, gunakan ID lama
                // dan bersihkan detail bahan baku yang lama
                // ==========================================
                $id_bom = $existingBom->id_bom;
                DB::table('bom_details')->where('id_bom', $id_bom)->delete();
                DB::table('boms')->where('id_bom', $id_bom)->update(['updated_at' => now()]);
            } else {
                // ==========================================
                // LOGIKA BARU: Jika belum ada, buat header baru
                // ==========================================
                $id_bom = $request->id_bom;
                DB::table('boms')->insert([
                    'id_bom' => $id_bom,
                    'kode_produk' => $request->kode_produk,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // 2. Masukkan daftar bahan baku (baik dari data baru maupun hasil editan)
            foreach ($request->bahan_baku as $bahan) {
                DB::table('bom_details')->insert([
                    'id_bom' => $id_bom,
                    'kode_bahan_baku' => $bahan['kode_bahan_baku'],
                    'jumlah_per_unit' => $bahan['jumlah_per_unit'],
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Resep BOM berhasil disimpan/diperbarui!'], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }
    // Menghapus resep BOM dengan aman (Soft delete jika memungkinkan, atau DB Transaction)
    public function destroy($id_bom)
    {
        try {
            DB::beginTransaction();

            $bom = DB::table('boms')->where('id_bom', $id_bom)->first();
            if (!$bom) {
                return response()->json(['message' => 'Resep BOM tidak ditemukan!'], 404);
            }

            // Pengecekan Relasi: Apakah sedang digunakan dalam transaksi Makloon (Pending / In Progress)?
            $isUsed = DB::table('makloon_orders')
                ->where('kode_produk', $bom->kode_produk)
                ->whereIn('status', ['Pending', 'In Progress'])
                ->exists();

            if ($isUsed) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resep BOM ini tidak bisa dihapus karena sedang digunakan dalam transaksi Makloon (Pending / In Progress).'
                ], 400);
            }

            // Hapus secara aman (detail dihapus dulu baru header)
            DB::table('bom_details')->where('id_bom', $id_bom)->delete();
            DB::table('boms')->where('id_bom', $id_bom)->delete();

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Resep BOM berhasil dihapus!'], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan saat menghapus data. Silakan coba lagi.',
            ], 500);
        }
    }
}