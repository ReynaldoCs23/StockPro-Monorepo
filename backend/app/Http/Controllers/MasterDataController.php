<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Traits\HasSystemLogs;
use App\Events\StokUpdated;

class MasterDataController extends Controller {
    use HasSystemLogs;

    public function getInitialData() {
        try {
            $isAuthenticated = auth('sanctum')->check();

            if (!$isAuthenticated) {
                return response()->json([
                    'companyProfile' => DB::table('company_profiles')->first() ?: [
                        'nama' => 'PT Mara Jaya Dewi Sakti',
                        'alamat' => 'Jl. Kumba Karna No.1, Baktiseraga, Buleleng, Bali 81119',
                        'npwp' => '00.000.000.0-000.000',
                        'penanggung_jawab' => 'GEDE ARIADI',
                    ],
                    'user' => null,
                ], 200);
            }

            return response()->json([
                'users' => strtolower(auth('sanctum')->user()->role) !== 'superadmin' 
                    ? DB::table('users')->where('role', '!=', 'Superadmin')->get() 
                    : DB::table('users')->get(),
                'categories' => DB::table('categories')->get(),
                'locations' => DB::table('locations')->get(),
                'suppliers' => DB::table('suppliers')->get(),
                'customers' => DB::table('customers')->get(),
                'items' => DB::table('items')->get(),
                'satuans' => DB::table('satuans')->get(),
                'inbound' => DB::table('transactions')
                    ->leftJoin('transaction_details', 'transactions.idTransaksi', '=', 'transaction_details.idTransaksi')
                    ->select(
                        'transactions.*',
                        DB::raw('COALESCE(SUM(transaction_details.jumlah), 0) as jumlah'),
                        DB::raw('COUNT(transaction_details.id) as total_item')
                    )
                    ->whereIn('transactions.type', ['IN', 'MAKLOON_IN'])
                    ->groupBy(
                        'transactions.idTransaksi', 'transactions.type', 'transactions.tanggal', 
                        'transactions.sumber_tujuan', 'transactions.entitas', 'transactions.totalTransaksi',
                        'transactions.pajak_persen', 'transactions.pajak_nominal',
                        'transactions.idReferensi', 'transactions.keterangan', 'transactions.created_at', 
                        'transactions.updated_at'
                    )
                    ->orderBy('transactions.created_at', 'desc')
                    ->get()
                    ->map(function($t) {
                        $items = DB::table('transaction_details')->where('idTransaksi', $t->idTransaksi)->get()->map(function($item) use ($t) {
                            $batch = DB::table('item_batches')->where('idTransaksi_masuk', $t->idTransaksi)->where('kodeBarang', $item->kodeBarang)->first();
                            $item->lokasi_asal = $batch ? $batch->lokasi_rak : '';
                            return $item;
                        });
                        $isi_transaksi_detail = $items->map(function($item) {
                            $nama = $item->namaBarang ?? '-';
                            return $nama . ' (' . $item->jumlah . ')';
                        })->implode(', ');
                        return [...(array)$t, 'sumber' => $t->sumber_tujuan, 'namaSupplier' => $t->entitas, 'items' => $items, 'isi_transaksi_detail' => $isi_transaksi_detail];
                    }),
                'outbound' => DB::table('transactions')
                    ->leftJoin('transaction_details', 'transactions.idTransaksi', '=', 'transaction_details.idTransaksi')
                    ->select(
                        'transactions.*',
                        DB::raw('COALESCE(SUM(transaction_details.jumlah), 0) as jumlah'),
                        DB::raw('COUNT(transaction_details.id) as total_item')
                    )
                    ->whereIn('transactions.type', ['OUT', 'MAKLOON_OUT'])
                    ->groupBy(
                        'transactions.idTransaksi', 'transactions.type', 'transactions.tanggal', 
                        'transactions.sumber_tujuan', 'transactions.entitas', 'transactions.totalTransaksi',
                        'transactions.pajak_persen', 'transactions.pajak_nominal',
                        'transactions.idReferensi', 'transactions.keterangan', 'transactions.created_at', 
                        'transactions.updated_at'
                    )
                    ->orderBy('transactions.created_at', 'desc')
                    ->get()
                    ->map(function($t) {
                        $items = DB::table('transaction_details')->where('idTransaksi', $t->idTransaksi)->get()->map(function($item) {
                            // Enrich with hargaJual if harga_satuan is 0 (legacy data)
                            if (floatval($item->harga_satuan) == 0) {
                                $master = DB::table('items')->where('kodeBarang', $item->kodeBarang)->first();
                                $item->harga_satuan = $master->hargaJual ?? 0;
                            }
                            return $item;
                        });
                        $isi_transaksi_detail = $items->map(function($item) {
                            $nama = $item->namaBarang ?? '-';
                            return $nama . ' (' . $item->jumlah . ')';
                        })->implode(', ');
                        return [...(array)$t, 'tujuan' => $t->sumber_tujuan, 'namaPembeli' => $t->entitas, 'items' => $items, 'isi_transaksi_detail' => $isi_transaksi_detail];
                    }),
                'returns' => DB::table('transactions')
                    ->leftJoin('transaction_details', 'transactions.idTransaksi', '=', 'transaction_details.idTransaksi')
                    ->select(
                        'transactions.*',
                        DB::raw('COALESCE(SUM(transaction_details.jumlah), 0) as jumlah'),
                        DB::raw('COUNT(transaction_details.id) as total_item')
                    )
                    ->where('transactions.type', 'RET')
                    ->groupBy(
                        'transactions.idTransaksi', 'transactions.type', 'transactions.tanggal', 
                        'transactions.sumber_tujuan', 'transactions.entitas', 'transactions.totalTransaksi',
                        'transactions.pajak_persen', 'transactions.pajak_nominal',
                        'transactions.idReferensi', 'transactions.keterangan', 'transactions.created_at', 
                        'transactions.updated_at'
                    )
                    ->orderBy('transactions.created_at', 'desc')
                    ->get()
                    ->map(function($t) {
                        $items = DB::table('transaction_details')
                            ->leftJoin('items', 'transaction_details.kodeBarang', '=', 'items.kodeBarang')
                            ->where('transaction_details.idTransaksi', $t->idTransaksi)
                            ->select('transaction_details.*', 'items.nama as item_nama')
                            ->get();
                        // Resolve entity: use entitas directly, or look up from reference transaction
                        $entityName = $t->entitas;
                        if (!$entityName && $t->idReferensi) {
                            $refTrx = DB::table('transactions')->where('idTransaksi', $t->idReferensi)->first();
                            $entityName = $refTrx->entitas ?? null;
                            // If ref is also a return with no entitas, follow its reference
                            if (!$entityName && $refTrx && $refTrx->idReferensi) {
                                $refTrx2 = DB::table('transactions')->where('idTransaksi', $refTrx->idReferensi)->first();
                                $entityName = $refTrx2->entitas ?? null;
                            }
                        }
                        // Enrich with entity address for print invoice
                        $entityAddress = '';
                        $entityPhone = '';
                        if ($entityName) {
                            $customer = DB::table('customers')->where('nama', $entityName)->first();
                            if ($customer) {
                                $entityAddress = $customer->alamat ?? '';
                                $entityPhone = $customer->telp ?? '';
                            } else {
                                $supplier = DB::table('suppliers')->where('nama', $entityName)->first();
                                if ($supplier) {
                                    $entityAddress = $supplier->alamat ?? '';
                                    $entityPhone = $supplier->telp ?? '';
                                }
                            }
                        }
                        $isi_transaksi_detail = $items->map(function($item) {
                            $nama = $item->namaBarang ?? $item->item_nama ?? '-';
                            return $nama . ' (' . $item->jumlah . ')';
                        })->implode(', ');
                        return [...(array)$t, 'jenisReturn' => $t->sumber_tujuan, 'entitas' => $entityName, 'items' => $items, 'entityAddress' => $entityAddress, 'entityPhone' => $entityPhone, 'isi_transaksi_detail' => $isi_transaksi_detail];
                    }),
                'logs' => DB::table('logs')->orderBy('waktu', 'desc')->get(),
                'companyProfile' => DB::table('company_profiles')->first() ?: [
                    'nama' => 'PT Mara Jaya Dewi Sakti',
                    'alamat' => 'Jl. Kumba Karna No.1, Baktiseraga, Buleleng, Bali 81119',
                    'npwp' => '00.000.000.0-000.000',
                    'penanggung_jawab' => 'GEDE ARIADI',
                ],
                'user' => auth('sanctum')->user(),
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function store(Request $request, $table) {
        if ($table === 'locations') {
            $request->validate([
                'tipe_lokasi' => 'required|in:internal,vendor'
            ]);
        }
        if (in_array($table, ['suppliers', 'customers'])) {
            $request->validate([
                'npwp' => 'nullable|string|max:30',
                'nik' => 'nullable|string|max:20',
                'penanggung_jawab' => 'nullable|string|max:100',
            ]);
        }

        try {
            $payload = $request->except(['log_user', 'log_detail', 'alamat_lengkap']);
            
            $idGenerator = new \App\Services\IdGeneratorService();

            if ($table === 'locations') {
                $payload['tipe_lokasi'] = $payload['tipe_lokasi'] ?? 'internal';
                $payload['idLokasi'] = $idGenerator->generateLocationId($payload['tipe_lokasi']);
            } elseif ($table === 'items') {
                $payload['kodeBarang'] = $idGenerator->generateItemCode($payload['tipeBarang'] ?? 'Bahan Baku');
                if (empty($payload['satuan_besar'])) {
                    $payload['satuan_besar'] = null;
                    $payload['rasio_konversi'] = 1;
                }
            } elseif ($table === 'categories') {
                $payload['idKategori'] = $idGenerator->generateSequenceId('categories', 'idKategori', 'KTG-', 3);
            } elseif ($table === 'suppliers') {
                $tipe = $payload['tipe_partner'] ?? 'supplier';
                $prefix = $tipe === 'vendor' ? 'VEN-' : 'SUP-';
                $payload['idSupplier'] = $idGenerator->generateSequenceId('suppliers', 'idSupplier', $prefix, 3);
            } elseif ($table === 'customers') {
                $payload['idPelanggan'] = $idGenerator->generateSequenceId('customers', 'idPelanggan', 'CUS-', 3);
            }
            
            $payload['created_at'] = now();
            $payload['updated_at'] = now();
            DB::table($table)->insert($payload);
            $this->writeLog($request->log_user, 'CREATE', $table, $request->log_detail);
            event(new StokUpdated("Pembaruan Data Master di tabel: " . $table));
            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function update(Request $request, $table, $id) {
        if ($table === 'locations') {
            $request->validate([
                'tipe_lokasi' => 'required|in:internal,vendor'
            ]);
        }
        if (in_array($table, ['suppliers', 'customers'])) {
            $request->validate([
                'npwp' => 'nullable|string|max:30',
                'nik' => 'nullable|string|max:20',
                'penanggung_jawab' => 'nullable|string|max:100',
            ]);
        }

        try {
            $idKey = $request->input('id_key', 'id');
            $payload = $request->except(['log_user', 'log_detail', 'id_key', 'alamat_lengkap']);
            
            if ($table === 'items' && empty($payload['satuan_besar'])) {
                $payload['satuan_besar'] = null;
                $payload['rasio_konversi'] = 1;
            }

            $payload['updated_at'] = now();
            
            $oldData = DB::table($table)->where($idKey, $id)->first();
            $changes = [];
            if ($oldData) {
                foreach ($payload as $key => $newVal) {
                    if ($key === 'updated_at' || $key === 'created_at') continue;
                    $oldVal = $oldData->{$key} ?? null;
                    if ($oldVal != $newVal) {
                        $changes[$key] = [
                            'old' => $oldVal,
                            'new' => $newVal
                        ];
                    }
                }
            }
            $payloadJson = !empty($changes) ? json_encode($changes) : null;

            if ($oldData && $table === 'items') {
                $oldStok = floatval($oldData->stok ?? 0);
                $newStok = floatval($payload['stok'] ?? $oldStok);
                $difference = $newStok - $oldStok;
                if ($difference > 0) {
                    $kodeBarang = $oldData->kodeBarang;
                    \App\Models\ItemBatch::create([
                        'id_batch' => 'ADJ-' . now()->format('YmdHis') . '-' . $kodeBarang,
                        'kodeBarang' => $kodeBarang,
                        'idTransaksi_masuk' => 'MANUAL-ADJUSTMENT',
                        'qty_awal' => $difference,
                        'qty_sisa' => $difference,
                        'qty_booking' => 0,
                        'tanggal_masuk' => now()->format('Y-m-d H:i:s'),
                        'harga_modal_satuan' => $oldData->hargaBeli ?? 0,
                        'idLokasi' => null,
                        'lokasi_rak' => '-',
                    ]);
                }
            }

            DB::table($table)->where($idKey, $id)->update($payload);
            $this->writeLog($request->log_user, 'UPDATE', $table, $request->log_detail, $payloadJson);
            event(new StokUpdated("Pembaruan Data Master di tabel: " . $table));
            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            \Log::error('Error in ' . __CLASS__ . '@' . __FUNCTION__ . ': ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Maaf, terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
            ], 500);
        }
    }

    public function destroy(Request $request, $table, $id) {
        try {
            $idKey = $request->input('id_key', 'id');
            DB::table($table)->where($idKey, $id)->delete();
            $this->writeLog($request->log_user, 'DELETE', $table, $request->log_detail);
            event(new StokUpdated("Pembaruan Data Master di tabel: " . $table));
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