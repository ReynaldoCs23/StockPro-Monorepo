<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\StockAdjustment;
use App\Models\Item;
use App\Models\ItemBatch;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Traits\HasSystemLogs;
use App\Events\StokUpdated;

class StockAdjustmentController extends Controller
{
    use HasSystemLogs;

    public function index(Request $request)
    {
        $query = StockAdjustment::with(['item', 'user'])->orderBy('created_at', 'desc');
        
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date . ' 00:00:00', 
                $request->end_date . ' 23:59:59'
            ]);
        }
        
        $perPage = $request->query('per_page', 10);
        if ($perPage === 'all') {
            $perPage = 999999;
        } else {
            $perPage = (int) $perPage;
        }
        
        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'item_id' => 'required|exists:items,kodeBarang',
            'adjustment_type' => 'required|in:addition,subtraction',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:1000',
        ]);

        abort_if(
            !auth()->user()->can('create_penyesuaian_stok') && auth()->user()->role !== 'Superadmin',
            403, 
            'Akses Ditolak: Anda tidak memiliki izin untuk menambah penyesuaian stok.'
        );

        try {
            DB::beginTransaction();

            $kodeBarang = $request->item_id;
            $type = $request->adjustment_type;
            $quantity = $request->quantity;

            // Generate ADJ-YYMMDD-XXXX
            $datePrefix = 'ADJ-' . Carbon::now()->format('ymd') . '-';
            $lastAdj = StockAdjustment::where('adjustment_number', 'LIKE', $datePrefix . '%')
                        ->orderBy('adjustment_number', 'desc')
                        ->first();
            
            $sequence = 1;
            if ($lastAdj) {
                $lastSequence = intval(substr($lastAdj->adjustment_number, -4));
                $sequence = $lastSequence + 1;
            }
            $adjustmentNumber = $datePrefix . str_pad($sequence, 4, '0', STR_PAD_LEFT);

            $item = Item::where('kodeBarang', $kodeBarang)->lockForUpdate()->first();
            if (!$item) {
                throw new \Exception("Item not found");
            }

            if ($type === 'subtraction') {
                $batchId = $request->batch_id; // optional
                if ($batchId) {
                    $batch = DB::table('item_batches')->where('id_batch', $batchId)->lockForUpdate()->first();
                    if (!$batch) {
                        throw new \Exception("Batch tidak ditemukan.");
                    }
                    $stokTersediaBatch = $batch->qty_sisa - $batch->qty_booking;
                    if ($stokTersediaBatch < $quantity) {
                        throw new \Exception("Stok di batch terpilih tidak mencukupi untuk dikurangi. Sisa Batch: " . $stokTersediaBatch);
                    }
                } else {
                    $stokTersedia = $item->stok - ($item->stok_booking ?? 0);
                    if ($stokTersedia < $quantity) {
                        throw new \Exception("Stok tersedia tidak mencukupi untuk dikurangi. Sisa Tersedia: " . $stokTersedia);
                    }
                }

                // Gunakan DB query builder langsung untuk memastikan stok terupdate secara persisten
                DB::table('items')->where('kodeBarang', $kodeBarang)->decrement('stok', $quantity);
                $this->consumeFifoBatches($adjustmentNumber, $kodeBarang, $quantity, $batchId);
            } else if ($type === 'addition') {
                // Gunakan DB query builder langsung untuk memastikan stok terupdate secara persisten
                DB::table('items')->where('kodeBarang', $kodeBarang)->increment('stok', $quantity);

                $hargaModal = floatval($item->hargaBeli ?? 0);
                
                ItemBatch::create([
                    'id_batch' => 'BCH-' . $adjustmentNumber,
                    'kodeBarang' => $kodeBarang,
                    'idTransaksi_masuk' => $adjustmentNumber,
                    'tanggal_masuk' => Carbon::now()->format('Y-m-d H:i:s'),
                    'qty_awal' => $quantity,
                    'qty_sisa' => $quantity,
                    'qty_booking' => 0,
                    'harga_modal_satuan' => round($hargaModal, 2),
                    'idLokasi' => null,
                    'lokasi_rak' => '-',
                ]);
            }

            $adjustment = StockAdjustment::create([
                'adjustment_number' => $adjustmentNumber,
                'item_id' => $kodeBarang,
                'user_id' => auth()->id() ?? 1,
                'adjustment_type' => $type,
                'quantity' => $quantity,
                'reason' => $request->reason,
            ]);

            $logDesc = ($type === 'addition' ? 'Penambahan' : 'Pengurangan') . " Stok: $kodeBarang sebanyak $quantity (Alasan: {$request->reason})";
            $this->writeLog(auth()->user()->namaLengkap ?? 'System', 'CREATE', 'stock_adjustments', $logDesc);

            DB::commit();
            event(new StokUpdated("Penyesuaian Stok: $kodeBarang"));

            return response()->json([
                'message' => 'Stock adjustment recorded successfully',
                'data' => $adjustment
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to record stock adjustment: ' . $e->getMessage()
            ], 500);
        }
    }

    private function consumeFifoBatches($idTransaksi, $kodeBarang, $jumlah, $batchId = null) {
        $remaining = $jumlah;
        $query = DB::table('item_batches')
            ->where('kodeBarang', $kodeBarang)
            ->whereRaw('(qty_sisa - qty_booking) > 0')
            ->orderBy('tanggal_masuk', 'asc')
            ->orderBy('id_batch', 'asc')
            ->lockForUpdate();
            
        if ($batchId) {
            $query->where('id_batch', $batchId);
        }
        
        $batches = $query->get();

        foreach($batches as $batch) {
            if($remaining <= 0) break;
            $available = $batch->qty_sisa - $batch->qty_booking;
            $take = min($available, $remaining);
            
            DB::table('item_batches')->where('id_batch', $batch->id_batch)->decrement('qty_sisa', $take);

            DB::table('transaction_batch_details')->insert([
                'idTransaksi' => $idTransaksi,
                'id_batch' => $batch->id_batch,
                'qty_diambil' => $take,
                'created_at' => Carbon::now()
            ]);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw new \Exception("Sisa stok FIFO tidak mencukupi untuk batch item {$kodeBarang}");
        }
    }
}
