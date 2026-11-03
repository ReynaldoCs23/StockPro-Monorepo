<?php

namespace Tests\Unit;

use App\Services\AiAnswerPdfService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AiAnswerPdfServiceTest extends TestCase
{
    public function test_render_menghasilkan_pdf_dan_nama_file_sesuai_format(): void
    {
        $md = "Pembuka.\n\n## Ringkasan\n\n| Barang | Qty |\n| --- | ---: |\n| Galon | 4.860 |";
        $now = Carbon::parse('2026-11-03 04:05:00', 'UTC'); // 11:05 WIB

        [$pdf, $name] = (new AiAnswerPdfService())->render($md, null, 'Insight Januari?', 'Administrator', $now);

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertSame('Analisis-AI_PT-Mara-Jaya-Dewi-Sakti_2026-11-03_1105.pdf', $name);
    }

    public function test_html_dan_link_berbahaya_disanitasi(): void
    {
        $svc = new AiAnswerPdfService();
        $html = $svc->markdownToSafeHtml("<script>alert(1)</script> <b onclick=\"x()\">t</b> ![x](http://evil.test/a.png) [k](javascript:alert(1))\n\n| A | B |\n| --- | ---: |\n| x | 1 |");

        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('onclick', $html);
        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('javascript:', $html);
        $this->assertStringContainsString('<table>', $html);
        $this->assertStringContainsString('class="al-right"', $html);

        $page = $svc->buildHtml('isi', '<i>Judul</i>', '<script>q</script>', '<b>User</b>', Carbon::now());
        $this->assertStringContainsString('&lt;script&gt;q&lt;/script&gt;', $page);
        $this->assertStringNotContainsString('<b>User</b>', $page);
        $this->assertStringNotContainsString('hash', strtolower($page));
    }

    public function test_endpoint_menolak_user_yang_belum_login(): void
    {
        $this->postJson('/api/ai/export-pdf', ['markdown' => 'tes'])->assertStatus(401);
    }
}
