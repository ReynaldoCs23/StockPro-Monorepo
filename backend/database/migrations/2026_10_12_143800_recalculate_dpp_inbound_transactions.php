<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Recalculates DPP for all inbound transactions to:
     * round((items_subtotal - potongan_harga - uang_muka) * 11 / 12, 2)
     */
    public function up(): void
    {
        $transactions = DB::table('transactions')
            ->where(function($q) {
                $q->whereIn('type', ['IN', 'MAKLOON_IN'])
                  ->orWhere('idTransaksi', 'like', 'INV-IN%')
                  ->orWhere('idTransaksi', 'like', 'MKL-IN%');
            })
            ->get();

        foreach ($transactions as $trx) {
            $details = DB::table('transaction_details')
                ->where('idTransaksi', $trx->idTransaksi)
                ->get();

            $subtotal = 0;
            if ($details->isNotEmpty()) {
                foreach ($details as $item) {
                    $qty = $item->jumlah_transaksi ?? $item->jumlah;
                    $subtotal += ($qty * (float)$item->harga_satuan);
                }
            } else {
                // Fallback to current totalTransaksi minus pajak if no details
                $subtotal = (float)$trx->totalTransaksi - (float)$trx->pajak_nominal;
            }

            $potongan = (float)($trx->potongan_harga ?? 0);
            $uangMuka = (float)($trx->uang_muka ?? 0);
            $baseSubtotal = max(0, $subtotal - $potongan - $uangMuka);

            $dppCalculated = round($baseSubtotal * 11 / 12, 2);

            DB::table('transactions')
                ->where('idTransaksi', $trx->idTransaksi)
                ->update([
                    'dpp' => $dppCalculated,
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert DPP back to subtotal if rolled back
        $transactions = DB::table('transactions')
            ->where(function($q) {
                $q->whereIn('type', ['IN', 'MAKLOON_IN'])
                  ->orWhere('idTransaksi', 'like', 'INV-IN%')
                  ->orWhere('idTransaksi', 'like', 'MKL-IN%');
            })
            ->get();

        foreach ($transactions as $trx) {
            $details = DB::table('transaction_details')
                ->where('idTransaksi', $trx->idTransaksi)
                ->get();

            $subtotal = 0;
            foreach ($details as $item) {
                $qty = $item->jumlah_transaksi ?? $item->jumlah;
                $subtotal += ($qty * (float)$item->harga_satuan);
            }

            DB::table('transactions')
                ->where('idTransaksi', $trx->idTransaksi)
                ->update([
                    'dpp' => round($subtotal, 2),
                    'updated_at' => now(),
                ]);
        }
    }
};
