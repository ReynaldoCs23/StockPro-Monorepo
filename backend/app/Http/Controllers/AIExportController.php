<?php

namespace App\Http\Controllers;

use App\Services\AiAnswerPdfService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AIExportController extends Controller
{
    /** POST /api/ai/export-pdf — hanya untuk user login (auth:sanctum). */
    public function exportPdf(Request $request, AiAnswerPdfService $pdf)
    {
        $data = $request->validate([
            'markdown' => 'required|string|max:' . AiAnswerPdfService::MAX_MARKDOWN_CHARS,
            'title' => 'nullable|string|max:150',
            'question' => 'nullable|string|max:2000',
        ]);

        $user = $request->user();
        $userName = $user->namaLengkap ?? $user->name ?? $user->username ?? 'Pengguna';

        try {
            [$binary, $filename] = $pdf->render($data['markdown'], $data['title'] ?? null, $data['question'] ?? null, $userName);
        } catch (\Throwable $e) {
            Log::error('[AIExport] Gagal membuat PDF: ' . $e->getMessage());
            return response()->json(['message' => 'Gagal membuat PDF.'], 500);
        }

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store',
        ]);
    }
}
