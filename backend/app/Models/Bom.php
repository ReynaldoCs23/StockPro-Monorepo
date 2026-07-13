<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bom extends Model
{
    protected $primaryKey = 'id_bom';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    public function details()
    {
        return $this->hasMany(BomDetail::class, 'id_bom', 'id_bom');
    }
}
