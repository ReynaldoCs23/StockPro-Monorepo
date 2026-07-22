<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockAdjustment extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function item()
    {
        return $this->belongsTo(Item::class, 'item_id', 'kodeBarang');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
