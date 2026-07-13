<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BomDetail extends Model
{
    protected $guarded = [];

    public function bom()
    {
        return $this->belongsTo(Bom::class, 'id_bom', 'id_bom');
    }
}
