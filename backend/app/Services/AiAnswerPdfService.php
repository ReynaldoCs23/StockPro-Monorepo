<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Carbon;
use League\CommonMark\GithubFlavoredMarkdownConverter;

/**
 * Membuat PDF A4 (teks dapat diseleksi) yang HANYA berisi jawaban Asisten AI.
 * Markdown -> HTML (CommonMark GFM, HTML mentah dibuang) -> dompdf.
 */
class AiAnswerPdfService
{
    public const COMPANY = 'PT Mara Jaya Dewi Sakti';
    public const DEFAULT_TITLE = 'Analisis Asisten AI StockPro';
    public const TIMEZONE = 'Asia/Jakarta';
    public const FOOTER_TEXT = 'Dihasilkan oleh Asisten AI StockPro. Verifikasi angka terhadap Laporan Mutasi sebelum dipakai untuk keputusan.';
    public const MAX_MARKDOWN_CHARS = 60000;

    /** @return array{0: string, 1: string} [isi PDF biner, nama file] */
    public function render(string $markdown, ?string $title, ?string $question, string $userName, ?CarbonInterface $now = null): array
    {
        $now = ($now ? Carbon::instance($now) : Carbon::now())->setTimezone(self::TIMEZONE);
        $html = $this->buildHtml($markdown, $title, $question, $userName, $now);

        $options = new Options();
        $options->setIsRemoteEnabled(false);      // tidak mengambil resource eksternal (cegah SSRF)
        $options->setIsPhpEnabled(false);
        $options->setIsJavascriptEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $options->setFontCache(storage_path('framework/cache/dompdf'));
        $options->setTempDir(sys_get_temp_dir());
        $options->setChroot([base_path('vendor/dompdf/dompdf')]);

        if (!is_dir(storage_path('framework/cache/dompdf'))) {
            @mkdir(storage_path('framework/cache/dompdf'), 0775, true);
        }

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();
        $this->stampFooter($dompdf);

        return [$dompdf->output(), self::filename($now)];
    }

    public static function filename(CarbonInterface $now): string
    {
        $t = Carbon::instance($now)->setTimezone(self::TIMEZONE);
        return 'Analisis-AI_PT-Mara-Jaya-Dewi-Sakti_' . $t->format('Y-m-d_Hi') . '.pdf';
    }

    /** Markdown -> HTML aman: HTML mentah dibuang, link tidak aman diblokir, gambar dihapus. */
    public function markdownToSafeHtml(string $markdown): string
    {
        $converter = new GithubFlavoredMarkdownConverter([
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 20,
        ]);
        $html = (string) $converter->convert($markdown);

        // Tidak ada gambar/iframe/script di PDF jawaban AI
        $html = preg_replace('#<(img|iframe|object|embed|script|style)\b[^>]*>(.*?</\1>)?#is', '', $html);
        // Perataan kolom tabel GFM -> class (dompdf lebih konsisten dengan CSS)
        $html = preg_replace('#<(td|th) align="(left|center|right)"#', '<$1 class="al-$2"', $html);
        // Link tetap teks biasa (tidak bisa diklik ke tujuan yang tidak diverifikasi)
        $html = preg_replace('#<a\b[^>]*>(.*?)</a>#is', '<span class="link">$1</span>', $html);

        return $html;
    }

