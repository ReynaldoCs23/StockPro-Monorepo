import React, { useState, useRef, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Calendar, Download, FileText } from '../components/icons/Icons';
import html2pdf from 'html2pdf.js';
import useAppStore from '../store/useAppStore';
import toast from 'react-hot-toast';
import { formatRp, formatRupiah } from '../utils/money';

// ---------------------------------------------------------------------------
// Format helpers (semua nilai berasal dari API; tidak ada angka hardcode)
// ---------------------------------------------------------------------------
const formatRpDec = formatRp; // format nominal tunggal: Rp 442,50
const fmtNum = (n) => Number(n || 0).toLocaleString('id-ID');
const unit = (s) => (s || '').toLowerCase();
// Waktu cetak selalu dalam zona backend (Asia/Makassar = WITA), tidak bergantung zona perangkat
const REPORT_TZ = 'Asia/Makassar';
const REPORT_TZ_LABEL = 'WITA';
const fmtDateTime = (d) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: REPORT_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).map(x => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};
const ymdToDmy = (s) => (s || '').split('-').reverse().join('/');

// Baris rekonsiliasi: label kiri, nominal kanan (format faktur ,00)
const RekonRow = ({ label, value, op = '', strong = false, accent = '', note }) => (
    <div className={`flex justify-between gap-2 ${strong ? 'border-t border-[#e2e8f0] pt-1.5 mt-1.5' : ''}`}>
        <span className={strong ? 'font-extrabold text-[#1e293b]' : ''}>
            {op && <span className="inline-block w-3 text-[#94a3b8]">{op}</span>}{label}
            {note && <span className="block text-[7px] text-[#94a3b8] font-normal">{note}</span>}
        </span>
        <span className={`whitespace-nowrap ${strong ? 'font-extrabold' : 'font-semibold text-[#1e293b]'} ${accent}`}>{formatRp(value)}</span>
    </div>
);

const MASUK_LABEL = {
    pembelian: 'Pembelian (harga perolehan)', makloon_masuk: 'Barang jadi dari makloon', retur_pelanggan: 'Retur dari pelanggan',
    retur_pengganti: 'Barang pengganti dari supplier', pengembalian_galon: 'Pengembalian galon', penyesuaian_tambah: 'Penyesuaian stok (+)', lainnya: 'Masuk lainnya',
};
const KELUAR_LABEL = {
    hpp_penjualan: 'HPP barang terjual (FIFO)', bahan_ke_makloon: 'Bahan baku dikirim ke makloon', retur_ke_supplier: 'Retur ke supplier',
    pengganti_ke_pelanggan: 'Barang pengganti ke pelanggan', penyesuaian_kurang: 'Penyesuaian stok (-)', lainnya: 'Keluar lainnya',
};
const WAJIB_TAMPIL = ['pembelian', 'retur_pelanggan', 'hpp_penjualan', 'retur_ke_supplier'];
const tampilkan = (obj) => Object.entries(obj || {}).filter(([k, v]) => WAJIB_TAMPIL.includes(k) || Number(v) !== 0);

const SUB_TEXT = 'block text-[7px] text-[#94a3b8] font-normal leading-tight';

/** Qty utama dalam satuan dasar + detail konversi (bila dibeli per box). */
const QtyCell = ({ qty, satuan, konversi }) => (
    <>
        {fmtNum(qty)}{satuan ? ` ${unit(satuan)}` : ''}
        {konversi && (
            <span className={SUB_TEXT}>({fmtNum(konversi.qty_beli)} {unit(konversi.satuan_beli)} x {fmtNum(konversi.isi_per_satuan)} {unit(konversi.satuan_dasar)})</span>
        )}
    </>
);

const HargaCell = ({ harga, hargaDasar, satuan, konversi }) => {
    if (harga === null || harga === undefined) return '-';
    if (!konversi) return formatRpDec(harga);
    return (
        <>
            {formatRpDec(harga)} / {unit(konversi.satuan_beli)}
            <span className={SUB_TEXT}>({formatRpDec(hargaDasar)} / {unit(satuan)})</span>
        </>
    );
};

/** Header kolom Harga Satuan dengan keterangan PPN. */
const HargaHeader = () => (
    <th className="py-2 px-1 text-right font-bold">Harga Satuan<span className="block text-[7px] font-normal text-[#64748b]">(sblm PPN)</span></th>
);

/**
 * Satu transaksi: baris induk + sub-baris per item (bila multi-item).
 * Dibungkus <tbody> sendiri agar induk & sub-baris tidak terpotong di batas halaman.
 */
