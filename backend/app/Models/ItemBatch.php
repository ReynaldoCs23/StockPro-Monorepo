<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemBatch extends Model
{
    public $timestamps = true;
    protected $primaryKey = 'id_batch';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    public function location()
    {
        return $this->belongsTo(Location::class, 'idLokasi', 'idLokasi');
    }
}
