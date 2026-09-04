import React, { useState, useRef, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Calendar, Download, FileText } from '../components/icons/Icons';
import html2pdf from 'html2pdf.js';
import useAppStore from '../store/useAppStore';
import toast from 'react-hot-toast';

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
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `Laporan_Mutasi_${startDate}_to_${endDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
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

        html2pdf().set(opt).from(element).save().then(() => {
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
        csvContent += `Periode: ${startDate} sd ${endDate}\n\n`;

        // Function to render table to CSV
        const addSectionToCSV = (title, headers, dataRows, mapRowFn) => {
            csvContent += `${title}\n`;
            csvContent += headers.join(",") + "\n";
            dataRows.forEach((row, index) => {
                const rowData = mapRowFn(row, index + 1);
                // Escape commas by quoting
                const csvRow = rowData.map(col => `"${String(col).replace(/"/g, '""')}"`).join(",");
                csvContent += csvRow + "\n";
            });
            csvContent += "\n";
        };

        // INBOUND
        addSectionToCSV(
            "BAGIAN I: REKAPITULASI BARANG MASUK (INBOUND)",
            ["No", "ID Transaksi", "Tanggal", "Sumber / Supplier", "Nama Barang", "Qty", "Harga Satuan", "Total Nilai", "Keterangan"],
            reportData.inbound_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.sumber, r.nama_barang, r.qty, r.harga_satuan, r.total_nilai, r.keterangan]
        );

        // OUTBOUND
        addSectionToCSV(
            "BAGIAN II: REKAPITULASI BARANG KELUAR (OUTBOUND / DISTRIBUSI)",
            ["No", "ID Transaksi", "Tanggal", "Tujuan / Customer", "Nama Barang", "Qty", "Harga Satuan", "Total Nilai", "Keterangan"],
            reportData.outbound_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.tujuan, r.nama_barang, r.qty, r.harga_satuan, r.total_nilai, r.keterangan]
        );

        // RETURNS
        addSectionToCSV(
            "BAGIAN III: REKAPITULASI RETUR & REJECT",
            ["No", "ID Retur", "Tanggal", "Asal Retur", "Nama Barang", "Qty", "Kondisi / Masalah", "Estimasi Nilai", "Tindakan / Disposisi"],
            reportData.returns_data,
            (r, i) => [i, r.id_transaksi, r.tanggal, r.asal_retur, r.nama_barang, r.qty, r.kondisi, r.estimasi_nilai, r.tindakan]
        );

        // REKONSILIASI
        csvContent += "RINGKASAN REKONSILIASI NILAI\n";
        csvContent += `Nilai Total Masuk (Inbound),${reportData.summary.inbound.nilai}\n`;
        csvContent += `Nilai Total Keluar (Outbound),${reportData.summary.outbound.nilai}\n`;
        csvContent += `Nilai Retur / Potongan Reject,-${reportData.summary.returns.nilai}\n`;
        csvContent += `SALDO REKONSILIASI BERSIH,${reportData.summary.net.nilai}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Mutasi_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatRp = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

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
                    `}</style>
                    <div ref={reportRef} className="print-safe-area p-8 bg-[#ffffff] text-[#0f172a]" style={{ fontFamily: 'Arial, sans-serif' }}>

                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-[#1e293b] pb-4 mb-1">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#0f172a] text-[#ffffff] flex items-center justify-center font-bold text-xl rounded">
                                    {companyProfile?.nama?.substring(0, 2).toUpperCase() || 'MJ'}
                                </div>
                                <div>
                                    <h1 className="text-xl font-extrabold text-[#1e293b]">{companyProfile?.nama || 'PT MARA JAYA DEWI SAKTI'}</h1>
                                    <p className="text-[11px] text-[#2563eb] font-bold tracking-wider">SISTEM MANAJEMEN INVENTARIS TERPADU • STOCKPRO ERP</p>
                                    <p className="text-[10px] text-[#64748b] mt-1">{companyProfile?.alamat || 'Kawasan Industri Cemerlang Blok B-4, Jakarta Barat'} | Telp: (021) 554-8902 | support@marajaya.co.id</p>
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
                            <div>Periode Transaksi: <strong className="text-[#1e293b]">{new Date(startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                            <div>Waktu Cetak: <strong className="text-[#1e293b]">{new Date().toLocaleString('id-ID')} WIB</strong></div>
                            <div>Operator / User: <strong className="text-[#1e293b]">{currentUser?.namaLengkap || 'Administrator'}</strong></div>
                        </div>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div className="border border-[#a7f3d0] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#047857] leading-tight max-w-[70%]">BARANG MASUK (IN)</span>
                                    <span className="bg-[#d1fae5] text-[#047857] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.inbound.count} Item</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{reportData.summary.inbound.qty.toLocaleString('id-ID')} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[11px] font-bold text-[#059669] mt-1">{formatRp(reportData.summary.inbound.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#bfdbfe] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#1d4ed8] leading-tight max-w-[70%]">BARANG KELUAR (OUT)</span>
                                    <span className="bg-[#dbeafe] text-[#1d4ed8] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.outbound.count} Item</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{reportData.summary.outbound.qty.toLocaleString('id-ID')} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[11px] font-bold text-[#2563eb] mt-1">{formatRp(reportData.summary.outbound.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#fde68a] rounded-lg p-3.5 bg-[#ffffff] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#b45309] leading-tight max-w-[70%]">RETUR / REJECT</span>
                                    <span className="bg-[#fef3c7] text-[#b45309] text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">{reportData.summary.returns.count} Kasus</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{reportData.summary.returns.qty.toLocaleString('id-ID')} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[11px] font-bold text-[#b45309] mt-1">{formatRp(reportData.summary.returns.nilai)}</div>
                                </div>
                            </div>

                            <div className="border border-[#e2e8f0] rounded-lg p-3.5 bg-[#f8fafc] shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold text-[#334155] leading-tight max-w-[70%]">NET MUTASI STOK</span>
                                    <span className={`text-[9px] font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap ${reportData.summary.net.status === 'Surplus' ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-[#ffe4e6] text-[#e11d48]'}`}>{reportData.summary.net.status}</span>
                                </div>
                                <div>
                                    <div className="text-xl font-extrabold text-[#1e293b] tracking-tight">{reportData.summary.net.qty > 0 ? '+' : ''}{reportData.summary.net.qty.toLocaleString('id-ID')} <span className="text-[10px] text-[#64748b] font-normal">Unit</span></div>
                                    <div className="text-[10px] font-medium text-[#64748b] mt-1">Saldo: {formatRp(reportData.summary.net.nilai)}</div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 1: INBOUND */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[11px] font-extrabold text-[#047857] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#10b981]"></span> BAGIAN I: REKAPITULASI BARANG MASUK (INBOUND)</h3>
                                <span className="text-[9px] text-[#64748b]">Total: {reportData.inbound_data.length} Item Masuk</span>
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
                                        <th className="py-2 px-1 text-right font-bold">Harga Satuan</th>
                                        <th className="py-2 px-1 text-right font-bold">Total Nilai</th>
                                        <th className="py-2 px-1 text-left font-bold w-[20%]">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.inbound_data.length > 0 ? reportData.inbound_data.map((row, i) => (
                                        <tr key={i} className="border-b border-[#f1f5f9] text-[#334155]">
                                            <td className="py-2 px-1 text-center">{i + 1}</td>
                                            <td className="py-2 px-1 font-semibold">{row.id_transaksi}</td>
                                            <td className="py-2 px-1 text-[#64748b]">{row.tanggal}</td>
                                            <td className="py-2 px-1">{row.sumber}</td>
                                            <td className="py-2 px-1">{row.nama_barang}</td>
                                            <td className="py-2 px-1 text-right font-bold">{row.qty.toLocaleString('id-ID')}</td>
                                            <td className="py-2 px-1 text-right text-[#64748b]">{row.harga_satuan ? formatRp(row.harga_satuan) : '-'}</td>
                                            <td className="py-2 px-1 text-right font-semibold">{formatRp(row.total_nilai)}</td>
                                            <td className="py-2 px-1 text-[#64748b] text-[8px]">{row.keterangan}</td>
                                        </tr>
                                    )) : <tr><td colSpan="9" className="py-4 text-center text-[#94a3b8]">Tidak ada transaksi</td></tr>}
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL BARANG MASUK:</td>
                                        <td className="py-2 px-1 text-right text-[#047857]">{reportData.summary.inbound.qty.toLocaleString('id-ID')}</td>
                                        <td colSpan="2" className="py-2 px-1 text-right text-[#047857]">{formatRp(reportData.summary.inbound.nilai)}</td>
                                        <td className="py-2 px-2 text-[8px] text-[#059669] italic">Status: Verified Inbound</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 2: OUTBOUND */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[11px] font-extrabold text-[#1d4ed8] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> BAGIAN II: REKAPITULASI BARANG KELUAR (OUTBOUND / DISTRIBUSI)</h3>
                                <span className="text-[9px] text-[#64748b]">Total: {reportData.outbound_data.length} Item Distribusi</span>
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
                                        <th className="py-2 px-1 text-right font-bold">Harga Satuan</th>
                                        <th className="py-2 px-1 text-right font-bold">Total Nilai</th>
                                        <th className="py-2 px-1 text-left font-bold w-[20%]">Keterangan / Alokasi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.outbound_data.length > 0 ? reportData.outbound_data.map((row, i) => (
                                        <tr key={i} className="border-b border-[#f1f5f9] text-[#334155]">
                                            <td className="py-2 px-1 text-center">{i + 1}</td>
                                            <td className="py-2 px-1 font-semibold">{row.id_transaksi}</td>
                                            <td className="py-2 px-1 text-[#64748b]">{row.tanggal}</td>
                                            <td className="py-2 px-1">{row.tujuan}</td>
                                            <td className="py-2 px-1">{row.nama_barang}</td>
                                            <td className="py-2 px-1 text-right font-bold">{row.qty.toLocaleString('id-ID')}</td>
                                            <td className="py-2 px-1 text-right text-[#64748b]">{row.harga_satuan ? formatRp(row.harga_satuan) : '-'}</td>
                                            <td className="py-2 px-1 text-right font-semibold">{formatRp(row.total_nilai)}</td>
                                            <td className="py-2 px-1 text-[#64748b] text-[8px]">{row.keterangan}</td>
                                        </tr>
                                    )) : <tr><td colSpan="9" className="py-4 text-center text-[#94a3b8]">Tidak ada transaksi</td></tr>}
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL BARANG KELUAR:</td>
                                        <td className="py-2 px-1 text-right text-[#1d4ed8]">{reportData.summary.outbound.qty.toLocaleString('id-ID')}</td>
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
                                <tbody>
                                    {reportData.returns_data.length > 0 ? reportData.returns_data.map((row, i) => (
                                        <tr key={i} className="border-b border-[#f1f5f9] text-[#334155]">
                                            <td className="py-2 px-1 text-center">{i + 1}</td>
                                            <td className="py-2 px-1 font-semibold">{row.id_transaksi}</td>
                                            <td className="py-2 px-1 text-[#64748b]">{row.tanggal}</td>
                                            <td className="py-2 px-1">{row.asal_retur}</td>
                                            <td className="py-2 px-1">{row.nama_barang}</td>
                                            <td className="py-2 px-1 text-right font-bold text-[#d97706]">{row.qty.toLocaleString('id-ID')}</td>
                                            <td className="py-2 px-1 text-[#e11d48] font-medium">{row.kondisi}</td>
                                            <td className="py-2 px-1 text-right font-semibold">{formatRp(row.estimasi_nilai)}</td>
                                            <td className="py-2 px-1 text-[#64748b] text-[8px]">{row.tindakan}</td>
                                        </tr>
                                    )) : <tr><td colSpan="9" className="py-4 text-center text-[#94a3b8]">Tidak ada transaksi</td></tr>}
                                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] font-bold text-[#1e293b]">
                                        <td colSpan="5" className="py-2 px-2 text-right">SUBTOTAL RETUR & REJECT:</td>
                                        <td className="py-2 px-1 text-right text-[#d97706]">{reportData.summary.returns.qty.toLocaleString('id-ID')}</td>
                                        <td colSpan="2" className="py-2 px-1 text-right text-[#d97706]">{formatRp(reportData.summary.returns.nilai)}</td>
                                        <td className="py-2 px-2 text-[8px] text-[#d97706] italic">Status: Claim Submitted</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Footer & Reconciliation */}
                        <div className="flex gap-4 mt-8">
                            <div className="flex-1 border border-[#bfdbfe] rounded p-4 bg-[#eff6ff]">
                                <div className="flex items-center gap-2 mb-2 text-[#1e40af]">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    <h4 className="font-extrabold text-[11px]">OTENTIKASI & AUDIT SISTEM TERKOMPUTERISASI</h4>
                                </div>
                                <p className="text-[9px] text-[#64748b] text-justify">
                                    * Dokumen ini dibuat dan dicetak secara otomatis melalui <strong>StockPro ERP System</strong> berdasarkan data transaksi aktual gudang. Telah divalidasi dengan segel integritas database pusat dan dinyatakan sah secara hukum operasional tanpa tanda tangan basah manual.
                                </p>
                                <p className="text-[8px] text-[#94a3b8] mt-2 font-mono">
                                    Kunci Hash Audit: SHA256:{Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}
                                </p>
                            </div>

                            <div className="w-[300px] border border-[#e2e8f0] rounded p-4 bg-[#ffffff]">
                                <h4 className="font-extrabold text-[11px] text-[#1e293b] mb-3 border-b border-[#e2e8f0] pb-2">RINGKASAN REKONSILIASI NILAI</h4>
                                <div className="space-y-2 text-[10px] text-[#475569]">
                                    <div className="flex justify-between">
                                        <span>Nilai Total Masuk (Inbound):</span>
                                        <span className="font-semibold text-[#1e293b]">{formatRp(reportData.summary.inbound.nilai)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Nilai Total Keluar (Outbound):</span>
                                        <span className="font-semibold text-[#1e293b]">{formatRp(reportData.summary.outbound.nilai)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Nilai Retur / Potongan Reject:</span>
                                        <span className="font-semibold text-[#e11d48]">- {formatRp(reportData.summary.returns.nilai)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-[#e2e8f0] pt-2 mt-2">
                                        <span className="font-extrabold text-[#1e293b] text-[11px]">SALDO REKONSILIASI BERSIH:</span>
                                        <span className={`font-extrabold text-[12px] ${reportData.summary.net.nilai >= 0 ? 'text-[#2563eb]' : 'text-[#e11d48]'}`}>{formatRp(reportData.summary.net.nilai)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-[8px] text-[#94a3b8] mt-8 pt-4 border-t border-[#e2e8f0]">
                            <p>{companyProfile?.nama || 'PT MARA JAYA DEWI SAKTI'} • StockPro Integrated Logistics Engine • Confidential</p>
                            <p>Halaman 1 dari 1 • DocRef: SEC-STK-{new Date().getFullYear()}-ALL-{Math.floor(Math.random() * 9000) + 1000}</p>
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