const TransactionGroup = ({ row, no, entity }) => (
    <tbody className="avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <tr className="border-b border-[#f1f5f9] text-[#334155]">
            <td className="py-2 px-1 text-center align-top">{no}</td>
            <td className="py-2 px-1 font-semibold align-top">{row.id_transaksi}</td>
            <td className="py-2 px-1 text-[#64748b] align-top">{row.tanggal}</td>
            <td className="py-2 px-1 align-top">{entity}</td>
            <td className="py-2 px-1 align-top">
                {row.nama_barang}
                {row.is_jasa && <span className="ml-1 text-[7px] font-bold text-[#64748b] bg-[#f1f5f9] px-1 rounded">JASA</span>}
            </td>
            <td className="py-2 px-1 text-right font-bold align-top whitespace-nowrap">
                {row.is_multi ? fmtNum(row.qty) : <QtyCell qty={row.qty} satuan={row.satuan} konversi={row.konversi} />}
            </td>
            <td className="py-2 px-1 text-right text-[#64748b] align-top whitespace-nowrap">
                {row.is_multi ? '-' : <HargaCell harga={row.harga_satuan} hargaDasar={row.harga_satuan_dasar} satuan={row.satuan} konversi={row.konversi} />}
            </td>
            <td className="py-2 px-1 text-right font-semibold align-top whitespace-nowrap">{formatRp(row.total_nilai_bulat)}</td>
            <td className="py-2 px-1 text-[#64748b] text-[8px] align-top">{row.keterangan}</td>
        </tr>
        {row.is_multi && row.items.map((it, j) => (
            <tr key={j} className="bg-[#fafbfc] border-b border-[#f1f5f9] text-[#64748b] text-[8px]">
                <td className="py-1 px-1"></td>
                <td colSpan="3" className="py-1 px-1"></td>
                <td className="py-1 px-1 pl-2">└ {it.nama_barang}</td>
                <td className="py-1 px-1 text-right whitespace-nowrap"><QtyCell qty={it.qty} satuan={it.satuan} konversi={it.konversi} /></td>
                <td className="py-1 px-1 text-right whitespace-nowrap"><HargaCell harga={it.harga_satuan} hargaDasar={it.harga_satuan_dasar} satuan={it.satuan} konversi={it.konversi} /></td>
                <td className="py-1 px-1 text-right whitespace-nowrap">{formatRp(it.subtotal_bulat)}</td>
                <td className="py-1 px-1"></td>
            </tr>
        ))}
    </tbody>
);

const EmptyBody = () => (
    <tbody><tr><td colSpan="9" className="py-4 text-center text-[#94a3b8]">Tidak ada transaksi</td></tr></tbody>
);

export default function LaporanMutasi() {
    const { companyProfile, currentUser } = useAppStore();

    const getLocalYYYYMMDD = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    const todayDate = new Date();
    const endDefault = getLocalYYYYMMDD(todayDate);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDefault = getLocalYYYYMMDD(sevenDaysAgo);

    const [startDate, setStartDate] = useState(startDefault);
    const [endDate, setEndDate] = useState(endDefault);

    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const reportRef = useRef();

    const companyName = companyProfile?.nama || 'PT MARA JAYA DEWI SAKTI';
    const auditHash = reportData?.audit?.hash || '';
    const docRef = `SEC-STK-${new Date().getFullYear()}-ALL-${auditHash.slice(0, 8).toUpperCase()}`;

    const fetchReport = async () => {
        setLoading(true);
        try {
            const data = await apiCall(`/reports/mutasi?start_date=${startDate}&end_date=${endDate}`);
            setReportData(data);
        } catch (error) {
            toast.error("Gagal mengambil data laporan");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const handleDownloadPDF = () => {
        const element = reportRef.current;
        const opt = {
            // margin bawah lebih besar untuk footer "Halaman X dari Y" yang dicap per halaman
            margin: [0.5, 0.5, 0.7, 0.5],
            filename: `Laporan_Mutasi_${startDate}_to_${endDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
            // Hindari baris / grup transaksi (induk + sub-baris) terpotong di batas halaman
            pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] }
        };

        toast.loading("Mempersiapkan PDF...", { id: 'pdf' });

        // Patch getComputedStyle to prevent html2canvas from crashing on Tailwind v4 oklch colors
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = function(el, pseudoElt) {
            const style = originalGetComputedStyle(el, pseudoElt);
            return new Proxy(style, {
                get(target, prop) {
                    const val = target[prop];
                    if (typeof val === 'function') {
                        return function(...args) {
                            const result = val.apply(target, args);
                            if (typeof result === 'string' && result.includes('oklch')) return 'rgba(0, 0, 0, 0)';
                            return result;
                        };
                    }
                    if (typeof val === 'string' && val.includes('oklch')) {
                        return 'rgba(0, 0, 0, 0)';
                    }
                    return val;
                }
            });
        };

        html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            // Nomor halaman dinamis: dicap setelah PDF selesai dipaginasi
            const total = pdf.internal.getNumberOfPages();
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            for (let i = 1; i <= total; i++) {
                pdf.setPage(i);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(148, 163, 184);
                pdf.setDrawColor(226, 232, 240);
                pdf.line(0.5, h - 0.45, w - 0.5, h - 0.45);
                pdf.text(`${companyName} • StockPro ERP • ${docRef}`, 0.5, h - 0.3);
                pdf.text(`Halaman ${i} dari ${total}`, w - 0.5, h - 0.3, { align: 'right' });
            }
        }).save().then(() => {
            toast.success("PDF berhasil diunduh", { id: 'pdf' });
        }).catch(err => {
            console.error(err);
            toast.error("Gagal mengunduh PDF", { id: 'pdf' });
        }).finally(() => {
            window.getComputedStyle = originalGetComputedStyle;
        });
    };

    const handleDownloadCSV = () => {
        if (!reportData) return;

        let csvContent = "data:text/csv;charset=utf-8,";

        // Header
        csvContent += "LAPORAN REKAPITULASI KESELURUHAN MUTASI INVENTARIS\n";
        csvContent += `Periode: ${ymdToDmy(startDate)} sd ${ymdToDmy(endDate)}\n\n`;

        const q = (col) => `"${String(col ?? '').replace(/"/g, '""')}"`;
        const qtyText = (r) => r.konversi ? `${r.qty} ${unit(r.satuan)} (${r.konversi.qty_beli} ${unit(r.konversi.satuan_beli)} x ${r.konversi.isi_per_satuan})` : r.qty;

        const addSectionToCSV = (title, headers, dataRows, mapRowFn) => {
            csvContent += `${title}\n`;
            csvContent += headers.join(",") + "\n";
            dataRows.forEach((row, index) => {
                csvContent += mapRowFn(row, index + 1).map(q).join(",") + "\n";
                if (row.is_multi) {
                    row.items.forEach(it => {
                        csvContent += ['', '', '', '', `└ ${it.nama_barang}`, qtyText(it), formatRupiah(it.harga_satuan), formatRupiah(it.subtotal_bulat), ''].map(q).join(",") + "\n";
                    });
                }
            });
            csvContent += "\n";
        };

        addSectionToCSV(
            "BAGIAN I: REKAPITULASI BARANG MASUK (INBOUND)",
            ["No", "ID Transaksi", "Tanggal", "Sumber / Supplier", "Nama Barang", "Qty (satuan dasar)", "Harga Satuan (sblm PPN)", "Total Nilai", "Keterangan"],
            reportData.inbound_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.sumber, r.nama_barang, r.is_multi ? r.qty : qtyText(r), r.harga_satuan == null ? '-' : formatRupiah(r.harga_satuan), formatRupiah(r.total_nilai_bulat), r.keterangan]
        );

        addSectionToCSV(
            "BAGIAN II: REKAPITULASI BARANG KELUAR (OUTBOUND / DISTRIBUSI)",
            ["No", "ID Transaksi", "Tanggal", "Tujuan / Customer", "Nama Barang", "Qty (satuan dasar)", "Harga Satuan (sblm PPN)", "Total Nilai", "Keterangan"],
            reportData.outbound_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.tujuan, r.nama_barang + (r.is_jasa ? ' [JASA]' : ''), r.is_multi ? r.qty : qtyText(r), r.harga_satuan == null ? '-' : formatRupiah(r.harga_satuan), formatRupiah(r.total_nilai_bulat), r.keterangan]
        );

        addSectionToCSV(
            "BAGIAN III: REKAPITULASI RETUR & REJECT",
            ["No", "ID Retur", "Tanggal", "Asal Retur", "Nama Barang", "Qty", "Kondisi / Masalah", "Estimasi Nilai", "Tindakan / Disposisi"],
            reportData.returns_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.asal_retur, r.nama_barang, r.qty, r.kondisi, formatRupiah(r.estimasi_nilai_bulat), r.tindakan]
        );

        csvContent += "NET MUTASI PER BARANG (BARANG FISIK)\n";
        csvContent += "Kode,Nama Barang,Satuan,Masuk,Keluar,Retur,Net\n";
        (reportData.net_per_barang || []).forEach(b => {
            csvContent += [b.kode_barang, b.nama_barang, b.satuan, b.masuk, b.keluar, b.retur, b.net].map(q).join(",") + "\n";
        });
        csvContent += "\n";

        const rk = reportData.rekonsiliasi || {};
        const ps = rk.persediaan || {}, pj = rk.penjualan || {}, pk = rk.pajak || {};
        const line = (label, v) => { csvContent += `${q(label)},${q(formatRupiah(v))}\n`; };
        csvContent += "RINGKASAN REKONSILIASI NILAI\n";
        csvContent += "A. NILAI PERSEDIAAN (harga perolehan, tanpa PPN, tanpa jasa)\n";
        line(`Saldo awal (${reportData.periode?.start})`, ps.saldo_awal);
        Object.entries(ps.masuk || {}).forEach(([k, v]) => line(`+ ${MASUK_LABEL[k] || k}`, v));
        Object.entries(ps.keluar || {}).forEach(([k, v]) => line(`- ${KELUAR_LABEL[k] || k}`, v));
        line(`Saldo akhir (${reportData.periode?.end})`, ps.saldo_akhir);
        line('Perubahan nilai persediaan', ps.perubahan);
        csvContent += "\nB. PENJUALAN, LABA & PAJAK (tanpa PPN)\n";
        line('Penjualan barang', pj.penjualan_barang);
        line('- Retur penjualan', pj.retur_penjualan);
        line('- HPP bersih (FIFO)', pj.hpp_bersih);
        line(`Laba kotor barang (margin ${String(pj.margin_barang_persen).replace('.', ',')}%)`, pj.laba_kotor_barang);
        line('+ Penjualan jasa (non-stok)', pj.penjualan_jasa);
        line('Laba kotor total', pj.laba_kotor_total);
        line('PPN keluaran', pk.ppn_keluaran);
        line('- PPN retur penjualan', pk.ppn_retur_penjualan);
        line('PPN masukan', pk.ppn_masukan);
        line('- PPN retur pembelian', pk.ppn_retur_pembelian);
        line('PPN kurang (+) / lebih (-) bayar', pk.ppn_kurang_bayar);
        csvContent += "\nINFO NILAI FAKTUR (termasuk PPN)\n";
        line('Total masuk', reportData.summary.inbound.nilai);
        line('Total keluar', reportData.summary.outbound.nilai);
        line('Total retur', reportData.summary.returns.nilai);
        if (Number(rk.cek_batch?.selisih) !== 0) line('PERHATIAN: selisih data batch (perlu dicek)', rk.cek_batch.selisih);
        csvContent += `SHA-256 data laporan,${auditHash}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Mutasi_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const outFisik = reportData ? reportData.outbound_data.filter(r => !r.is_jasa) : [];
    const outJasa = reportData ? reportData.outbound_data.filter(r => r.is_jasa) : [];
    const hasReturns = reportData ? reportData.returns_data.length > 0 : false;

    return (
        <div className="space-y-6 max-w-[1000px] mx-auto">
            {/* Control Panel */}
            <div className="bg-[#ffffff] p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                    </div>
                    <button onClick={fetchReport} disabled={loading} className="px-4 py-2 bg-slate-800 text-[#ffffff] text-[13px] font-bold rounded-lg hover:bg-slate-700 transition-colors">
                        {loading ? 'Memuat...' : 'Terapkan Filter'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadCSV} disabled={!reportData} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-[13px] font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors">
                        <FileText className="w-4 h-4" /> CSV
                    </button>
                    <button onClick={handleDownloadPDF} disabled={!reportData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#ffffff] text-[13px] font-bold rounded-lg hover:bg-blue-700 transition-colors">
                        <Download className="w-4 h-4" /> Unduh PDF
                    </button>
                </div>
            </div>

            {/* Print Preview Area */}
            {reportData ? (
                <div className="bg-[#ffffff] border border-[#e2e8f0] shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                    <style>{`
                        :where(.print-safe-area) *,
                        :where(.print-safe-area) *::before,
                        :where(.print-safe-area) *::after {
                            border-color: rgba(226, 232, 240, 1);
                            outline-color: rgba(226, 232, 240, 1);
                            text-decoration-color: rgba(226, 232, 240, 1);
                        }
                        .print-safe-area .avoid-break { break-inside: avoid; page-break-inside: avoid; }
                    `}</style>
                    <div ref={reportRef} className="print-safe-area p-8 bg-[#ffffff] text-[#0f172a]" style={{ fontFamily: 'Arial, sans-serif' }}>

                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-[#1e293b] pb-4 mb-1">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h1 className="text-xl font-extrabold text-[#1e293b]">{companyName}</h1>
                                    <p className="text-[11px] text-[#2563eb] font-bold tracking-wider">SISTEM MANAJEMEN INVENTARIS TERPADU • STOCKPRO ERP</p>
                                    <p className="text-[10px] text-[#64748b] mt-1">{companyProfile?.alamat || 'Kawasan Industri Cemerlang Blok B-4, Jakarta Barat'} | Telp: 0362-3435401 | gede.ariadi@gmail.com</p>
                                </div>
                            </div>
                            <div className="text-right text-[9px] text-[#64748b] flex flex-col justify-end h-full">
                                <p>No. Dokumen: <strong className="text-[#334155]">FM-WH-ALL-{new Date().getFullYear()}-05</strong></p>
                                <p>Revisi: <strong className="text-[#334155]">02</strong> | Sifat: <strong className="text-[#e11d48]">Internal Rahasia</strong></p>
                                <p>Status: <strong className="text-[#059669]">Terverifikasi Database</strong></p>
                            </div>
                        </div>
                        <div className="border-b-4 border-[#2563eb] mb-6 w-full"></div>

                        {/* Title */}
                        <div className="text-center mb-6">
                            <h2 className="text-lg font-extrabold text-[#1e293b] mb-1">LAPORAN REKAPITULASI KESELURUHAN MUTASI INVENTARIS</h2>
                            <p className="text-[11px] text-[#475569]">Rekapitulasi Terpadu: Mutasi Barang Masuk (Inbound), Barang Keluar (Outbound), dan Retur Barang (Return)</p>
                        </div>

                        {/* Info Bar */}
                        <div className="flex justify-between items-center text-[11px] bg-[#f8fafc] px-4 py-2 border border-[#e2e8f0] mb-6 rounded">
                            <div>Periode Transaksi: <strong className="text-[#1e293b]">{reportData.periode?.start || ymdToDmy(startDate)} - {reportData.periode?.end || ymdToDmy(endDate)}</strong></div>
                            <div>Waktu Cetak: <strong className="text-[#1e293b]">{fmtDateTime(new Date())} {REPORT_TZ_LABEL}</strong></div>
                            <div>Operator / User: <strong className="text-[#1e293b]">{currentUser?.namaLengkap || 'Administrator'}</strong></div>
                        </div>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div className="border border-[#a7f3d0] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#047857] leading-tight max-w-[70%]">BARANG MASUK (IN)</span>
                                    <span className="bg-[#d1fae5] text-[#047857] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.inbound.count} Transaksi</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{fmtNum(reportData.summary.inbound.qty_fisik)} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[11px] font-bold text-[#059669] mt-1">{formatRp(reportData.summary.inbound.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#bfdbfe] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#1d4ed8] leading-tight max-w-[70%]">BARANG KELUAR (OUT)</span>
                                    <span className="bg-[#dbeafe] text-[#1d4ed8] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.outbound.count} Transaksi</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{fmtNum(reportData.summary.outbound.qty_fisik)} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    {reportData.summary.outbound.qty_jasa > 0 && (
                                        <div className="text-[8px] text-[#94a3b8]">+ {fmtNum(reportData.summary.outbound.qty_jasa)} jasa (non-stok)</div>
                                    )}
                                    <div className="text-[11px] font-bold text-[#2563eb] mt-1">{formatRp(reportData.summary.outbound.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#fde68a] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#b45309] leading-tight max-w-[70%]">RETUR / REJECT</span>
                                    <span className="bg-[#fef3c7] text-[#b45309] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.returns.count} Kasus</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{fmtNum(reportData.summary.returns.qty_fisik)} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[11px] font-bold text-[#b45309] mt-1">{formatRp(reportData.summary.returns.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#e2e8f0] rounded-lg p-3.5 bg-[#f8fafc] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#334155] leading-tight max-w-[70%]">NET MUTASI STOK</span>
                                    <span className={`text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap ${reportData.summary.net.status === 'Surplus' ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-[#ffe4e6] text-[#e11d48]'}`}>{reportData.summary.net.status}</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{reportData.summary.net.qty > 0 ? '+' : ''}{fmtNum(reportData.summary.net.qty)} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[8px] text-[#94a3b8]">barang fisik, lintas jenis</div>
                                    <div className="text-[8px] text-[#94a3b8] mt-1">Perubahan nilai persediaan</div>
                                    <div className={`text-[10px] font-bold whitespace-nowrap ${Number(reportData.rekonsiliasi?.persediaan?.perubahan) >= 0 ? 'text-[#047857]' : 'text-[#e11d48]'}`}>{Number(reportData.rekonsiliasi?.persediaan?.perubahan) > 0 ? '+' : ''}{formatRp(reportData.rekonsiliasi?.persediaan?.perubahan)}</div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 1: INBOUND */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[11px] font-extrabold text-[#047857] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#10b981]"></span> BAGIAN I: REKAPITULASI BARANG MASUK (INBOUND)</h3>
                                <span className="text-[9px] text-[#64748b]">Total: {reportData.inbound_data.length} Transaksi Masuk</span>
                            </div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-[#f1f5f9] text-[#334155] border-y border-[#cbd5e1]">
                                        <th className="py-2 px-1 text-center font-bold">No</th>
                                        <th className="py-2 px-1 text-left font-bold">ID Transaksi</th>
                                        <th className="py-2 px-1 text-left font-bold">Tanggal</th>
                                        <th className="py-2 px-1 text-left font-bold">Sumber / Supplier</th>
                                        <th className="py-2 px-1 text-left font-bold w-[15%]">Nama Barang</th>
                                        <th className="py-2 px-1 text-right font-bold">Qty</th>
                                        <HargaHeader />
                                        <th className="py-2 px-1 text-right font-bold">Total Nilai</th>
                                        <th className="py-2 px-1 text-left font-bold w-[20%]">Keterangan</th>
                                    </tr>
                                </thead>
                                {reportData.inbound_data.length > 0
                                    ? reportData.inbound_data.map((row, i) => <TransactionGroup key={row.id_transaksi} row={row} no={i + 1} entity={row.sumber} />)
                                    : <EmptyBody />}
                                <tbody>
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL BARANG MASUK:</td>
                                        <td className="py-2 px-1 text-right text-[#047857]">{fmtNum(reportData.summary.inbound.qty_fisik)}</td>
                                        <td colSpan="2" className="py-2 px-1 text-right text-[#047857]">{formatRp(reportData.summary.inbound.nilai)}</td>
                                        <td className="py-2 px-2 text-[8px] text-[#059669] italic">Status: Verified Inbound</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="text-[7px] text-[#94a3b8] mt-1 leading-snug">
                                Qty ditampilkan dalam satuan dasar (pcs). Pembelian dalam box dikonversi sesuai isi per box.
                                {' '}Harga Satuan adalah harga sebelum PPN; Total Nilai = Qty x Harga Satuan x 1,11 (termasuk PPN 11%).
                            </p>
                        </div>

                        {/* SECTION 2: OUTBOUND */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[11px] font-extrabold text-[#1d4ed8] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> BAGIAN II: REKAPITULASI BARANG KELUAR (OUTBOUND / DISTRIBUSI)</h3>
                                <span className="text-[9px] text-[#64748b]">Total: {reportData.outbound_data.length} Transaksi Keluar</span>
                            </div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-[#f1f5f9] text-[#334155] border-y border-[#cbd5e1]">
                                        <th className="py-2 px-1 text-center font-bold">No</th>
                                        <th className="py-2 px-1 text-left font-bold">ID Transaksi</th>
                                        <th className="py-2 px-1 text-left font-bold">Tanggal</th>
                                        <th className="py-2 px-1 text-left font-bold">Tujuan / Customer</th>
                                        <th className="py-2 px-1 text-left font-bold w-[15%]">Nama Barang</th>
                                        <th className="py-2 px-1 text-right font-bold">Qty</th>
                                        <HargaHeader />
                                        <th className="py-2 px-1 text-right font-bold">Total Nilai</th>
                                        <th className="py-2 px-1 text-left font-bold w-[20%]">Keterangan / Alokasi</th>
                                    </tr>
                                </thead>
                                {reportData.outbound_data.length > 0
                                    ? outFisik.map((row, i) => <TransactionGroup key={row.id_transaksi} row={row} no={i + 1} entity={row.tujuan} />)
                                    : <EmptyBody />}
                                {outJasa.length > 0 && (
                                    <>
                                        <tbody className="avoid-break">
                                            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                                <td colSpan="9" className="py-1.5 px-2 text-[8px] font-bold text-[#64748b] uppercase tracking-wider">Jasa / Non-Stok <span className="normal-case font-normal">(tidak dihitung dalam total unit barang; nilai tetap masuk rekonsiliasi)</span></td>
                                            </tr>
                                        </tbody>
                                        {outJasa.map((row, i) => <TransactionGroup key={row.id_transaksi} row={row} no={outFisik.length + i + 1} entity={row.tujuan} />)}
                                    </>
                                )}
                                <tbody>
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL BARANG KELUAR:</td>
                                        <td className="py-2 px-1 text-right text-[#1d4ed8] whitespace-nowrap">
                                            {fmtNum(reportData.summary.outbound.qty_fisik)}
                                            {reportData.summary.outbound.qty_jasa > 0 && <span className={SUB_TEXT}>+ {fmtNum(reportData.summary.outbound.qty_jasa)} jasa</span>}
                                        </td>
                                        <td colSpan="2" className="py-2 px-1 text-right text-[#1d4ed8]">{formatRp(reportData.summary.outbound.nilai)}</td>
                                        <td className="py-2 px-2 text-[8px] text-[#2563eb] italic">Status: Delivery Confirmed</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 3: RETURNS */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[11px] font-extrabold text-[#d97706] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#fbbf24]"></span> BAGIAN III: REKAPITULASI RETUR & REJECT (RETURN/DAMAGE)</h3>
                                <span className="text-[9px] text-[#64748b]">Total: {reportData.returns_data.length} Kasus Retur</span>
                            </div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-[#f1f5f9] text-[#334155] border-y border-[#cbd5e1]">
                                        <th className="py-2 px-1 text-center font-bold">No</th>
                                        <th className="py-2 px-1 text-left font-bold">ID Retur</th>
                                        <th className="py-2 px-1 text-left font-bold">Tanggal</th>
                                        <th className="py-2 px-1 text-left font-bold">Asal Retur</th>
                                        <th className="py-2 px-1 text-left font-bold w-[15%]">Nama Barang</th>
                                        <th className="py-2 px-1 text-right font-bold">Qty</th>
                                        <th className="py-2 px-1 text-left font-bold">Kondisi / Masalah</th>
                                        <th className="py-2 px-1 text-right font-bold">Estimasi Nilai</th>
                                        <th className="py-2 px-1 text-left font-bold w-[20%]">Tindakan / Disposisi</th>
                                    </tr>
                                </thead>
                                {hasReturns ? reportData.returns_data.map((row, i) => (
                                    <tbody key={row.id_transaksi} className="avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                        <tr className="border-b border-[#f1f5f9] text-[#334155]">
                                            <td className="py-2 px-1 text-center">{i + 1}</td>
                                            <td className="py-2 px-1 font-semibold">{row.id_transaksi}</td>
                                            <td className="py-2 px-1 text-[#64748b]">{row.tanggal}</td>
                                            <td className="py-2 px-1">{row.asal_retur}</td>
                                            <td className="py-2 px-1">{row.nama_barang}</td>
                                            <td className="py-2 px-1 text-right font-bold text-[#d97706]">{fmtNum(row.qty)}</td>
                                            <td className="py-2 px-1 text-[#e11d48] font-medium">{row.kondisi}</td>
                                            <td className="py-2 px-1 text-right font-semibold">{formatRp(row.estimasi_nilai_bulat)}</td>
                                            <td className="py-2 px-1 text-[#64748b] text-[8px]">{row.tindakan}</td>
                                        </tr>
                                        {row.is_multi && row.items.map((it, j) => (
                                            <tr key={j} className="bg-[#fafbfc] border-b border-[#f1f5f9] text-[#64748b] text-[8px]">
                                                <td colSpan="4" className="py-1 px-1"></td>
                                                <td className="py-1 px-1 pl-2">└ {it.nama_barang}</td>
                                                <td className="py-1 px-1 text-right whitespace-nowrap"><QtyCell qty={it.qty} satuan={it.satuan} konversi={it.konversi} /></td>
                                                <td className="py-1 px-1"></td>
                                                <td className="py-1 px-1 text-right whitespace-nowrap">{formatRp(it.subtotal_bulat)}</td>
                                                <td className="py-1 px-1"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                )) : <EmptyBody />}
                                <tbody>
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL RETUR & REJECT:</td>
                                        <td className="py-2 px-1 text-right text-[#d97706]">{fmtNum(reportData.summary.returns.qty)}</td>
                                        <td colSpan="2" className="py-2 px-1 text-right text-[#d97706]">{formatRp(reportData.summary.returns.nilai)}</td>
                                        {hasReturns
                                            ? <td className="py-2 px-2 text-[8px] text-[#d97706] italic">Status: {reportData.summary.returns.status}</td>
                                            : <td className="py-2 px-2 text-[8px] text-[#94a3b8] italic">Status: Tidak Ada Retur</td>}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* NET MUTASI PER BARANG */}
                        {reportData.net_per_barang?.length > 0 && (
                            <div className="mb-6 avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-[11px] font-extrabold text-[#334155] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#64748b]"></span> NET MUTASI PER BARANG</h3>
                                    <span className="text-[9px] text-[#64748b]">{reportData.net_per_barang.length} Jenis Barang Fisik</span>
                                </div>
                                <table className="w-full text-[9px] border-collapse">
                                    <thead>
                                        <tr className="bg-[#f1f5f9] text-[#334155] border-y border-[#cbd5e1]">
                                            <th className="py-2 px-1 text-center font-bold">No</th>
                                            <th className="py-2 px-1 text-left font-bold">Kode</th>
                                            <th className="py-2 px-1 text-left font-bold">Nama Barang</th>
                                            <th className="py-2 px-1 text-left font-bold">Satuan</th>
                                            <th className="py-2 px-1 text-right font-bold">Masuk</th>
                                            <th className="py-2 px-1 text-right font-bold">Keluar</th>
                                            <th className="py-2 px-1 text-right font-bold">Retur</th>
                                            <th className="py-2 px-1 text-right font-bold">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.net_per_barang.map((b, i) => (
                                            <tr key={b.kode_barang} className="border-b border-[#f1f5f9] text-[#334155]">
                                                <td className="py-1.5 px-1 text-center">{i + 1}</td>
                                                <td className="py-1.5 px-1 text-[#64748b]">{b.kode_barang}</td>
                                                <td className="py-1.5 px-1">{b.nama_barang}</td>
                                                <td className="py-1.5 px-1 text-[#64748b]">{unit(b.satuan)}</td>
                                                <td className="py-1.5 px-1 text-right text-[#047857]">{fmtNum(b.masuk)}</td>
                                                <td className="py-1.5 px-1 text-right text-[#1d4ed8]">{fmtNum(b.keluar)}</td>
                                                <td className="py-1.5 px-1 text-right text-[#d97706]">{fmtNum(b.retur)}</td>
                                                <td className={`py-1.5 px-1 text-right font-bold ${b.net < 0 ? 'text-[#e11d48]' : 'text-[#1e293b]'}`}>{b.net > 0 ? '+' : ''}{fmtNum(b.net)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-[7px] text-[#94a3b8] mt-1">Laporan ini hanya mutasi periode berjalan dan tidak memuat saldo awal stok. Jasa/non-stok tidak termasuk.</p>
                            </div>
                        )}

                        {/* REKONSILIASI NILAI: (A) persediaan tanpa PPN dari buku batch FIFO, (B) penjualan, laba & PPN */}
                        {reportData.rekonsiliasi && (() => {
                            const rk = reportData.rekonsiliasi;
                            const ps = rk.persediaan;
                            const pj = rk.penjualan;
                            const pk = rk.pajak;
                            const naik = Number(ps.perubahan) >= 0;
                            const ppnKurang = Number(pk.ppn_kurang_bayar) >= 0;
                            return (
                                <div className="mt-8 avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                    <h4 className="font-extrabold text-[11px] text-[#1e293b] mb-3 border-b border-[#e2e8f0] pb-2">RINGKASAN REKONSILIASI NILAI</h4>
                                    <div className="grid grid-cols-2 gap-4 text-[9.5px] text-[#475569]">
                                        <div className="border border-[#e2e8f0] rounded p-3 bg-[#ffffff] space-y-1">
                                            <p className="font-extrabold text-[10px] text-[#047857] mb-1">A. NILAI PERSEDIAAN <span className="font-normal text-[#94a3b8]">(harga perolehan, tanpa PPN, tanpa jasa)</span></p>
                                            <RekonRow label={`Saldo awal (${reportData.periode?.start})`} value={ps.saldo_awal} />
                                            {tampilkan(ps.masuk).map(([k, v]) => <RekonRow key={k} op="+" label={MASUK_LABEL[k] || k} value={v} />)}
                                            {tampilkan(ps.keluar).map(([k, v]) => <RekonRow key={k} op="−" label={KELUAR_LABEL[k] || k} value={v} />)}
                                            <RekonRow strong label={`Saldo akhir (${reportData.periode?.end})`} value={ps.saldo_akhir} accent="text-[#047857]" />
                                            <div className={`flex justify-between text-[9px] ${naik ? 'text-[#047857]' : 'text-[#e11d48]'}`}>
                                                <span>Perubahan nilai persediaan periode ini</span>
                                                <span className="font-bold whitespace-nowrap">{naik ? '+' : ''}{formatRp(ps.perubahan)}</span>
                                            </div>
                                        </div>
                                        <div className="border border-[#e2e8f0] rounded p-3 bg-[#ffffff] space-y-1">
                                            <p className="font-extrabold text-[10px] text-[#1d4ed8] mb-1">B. PENJUALAN, LABA & PAJAK <span className="font-normal text-[#94a3b8]">(tanpa PPN)</span></p>
                                            <RekonRow label="Penjualan barang" value={pj.penjualan_barang} />
                                            <RekonRow op="−" label="Retur penjualan" value={pj.retur_penjualan} />
                                            <RekonRow op="−" label="HPP bersih (FIFO, setelah retur)" value={pj.hpp_bersih} />
                                            <RekonRow strong label={`Laba kotor barang (margin ${String(pj.margin_barang_persen).replace('.', ',')}%)`} value={pj.laba_kotor_barang} accent="text-[#1d4ed8]" />
                                            <RekonRow op="+" label="Penjualan jasa (non-stok)" value={pj.penjualan_jasa} />
                                            <RekonRow strong label="Laba kotor total" value={pj.laba_kotor_total} accent="text-[#1d4ed8]" note="sama dengan perhitungan laba di Dashboard" />
                                            <div className="border-t border-dashed border-[#e2e8f0] mt-2 pt-1.5 space-y-1">
                                                <RekonRow label="PPN keluaran (setelah retur)" value={(Number(pk.ppn_keluaran) - Number(pk.ppn_retur_penjualan)).toFixed(2)} />
                                                <RekonRow op="−" label="PPN masukan (setelah retur)" value={(Number(pk.ppn_masukan) - Number(pk.ppn_retur_pembelian)).toFixed(2)} />
                                                <RekonRow strong label={ppnKurang ? 'PPN kurang bayar (disetor)' : 'PPN lebih bayar'} value={Math.abs(Number(pk.ppn_kurang_bayar)).toFixed(2)} accent={ppnKurang ? 'text-[#b45309]' : 'text-[#047857]'} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[8px] text-[#94a3b8] leading-snug">
                                        Info nilai faktur (termasuk PPN): Masuk {formatRp(reportData.summary.inbound.nilai)} • Keluar {formatRp(reportData.summary.outbound.nilai)} • Retur {formatRp(reportData.summary.returns.nilai)}.
                                        {' '}Nilai faktur tidak dipakai untuk rekonsiliasi karena mencampur harga beli, harga jual, PPN, dan jasa.
                                    </div>
                                    {Number(rk.cek_batch?.selisih) !== 0 && (
                                        <div className="mt-2 text-[8px] text-[#b45309] bg-[#fffbeb] border border-[#fde68a] rounded px-2 py-1.5">
                                            Perhatian: selisih data batch {formatRp(rk.cek_batch.selisih)} ({rk.cek_batch.batch.map(b => `${b.id_batch}: ${b.qty_selisih.toLocaleString('id-ID')} unit`).join(', ')}).
                                            {' '}Jumlah awal batch dikurangi pemakaian tidak sama dengan sisa batch, sehingga saldo buku persediaan lebih besar dari sisa fisik. Data tidak diubah otomatis; perlu dicek.
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Otentikasi & audit */}
                        <div className="mt-4 avoid-break border border-[#bfdbfe] rounded p-4 bg-[#eff6ff]" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                            <div className="flex items-center gap-2 mb-2 text-[#1e40af]">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                <h4 className="font-extrabold text-[11px]">OTENTIKASI & AUDIT SISTEM TERKOMPUTERISASI</h4>
                            </div>
                            <p className="text-[9px] text-[#64748b] text-justify">
                                * Dokumen dihasilkan otomatis oleh sistem <strong>StockPro ERP</strong>. Keaslian data dapat diverifikasi dengan mencocokkan hash di bawah terhadap data sumber.
                            </p>
                            <div className="text-[7px] text-[#94a3b8] mt-2 font-mono leading-snug">
                                <div className="font-sans text-[8px]">SHA-256 data laporan:</div>
                                <div>{auditHash.slice(0, 32)}</div>
                                <div>{auditHash.slice(32)}</div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-[8px] text-[#94a3b8] mt-8 pt-4 border-t border-[#e2e8f0]">
                            <p>{companyName} • StockPro Integrated Logistics Engine • Confidential</p>
                            <p>DocRef: {docRef}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-[#f8fafc] border border-[#e2e8f0] shadow-sm mx-auto flex flex-col items-center justify-center text-[#94a3b8]" style={{ width: '210mm', minHeight: '297mm' }}>
                    <FileText className="w-16 h-16 mb-4 text-[#cbd5e1]" />
                    <p className="font-semibold text-lg">Tidak Ada Data</p>
                    <p className="text-sm">Terapkan filter untuk melihat preview laporan.</p>
                </div>
            )}
        </div>
    );
}
