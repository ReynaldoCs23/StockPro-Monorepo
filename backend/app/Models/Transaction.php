<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaction extends Model
{
    use SoftDeletes;
    protected $primaryKey = 'idTransaksi';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    protected $casts = [
        'tanggal' => 'datetime',
    ];

    protected function serializeDate(\DateTimeInterface $date) {
        return $date->format('Y-m-d H:i:s');
    }

    public function details()
    {
        return $this->hasMany(TransactionDetail::class, 'idTransaksi', 'idTransaksi');
    }

    public function targetItem()
    {
        return $this->belongsTo(\App\Models\Item::class, 'target_kode_barang', 'kodeBarang');
    }
}
