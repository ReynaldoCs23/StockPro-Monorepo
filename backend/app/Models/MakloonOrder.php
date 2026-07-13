<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MakloonOrder extends Model
{
    protected $guarded = [];

    public function vendor()
    {
        return $this->belongsTo(Supplier::class, 'id_vendor', 'idSupplier');
    }

    public function product()
    {
        return $this->belongsTo(Item::class, 'kode_produk', 'kodeBarang');
    }
}
