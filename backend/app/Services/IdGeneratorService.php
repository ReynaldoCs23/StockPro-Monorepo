<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class IdGeneratorService
{
    /**
     * Generate Transaction ID
     * Formats: 
     * INV-IN-YYMM-XXXX
     * INV-OUT-YYMM-XXXX
     * MKL-IN-YYMM-XXXX
     * MKL-OUT-YYMM-XXXX
     * RET-IN-YYMM-XXXX
     * RET-OUT-YYMM-XXXX
     */
    public function generateTransactionId($type, $returnType = null)
    {
        $yymm = Carbon::now()->format('ym');
        $prefix = '';

        if ($type === 'IN') {
            $prefix = "INV-IN-{$yymm}-";
        } elseif ($type === 'OUT') {
            $prefix = "INV-OUT-{$yymm}-";
        } elseif ($type === 'MAKLOON_IN') {
            $prefix = "MKL-IN-{$yymm}-";
        } elseif ($type === 'MAKLOON_OUT') {
            $prefix = "MKL-OUT-{$yymm}-";
        } elseif ($type === 'RET') {
            if (in_array($returnType, ['RET_OUT_RETURN_SUPPLIER', 'RET_OUT_REPLACE', 'Return ke Vendor'])) {
                $prefix = "RET-OUT-{$yymm}-";
            } else {
                $prefix = "RET-IN-{$yymm}-";
            }
        }

        return $this->getLatestSequence('transactions', 'idTransaksi', $prefix, 4);
    }

    /**
     * Generate Item Code
     * RM-XXXX (Bahan Baku/Kemasan) or BRG-XXXX (Produk Jadi)
     */
    public function generateItemCode($tipeBarang)
    {
        $prefix = in_array($tipeBarang, ['Bahan Baku', 'Kemasan']) ? 'RM-' : 'BRG-';
        return $this->getLatestSequence('items', 'kodeBarang', $prefix, 4);
    }

    /**
     * Generate Location ID
     * WH-INT-XXX or WH-VND-XXX
     */
    public function generateLocationId($tipeLokasi)
    {
        $prefix = $tipeLokasi === 'vendor' ? 'WH-VND-' : 'WH-INT-';
        return $this->getLatestSequence('locations', 'idLokasi', $prefix, 3);
    }

    /**
     * Generate Makloon Work Order Number
     * WO-MKL-YYMM-XXXX
     */
    public function generateMakloonWoNumber()
    {
        $yymm = Carbon::now()->format('ym');
        $prefix = "WO-MKL-{$yymm}-";
        return $this->getLatestSequence('makloon_orders', 'wo_number', $prefix, 4);
    }

    /**
     * Generate General Sequence ID
     * e.g. KTG-XXX, SUP-XXX, CUS-XXX
     */
    public function generateSequenceId($table, $column, $prefix, $length = 3)
    {
        return $this->getLatestSequence($table, $column, $prefix, $length);
    }

    /**
     * Core method to securely fetch and increment the latest ID.
     */
    private function getLatestSequence($table, $column, $prefix, $length)
    {
        return DB::transaction(function () use ($table, $column, $prefix, $length) {
            $latest = DB::table($table)
                ->where($column, 'LIKE', "{$prefix}%")
                ->orderBy($column, 'desc')
                ->lockForUpdate()
                ->value($column);

            if (!$latest) {
                $sequence = 1;
            } else {
                $lastSequence = (int) substr($latest, strlen($prefix));
                $sequence = $lastSequence + 1;
            }

            return $prefix . str_pad($sequence, $length, '0', STR_PAD_LEFT);
        });
    }
}
