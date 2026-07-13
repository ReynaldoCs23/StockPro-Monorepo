<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $primaryKey = 'idPelanggan';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'idPelanggan', 'nama', 'alamat', 'telp',
        'npwp', 'nik', 'alamat_lengkap', 'penanggung_jawab',
    ];
}
