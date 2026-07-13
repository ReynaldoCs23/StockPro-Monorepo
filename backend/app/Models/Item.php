<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    protected $primaryKey = 'kodeBarang';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    protected $appends = ['stok_tersedia', 'stok_aktual'];

    public function getStokAktualAttribute()
    {
        return $this->stok;
    }

    public function getStokTersediaAttribute()
    {
        return $this->stok - ($this->stok_booking ?? 0);
    }
}
