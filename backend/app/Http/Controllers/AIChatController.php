<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AIChatController extends Controller
{
    public function ask(Request $request)
    {
        $request->validate([
            'question' => 'required|string'
        ]);

        try {
            // Naikkan timeout jadi 300 detik (5 menit) karena proses AI dan pemanggilan multi-tools bisa memakan waktu lama
            $response = Http::timeout(300)->post('http://127.0.0.1:5000/chat', [
                'question' => $request->question
            ]);

            return response()->json([
                'answer' => $response->json('answer') ?? 'Gagal menghubungi mesin AI (Python script belum dijalankan atau port salah).'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'answer' => 'Terjadi kesalahan jaringan ke mesin AI: ' . $e->getMessage()
            ], 500);
        }
    }
}
