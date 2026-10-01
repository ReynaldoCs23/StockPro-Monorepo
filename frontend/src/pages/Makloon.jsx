import React, { useState, useEffect } from 'react';
import { Factory, Trash2, Save, Play, ClipboardList, Package, Truck, CheckCircle2, Loader2, ArrowRight } from '../components/icons/Icons';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import { apiCall } from '../utils/api';
import { generateId, getLocalYYYYMMDD } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function Makloon() {
    const { items, setItems, locations, suppliers, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const [activeTab, setActiveTab] = useState('resep');

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);

    // --- STATE DATABASE BOM ---
    const [boms, setBoms] = useState([]);
    const [isLoadingBoms, setIsLoadingBoms] = useState(false);

    // --- FORM BAGIAN 1: MASTER RESEP BOM ---
    const [resepProduk, setResepProduk] = useState('');
    const [resepBahanList, setResepBahanList] = useState([{ kode_bahan_baku: '', jumlah_per_unit: '' }]);

    // --- STATE MAKLOON ORDERS ---
    const [makloonOrders, setMakloonOrders] = useState([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [dateFilter, setDateFilter] = useState(getLocalYYYYMMDD());

    // --- FORM BAGIAN 2: CREATE MAKLOON ORDER ---
    const [vendor, setVendor] = useState('');
    const [produksiProduk, setProduksiProduk] = useState('');
    const [jumlahProduk, setJumlahProduk] = useState('');
    const [bomPreview, setBomPreview] = useState(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const [toast, setToast] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // --- MODAL TERIMA BARANG ---
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [receiveOrderId, setReceiveOrderId] = useState(null);
    const [receiveTargetQty, setReceiveTargetQty] = useState(0);
    const [receiveQty, setReceiveQty] = useState('');
    const [makloonFee, setMakloonFee] = useState('');
    const [taxPercent, setTaxPercent] = useState(11);
    const [receiveLokasi, setReceiveLokasi] = useState('');
    const [sendConfirmId, setSendConfirmId] = useState(null);
    const [approvalPrompt, setApprovalPrompt] = useState(null); // { idTransaksi, type }
    const fetchBoms = async () => {
        if (isApiOffline) return;
        setIsLoadingBoms(true);
        try {
            const response = await apiCall('/boms', 'GET');
            setBoms(response || []);
        } catch (err) {
            console.error("Gagal menarik data Master BOM:", err);
        } finally {
            setIsLoadingBoms(false);
        }
    };

    const fetchOrders = async (date) => {
        if (isApiOffline) return;
        setIsLoadingOrders(true);
        try {
            const query = date ? `?date=${date}` : '';
            const response = await apiCall(`/makloon-orders${query}`, 'GET');
            setMakloonOrders(response || []);
        } catch (err) {
            console.error("Gagal menarik data Makloon Orders:", err);
        } finally {
            setIsLoadingOrders(false);
        }
    };

    useEffect(() => {
        fetchBoms();
        fetchOrders(dateFilter);
    }, [isApiOffline, dateFilter]);

    // ==========================================
    // LOGIKA BAGIAN 1: SIMPAN RESEP BOM
    // ==========================================
    const handleAddResepBahan = () => setResepBahanList([...resepBahanList, { kode_bahan_baku: '', jumlah_per_unit: '' }]);
    const handleRemoveResepBahan = (index) => setResepBahanList(resepBahanList.filter((_, i) => i !== index));
    const handleResepBahanChange = (index, field, value) => {
        const newList = [...resepBahanList];
        newList[index][field] = value;
        setResepBahanList(newList);
    };

    const handleSaveResep = async (e) => {
        e.preventDefault();
        setErrorMsg(''); setSuccessMsg('');

        if (!resepProduk) return setErrorMsg('Pilih produk jadi terlebih dahulu!');
        const validBahan = resepBahanList.filter(b => b.kode_bahan_baku && b.jumlah_per_unit && b.jumlah_per_unit > 0);
        if (validBahan.length === 0) return setErrorMsg('Minimal masukkan satu bahan baku!');

        setIsProcessing(true);
        try {
            const payloadBom = {
                id_bom: 'BOM-' + Date.now(),
                kode_produk: resepProduk,
                bahan_baku: validBahan
            };

            if (!isApiOffline) {
                await apiCall('/boms', 'POST', payloadBom);
            }

            setBoms([...boms.filter(b => b.kode_produk !== resepProduk), payloadBom]);
            setToast({ message: 'Resep BOM berhasil disimpan ke Database!', type: 'success' });
            setResepProduk('');
            setResepBahanList([{ kode_bahan_baku: '', jumlah_per_unit: '' }]);
        } catch (err) {
            setErrorMsg('Error Validation: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteBom = async (id_bom) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus resep BOM ini?")) return;
        
        try {
            if (!isApiOffline) {
                await apiCall(`/boms/${id_bom}`, 'DELETE');
            }
            setBoms(prev => (Array.isArray(prev) ? prev : []).filter(item => item.id_bom !== id_bom));
            setToast({ message: 'Resep BOM berhasil dihapus!', type: 'success' });
        } catch (err) {
            setErrorMsg('Gagal menghapus BOM: ' + err.message);
        }
    };

    // ==========================================
    // LOGIKA BAGIAN 2: MAKLOON ORDERS
    // ==========================================
    const handleProdukChange = async (e) => {
        const val = e.target.value;
        setProduksiProduk(val);
        setBomPreview(null);
        if (val && !isApiOffline) {
            setIsLoadingPreview(true);
            try {
                const res = await apiCall(`/bom/${val}/preview`);
                setBomPreview(res.bahan_baku || []);
            } catch (err) {
                setBomPreview([]);
            } finally {
                setIsLoadingPreview(false);
            }
        }
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        setErrorMsg(''); setSuccessMsg('');

        if (!vendor || !produksiProduk || !jumlahProduk || jumlahProduk <= 0) {
            return setErrorMsg('Harap lengkapi semua field!');
        }

        setIsProcessing(true);
        try {
            if (!isApiOffline) {
                await apiCall('/makloon-orders', 'POST', {
                    id_vendor: vendor,
                    kode_produk: produksiProduk,
                    target_qty: jumlahProduk
                });
                await fetchOrders();
            } else {
                addSimulatedLog('CREATE', 'Makloon', `Membuat Order Makloon untuk ${produksiProduk}`);
            }
            setToast({ message: 'Order Makloon berhasil dibuat!', type: 'success' });
            setProduksiProduk(''); setJumlahProduk(''); setVendor('');
        } catch (err) {
            setErrorMsg("Error Validation: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendBahan = async (id) => {
        setErrorMsg(''); setSuccessMsg('');
        setIsProcessing(true);
        try {
            if (!isApiOffline) {
                const response = await apiCall(`/makloon-orders/${id}/send`, 'POST');
                await fetchOrders(dateFilter);
                if (response?.idTransaksi) {
                    setApprovalPrompt({ idTransaksi: response.idTransaksi, type: 'send' });
                } else {
                    setToast({ message: 'Bahan baku berhasil dikirim ke vendor!', type: 'success' });
                }
            } else {
                setToast({ message: 'Bahan baku berhasil dikirim ke vendor!', type: 'success' });
            }
        } catch (err) {
            setErrorMsg("Error Validation: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelOrder = async (id) => {
        if (!window.confirm("Apakah Anda yakin ingin membatalkan order makloon ini?")) return;
        setErrorMsg(''); setSuccessMsg('');
        setIsProcessing(true);
        try {
            if (!isApiOffline) {
                await apiCall(`/makloon-orders/${id}/cancel`, 'POST');
                await fetchOrders(dateFilter);
            }
            setToast({ message: 'Order Makloon berhasil dibatalkan!', type: 'success' });
        } catch (err) {
            setErrorMsg("Gagal membatalkan order: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const openReceiveModal = (id, targetQty) => {
        setReceiveOrderId(id);
        setReceiveTargetQty(targetQty);
        setReceiveQty(targetQty);
        setReceiveLokasi('');
        setShowReceiveModal(true);
    };

    const confirmReceiveBarang = async (e) => {
        e.preventDefault();
        const qty = Number(receiveQty);
        if (isNaN(qty) || qty <= 0) {
            setToast({ message: 'Jumlah tidak valid!', type: 'error' });
            return;
        }
        const fee = Number(makloonFee) || 0;
        const tax = Number(taxPercent) || 0;
        if (!receiveLokasi) {
            setToast({ message: 'Harap pilih lokasi rak!', type: 'error' });
            return;
        }
        const subtotal = qty * fee;
        const pajakNominal = Math.round(subtotal * (tax / 100));
        const totalTransaksi = subtotal + pajakNominal;

        setErrorMsg(''); setSuccessMsg('');
        setIsProcessing(true);
        setShowReceiveModal(false);
        try {
            if (!isApiOffline) {
                const response = await apiCall(`/makloon-orders/${receiveOrderId}/receive`, 'POST', {
                    received_qty: qty,
                    harga_satuan: fee,
                    pajak_persen: tax,
                    pajak_nominal: pajakNominal,
                    total_transaksi: totalTransaksi,
                    lokasi_tujuan: receiveLokasi
                });
                await fetchOrders();
                if (response?.idTransaksi) {
                    setApprovalPrompt({ idTransaksi: response.idTransaksi, type: 'receive' });
                } else {
                    setToast({ message: 'Barang jadi berhasil diterima dan stok diupdate!', type: 'success' });
                }
            } else {
                setToast({ message: 'Barang jadi berhasil diterima dan stok diupdate!', type: 'success' });
            }
        } catch (err) {
            setErrorMsg("Error Validation: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveTransaction = async () => {
        if (!approvalPrompt) return;
        setIsProcessing(true);
        try {
            await apiCall(`/transaction/${approvalPrompt.idTransaksi}/approve`, 'POST');
            setToast({ message: `Transaksi ${approvalPrompt.idTransaksi} berhasil disetujui (Approved)!`, type: 'success' });
        } catch (err) {
            setErrorMsg("Gagal menyetujui transaksi: " + err.message);
        } finally {
            setIsProcessing(false);
            setApprovalPrompt(null);
        }
    };

    const produkJadiOptions = items.filter(i => i.tipeBarang === 'Produk Jadi' || i.tipe_barang === 'barang_jadi');
    const bahanBakuOptions = items.filter(i => i.tipeBarang !== 'Produk Jadi' && i.tipe_barang !== 'barang_jadi');
    const vendorOptions = suppliers?.filter(s => s.tipe_partner === 'vendor' || s.idSupplier.startsWith('VEN')) || [];

    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 print:hidden max-w-6xl mx-auto">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="mb-8 border-b border-slate-100 pb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-blue-600 border border-slate-200 shadow-sm">
                            <Factory className="w-6 h-6" />
                        </div>
                        Manajemen Makloon (Contract Manufacturing)
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Pengelolaan Bill of Materials (BOM) dan pelacakan alur produksi pihak ketiga.</p>
                </div>
            </div>

            <div className="flex gap-3 mb-8 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/60">
                <button onClick={() => { setActiveTab('resep'); setErrorMsg(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all duration-300 flex justify-center items-center gap-2 ${activeTab === 'resep' ? 'bg-white text-blue-600 shadow-md border border-slate-200 scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95'}`}>
                    <ClipboardList className="w-5 h-5" /> 1. Master Resep (BOM)
                </button>
                <button onClick={() => { setActiveTab('makloon'); setErrorMsg(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all duration-300 flex justify-center items-center gap-2 ${activeTab === 'makloon' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95'}`}>
                    <Truck className="w-5 h-5" /> 2. Manajemen Makloon
                </button>
            </div>

            <div className="alert-container min-h-[50px] mb-6">
                {(isLoadingBoms || isLoadingOrders) && <div className="text-center text-sm text-blue-500 font-medium flex justify-center items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sedang memuat data...</div>}
                {errorMsg && <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 mb-4 font-semibold shadow-sm">{errorMsg}</div>}
                {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold border border-emerald-200/60 shadow-sm">{successMsg}</div>}
            </div>

            {activeTab === 'resep' && (
                <div className="animate-fadeIn space-y-6">
                    {/* BOM Table - always visible for view_makloon */}
                    {boms.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100">
                                <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Daftar Resep BOM Tersimpan</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 font-bold text-slate-600">Kode Produk</th>
                                        <th className="p-4 font-bold text-slate-600">Jumlah Bahan</th>
                                        <th className="p-4 font-bold text-slate-600 text-right">Aksi</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {boms.map(b => (
                                            <tr key={b.id_bom} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold text-slate-700">{b.kode_produk}</td>
                                                <td className="p-4 text-slate-600">{Array.isArray(b.bahan_baku) ? b.bahan_baku.length : 0} bahan</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleDeleteBom(b.id_bom)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Hapus Resep">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* BOM Creation Form - only for users with create_makloon */}
                    {can('create_makloon') && (
                        <form onSubmit={handleSaveResep} className="space-y-6">
                            <div className="bg-gradient-to-br from-slate-50 to-white p-7 rounded-2xl border border-slate-200 shadow-sm">
                                <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-widest">A. Pilih Produk yang Ingin Dibuat Resepnya</label>
                                <select required className="w-full p-4 border border-slate-300 rounded-xl font-bold text-blue-900 bg-white shadow-inner focus:ring-4 focus:ring-blue-100 focus:border-b transition-all outline-none:border-blue-500:ring-blue-500" value={resepProduk} onChange={e => {
                                    setResepProduk(e.target.value);
                                    const existingBom = boms.find(b => b.kode_produk === e.target.value);
                                    if (existingBom && existingBom.bahan_baku) setResepBahanList(existingBom.bahan_baku);
                                    else setResepBahanList([{ kode_bahan_baku: '', jumlah_per_unit: '' }]);
                                }}>
                                    <option value="">-- Pilih Produk Jadi --</option>
                                    {produkJadiOptions.map(i => <option key={i.kodeBarang} value={i.kodeBarang}>[{i.kodeBarang}] {i.nama}</option>)}
                                </select>
                                {boms.find(b => b.kode_produk === resepProduk) && <p className="text-xs font-bold text-amber-600 mt-3 flex items-center gap-1">⚠️ Perhatian: Resep untuk produk ini sudah ada. Menyimpan akan menimpa resep lama.</p>}
                            </div>

                            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">B. Kebutuhan Bahan Baku (Per 1 Unit Produk)</h3>
                                    <button type="button" onClick={handleAddResepBahan} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl hover:bg-indigo-100 hover:scale-105 transition-all shadow-sm">+ Tambah Bahan</button>
                                </div>
                                <div className="space-y-3">
                                    {resepBahanList.map((bahan, idx) => {
                                        const selectedBahan = items.find(i => i.kodeBarang === bahan.kode_bahan_baku);
                                        return (
                                        <div key={idx} className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-b transition-colors">
                                            <div className="flex-1">
                                                <select required className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-100 outline-none:border-blue-500:ring-blue-500" value={bahan.kode_bahan_baku} onChange={e => handleResepBahanChange(idx, 'kode_bahan_baku', e.target.value)}>
                                                    <option value="">Pilih Bahan Baku...</option>
                                                    {bahanBakuOptions.map(i => <option key={i.kodeBarang} value={i.kodeBarang}>[{i.kodeBarang}] {i.nama}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <input type="number" min="0.01" step="any" required className="w-24 p-3 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-blue-100 outline-none:border-blue-500:ring-blue-500" placeholder="Jml / Unit" value={bahan.jumlah_per_unit} onChange={e => handleResepBahanChange(idx, 'jumlah_per_unit', e.target.value === '' ? '' : Number(e.target.value))} />
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">{selectedBahan?.satuan_dasar || '-'}</span>
                                                {resepBahanList.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveResepBahan(idx)} className="p-2.5 text-rose-500 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button disabled={isProcessing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl flex justify-center items-center shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:scale-100">
                                {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENYIMPAN...</> : <><Save className="w-5 h-5 mr-2" /> SIMPAN MASTER RESEP (BOM)</>}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {activeTab === 'makloon' && (
                <div className="animate-fadeIn space-y-8">
                    {/* FORM CREATE ORDER - only visible with create_makloon permission */}
                    {can('create_makloon') && (
                        <form onSubmit={handleCreateOrder} className="bg-gradient-to-br from-indigo-50/50 to-white p-7 rounded-2xl border border-indigo-100/50 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                            <h3 className="font-black text-indigo-900 uppercase tracking-widest text-xs mb-5 flex items-center gap-2 relative z-10"><Factory className="w-4 h-4 text-indigo-500" /> Buat Order Makloon Baru</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Vendor</label>
                                    <select required className="w-full p-3.5 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-shadow:border-blue-500:ring-blue-500" value={vendor} onChange={e => setVendor(e.target.value)}>
                                        <option value="">-- Pilih Vendor --</option>
                                        {vendorOptions.map(v => <option key={v.idSupplier} value={v.idSupplier}>{v.nama}</option>)}
                                    </select>
                                    {vendorOptions.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Belum ada lokasi bertipe vendor.</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Produk Jadi</label>
                                    <select required className="w-full p-3.5 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-shadow:border-blue-500:ring-blue-500" value={produksiProduk} onChange={handleProdukChange}>
                                        <option value="">-- Pilih Produk --</option>
                                        {produkJadiOptions.map(i => {
                                            const hasBom = boms.some(b => b.kode_produk === i.kodeBarang);
                                            return <option key={i.kodeBarang} value={i.kodeBarang} disabled={!hasBom}>
                                                {i.nama} {!hasBom && '(Resep Kosong)'}
                                            </option>
                                        })}
                                    </select>

                                    {isLoadingPreview && <div className="mt-2 text-xs text-indigo-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Memuat Resep...</div>}
                                    {bomPreview && !isLoadingPreview && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-3 max-h-48 overflow-y-auto shadow-inner">
                                            <h4 className="text-[10px] font-black text-slate-400 mb-2 border-b border-slate-200 pb-2 uppercase tracking-wider">Preview Bahan Baku (Resep per Unit):</h4>
                                            <div className="space-y-2.5 mt-2">
                                                {bomPreview.map((bahan, idx) => {
                                                    const totalDibutuhkan = bahan.qty_dibutuhkan * (jumlahProduk || 1);
                                                    const isKurang = bahan.stok_aktual < totalDibutuhkan;
                                                    return (
                                                        <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                                            <span className="font-bold text-slate-700 leading-tight mr-2" title={bahan.nama_bahan}>{bahan.nama_bahan}</span>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-slate-500 text-[10px] font-bold">Dibutuhkan: {totalDibutuhkan}</span>
                                                                <span className={isKurang ? "text-red-600 font-black flex items-center gap-1" : "text-emerald-600 font-bold"}>
                                                                    Sisa: {bahan.stok_aktual} 
                                                                    {isKurang && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md text-[8px] uppercase tracking-wider">Stok Kurang</span>}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Target Qty</label>
                                    <input type="number" min="1" required className="w-full p-3.5 border border-slate-200 rounded-xl bg-white font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-shadow:border-blue-500:ring-blue-500" value={jumlahProduk} onChange={e => setJumlahProduk(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Contoh: 100" />
                                </div>
                            </div>
                            <div className="mt-5 flex justify-end items-center relative z-10">
                                <button disabled={isProcessing} className={`px-8 py-3.5 disabled:bg-slate-300 text-white font-black text-sm rounded-xl flex justify-center items-center shadow-lg transition-all hover:scale-105 active:scale-95 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30`}>
                                    {isProcessing ? 'MEMPROSES...' : 'BUAT ORDER'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TABLE ORDERS */}
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-800">Daftar Order Makloon</h4>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-600">Filter Tanggal:</label>
                            <input 
                                type="date" 
                                value={dateFilter} 
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 font-bold text-slate-600">WO Number</th>
                                        <th className="p-4 font-bold text-slate-600">Vendor</th>
                                        <th className="p-4 font-bold text-slate-600">Produk</th>
                                        <th className="p-4 font-bold text-slate-600 text-center">Target Qty</th>
                                        <th className="p-4 font-bold text-slate-600 text-center">Status</th>
                                        {can('edit_makloon') && <th className="p-4 font-bold text-slate-600 text-center">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {makloonOrders.length === 0 ? (
                                        <tr><td colSpan={can('edit_makloon') ? 6 : 5} className="p-8 text-center text-slate-400 font-medium italic">Belum ada order makloon yang terdata.</td></tr>
                                    ) : makloonOrders.map(order => {
                                        const vendorName = suppliers?.find(s => s.idSupplier === order.id_vendor)?.nama || order.vendor?.nama || order.id_vendor;
                                        const productName = items?.find(i => i.kodeBarang === order.kode_produk)?.nama || order.product?.nama || order.kode_produk;
                                        
                                        return (
                                            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 font-black text-slate-700">{order.wo_number}</td>
                                                <td className="p-4 font-medium text-slate-600 flex items-center gap-2"><Truck className="w-4 h-4 text-slate-400"/> {vendorName}</td>
                                                <td className="p-4 font-medium text-slate-600">{productName}</td>
                                                <td className="p-4 font-bold text-indigo-600 text-center">{order.target_qty}</td>
                                                <td className="p-4 text-center">
                                                    {order.status === 'Pending' && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[11px] font-black tracking-wider uppercase border border-amber-200">Pending</span>}
                                                    {order.status === 'On-Process' && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[11px] font-black tracking-wider uppercase border border-b animate-pulse">On Process</span>}
                                                    {order.status === 'Completed' && <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[11px] font-black tracking-wider uppercase border border-slate-200 flex items-center justify-center gap-1 w-max mx-auto"><CheckCircle2 className="w-3 h-3"/> Selesai</span>}
                                                    {order.status === 'Cancelled' && <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[11px] font-black tracking-wider uppercase border border-red-200 w-max mx-auto block">Batal</span>}
                                                </td>
                                                {can('edit_makloon') && (
                                                    <td className="p-4 text-center">
                                                        {order.status === 'Pending' && (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button disabled={isProcessing} onClick={() => setSendConfirmId(order.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 flex items-center gap-1">
                                                                    Kirim Bahan <ArrowRight className="w-3 h-3"/>
                                                                </button>
                                                                <button disabled={isProcessing} onClick={() => handleCancelOrder(order.id)} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1 border border-red-200">
                                                                    <Trash2 className="w-3 h-3"/> Batal
                                                                </button>
                                                            </div>
                                                        )}
                                                        {order.status === 'On-Process' && (
                                                            <button disabled={isProcessing} onClick={() => openReceiveModal(order.id, order.target_qty)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 flex items-center gap-1 mx-auto">
                                                                <Package className="w-3 h-3"/> Terima Barang
                                                            </button>
                                                        )}
                                                        {order.status === 'Completed' && (
                                                            <span className="text-slate-400 text-xs font-bold italic">-</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} title="Terima Barang Makloon">
                <form onSubmit={confirmReceiveBarang}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah Barang Jadi yang Diterima</label>
                        <input 
                            type="number" 
                            min="1" 
                            required 
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-emerald-700:border-blue-500:ring-blue-500" 
                            value={receiveQty} 
                            onChange={e => setReceiveQty(e.target.value)} 
                        />
                        <p className="text-xs text-slate-500 mt-2">Target pesanan WO ini adalah: <strong className="text-slate-700">{receiveTargetQty}</strong> unit.</p>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lokasi Rak (Tujuan)</label>
                        <select
                            required
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none font-bold text-slate-700"
                            value={receiveLokasi}
                            onChange={e => setReceiveLokasi(e.target.value)}
                        >
                            <option value="">-- Pilih Lokasi Rak --</option>
                            {locations?.map(loc => (
                                <option key={loc.idLokasi} value={loc.idLokasi}>{loc.nama}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Biaya Jasa Makloon / Pcs</label>
                            <input 
                                type="number" 
                                min="0" 
                                required 
                                placeholder="Rp 0"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-blue-700:border-blue-500:ring-blue-500" 
                                value={makloonFee} 
                                onChange={e => setMakloonFee(e.target.value)} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Pajak / PPN (%)</label>
                            <input 
                                type="number" 
                                min="0" 
                                max="100"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-blue-700:border-blue-500:ring-blue-500" 
                                value={taxPercent} 
                                onChange={e => setTaxPercent(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                            <span>Subtotal</span>
                            <span>Rp {((Number(receiveQty) || 0) * (Number(makloonFee) || 0)).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600 mb-2">
                            <span>PPN ({taxPercent || 0}%)</span>
                            <span>Rp {Math.round((Number(receiveQty) || 0) * (Number(makloonFee) || 0) * ((Number(taxPercent) || 0) / 100)).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2">
                            <span>Total Estimasi</span>
                            <span className="text-emerald-700">Rp {Math.round((Number(receiveQty) || 0) * (Number(makloonFee) || 0) * (1 + (Number(taxPercent) || 0) / 100)).toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end mt-6">
                        <button type="button" onClick={() => setShowReceiveModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Batal</button>
                        <button type="submit" disabled={isProcessing} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                            {isProcessing ? 'Memproses...' : <><CheckCircle2 className="w-4 h-4" /> Simpan Penerimaan</>}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={!!sendConfirmId}
                onClose={() => setSendConfirmId(null)}
                onConfirm={() => { handleSendBahan(sendConfirmId); setSendConfirmId(null); }}
                title="Kirim Bahan Baku"
                message="Yakin ingin mengirim bahan baku ke vendor? Stok bahan baku akan berkurang sesuai resep BOM."
                confirmText="Ya, Kirim"
                variant="warning"
            />

            <ConfirmModal
                isOpen={!!approvalPrompt}
                onClose={() => setApprovalPrompt(null)}
                onConfirm={handleApproveTransaction}
                title="Approve Transaksi (Opsional)"
                message={`Transaksi dengan ID ${approvalPrompt?.idTransaksi} telah dibuat sebagai Draft. Apakah Anda ingin langsung menyetujuinya (Approve) sekarang agar tercatat permanen di sistem?`}
                confirmText="Ya, Approve Sekarang"
                cancelText="Nanti Saja"
            />
        </div>
    );
}
