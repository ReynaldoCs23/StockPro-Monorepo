<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\TransactionController;
use Carbon\Carbon;

#[Signature('transactions:execute-scheduled')]
#[Description('Execute scheduled transactions that are due today or earlier')]
class ExecuteScheduledTransactions extends Command
{
    public function handle()
    {
        $this->info('Finding scheduled transactions...');
        $today = Carbon::today()->format('Y-m-d');

        $transactions = DB::table('transactions')
            ->where('status', 'scheduled')
            ->where('execution_date', '<=', $today)
            ->get();

        if ($transactions->isEmpty()) {
            $this->info('No scheduled transactions to execute.');
            return;
        }

        $trxController = app(TransactionController::class);

        foreach ($transactions as $trx) {
            DB::beginTransaction();
            try {
                $details = DB::table('transaction_details')->where('idTransaksi', $trx->idTransaksi)->get();

                $retJenis = $trx->sumber_tujuan ?? '';
                if ($trx->type === 'OUT' || ($trx->type === 'RET' && str_starts_with($retJenis, 'RET_OUT'))) {
                    $batchDetails = DB::table('transaction_batch_details')->where('idTransaksi', $trx->idTransaksi)->get();
                    foreach ($batchDetails as $bDetail) {
                        DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->decrement('qty_booking', $bDetail->qty_diambil);
                        DB::table('item_batches')->where('id_batch', $bDetail->id_batch)->decrement('qty_sisa', $bDetail->qty_diambil);
                    }
                }

                foreach ($details as $detail) {
                    if ($trx->type === 'OUT') {
                        // Release booking, deduct actual stock
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok_booking', $detail->jumlah);
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah);
                    } elseif ($trx->type === 'IN') {
                        // Actually add stock, insert batch
                        \App\Models\ItemBatch::create([
                            'id_batch' => 'BCH-' . $trx->idTransaksi . '-' . uniqid(),
                            'kodeBarang' => $detail->kodeBarang,
                            'idTransaksi_masuk' => $trx->idTransaksi,
                            'tanggal_masuk' => $trx->tanggal,
                            'qty_awal' => $detail->jumlah,
                            'qty_sisa' => $detail->jumlah,
                            'qty_booking' => 0,
                            'harga_modal_satuan' => $detail->harga_satuan,
                            'idLokasi' => $detail->lokasi_tujuan ?? null,
                            'lokasi_rak' => $detail->lokasi_asal ?? '-',
                        ]);
                        DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
                    } elseif ($trx->type === 'RET') {
                        $retJenis = $trx->sumber_tujuan ?? '';
                        if (str_starts_with($retJenis, 'RET_OUT')) {
                            DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok_booking', $detail->jumlah);
                            DB::table('items')->where('kodeBarang', $detail->kodeBarang)->decrement('stok', $detail->jumlah);
                        } elseif (str_starts_with($retJenis, 'RET_IN')) {
                            \App\Models\ItemBatch::create([
                                'id_batch' => 'BCH-' . $trx->idTransaksi . '-' . uniqid(),
                                'kodeBarang' => $detail->kodeBarang,
                                'idTransaksi_masuk' => $trx->idTransaksi,
                                'tanggal_masuk' => $trx->tanggal,
                                'qty_awal' => $detail->jumlah,
                                'qty_sisa' => $detail->jumlah,
                                'qty_booking' => 0,
                                'harga_modal_satuan' => $detail->harga_satuan,
                                'idLokasi' => $detail->lokasi_tujuan ?? null,
                                'lokasi_rak' => $detail->lokasi_asal ?? '-',
                            ]);
                            DB::table('items')->where('kodeBarang', $detail->kodeBarang)->increment('stok', $detail->jumlah);
                        }
                    }
                }

                DB::table('transactions')
                    ->where('idTransaksi', $trx->idTransaksi)
                    ->update(['status' => 'completed']);

                DB::commit();
                $this->info("Executed transaction: {$trx->idTransaksi}");
            } catch (\Exception $e) {
                DB::rollBack();
                \Log::error('Scheduled Transaction Error: ' . $e->getMessage());
                $this->error('Gagal mengeksekusi transaksi terjadwal. Cek log server untuk detail.');
            }
        }
        $this->info('Done.');
    }
}
