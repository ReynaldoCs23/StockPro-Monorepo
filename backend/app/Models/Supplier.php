<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $primaryKey = 'idSupplier';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'idSupplier', 'nama', 'tipe_partner', 'alamat', 'telp',
        'npwp', 'nik', 'alamat_lengkap', 'penanggung_jawab',
    ];
}
