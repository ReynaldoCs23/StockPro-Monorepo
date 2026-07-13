<?php

namespace App\Traits;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

trait HasSystemLogs {
    private function writeLog($user, $aksi, $modul, $keterangan, $payload = null) {
        if (!$user) return;
        DB::table('logs')->insert([
            'idLog' => uniqid('LOG-'),
            'waktu' => Carbon::now(),
            'user' => $user,
            'aksi' => $aksi,
            'modul' => $modul,
            'keterangan' => $keterangan,
            'payload' => $payload,
            'created_at' => Carbon::now()
        ]);
    }
}