    public function buildHtml(string $markdown, ?string $title, ?string $question, string $userName, CarbonInterface $now): string
    {
        $body = $this->markdownToSafeHtml($markdown);
        $e = fn (?string $s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $title = trim((string) $title) !== '' ? trim($title) : self::DEFAULT_TITLE;
        $printed = Carbon::instance($now)->setTimezone(self::TIMEZONE)->format('d/m/Y H:i') . ' WIB';
        $questionHtml = trim((string) $question) !== ''
            ? '<p class="question"><span>Pertanyaan:</span> ' . $e(trim($question)) . '</p>'
            : '';

        return <<<HTML
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{$e($title)}</title>
<style>
    @page { margin: 18mm 16mm 20mm 16mm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 9.5pt; line-height: 1.55; color: #334155; }
    .doc-header { border-bottom: 2px solid #1e293b; padding-bottom: 6pt; margin-bottom: 2pt; }
    .company { font-size: 14pt; font-weight: bold; color: #1e293b; margin: 0; }
    .app { font-size: 7.5pt; color: #2563eb; font-weight: bold; letter-spacing: 0.6pt; margin: 1pt 0 0; }
    .accent { border-bottom: 3px solid #2563eb; margin-bottom: 10pt; }
    .title { font-size: 12.5pt; font-weight: bold; color: #1e293b; margin: 0 0 3pt; }
    .meta { font-size: 7.5pt; color: #64748b; margin: 0; }
    .question { font-size: 7.5pt; color: #64748b; margin: 3pt 0 0; padding: 4pt 6pt; background: #f8fafc; border-left: 2px solid #93c5fd; }
    .question span { font-weight: bold; color: #475569; }
    .content { margin-top: 12pt; }

    h1, h2, h3, h4 { color: #1e293b; font-weight: bold; line-height: 1.3; page-break-after: avoid; page-break-inside: avoid; }
    h1 { font-size: 13pt; margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #e2e8f0; }
    h2 { font-size: 11.5pt; margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #e2e8f0; }
    h3 { font-size: 10.5pt; margin: 12pt 0 5pt; color: #1e3a8a; }
    h4 { font-size: 9.5pt; margin: 10pt 0 4pt; }
    p { margin: 0 0 7pt; }
    ul, ol { margin: 0 0 7pt; padding-left: 16pt; }
    li { margin: 0 0 3pt; }
    li p { margin: 0; }
    strong { color: #1e293b; }
    hr { border: 0; border-top: 1px solid #e2e8f0; margin: 10pt 0; }
    blockquote { margin: 0 0 7pt; padding: 4pt 8pt; border-left: 2px solid #93c5fd; background: #f8fafc; color: #475569; }
    code { font-family: "DejaVu Sans Mono", monospace; font-size: 8pt; background: #f1f5f9; color: #1e40af; padding: 0 2pt; }
    pre { background: #f1f5f9; padding: 6pt; font-size: 8pt; white-space: pre-wrap; }
    pre code { background: transparent; color: #0f172a; }
    .link { color: #2563eb; }

    table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 8.5pt; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { background: #eef2f7; color: #1e293b; font-weight: bold; text-align: left; border: 1px solid #cbd5e1; padding: 4pt 6pt; }
    td { border: 1px solid #e2e8f0; padding: 3.5pt 6pt; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .al-right { text-align: right; white-space: nowrap; }
    .al-center { text-align: center; }
</style>
</head>
<body>
    <div class="doc-header">
        <p class="company">{$e(self::COMPANY)}</p>
        <p class="app">SISTEM MANAJEMEN INVENTARIS &bull; STOCKPRO ERP</p>
    </div>
    <div class="accent"></div>
    <p class="title">{$e($title)}</p>
    <p class="meta">Dicetak: {$e($printed)} &bull; Oleh: {$e($userName)}</p>
    {$questionHtml}
    <div class="content">
{$body}
    </div>
</body>
</html>
HTML;
    }

    /** Footer di setiap halaman: teks kiri + "Halaman X dari Y" dinamis di kanan. */
    private function stampFooter(Dompdf $dompdf): void
    {
        $canvas = $dompdf->getCanvas();
        $metrics = $dompdf->getFontMetrics();
        $font = $metrics->getFont('DejaVu Sans');
        $size = 6.5;
        $color = [0.58, 0.64, 0.72]; // #94a3b8
        $w = $canvas->get_width();
        $h = $canvas->get_height();
        $margin = 16 * 72 / 25.4; // 16mm dalam pt
        $y = $h - 36;

        $canvas->line($margin, $y - 5, $w - $margin, $y - 5, [0.89, 0.91, 0.94], 0.5);
        $canvas->page_text($margin, $y, self::FOOTER_TEXT, $font, $size, $color);

        $pageLabel = 'Halaman {PAGE_NUM} dari {PAGE_COUNT}';
        $labelWidth = $metrics->getTextWidth('Halaman 99 dari 99', $font, $size);
        $canvas->page_text($w - $margin - $labelWidth, $y, $pageLabel, $font, $size, $color);
    }
}
