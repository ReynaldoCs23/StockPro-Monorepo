import useAppStore from '../store/useAppStore';
import React, { useState, useEffect } from 'react';
import FakturPajak from '../components/ui/FakturPajak';
import { ArrowUpFromLine, Package, Calendar, Trash2 } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import SuratJalanMakloon from '../components/ui/SuratJalanMakloon';
import { apiCall } from '../utils/api';
import { generateId, getLocalYYYYMMDD, formatRp, formatLocalDate } from '../utils/helpers';

export default function BarangKeluar() {
    const { outbound, setOutbound, items, setItems, customers, suppliers, locations, returns, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions, companyProfile } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const todayDate = new Date();
    const todayString = getLocalYYYYMMDD(todayDate);

    const startDefault = todayString;
    const endDefault = todayString;

    const [isModalOpen, setModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);
    const [filterStart, setFilterStart] = useState(startDefault);
    const [filterEnd, setFilterEnd] = useState(endDefault);
    const [printData, setPrintData] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [toast, setToast] = useState(null);
    const [fifoTraceData, setFifoTraceData] = useState(null);
    const [isFifoLoading, setIsFifoLoading] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [globalSummary, setGlobalSummary] = useState({ total_transactions: 0, total_qty: 0 });

    // Header Data
    const [formData, setFormData] = useState({ tanggal: todayString, tujuan: 'Penjualan ke Customer', namaPembeli: '', keterangan: '' });
    // Detail Data
    const [cartItems, setCartItems] = useState([{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
    const [pajakPersen, setPajakPersen] = useState(11);
    const [targetKodeBarang, setTargetKodeBarang] = useState('');

    const filteredOutbound = (() => {
        return (Array.isArray(outbound) ? outbound : []).filter(t => {
            if (!t.tanggal) return true;
            const tgl = getLocalYYYYMMDD(t.tanggal);
            return tgl >= filterStart && tgl <= filterEnd;
        });
    })();

    const completedOutbound = filteredOutbound.filter(t => t.status === 'completed' || t.status === 'COMPLETED');

    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, filterStart, filterEnd]);

    useEffect(() => {
        if (!isApiOffline) {
            setIsProcessing(true);
            const safeStart = getLocalYYYYMMDD(new Date(filterStart));
            const safeEnd = getLocalYYYYMMDD(new Date(filterEnd));
            apiCall(`/transactions?category=outbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&page=${currentPage}`)
                .then(data => {
                    if (data && data.data) {
                        setOutbound(Array.isArray(data.data) ? data.data : (data.data.data || []));
                        setLastPage(data.last_page || 1);
                        if (data.summary) {
                            setGlobalSummary(data.summary);
                        }
                    } else {
                        setOutbound(Array.isArray(data) ? data : []);
                        setLastPage(1);
                    }
                    setIsProcessing(false);
                })
                .catch(() => setIsProcessing(false));
        }
    }, [filterType, filterStart, filterEnd, currentPage]);

    const isMakloonOut = formData.tujuan === 'Kirim ke Vendor Makloon';
    const makloonVendors = suppliers.filter(s => s.tipe_partner === 'vendor' || s.idSupplier.startsWith('VEN'));
    const produkJadiItems = items.filter(i => (i.tipeBarang || '').toLowerCase() === 'produk jadi');

    const openAddModal = () => {
        setEditId(null);
        setFormData({ tanggal: todayString, tujuan: 'Penjualan ke Customer', namaPembeli: '', keterangan: '' });
        setCartItems([{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
        setTargetKodeBarang('');
        setErrorMsg(''); setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditId(row.idTransaksi);
        setFormData({
            tanggal: row.tanggal ? getLocalYYYYMMDD(row.tanggal) : todayString,
            tujuan: row.tujuan || 'Penjualan ke Customer',
            namaPembeli: row.namaPembeli || '',
            keterangan: row.keterangan || ''
        });
        setCartItems(row.items && row.items.length > 0 ? row.items.map(item => ({
            ...item,
            kodeBarang: item.kodeBarang,
            jumlah: item.jumlah_transaksi || item.jumlah,
            lokasi_asal: item.lokasi_asal || '',
            lokasi_tujuan: item.lokasi_tujuan || '',
            satuan_transaksi: item.satuan_transaksi || items.find(i => i.kodeBarang === item.kodeBarang)?.satuan_dasar || ''
        })) : [{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
        setErrorMsg('');
        setModalOpen(true);
    };

    const handleViewDetail = (row) => {
        setDetailData(row);
        setIsDetailModalOpen(true);
    };

    const handleFifoTrace = async (row) => {
        setIsFifoLoading(true);
        setFifoTraceData({ id: row.idTransaksi, traces: [] });
        try {
            const traces = await apiCall(`/transactions/${row.idTransaksi}/fifo-trace`);
            setFifoTraceData({ id: row.idTransaksi, traces });
        } catch (e) {
            setFifoTraceData(null);
        } finally {
            setIsFifoLoading(false);
        }
    };

    const handleAddRow = () => setCartItems([...cartItems, { kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: formData.namaPembeli || '', satuan_transaksi: '' }]);
    const handleRemoveRow = (index) => setCartItems(cartItems.filter((_, i) => i !== index));
    const handleRowChange = (index, field, value) => {
        const newCart = [...cartItems];
        newCart[index][field] = value;
        if (field === 'kodeBarang') {
            const item = items.find(i => i.kodeBarang === value);
            if (item) newCart[index].satuan_transaksi = item.satuan_dasar || '';
        }
        setCartItems(newCart);
    };

    const getActualBaseQty = (row) => {
        const item = items.find(i => i.kodeBarang === row.kodeBarang);
        if (!item || !row.jumlah) return 0;
        return row.satuan_transaksi === item.satuan_besar ? Number(row.jumlah) * Number(item.rasio_konversi || 1) : Number(row.jumlah);
    };

    const handleDelete = async (id) => {
        if (!confirm(`Hapus draft transaksi ${id}? Data akan dihapus permanen.`)) return;
        try {
            if (!isApiOffline) {
                await apiCall(`/transaction/OUT/${id}`, 'DELETE', {
                    log_user: currentUser.namaLengkap,
                    log_detail: `Membatalkan Barang Keluar: ${id}`
                });
            }
            setOutbound((Array.isArray(outbound) ? outbound : []).filter(t => t.idTransaksi !== id));
            setToast({ message: "Transaksi berhasil dihapus!", type: "success" });
        } catch (e) { setToast({ message: "Gagal menghapus: " + e.message, type: "error" }); }
    };

    const handlePrintRow = (row) => {
        setPrintData(row);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = cartItems.filter(c => c.kodeBarang && c.jumlah > 0);
        if (validItems.length === 0) return setToast({ message: 'Minimal masukkan satu barang!', type: 'error' });

        // Validasi Stok Multi-Item
        for (let it of validItems) {
            const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
            const baseQty = getActualBaseQty(it);
            if (Number(stockData?.stok || 0) < baseQty) {
                setErrorMsg(`Stok tidak cukup untuk ${stockData?.nama || it.kodeBarang}! (Sisa: ${stockData?.stok || 0} ${stockData?.satuan_dasar || ''}, Dibutuhkan: ${baseQty})`);
                return;
            }
        }

        setIsProcessing(true);
        const isMakloon = formData.tujuan === 'Kirim ke Vendor Makloon';
        const idPrefix = isMakloon ? 'MKL-OUT' : 'INV-OUT';
        const finalId = editId || generateId(idPrefix, outbound, 'idTransaksi');

        // Kalkulasi Total Transaksi
        let totalTransaksiValue = 0;
        if (formData.tujuan === 'Penjualan ke Customer') {
            validItems.forEach(it => {
                const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
                totalTransaksiValue += (getActualBaseQty(it) * Number(stockData?.hargaJual || 0));
            });
        }
        const pajakNominal = totalTransaksiValue * (pajakPersen / 100);
        const grandTotal = totalTransaksiValue + pajakNominal;

        const payload = {
            idTransaksi: finalId,
            ...formData,
            target_kode_barang: isMakloon ? targetKodeBarang : null,
            totalTransaksi: grandTotal,
            pajak_persen: pajakPersen,
            pajak_nominal: pajakNominal,
            items: validItems.map(item => {
                const stockData = items.find(i => i.kodeBarang === item.kodeBarang);
                return {
                    ...item,
                    namaBarang: stockData?.nama || '',
                    harga_modal_satuan: parseFloat(Number(stockData?.hargaJual || 0).toFixed(2)),
                    jumlah_transaksi: Number(item.jumlah),
                    satuan_transaksi: item.satuan_transaksi || stockData?.satuan_dasar || '',
                    jumlah: getActualBaseQty(item),
                    lokasi_tujuan: isMakloon ? formData.namaPembeli : (item.lokasi_tujuan || formData.namaPembeli),
                    lokasi_asal: isMakloon ? 'PT Mara Jaya Dewi Sakti' : (item.lokasi_asal || 'PT Mara Jaya Dewi Sakti'),
                };
            })
        };

        try {
            let serverPayload = null;
            if (!isApiOffline) {
                serverPayload = await apiCall(`/transaction/OUT`, 'POST', {
                    ...payload,
                    log_user: currentUser.namaLengkap,
                    log_detail: `Keluar: ${validItems.length} Jenis Barang untuk ${payload.tujuan}`
                });
            }

            const finalTransaction = (serverPayload && serverPayload.idTransaksi) ? serverPayload : payload;

            const summaryPayload = {
                ...finalTransaction,
                jumlah: finalTransaction.jumlah || validItems.reduce((sum, item) => sum + getActualBaseQty(item), 0),
                namaBarang: finalTransaction.namaBarang || `${validItems.length} Jenis Barang Keluar`
            };

            if (editId) {
                setOutbound(prev => prev.map(t => t.idTransaksi === editId ? summaryPayload : t));
            } else {
                setOutbound(prev => [summaryPayload, ...prev]);
            }
            setItems(items.map(it => {
                const usedItem = validItems.find(v => v.kodeBarang === it.kodeBarang);
                if (usedItem) return { ...it, stok: Number(it.stok) - getActualBaseQty(usedItem) };
                return it;
            }));

            if (isApiOffline) addSimulatedLog('CREATE', 'Barang Keluar', `Menambah Transaksi Keluar: ${payload.idTransaksi}`);
            setToast({ message: "Transaksi berhasil disimpan!", type: "success" });
            setModalOpen(false); setErrorMsg('');
        } catch (e) { setErrorMsg("Error Validation: " + e.message); }
        finally { setIsProcessing(false); }
    };

    const executeApprove = async (row) => {
        setIsProcessing(true);
        try {
            await apiCall(`/transaction/${row.idTransaksi}/approve`, 'POST');
            setToast({ message: 'Transaksi berhasil di-approve!', type: 'success' });
            setConfirmAction(null);
        } catch(e) { setToast({ message: e.message, type: 'error' }); }
        finally { setIsProcessing(false); }
    };

    const executeVoid = async (row) => {
        setIsProcessing(true);
        try {
            await apiCall(`/transaction/${row.idTransaksi}/void`, 'POST');
            setToast({ message: 'Transaksi berhasil dibatalkan!', type: 'success' });
            setConfirmAction(null);
        } catch(e) { setToast({ message: e.message, type: 'error' }); }
        finally { setIsProcessing(false); }
    };

    const handleApprove = (row) => setConfirmAction({ type: 'approve', row });
    const handleVoid = (row) => setConfirmAction({ type: 'void', row });

    const reportColumns = [
        { key: 'idTransaksi', label: 'ID Transaksi' },
        { key: 'status', label: 'Status', format: (v) => {
            if (v === 'draft') return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">DRAFT</span>;
            if (v === 'void') return <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded-md text-[10px] font-bold">VOID</span>;
            if (v === 'scheduled') return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">SCHEDULED</span>;
            return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">COMPLETED</span>;
        } },
        { key: 'tanggal', label: 'Tanggal', format: v => formatLocalDate(v) },
        { key: 'entitas', label: 'Pelanggan/Penerima', format: (v, row) => v || row.namaPembeli || row.sumber_tujuan || row.jenisReturn || '-' },
        { key: 'isi_transaksi', label: 'Isi Transaksi', format: (v, row) => (
            <div className="flex items-center gap-2">
                <span className="print:hidden"><button onClick={() => handleViewDetail(row)} className="text-blue-600 font-medium hover:underline text-xs">{row.items?.length || 0} Jenis Barang</button></span>
                <span className="hidden print:inline">{row.isi_transaksi_detail || '-'}</span>
                {!row.idTransaksi?.startsWith('RET') && <button onClick={() => handleFifoTrace(row)} className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors print:hidden">FIFO</button>}
            </div>
        ), exportFormat: (v, row) => row.isi_transaksi_detail || '-' },
        { key: 'items', label: 'Total Jumlah', format: (v, row) => <span className="text-rose-600 font-bold">-{row.jumlah || (row.items ? row.items.reduce((sum, item) => sum + Number(item.jumlah), 0) : 0)}</span>, exportFormat: (v, row) => row.jumlah || (row.items ? row.items.reduce((sum, item) => sum + Number(item.jumlah), 0) : 0) },
        { key: 'keterangan', label: 'Keterangan' },
        { key: 'totalTransaksi', label: 'Total Nilai', format: v => formatRp(v || 0), exportFormat: v => formatRp(v || 0) }
    ];

    const [fullPrintData, setFullPrintData] = useState(null);

    useEffect(() => {
        if (fullPrintData && fullPrintData.length > 0) {
            const timer = setTimeout(() => {
                window.print();
                setFullPrintData(null);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [fullPrintData]);

    const handlePrintLaporan = async () => {
        setIsProcessing(true);
        const safeStart = getLocalYYYYMMDD(new Date(filterStart));
        const safeEnd = getLocalYYYYMMDD(new Date(filterEnd));
        try {
            const resp = await apiCall(`/transactions?category=outbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&per_page=10000`);
            console.log('[PrintLaporan] API response:', resp);
            console.log('[PrintLaporan] resp.data length:', resp?.data?.length);
            const allData = Array.isArray(resp?.data) ? resp.data : [];
            console.log('[PrintLaporan] allData length:', allData.length);
            if (allData.length === 0) {
                setToast({ message: "Tidak ada data untuk dicetak.", type: "error" });
            } else {
                setFullPrintData(allData);
            }
        } catch (e) {
            console.error('[PrintLaporan] Error:', e);
            setToast({ message: "Gagal mengambil data laporan: " + e.message, type: "error" });
        }
        setIsProcessing(false);
    };

    const isPrintingRow = !!printData;

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {printData && (
                (printData.type === 'MAKLOON_OUT' || printData.idTransaksi?.startsWith('MKL-OUT')) 
                ? <SuratJalanMakloon data={printData} onClose={() => setPrintData(null)} companyProfile={companyProfile} suppliers={suppliers} customers={customers} />
                : <FakturPajak data={printData} onClose={() => setPrintData(null)} suppliers={suppliers} customers={customers} companyProfile={companyProfile} />
            )}

            <div className={`space-y-6 ${isPrintingRow ? 'hidden' : 'print:hidden'}`}>
                <div className="flex justify-end mb-2">
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input type="date" max={filterEnd} value={filterStart} onChange={e => setFilterStart(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" min={filterStart} value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <StatCardMini title="Total Transaksi Keluar" value={globalSummary.total_transactions} icon={ArrowUpFromLine} bgClass="bg-rose-50" colorClass="text-rose-600" />
                    <StatCardMini title="Total Qty Keluar" value={globalSummary.total_qty} icon={Package} bgClass="bg-blue-50" colorClass="text-blue-600" />
                </div>

                <DataTable
                    title="Barang Keluar" filename="Barang_Keluar" data={filteredOutbound}
                    onPrintLaporan={handlePrintLaporan}
                    customFilter={
                        <div className="relative mr-2 w-full md:w-auto">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 cursor-pointer w-full font-medium">
                                <option value="">Semua Transaksi</option>
                                <option value="customer">Ke Customer</option>
                                <option value="makloon">Ke Vendor Makloon</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    }
                    onAdd={can('create_barang_keluar') ? openAddModal : null}
                    onEdit={can('edit_barang_keluar') ? handleEdit : null}
                    onDelete={can('delete_barang_keluar') ? handleDelete : null} onPrint={handlePrintRow}
                    hideActions={row => (row.type && row.type.includes('MAKLOON')) || (row.idTransaksi && row.idTransaksi.startsWith('RET'))}
                    idKey="idTransaksi"
                    currentPage={currentPage}
                    lastPage={lastPage}
                    onPageChange={setCurrentPage}
                    columns={reportColumns}
                    extraActions={(row) => (
                        <>
                            {row.status === 'draft' && (
                                <>
                                    <button onClick={() => handleApprove(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Approve Transaksi"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></button>
                                    {can('delete_barang_keluar') && <button onClick={() => handleDelete(row.idTransaksi)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Draft"><Trash2 className="w-4 h-4" /></button>}
                                </>
                            )}
                            {row.status === 'completed' && <button onClick={() => handleVoid(row)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Void Transaksi"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>}
                        </>
                    )}
                />
            </div>
            
            {!isPrintingRow && <ReportPrintTemplate title="Laporan Barang Keluar" type="transaction" data={fullPrintData || filteredOutbound} columns={reportColumns} />}

            <ConfirmModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (confirmAction?.type === 'approve') {
                        executeApprove(confirmAction.row);
                    } else if (confirmAction?.type === 'void') {
                        executeVoid(confirmAction.row);
                    }
                    setConfirmAction(null);
                }}
                title={confirmAction?.type === 'approve' ? "Approve Transaksi" : "Batalkan Transaksi (Void)"}
                message={confirmAction?.type === 'approve' ? "Approve transaksi ini? Stok fisik akan terpotong secara FIFO." : "Batalkan (Void) transaksi ini? Alokasi FIFO akan dikembalikan."}
            />

            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setErrorMsg(''); }} title="Input Barang Keluar" width="max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 mb-4 font-semibold shadow-sm">
                            {errorMsg}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tanggal</label>
                            <input type="date" required className="w-full p-2.5 border border-slate-200 rounded-lg:border-blue-500:ring-blue-500" value={formData.tanggal} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tujuan / Kategori Keluar</label>
                            <select className="w-full p-2.5 border border-slate-200 rounded-lg:border-blue-500:ring-blue-500" value={formData.tujuan} onChange={e => setFormData({ ...formData, tujuan: e.target.value, namaPembeli: '' })}>
                                <option value="Penjualan ke Customer">Penjualan ke Customer</option>
                                <option value="Kirim ke Vendor Makloon">Kirim ke Vendor Makloon</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">{isMakloonOut ? 'Nama Vendor Makloon' : 'Nama Pelanggan / Distributor'}</label>
                            <select required className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none:border-blue-500:ring-blue-500" value={formData.namaPembeli} onChange={e => {
                                const name = e.target.value;
                                setFormData({ ...formData, namaPembeli: name });
                                setCartItems(prev => prev.map(item => ({ ...item, lokasi_tujuan: name })));
                            }}>
                                <option value="">{isMakloonOut ? 'Pilih Vendor Makloon...' : 'Pilih Pelanggan...'}</option>
                                {isMakloonOut
                                    ? makloonVendors.map(s => <option key={s.idSupplier} value={s.nama}>{s.nama}</option>)
                                    : customers.map(c => <option key={c.idPelanggan} value={c.nama}>{c.nama}</option>)
                                }
                            </select>
                        </div>
                        {isMakloonOut && (
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Pilih Target Barang Jadi</label>
                                <select required className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none:border-blue-500:ring-blue-500" value={targetKodeBarang} onChange={e => setTargetKodeBarang(e.target.value)}>
                                    <option value="">Pilih Produk Jadi yang diharapkan...</option>
                                    {produkJadiItems.map(i => <option key={i.kodeBarang} value={i.kodeBarang}>{i.kodeBarang} - {i.nama}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                        <div className="bg-slate-100 p-3 font-bold text-sm text-slate-700 flex justify-between items-center">
                            Daftar Barang Keluar
                            <button type="button" onClick={handleAddRow} className="bg-rose-600 text-white px-3 py-1 rounded text-xs">+ Tambah Baris</button>
                        </div>
                        <div className="p-4 bg-white overflow-x-auto">
                            <div className="min-w-[750px] space-y-3">
                                {cartItems.map((item, idx) => {
                                    const selectedItem = items.find(i => i.kodeBarang === item.kodeBarang);
                                    const satuanOptions = selectedItem ? [selectedItem.satuan_dasar, ...(selectedItem.satuan_besar ? [selectedItem.satuan_besar] : [])] : [];
                                    const lineSubtotal = getActualBaseQty(item) * Number(selectedItem?.hargaJual || 0);
                                    return (
                                    <div key={idx} className="flex gap-2 items-center flex-wrap">
                                        <select required className="flex-1 min-w-[180px] p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.kodeBarang} onChange={e => handleRowChange(idx, 'kodeBarang', e.target.value)}>
                                            <option value="">Pilih Barang...</option>
                                            {items.map(i => <option key={i.kodeBarang} value={i.kodeBarang}>[{i.satuan_dasar}] {i.nama} (Fisik: {i.stok} | Booking: {i.stok_booking || 0} | Tersedia: {i.stok_tersedia ?? i.stok})</option>)}
                                        </select>
                                        <input type="number" min="1" required placeholder="Qty" className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.jumlah} onChange={e => handleRowChange(idx, 'jumlah', e.target.value)} />
                                        <select className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.satuan_transaksi} onChange={e => handleRowChange(idx, 'satuan_transaksi', e.target.value)}>
                                            {satuanOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <input type="text" readOnly className="w-28 p-2 border rounded-lg text-sm bg-slate-100 text-slate-600:border-blue-500:ring-blue-500" value={item.lokasi_tujuan || 'Lok. Tujuan...'} title="Otomatis dari Pelanggan" />
                                        <span className="w-28 text-xs font-semibold text-rose-700 text-right">{lineSubtotal > 0 ? formatRp(lineSubtotal) : '-'}</span>
                                        {cartItems.length > 1 && <button type="button" onClick={() => handleRemoveRow(idx)} className="p-2 text-rose-500 shrink-0"><Trash2 className="w-5 h-5" /></button>}
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Keterangan Tambahan</label>
                        <input type="text" placeholder="Opsional..." className="w-full p-2.5 border rounded-xl:border-blue-500:ring-blue-500" value={formData.keterangan} onChange={e => setFormData({ ...formData, keterangan: e.target.value })} />
                    </div>

                    {formData.tujuan === 'Penjualan ke Customer' && (() => {
                        const subtotal = cartItems.filter(c => c.kodeBarang && c.jumlah > 0).reduce((sum, it) => {
                            const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
                            return sum + (getActualBaseQty(it) * Number(stockData?.hargaJual || 0));
                        }, 0);
                        const taxNominal = subtotal * (pajakPersen / 100);
                        return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Pajak / PPN (%)</label>
                                    <input type="number" min="0" max="100" className="w-24 p-2 border rounded-lg text-sm text-center font-bold:border-blue-500:ring-blue-500" value={pajakPersen} onChange={e => setPajakPersen(Number(e.target.value) || 0)} />
                                </div>
                                <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-bold">{formatRp(subtotal)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-slate-500">PPN ({pajakPersen}%)</span><span className="font-bold text-amber-600">{formatRp(taxNominal)}</span></div>
                                <div className="flex justify-between text-base border-t pt-2"><span className="font-bold text-slate-700">Grand Total</span><span className="font-black text-blue-700">{formatRp(subtotal + taxNominal)}</span></div>
                            </div>
                        );
                    })()}

                    {formData.tanggal > todayString && (
                        <div className="bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-200 text-sm font-medium mt-4">
                            Transaksi di masa depan akan dijadwalkan dan memotong stok booking.
                        </div>
                    )}
                    <button disabled={isProcessing} className={`w-full py-4 text-white font-bold rounded-xl text-lg mt-4 ${formData.tanggal > todayString ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                        {isProcessing ? "Memproses..." : (formData.tanggal > todayString ? "JADWALKAN TRANSAKSI KELUAR" : "PROSES BARANG KELUAR")}
                    </button>
                </form>
            </Modal>
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detail Transaksi: ${detailData?.idTransaksi}`} width="max-w-3xl">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500 block">Tanggal:</span> <span className="font-bold">{formatLocalDate(detailData?.tanggal)}</span></div>
                    <div><span className="text-slate-500 block">Pelanggan/Tujuan:</span> <span className="font-bold">{detailData?.namaPembeli || detailData?.entitas}</span></div>
                    <div className="col-span-2"><span className="text-slate-500 block">Keterangan:</span> <span className="font-bold">{detailData?.keterangan || '-'}</span></div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Kode Barang</th>
                                <th className="px-4 py-3 font-semibold">Nama Barang</th>
                                <th className="px-4 py-3 font-semibold">Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {detailData?.items && detailData.items.length > 0 ? detailData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">{item.kodeBarang}</td>
                                    <td className="px-4 py-3">{item.namaBarang || items.find(i => i.kodeBarang === item.kodeBarang)?.nama || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-rose-600">-{item.jumlah}</td>
                                </tr>
                            )) : <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400">Tidak ada rincian barang.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300">Tutup</button>
                </div>
            </Modal>

            {/* FIFO Trace Modal */}
            <Modal isOpen={!!fifoTraceData} onClose={() => setFifoTraceData(null)} title={`Audit FIFO Trace — ${fifoTraceData?.id || ''}`} width="max-w-3xl">
                {isFifoLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="ml-3 text-sm text-slate-500">Memuat data FIFO...</span>
                    </div>
                ) : fifoTraceData?.traces?.length > 0 ? (
                    <div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 text-xs text-indigo-800 font-medium">
                            <strong>FIFO Proof:</strong> Tabel di bawah menunjukkan batch mana saja yang dipotong stoknya, diurutkan dari tanggal masuk terlama (First-In, First-Out).
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs">#</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs">Kode Barang</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs">Diambil Dari (Batch Masuk)</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs">Lokasi Rak</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs">Tgl Masuk</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs text-right">Qty Awal</th>
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs text-right">Qty Terpotong</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fifoTraceData.traces.map((t, i) => (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-slate-400 text-xs">{i + 1}</td>
                                            <td className="py-3 px-4 text-slate-600">
                                                <span className="font-mono text-xs">{t.kodeBarang}</span>
                                                {t.namaBarang && <p className="text-[10px] text-slate-400">{t.namaBarang}</p>}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-mono text-xs">{t.idTransaksi_masuk}</td>
                                            <td className="py-3 px-4 text-slate-600 text-xs font-semibold">{t.batch?.location?.nama || t.lokasi_rak_nama || <span className="text-gray-400 italic font-normal">Belum diset</span>}</td>
                                            <td className="py-3 px-4 text-slate-600 text-xs">{t.tanggal_masuk}</td>
                                            <td className="py-3 px-4 text-slate-600 text-right">{t.qty_awal}</td>
                                            <td className="py-3 px-4 text-right font-bold text-indigo-700">{t.qty_diambil}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan={6} className="py-3 px-4 text-right font-bold text-slate-700 text-xs uppercase">Total Qty Outbound</td>
                                        <td className="py-3 px-4 text-right font-extrabold text-indigo-800 text-lg">{fifoTraceData.traces.reduce((sum, t) => sum + Number(t.qty_diambil), 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">Tidak ada data FIFO trace untuk transaksi ini.</div>
                )}
            </Modal>
        </div>
    );
}