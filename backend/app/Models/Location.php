<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    protected $primaryKey = 'idLokasi';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
}
