import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, Package, Calendar, Trash2 } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import FakturPajak from '../components/ui/FakturPajak';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId, getLocalYYYYMMDD, formatRp, formatLocalDate } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function BarangMasuk() {
    const { inbound, setInbound, items, setItems, returns, locations, suppliers, customers, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const todayDate = new Date();
    const todayString = getLocalYYYYMMDD(todayDate);

    const startDefault = todayString;
    const endDefault = todayString;

    const [startDate, setStartDate] = useState(startDefault);
    const [endDate, setEndDate] = useState(endDefault);

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [globalSummary, setGlobalSummary] = useState({ total_transactions: 0, total_qty: 0 });

    const [isModalOpen, setModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [printData, setPrintData] = useState(null);
    const [filterType, setFilterType] = useState('');

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);
    const [detailData, setDetailData] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    // Header Data
    const [formData, setFormData] = useState({ tanggal: todayString, sumber: 'Dari Supplier', namaSupplier: '', keterangan: '' });
    // Detail Data (Multi-item)
    const [cartItems, setCartItems] = useState([{ kodeBarang: '', jumlah: '', harga_modal_satuan: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
    const [pajakPersen, setPajakPersen] = useState(11);
    const [makloonRefs, setMakloonRefs] = useState([]);

    useEffect(() => {
        if (isMakloonIn) {
            apiCall('/makloon-references').then(setMakloonRefs).catch(() => setMakloonRefs([]));
        }
    }, [formData.sumber]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, startDate, endDate]);

    const fetchTransactions = async () => {
        if (!isApiOffline) {
            setIsProcessing(true);
            const safeStart = getLocalYYYYMMDD(new Date(startDate));
            const safeEnd = getLocalYYYYMMDD(new Date(endDate));
            try {
                const data = await apiCall(`/transactions?category=inbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&page=${currentPage}`);
                if (data && data.data) {
                    setInbound(data.data);
                    setLastPage(data.last_page || 1);
                    if (data.summary) {
                        setGlobalSummary(data.summary);
                    }
                } else {
                    setInbound(Array.isArray(data) ? data : []);
                    setLastPage(1);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [filterType, startDate, endDate, currentPage]);



    const isMakloonIn = formData.sumber === 'Terima dari Vendor Makloon';
    const makloonVendors = suppliers.filter(s => s.tipe_partner === 'vendor' || s.idSupplier.startsWith('VEN'));
    const standardSuppliers = suppliers.filter(s => s.tipe_partner !== 'vendor' && !s.idSupplier.startsWith('VEN'));

    const filteredInbound = (() => {
        return inbound.filter(trx => {
            if (!trx.tanggal) return true;
            const d = getLocalYYYYMMDD(trx.tanggal);
            return d >= startDate && d <= endDate;
        });
    })();

    const completedInbound = filteredInbound.filter(t => t.status === 'completed' || t.status === 'COMPLETED');
    // totalQtyMasuk logic moved to use globalSummary

    const openAddModal = () => {
        setEditId(null);
        setFormData({ tanggal: todayString, sumber: 'Dari Supplier', namaSupplier: '', keterangan: '', idReferensi: '' });
        setCartItems([{ kodeBarang: '', jumlah: '', harga_modal_satuan: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
        setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditId(row.idTransaksi);
        setFormData({
            tanggal: row.tanggal ? getLocalYYYYMMDD(row.tanggal) : todayString,
            sumber: row.sumber || 'Dari Supplier',
            namaSupplier: row.namaSupplier || '',
            keterangan: row.keterangan || '',
            idReferensi: row.idReferensi || ''
        });
        
        if (row.items && row.items.length > 0) {
            setCartItems(row.items.map(item => ({
                ...item,
                kodeBarang: item.kodeBarang,
                jumlah: item.jumlah_transaksi || item.jumlah,
                harga_modal_satuan: item.harga_satuan || item.harga_modal_satuan || '',
                lokasi_asal: item.lokasi_asal || '',
                lokasi_tujuan: item.lokasi_tujuan || '',
                satuan_transaksi: item.satuan_transaksi || items.find(i => i.kodeBarang === item.kodeBarang)?.satuan_dasar || ''
            })));
        } else {
            setCartItems([{ kodeBarang: '', jumlah: '', harga_modal_satuan: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
        }
        
        setModalOpen(true);
    };

    const handleViewDetail = (row) => {
        setDetailData(row);
        setIsDetailModalOpen(true);
    };

    const handlePrintRow = (row) => {
        setPrintData(row);
    };

    const handleAddRow = () => setCartItems([...cartItems, { kodeBarang: '', jumlah: '', harga_modal_satuan: '', lokasi_asal: formData.namaSupplier || '', lokasi_tujuan: '', satuan_transaksi: '' }]);
    const handleRemoveRow = (index) => setCartItems(cartItems.filter((_, i) => i !== index));

    const handleSelectMakloonRef = (refId) => {
        setFormData(prev => ({ ...prev, idReferensi: refId }));
        const ref = makloonRefs.find(r => r.idTransaksi === refId);
        if (ref && ref.target_kode_barang) {
            const targetItem = items.find(i => i.kodeBarang === ref.target_kode_barang);
            setCartItems([{
                kodeBarang: ref.target_kode_barang,
                jumlah: '',
                harga_modal_satuan: '',
                lokasi_asal: formData.namaSupplier || ref.entitas || '',
                lokasi_tujuan: '',
                satuan_transaksi: targetItem?.satuan_dasar || ''
            }]);
        }
    };

    const handleRowChange = (index, field, value) => {
        const newCart = [...cartItems];
        const oldSatuan = newCart[index].satuan_transaksi;
        newCart[index][field] = value;
        
        const item = items.find(i => i.kodeBarang === newCart[index].kodeBarang);
        
        if (field === 'kodeBarang') {
            if (item) {
                newCart[index].harga_modal_satuan = item.hargaBeli;
                newCart[index].satuan_transaksi = item.satuan_dasar || '';
            }
        } else if (field === 'satuan_transaksi' && item) {
            const isNowBesar = value === item.satuan_besar;
            const wasBesar = oldSatuan === item.satuan_besar;
            const rasio = Number(item.rasio_konversi || 1);
            
            if (isNowBesar && !wasBesar) {
                newCart[index].harga_modal_satuan = (Number(newCart[index].harga_modal_satuan) || 0) * rasio;
            } else if (!isNowBesar && wasBesar) {
                newCart[index].harga_modal_satuan = (Number(newCart[index].harga_modal_satuan) || 0) / rasio;
            }
        }
        setCartItems(newCart);
    };

    const getActualBaseQty = (row) => {
        const item = items.find(i => i.kodeBarang === row.kodeBarang);
        if (!item || !row.jumlah) return 0;
        return row.satuan_transaksi === item.satuan_besar ? Number(row.jumlah) * Number(item.rasio_konversi || 1) : Number(row.jumlah);
    };

    const handleDelete = async (id) => {
        if (!confirm(`Hapus draft transaksi Barang Masuk ${id}? Data akan dihapus permanen.`)) return;
        try {
            if (!isApiOffline) {
                await apiCall(`/transaction/IN/${id}`, 'DELETE', {
                    log_user: currentUser.namaLengkap,
                    log_detail: `Membatalkan Barang Masuk: ${id}`
                });
            }

            setInbound(inbound.filter(t => t.idTransaksi !== id));
            setToast({ message: "Transaksi berhasil dihapus!", type: "success" });
        } catch (e) {
            setToast({ message: "Gagal menghapus: " + e.message, type: "error" });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = cartItems.filter(c => c.kodeBarang && c.jumlah > 0);
        if (validItems.length === 0) return setToast({ message: 'Minimal masukkan satu barang yang valid!', type: 'error' });

        setIsProcessing(true);
        const isMakloon = formData.sumber === 'Terima dari Vendor Makloon';
        const idPrefix = isMakloon ? 'MKL-IN' : 'INV-IN';
        const finalId = editId || generateId(idPrefix, inbound, 'idTransaksi');

        const subtotalCalc = validItems.reduce((sum, it) => sum + (Number(it.jumlah) * Number(it.harga_modal_satuan || 0)), 0);
        const pajakNominalCalc = subtotalCalc * (pajakPersen / 100);

        const payload = {
            idTransaksi: finalId,
            ...formData,
            pajak_persen: pajakPersen,
            pajak_nominal: pajakNominalCalc,
            totalTransaksi: subtotalCalc + pajakNominalCalc,
            items: validItems.map(item => ({
                ...item,
                namaBarang: items.find(i => i.kodeBarang === item.kodeBarang)?.nama || '',
                harga_modal_satuan: parseFloat(Number(item.harga_modal_satuan || 0).toFixed(2)),
                jumlah_transaksi: Number(item.jumlah),
                satuan_transaksi: item.satuan_transaksi || items.find(i => i.kodeBarang === item.kodeBarang)?.satuan_dasar || '',
                jumlah: getActualBaseQty(item)
            }))
        };

        try {
            if (!isApiOffline) {
                await apiCall(`/transaction/IN`, 'POST', {
                    ...payload,
                    log_user: currentUser.namaLengkap,
                    log_detail: `Input Kedatangan Barang: ${finalId} (${validItems.length} Jenis Barang)`
                });
            }

            // Format agar DataTable tetap bisa membaca summary-nya saat OFFLINE
            const summaryPayload = {
                ...payload,
                jumlah: validItems.reduce((sum, item) => sum + getActualBaseQty(item), 0),
                namaBarang: `${validItems.length} Jenis Barang`
            };

            // 1. Picu Re-fetch Setelah Sukses (Data Segar dari Server + Relasi)
            if (!isApiOffline) {
                await fetchTransactions(); // Update state dengan eager loaded data
            } else {
                if (editId) {
                    setInbound(inbound.map(t => t.idTransaksi === editId ? summaryPayload : t));
                } else {
                    setInbound([summaryPayload, ...inbound]);
                }
            }
            
            setItems(items.map(it => {
                const usedItem = validItems.find(v => v.kodeBarang === it.kodeBarang);
                if (usedItem) return { ...it, stok: Number(it.stok) + getActualBaseQty(usedItem) };
                return it;
            }));

            if (isApiOffline && !editId) addSimulatedLog('CREATE', 'Barang Masuk', `Input Barang: ${finalId}`);
            setToast({ message: "Transaksi berhasil disimpan!", type: "success" });
            setModalOpen(false);
        } catch (e) { setToast({ message: "Gagal menyimpan: " + e.message, type: "error" }); }
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

    const handleApprove = (row) => setConfirmAction({ type: 'approve', row });

    const reportColumns = [
        { key: 'idTransaksi', label: 'ID Transaksi' },
        { key: 'status', label: 'Status', format: (v) => {
            if (v === 'draft') return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">DRAFT</span>;
            if (v === 'scheduled') return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">SCHEDULED</span>;
            return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">COMPLETED</span>;
        } },
        { key: 'tanggal', label: 'Tanggal', format: v => formatLocalDate(v) },
        { key: 'sumber', label: 'Sumber' },
        { key: 'namaSupplier', label: 'Nama Supplier', format: (v, row) => v || row.entitas || '-' },
        { key: 'isi_transaksi', label: 'Isi Transaksi', format: (v, row) => (
            <>
                <span className="print:hidden"><button onClick={() => { setDetailData(row); setIsDetailModalOpen(true); }} className="text-blue-600 font-medium hover:underline">{row.items?.length || 0} Jenis Barang (Lihat Detail)</button></span>
                <span className="hidden print:inline">{row.isi_transaksi_detail || '-'}</span>
            </>
        ), exportFormat: (v, row) => row.isi_transaksi_detail || '-' },
        { key: 'jumlah', label: 'Total Qty', format: (v, row) => <span className="text-emerald-600 font-bold">+{row.jumlah || (row.items ? row.items.reduce((sum, item) => sum + Number(item.jumlah), 0) : 0)}</span>, exportFormat: (v, row) => row.jumlah || (row.items ? row.items.reduce((sum, item) => sum + Number(item.jumlah), 0) : 0) },
        { key: 'keterangan', label: 'Keterangan' },
        { key: 'totalTransaksi', label: 'Total Nilai', format: v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0), exportFormat: v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0) }
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
        const safeStart = getLocalYYYYMMDD(new Date(startDate));
        const safeEnd = getLocalYYYYMMDD(new Date(endDate));
        try {
            const resp = await apiCall(`/transactions?category=inbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&per_page=10000`);
            const allData = Array.isArray(resp?.data) ? resp.data : [];
            if (allData.length === 0) {
                setToast({ message: "Tidak ada data untuk dicetak.", type: "error" });
            } else {
                setFullPrintData(allData);
            }
        } catch (e) {
            setToast({ message: "Gagal mengambil data laporan: " + e.message, type: "error" });
        }
        setIsProcessing(false);
    };

    const isPrintingRow = !!printData;

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <FakturPajak data={printData} onClose={() => setPrintData(null)} suppliers={suppliers} customers={customers || []} />

            <div className={`space-y-6 ${isPrintingRow ? 'hidden' : 'print:hidden'}`}>
                <div className="flex justify-end mb-2">
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <StatCardMini title="Total Transaksi Masuk" value={globalSummary.total_transactions} icon={ArrowDownToLine} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                    <StatCardMini title="Total Qty Masuk" value={globalSummary.total_qty} icon={Package} bgClass="bg-blue-50" colorClass="text-blue-600" />
                </div>

                <DataTable title="Barang Masuk" data={filteredInbound} idKey="idTransaksi" filename="Barang_Masuk"
                    onPrintLaporan={handlePrintLaporan}
                    customFilter={
                        <div className="relative mr-2 w-full md:w-auto">
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 cursor-pointer w-full font-medium">
                                <option value="">Semua Transaksi</option>
                                <option value="supplier">Dari Supplier</option>
                                <option value="makloon">Dari Vendor Makloon</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    }
                    columns={reportColumns}
                    currentPage={currentPage} lastPage={lastPage} onPageChange={setCurrentPage}
                    extraActions={(row) => (
                        <>
                            {row.status === 'draft' && (
                                <>
                                    <button onClick={() => handleApprove(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Approve Transaksi"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></button>
                                    {can('delete_barang_masuk') && <button onClick={() => handleDelete(row.idTransaksi)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Draft"><Trash2 className="w-4 h-4" /></button>}
                                </>
                            )}
                        </>
                    )}
                    onAdd={can('create_barang_masuk') ? openAddModal : null}
                    onEdit={can('edit_barang_masuk') ? handleEdit : null}
                    onDelete={can('delete_barang_masuk') ? handleDelete : null}
                    hideActions={row => (row.type && row.type.includes('MAKLOON')) || (row.idTransaksi && row.idTransaksi.startsWith('RET'))}
                    onPrint={handlePrintRow}
                />
            </div>
            
            {!isPrintingRow && <ReportPrintTemplate title="Laporan Barang Masuk" type="transaction" data={fullPrintData || filteredInbound} columns={reportColumns} />}

            <ConfirmModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (confirmAction?.type === 'approve') {
                        executeApprove(confirmAction.row);
                    }
                    setConfirmAction(null);
                }}
                title="Approve Transaksi"
                message="Approve transaksi ini? Stok fisik dan HPP akan terupdate secara permanen."
            />

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Input Kedatangan Barang" width="max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tanggal</label>
                            <input type="date" required className="w-full p-2.5 border rounded-xl:border-blue-500:ring-blue-500" value={formData.tanggal} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Sumber Barang</label>
                            <select className="w-full p-2.5 border border-slate-200 rounded-xl:border-blue-500:ring-blue-500" value={formData.sumber} onChange={e => setFormData({ ...formData, sumber: e.target.value, namaSupplier: '' })}>
                                <option value="Dari Supplier">Pembelian dari Supplier</option>
                                <option value="Terima dari Vendor Makloon">Terima dari Vendor Makloon</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">{isMakloonIn ? 'Nama Vendor Makloon' : 'Supplier'}</label>
                            <select required className="w-full p-2.5 border rounded-xl:border-blue-500:ring-blue-500" value={formData.namaSupplier} onChange={e => {
                                const name = e.target.value;
                                setFormData({ ...formData, namaSupplier: name });
                                setCartItems(prev => prev.map(item => ({ ...item, lokasi_asal: name })));
                            }}>
                                <option value="">{isMakloonIn ? 'Pilih Vendor Makloon...' : 'Pilih Supplier...'}</option>
                                {isMakloonIn
                                    ? makloonVendors.map(s => <option key={s.idSupplier} value={s.nama}>{s.nama}</option>)
                                    : standardSuppliers.map(s => <option key={s.idSupplier} value={s.nama}>{s.nama}</option>)
                                }
                            </select>
                        </div>
                        {isMakloonIn && (
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Pilih Referensi MKL-OUT</label>
                                <select required className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none:border-blue-500:ring-blue-500" value={formData.idReferensi || ''} onChange={e => handleSelectMakloonRef(e.target.value)}>
                                    <option value="">Pilih transaksi MKL-OUT...</option>
                                    {makloonRefs.map(ref => (
                                        <option key={ref.idTransaksi} value={ref.idTransaksi}>
                                            {ref.idTransaksi} — {ref.entitas} → {ref.target_item?.nama || ref.target_kode_barang} ({new Date(ref.tanggal).toLocaleDateString('id-ID')})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                        <div className="bg-slate-100 p-3 font-bold text-sm text-slate-700 flex justify-between items-center">
                            Daftar Barang Masuk
                            <button type="button" onClick={handleAddRow} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">+ Tambah Baris</button>
                        </div>
                        <div className="p-4 bg-white overflow-x-auto">
                            <div className="min-w-[750px] space-y-3">
                                {cartItems.map((item, idx) => {
                                    const selectedItem = items.find(i => i.kodeBarang === item.kodeBarang);
                                    const satuanOptions = selectedItem ? [selectedItem.satuan_dasar, ...(selectedItem.satuan_besar ? [selectedItem.satuan_besar] : [])] : [];
                                    const lineSubtotal = Number(item.jumlah) * Number(item.harga_modal_satuan || 0);
                                    return (
                                    <div key={idx} className="flex gap-2 items-center flex-wrap">
                                        <select required className="flex-1 min-w-[180px] p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.kodeBarang} onChange={e => handleRowChange(idx, 'kodeBarang', e.target.value)}>
                                            <option value="">Pilih Barang...</option>
                                            {items.map(i => <option key={i.kodeBarang} value={i.kodeBarang}>[{i.satuan_dasar}] {i.nama}</option>)}
                                        </select>
                                        <input type="number" min="1" required placeholder="Qty" className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.jumlah} onChange={e => handleRowChange(idx, 'jumlah', e.target.value)} />
                                        <select className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.satuan_transaksi} onChange={e => handleRowChange(idx, 'satuan_transaksi', e.target.value)}>
                                            {satuanOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <input type="number" required placeholder="Hrg Modal" className="w-28 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.harga_modal_satuan} onChange={e => handleRowChange(idx, 'harga_modal_satuan', e.target.value)} disabled={formData.sumber === 'Penggantian Retur Vendor'} />
                                        <input type="text" readOnly className="w-24 p-2 border rounded-lg text-sm bg-slate-100 text-slate-600:border-blue-500:ring-blue-500" value={item.lokasi_asal || 'Asal...'} title="Otomatis dari Supplier" />
                                        <select required className="w-28 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.lokasi_tujuan} onChange={e => handleRowChange(idx, 'lokasi_tujuan', e.target.value)}>
                                            <option value="">Lok. Tujuan...</option>
                                            {locations.map(l => <option key={l.idLokasi} value={l.idLokasi}>{l.nama}</option>)}
                                        </select>
                                        <span className="w-28 text-xs font-semibold text-blue-700 text-right">{lineSubtotal > 0 ? formatRp(lineSubtotal) : '-'}</span>
                                        {cartItems.length > 1 && <button type="button" onClick={() => handleRemoveRow(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"><Trash2 className="w-5 h-5" /></button>}
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

                    {(() => {
                        const subtotal = cartItems.filter(c => c.kodeBarang && c.jumlah > 0).reduce((sum, it) => sum + (Number(it.jumlah) * Number(it.harga_modal_satuan || 0)), 0);
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

                    <button disabled={isProcessing} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl mt-4">
                        {isProcessing ? "Memproses..." : "Simpan Transaksi"}
                    </button>
                </form>
            </Modal>
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detail Transaksi: ${detailData?.idTransaksi}`} width="max-w-3xl">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500 block">Tanggal:</span> <span className="font-bold">{formatLocalDate(detailData?.tanggal)}</span></div>
                    <div><span className="text-slate-500 block">Supplier / Sumber:</span> <span className="font-bold">{detailData?.sumber === 'Dari Produksi' ? 'Internal (Produksi)' : detailData?.namaSupplier || detailData?.entitas}</span></div>
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
                                    <td className="px-4 py-3 font-bold text-emerald-600">+{item.jumlah}</td>
                                </tr>
                            )) : <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400">Tidak ada rincian barang.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300">Tutup</button>
                </div>
            </Modal>
        </div>
    );
}