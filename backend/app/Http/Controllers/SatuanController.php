<?php

namespace App\Http\Controllers;

use App\Models\Satuan;
use Illuminate\Http\Request;
use App\Traits\HasSystemLogs;
use App\Events\StokUpdated;

class SatuanController extends Controller
{
    use HasSystemLogs;

    public function index()
    {
        return response()->json(Satuan::all());
    }

    public function store(Request $request)
    {
        $request->validate(['nama_satuan' => 'required|string|unique:satuans,nama_satuan']);

        try {
            $satuan = Satuan::create(['nama_satuan' => $request->nama_satuan]);
            $this->writeLog($request->log_user, 'CREATE', 'Satuan', $request->log_detail ?? "Menambah Satuan: {$request->nama_satuan}");
            event(new StokUpdated("Pembaruan Data Master Satuan"));
            return response()->json(['status' => 'success', 'data' => $satuan]);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $request->validate(['nama_satuan' => 'required|string|unique:satuans,nama_satuan,' . $id]);

        try {
            $satuan = Satuan::findOrFail($id);
            $satuan->fill(['nama_satuan' => $request->nama_satuan]);
            
            $changes = $satuan->getDirty();
            $original = $satuan->getOriginal();
            $payloadJson = [];
            foreach($changes as $key => $newVal) {
                if ($key === 'updated_at') continue;
                $payloadJson[$key] = [
                    'old' => $original[$key] ?? null,
                    'new' => $newVal
                ];
            }
            $payloadStr = !empty($payloadJson) ? json_encode($payloadJson) : null;

            $satuan->save();
            $this->writeLog($request->log_user, 'UPDATE', 'Satuan', $request->log_detail ?? "Mengubah Satuan ID:{$id}", $payloadStr);
            event(new StokUpdated("Pembaruan Data Master Satuan"));
            return response()->json(['status' => 'success', 'data' => $satuan]);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        try {
            $satuan = Satuan::findOrFail($id);
            $satuan->delete();
            $this->writeLog($request->log_user, 'DELETE', 'Satuan', $request->log_detail ?? "Menghapus Satuan: {$satuan->nama_satuan}");
            event(new StokUpdated("Pembaruan Data Master Satuan"));
            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }
}
