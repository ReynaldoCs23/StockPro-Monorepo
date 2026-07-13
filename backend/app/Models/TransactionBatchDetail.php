<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransactionBatchDetail extends Model
{
    public $timestamps = true;
    protected $guarded = [];

    public function batch()
    {
        return $this->belongsTo(ItemBatch::class, 'id_batch', 'id_batch');
    }
}
