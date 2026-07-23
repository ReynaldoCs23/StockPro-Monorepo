import React, { useState } from 'react';
import { Undo, Package, Calendar, ArrowDownToLine, ArrowUpFromLine } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import NotaReturnPrintLayout from '../components/ui/NotaReturnPrintLayout';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import { apiCall } from '../utils/api';
import { generateId, getLocalYYYYMMDD, formatLocalDate } from '../utils/helpers';
import useAppStore from '../store/useAppStore';

export default function BarangReturn() {
    const { locations, returns, setReturns, inbound, setInbound, outbound, setOutbound, items, setItems, suppliers, customers, currentUser, isApiOffline, addLog: addSimulatedLog, currentUserPermissions: userPermissions, companyProfile } = useAppStore();
    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');
    const todayDate = new Date();
    const todayString = getLocalYYYYMMDD(todayDate);

    const startDefault = todayString;
    const endDefault = todayString;

    const [startDate, setStartDate] = useState(startDefault);
    const [endDate, setEndDate] = useState(endDefault);

    const [isModalOpen, setModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailData, setDetailData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState(null);
    const [printData, setPrintData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [recentOutbound, setRecentOutbound] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const can = (perm) => isAdminOrSuperadmin || userPermissions.includes(perm);
    // --- FLOW STATE ---
    const [flowType, setFlowType] = useState('');

    React.useEffect(() => {
        if (!isApiOffline && isModalOpen && flowType === 'RET_IN') {
            apiCall(`/transactions?category=outbound&recent_only=true`)
                .then(res => setRecentOutbound(res.data?.data || res.data || res || []))
                .catch(() => { });
        }
    }, [isModalOpen, flowType, isApiOffline]);

    const [jenisReturn, setJenisReturn] = useState('');
    const [idReferensi, setIdReferensi] = useState('');
    const [refEntity, setRefEntity] = useState('');
    const [tanggal, setTanggal] = useState(todayString);
    const [keterangan, setKeterangan] = useState('');

    // Multi-item selection
    const [refItems, setRefItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [availableBatches, setAvailableBatches] = useState([]);

    React.useEffect(() => {
        if (flowType === 'RET_OUT') {
            apiCall('/item-batches/available').then(setAvailableBatches).catch(() => setAvailableBatches([]));
        }
    }, [flowType]);

    // Filter based on date
    const filteredReturns = returns.filter(trx => {
        if (!trx.tanggal) return true;
        const d = getLocalYYYYMMDD(trx.tanggal);
        return d >= startDate && d <= endDate;
    });

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterType, startDate, endDate]);

    React.useEffect(() => {
        if (!isApiOffline) {
            setIsProcessing(true);
            const safeStart = getLocalYYYYMMDD(new Date(startDate));
            const safeEnd = getLocalYYYYMMDD(new Date(endDate));
            apiCall(`/transactions?category=return&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&page=${currentPage}`)
                .then(data => {
                    if (data && data.data) {
                        setReturns(data.data);
                        setLastPage(data.last_page || 1);
                    } else {
                        setReturns(Array.isArray(data) ? data : []);
                        setLastPage(1);
                    }
                    setIsProcessing(false);
                })
                .catch(() => setIsProcessing(false));
        }
    }, [filterType, startDate, endDate, currentPage]);

    const totalQtyReturn = filteredReturns.reduce((a, b) => a + Number(b.jumlah || 0), 0);
    const retOutCount = filteredReturns.filter(r => (r.sumber_tujuan || r.jenisReturn || '').startsWith('RET_OUT')).length;
    const retInCount = filteredReturns.filter(r => (r.sumber_tujuan || r.jenisReturn || '').startsWith('RET_IN')).length;

    // --- Open Modal ---
    const openModal = (flow) => {
        setFlowType(flow);
        setJenisReturn('');
        setIdReferensi('');
        setRefEntity('');
        setTanggal(todayString);
        setKeterangan('');
        setRefItems([]);
        setSelectedItems([]);
        setErrorMsg('');
        setModalOpen(true);
    };

    const handleViewDetail = (row) => {
        setDetailData(row);
        setIsDetailModalOpen(true);
    };

    // --- Reference Selection (RET_OUT) ---
    const handleRefSelect = (refId) => {
        setIdReferensi(refId);
        const allTransactions = [...inbound, ...outbound, ...recentOutbound];
        const refTrx = allTransactions.find(t => t.idTransaksi === refId);
        if (!refTrx) return;
        setRefEntity(refTrx?.entitas || refTrx?.namaSupplier || refTrx?.namaPembeli || '');
        const trxItems = refTrx?.items || [];
        setRefItems(trxItems);
        const isRetInCustomer = jenisReturn === 'RET_IN_RETURN_CUSTOMER';
        setSelectedItems(trxItems.map(it => ({
            kodeBarang: it.kodeBarang,
            namaBarang: it.namaBarang || it.item_nama || items.find(i => i.kodeBarang === it.kodeBarang)?.nama || '',
            maxQty: Number(it.jumlah),
            trxQty: Number(it.jumlah),
            jumlah: isRetInCustomer ? 1 : 0,
            selected: isRetInCustomer,
            id_batch: '',
            harga_satuan: Number(it.harga_satuan || items.find(i => i.kodeBarang === it.kodeBarang)?.hargaJual || 0)
        })));
    };

    // --- Reference Selection (RET_IN) ---
    const handleRetInRefSelect = (refId) => {
        setIdReferensi(refId);
        const refTrx = returns.find(t => t.idTransaksi === refId);
        if (!refTrx) return;
        setRefEntity(refTrx?.entitas || '');
        const trxItems = refTrx?.items || [];
        setSelectedItems(trxItems.map(it => ({
            kodeBarang: it.kodeBarang,
            namaBarang: it.namaBarang || it.item_nama || items.find(i => i.kodeBarang === it.kodeBarang)?.nama || '',
            maxQty: Number(it.jumlah),
            jumlah: Number(it.jumlah),
            selected: true,
            lokasi_tujuan: '',
            harga_satuan: Number(it.harga_satuan || items.find(i => i.kodeBarang === it.kodeBarang)?.hargaJual || 0)
        })));
    };

    const toggleItem = (idx) => setSelectedItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected, jumlah: !it.selected ? it.maxQty || it.jumlah : 0 } : it));
    const updateQty = (idx, val) => setSelectedItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, jumlah: Math.min(Math.max(0, Number(val)), it.maxQty || 99999) }));

    // --- Submit ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = selectedItems.filter(it => it.selected && it.jumlah > 0);
        if (validItems.length === 0) return setToast({ message: 'Pilih minimal satu barang dengan jumlah valid!', type: 'error' });

        const isStockOut = jenisReturn.startsWith('RET_OUT');

        if (isStockOut) {
            const missingBatch = validItems.find(it => !it.id_batch);
            if (missingBatch) return setToast({ message: `Pilih Batch Masuk untuk barang ${missingBatch.namaBarang}!`, type: 'error' });
        } else {
            const missingLokasi = validItems.find(it => !it.lokasi_tujuan);
            if (missingLokasi) return setToast({ message: `Pilih Lokasi Rak Tujuan untuk barang ${missingLokasi.namaBarang}!`, type: 'error' });
        }

        setIsProcessing(true);
        const generatedId = generateId('RET', returns, 'idTransaksi');

        const payload = {
            idTransaksi: generatedId,
            tanggal,
            jenisReturn,
            idReferensi,
            keterangan,
            namaPembeli: refEntity,
            sumber_tujuan: jenisReturn,
            items: validItems.map(it => ({
                kodeBarang: it.kodeBarang,
                namaBarang: it.namaBarang,
                jumlah: it.jumlah,
                harga_satuan: it.harga_satuan || 0,
                harga_modal_satuan: 0,
                lokasi_asal: null,
                lokasi_tujuan: isStockOut ? null : it.lokasi_tujuan,
                id_batch: isStockOut ? it.id_batch : null
            }))
        };

        try {
            let serverPayload = null;
            if (!isApiOffline) {
                serverPayload = await apiCall(`/transaction/RET`, 'POST', {
                    ...payload, log_user: currentUser.namaLengkap,
                    log_detail: `Return (${jenisReturn}): ${validItems.length} item via Ref ${idReferensi}`
                });
            }

            // Fallback to local payload if offline or no hydrated model returned
            const finalTransaction = (serverPayload && serverPayload.idTransaksi) ? serverPayload : payload;

            const uiPayload = {
                ...finalTransaction,
                entitas: finalTransaction.entitas || refEntity,
                jumlah: finalTransaction.jumlah || validItems.reduce((sum, it) => sum + Number(it.jumlah), 0),
                items: finalTransaction.items || validItems
            };

            // Only update returns state - visual merge handles display in Masuk/Keluar
            setReturns([uiPayload, ...returns]);

            // Update local stock
            setItems(items.map(it => {
                const used = validItems.find(v => v.kodeBarang === it.kodeBarang);
                if (!used) return it;
                return { ...it, stok: isStockOut ? Number(it.stok) - Number(used.jumlah) : Number(it.stok) + Number(used.jumlah) };
            }));

            if (isApiOffline) addSimulatedLog('CREATE', 'Return', `Return: ${generatedId}`);
            setToast({ message: 'Transaksi Return berhasil diproses!', type: 'success' });
            setModalOpen(false);
            setErrorMsg('');
        } catch (e) { setErrorMsg('Error Validation: ' + e.message); }
        finally { setIsProcessing(false); }
    };

    // --- Delete ---
    const handleDelete = async (id) => {
        const trans = returns.find(t => t.idTransaksi === id);
        const isStockOut = (trans?.sumber_tujuan || trans?.jenisReturn || '').startsWith('RET_OUT') || trans?.jenisReturn === 'Return ke Vendor';

        try {
            if (!isApiOffline) await apiCall(`/transaction/RET/${id}`, 'DELETE', { log_user: currentUser.namaLengkap, log_detail: `Membatalkan Return: ${id}` });
            setReturns(returns.filter(t => t.idTransaksi !== id));

            if (trans) {
                const transItems = trans.items || [{ kodeBarang: trans.kodeBarang, jumlah: trans.jumlah }];
                setItems(items.map(it => {
                    const used = transItems.find(v => v.kodeBarang === it.kodeBarang);
                    if (!used) return it;
                    return { ...it, stok: isStockOut ? Number(it.stok) + Number(used.jumlah) : Number(it.stok) - Number(used.jumlah) };
                }));
            }
            setToast({ message: 'Return berhasil dihapus!', type: 'success' });
        } catch (e) { setToast({ message: 'Gagal menghapus: ' + e.message, type: 'error' }); }
    };

    // --- Export CSV ---
    // 🔥 FIX SINGLE-USE REFERENCE ID 🔥
    // Collect all already-used reference IDs
    const usedRefIds = returns.map(r => r.idReferensi).filter(Boolean);

    // RET_OUT Reference Options (strict cross-referencing)
    const retOutRefOptions = (() => {
        if (jenisReturn === 'RET_OUT_RETURN_SUPPLIER') {
            // Returning to supplier → reference original inbound purchase
            return inbound.filter(t => !t.type?.includes('MAKLOON') && !t.idTransaksi?.startsWith('MKL') && !usedRefIds.includes(t.idTransaksi));
        }
        return [];
    })();

    // RET_IN Reference Options (strict cross-referencing)
    const retInRefOptions = (() => {
        if (jenisReturn === 'RET_IN_RETURN_CUSTOMER') {
            // Customer returning goods → reference original outbound sale
            return (Array.isArray(recentOutbound) ? recentOutbound : []).filter(t => {
                const tujuan = t.sumber_tujuan || t.tujuan || '';
                return tujuan.includes('Penjualan') && !usedRefIds.includes(t.idTransaksi);
            });
        }
        return [];
    })();

    const getBadgeInfo = (v) => {
        const isOut = (v || '').startsWith('RET_OUT') || v === 'Return ke Vendor';
        const subLabel = { 'RET_OUT_RETURN_SUPPLIER': 'Ke Supplier', 'RET_IN_RETURN_CUSTOMER': 'Dari Pelanggan', 'Return ke Vendor': 'Legacy', 'Return dari Customer': 'Legacy' }[v] || '';
        return { isOut, subLabel };
    };

    const returnColumns = [
        { key: 'idTransaksi', label: 'ID Return' },
        { key: 'tanggal', label: 'Tanggal', format: v => formatLocalDate(v) },
        {
            key: 'jenisReturn', label: 'Tipe', format: (v, row) => {
                const { isOut, subLabel } = getBadgeInfo(v || row.sumber_tujuan || '');
                return (
                    <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${isOut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{isOut ? 'KELUAR' : 'MASUK'}</span>
                        {subLabel && <p className="text-[10px] text-slate-400 mt-0.5">{subLabel}</p>}
                    </div>
                );
            }, exportFormat: (v, row) => {
                const { isOut, subLabel } = getBadgeInfo(v || row.sumber_tujuan || '');
                return `${isOut ? 'KELUAR' : 'MASUK'} - ${subLabel}`;
            }
        },
        { key: 'idReferensi', label: 'Ref. ID', format: v => v || '-', exportFormat: v => v || '-' },
        {
            key: 'items', label: 'Isi Transaksi', format: (v, row) => (
                <>
                    <span className="print:hidden">
                        <button onClick={() => handleViewDetail(row)} className="text-blue-600 font-medium hover:underline text-xs">
                            {Array.isArray(v) ? v.map(i => `${i.namaBarang || i.item_nama} (${i.jumlah})`).join(', ') : `${v?.length || 0} Jenis Barang`} (Lihat Detail)
                        </button>
                    </span>
                    <span className="hidden print:inline">{row.isi_transaksi_detail || '-'}</span>
                </>
            ), exportFormat: (v, row) => row.isi_transaksi_detail || '-'
        },
        {
            key: 'jumlah', label: 'Total Qty', format: (v, row) => {
                const isOut = (row.sumber_tujuan || row.jenisReturn || '').startsWith('RET_OUT');
                return <span className={`font-bold ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>{isOut ? '-' : '+'}{v}</span>;
            }, exportFormat: (v, row) => {
                const isOut = (row.sumber_tujuan || row.jenisReturn || '').startsWith('RET_OUT');
                return `${isOut ? '-' : '+'}${v}`;
            }
        },
        { key: 'keterangan', label: 'Keterangan' },
        { key: 'totalTransaksi', label: 'Total Nilai', format: v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0), exportFormat: v => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0) }
    ];

    const isPrintingRow = !!printData;

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <NotaReturnPrintLayout data={printData} onClose={() => setPrintData(null)} currentUser={currentUser} suppliers={suppliers} customers={customers} companyProfile={companyProfile} />

            <div className={`space-y-6 ${isPrintingRow ? 'hidden' : 'print:hidden'}`}>
                {/* Date Filter */}
                <div className="flex justify-end mb-2">
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input type="date" max={endDate} value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                        <span className="text-slate-300 font-bold mx-2">-</span>
                        <input type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] outline-none font-semibold text-slate-700 bg-transparent cursor-pointer" />
                    </div>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCardMini title="Total Transaksi" value={filteredReturns.length} icon={Undo} bgClass="bg-violet-50" colorClass="text-violet-600" />
                    <StatCardMini title="Total Qty Return" value={totalQtyReturn} icon={Package} bgClass="bg-sky-50" colorClass="text-sky-600" />
                    <StatCardMini title="Return Keluar" value={retOutCount} icon={ArrowUpFromLine} bgClass="bg-rose-50" colorClass="text-rose-600" />
                    <StatCardMini title="Return Masuk" value={retInCount} icon={ArrowDownToLine} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                </div>

                {/* Data Table - Unified with DataTable component */}
                <DataTable
                    title="Riwayat Return"
                    data={filteredReturns}
                    idKey="idTransaksi"
                    filename="Barang_Return"
                    onDelete={can('delete_barang_return') ? handleDelete : null}
                    onPrint={(row) => setPrintData(row)}
                    currentPage={currentPage}
                    lastPage={lastPage}
                    onPageChange={setCurrentPage}
                    customFilter={
                        <div className="flex items-center gap-2">
                            <div className="relative w-full md:w-auto">
                                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 cursor-pointer w-full font-medium">
                                    <option value="all">Semua Transaksi</option>
                                    <option value="MASUK">Return Masuk (Dari Pelanggan)</option>
                                    <option value="KELUAR">Return Keluar (Ke Supplier)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                            {can('create_barang_return') && <button onClick={() => openModal('RET_OUT')} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 transition-colors whitespace-nowrap"><ArrowUpFromLine className="w-4 h-4" /> Return Keluar</button>}
                            {can('create_barang_return') && <button onClick={() => openModal('RET_IN')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap"><ArrowDownToLine className="w-4 h-4" /> Return Masuk</button>}
                        </div>
                    }
                    columns={returnColumns}
                />
            </div>

            {!isPrintingRow && <ReportPrintTemplate title="Laporan Transaksi Barang Return" type="transaction" data={filteredReturns} columns={returnColumns} />}

            {/* Detail Modal */}
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detail Transaksi: ${detailData?.idTransaksi}`} width="max-w-3xl">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500 block">Tanggal:</span> <span className="font-bold">{formatLocalDate(detailData?.tanggal)}</span></div>
                    <div><span className="text-slate-500 block">Referensi ID:</span> <span className="font-bold">{detailData?.idReferensi || '-'}</span></div>
                    <div className="col-span-2"><span className="text-slate-500 block">Keterangan:</span> <span className="font-bold">{detailData?.keterangan || '-'}</span></div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Kode Barang</th>
                                <th className="px-4 py-3 font-semibold">Nama Barang</th>
                                <th className="px-4 py-3 font-semibold text-center">Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {detailData?.items && detailData.items.length > 0 ? detailData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">{item.kodeBarang}</td>
                                    <td className="px-4 py-3">{item.namaBarang || items.find(i => i.kodeBarang === item.kodeBarang)?.nama || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-center text-slate-800">{item.jumlah} pcs</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td className="px-4 py-3">{detailData?.kodeBarang || '-'}</td>
                                    <td className="px-4 py-3">{detailData?.namaBarang || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-center text-slate-800">{detailData?.jumlah || 0} pcs</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors">Tutup</button>
                </div>
            </Modal>

            {/* FLOW 1 - RET_OUT (Stok Keluar) */}
            <Modal isOpen={isModalOpen && flowType === 'RET_OUT'} onClose={() => { setModalOpen(false); setErrorMsg(''); }} title="Return — Stok Keluar Gudang" width="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 mb-4 font-semibold shadow-sm">
                            {errorMsg}
                        </div>
                    )}
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 text-xs font-medium">
                        <strong>FLOW 1 — OUTBOUND:</strong> Barang akan dikurangi dari stok gudang. Pilih transaksi asal, lalu pilih barang & jumlah yang ingin diretur/dikirim.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Jenis Return Keluar</label>
                            <select required className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none:border-blue-500:ring-blue-500" value={jenisReturn} onChange={e => { setJenisReturn(e.target.value); setIdReferensi(''); setRefItems([]); setSelectedItems([]); }}>
                                <option value="">-- Pilih Jenis --</option>
                                <option value="RET_OUT_RETURN_SUPPLIER">Pengembalian ke Supplier</option>
                            </select>
                        </div>
                        {jenisReturn && (
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium mb-1 text-slate-700">ID Transaksi Referensi (Opsional - Pembelian Masuk)</label>
                                <select className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none" value={idReferensi} onChange={e => handleRefSelect(e.target.value)}>
                                    <option value="">Tanpa Referensi (Pilih Item Manual)</option>
                                    {retOutRefOptions.map(t => (
                                        <option key={t.idTransaksi} value={t.idTransaksi}>{t.idTransaksi} | {t.entitas || t.namaSupplier || t.keterangan || '-'} ({t.jumlah} pcs)</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {jenisReturn === 'RET_OUT_RETURN_SUPPLIER' && !idReferensi && (
                            <div className="col-span-1 md:col-span-2 border border-slate-200 p-4 rounded-xl mt-2 bg-white">
                                <label className="block text-sm font-medium mb-2 text-slate-700">Tambah Barang Return</label>
                                <select className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-rose-500 outline-none" value="" onChange={e => {
                                    const kodeBarang = e.target.value;
                                    if (!kodeBarang) return;
                                    const itemMaster = items.find(i => i.kodeBarang === kodeBarang);
                                    if (selectedItems.some(it => it.kodeBarang === kodeBarang)) return;
                                    setSelectedItems(prev => [...prev, {
                                        kodeBarang,
                                        namaBarang: itemMaster?.nama || kodeBarang,
                                        maxQty: 99999,
                                        trxQty: 99999,
                                        jumlah: 1,
                                        selected: true,
                                        id_batch: ''
                                    }]);
                                }}>
                                    <option value="">+ Pilih Barang yang Akan Direturn...</option>
                                    {items.map(i => (
                                        <option key={i.kodeBarang} value={i.kodeBarang}>{i.kodeBarang} - {i.nama} (Stok: {i.stok})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="col-span-1">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Tanggal</label>
                            <input type="date" required className="w-full p-2.5 border border-slate-300 rounded-xl bg-white:border-blue-500:ring-blue-500" value={tanggal} onChange={e => setTanggal(e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Alasan / Keterangan</label>
                            <input type="text" required placeholder="Barang cacat / salah kirim..." className="w-full p-2.5 border border-slate-300 rounded-xl bg-white:border-blue-500:ring-blue-500" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
                        </div>
                    </div>
                    {selectedItems.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                            <div className="bg-slate-100 p-3 font-bold text-sm text-slate-700">Pilih Barang & Jumlah Return</div>
                            <div className="p-3 space-y-2 bg-white">
                                {selectedItems.map((it, idx) => (
                                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${it.selected ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                        <input type="checkbox" checked={it.selected} onChange={() => toggleItem(idx)} className="w-4 h-4 accent-rose-600 cursor-pointer" />
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-slate-800">{it.namaBarang}</p>
                                            <p className="text-[10px] text-slate-400">{it.kodeBarang} · Maks: {it.maxQty}</p>
                                        </div>
                                        <select
                                            disabled={!it.selected}
                                            value={it.id_batch || ''}
                                            onChange={e => {
                                                const batchId = e.target.value;
                                                const batch = availableBatches.find(b => b.id_batch === batchId);
                                                const newMax = batch ? batch.qty_sisa - batch.qty_booking : 0;
                                                const newItems = [...selectedItems];
                                                newItems[idx].id_batch = batchId;
                                                newItems[idx].maxQty = Math.min(it.trxQty, newMax);
                                                if (newItems[idx].jumlah > newItems[idx].maxQty) {
                                                    newItems[idx].jumlah = newItems[idx].maxQty;
                                                }
                                                setSelectedItems(newItems);
                                            }}
                                            className="w-48 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-slate-100"
                                            required={it.selected}
                                        >
                                            <option value="">Pilih Batch Masuk...</option>
                                            {availableBatches.filter(b => b.kodeBarang === it.kodeBarang).map(b => (
                                                <option key={b.id_batch} value={b.id_batch}>
                                                    {b.id_batch} ({formatLocalDate(b.tanggal_masuk)}) Sisa: {b.qty_sisa - b.qty_booking}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="number" min="0" max={it.maxQty} disabled={!it.selected} className="w-24 p-2 border border-slate-300 rounded-lg text-sm text-center disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:ring-1 focus:ring-rose-500:border-blue-500:ring-blue-500" value={it.jumlah} onChange={e => updateQty(idx, e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <button disabled={isProcessing} className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl mt-4 transition-all flex justify-center items-center shadow-lg shadow-rose-200">
                        {isProcessing ? "Memproses..." : "Konfirmasi Return Keluar (Kurangi Stok)"}
                    </button>
                </form>
            </Modal>

            {/* FLOW 2 - RET_IN (Stok Masuk) */}
            <Modal isOpen={isModalOpen && flowType === 'RET_IN'} onClose={() => { setModalOpen(false); setErrorMsg(''); }} title="Return — Stok Masuk Gudang" width="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 mb-4 font-semibold shadow-sm">
                            {errorMsg}
                        </div>
                    )}
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-800 text-xs font-medium">
                        <strong>FLOW 2 — INBOUND:</strong> Barang akan ditambahkan ke stok gudang. Pilih ID RET-OUT sebagai referensi, sistem akan otomatis menarik data barang & qty.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Jenis Return Masuk</label>
                            <select required className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none:border-blue-500:ring-blue-500" value={jenisReturn} onChange={e => { setJenisReturn(e.target.value); setIdReferensi(''); setSelectedItems([]); }}>
                                <option value="">-- Pilih Jenis --</option>
                                <option value="RET_IN_RETURN_CUSTOMER">Return Masuk dari Pelanggan</option>
                            </select>
                        </div>
                        {jenisReturn && (
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium mb-1 text-slate-700">Referensi ID (Wajib: Penjualan Keluar)</label>
                                <select
                                    required
                                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={idReferensi}
                                    onChange={e => handleRefSelect(e.target.value)}
                                >
                                    <option value="">Pilih Transaksi Referensi...</option>
                                    {retInRefOptions.map(t => (
                                        <option key={t.idTransaksi} value={t.idTransaksi}>{t.idTransaksi} | {t.entitas || t.namaPembeli || t.keterangan || '-'} ({t.jumlah} pcs)</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="col-span-1">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Tanggal</label>
                            <input type="date" required className="w-full p-2.5 border border-slate-300 rounded-xl bg-white:border-blue-500:ring-blue-500" value={tanggal} onChange={e => setTanggal(e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium mb-1 text-slate-700">Keterangan</label>
                            <input type="text" required placeholder="Penggantian diterima / barang dikembalikan..." className="w-full p-2.5 border border-slate-300 rounded-xl bg-white:border-blue-500:ring-blue-500" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
                        </div>
                    </div>
                    {selectedItems.length > 0 && (
                        <div className="border border-emerald-200 rounded-xl overflow-hidden mt-4">
                            <div className="bg-emerald-100 p-3 font-bold text-sm text-emerald-800">Barang yang Akan Diterima {jenisReturn === 'RET_IN_RETURN_CUSTOMER' ? '(Atur Qty Return)' : '(Otomatis dari RET-OUT)'}</div>
                            <div className="p-3 space-y-2 bg-white">
                                {selectedItems.map((it, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                                        <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-slate-800">{it.namaBarang}</p>
                                            <p className="text-[10px] text-slate-400">{it.kodeBarang} {it.maxQty ? `· Maks: ${it.maxQty}` : ''}</p>
                                        </div>
                                        <select
                                            required
                                            className="w-48 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-500:border-blue-500:ring-blue-500"
                                            value={it.lokasi_tujuan || ''}
                                            onChange={e => {
                                                const newItems = [...selectedItems];
                                                newItems[idx].lokasi_tujuan = e.target.value;
                                                setSelectedItems(newItems);
                                            }}
                                        >
                                            <option value="">Lokasi Rak Tujuan...</option>
                                            {(locations || []).map(l => (
                                                <option key={l.idLokasi} value={l.idLokasi}>{l.nama}</option>
                                            ))}
                                        </select>
                                        {jenisReturn === 'RET_IN_RETURN_CUSTOMER' ? (
                                            <input type="number" min="0" max={it.maxQty} className="w-24 p-2 border border-slate-300 rounded-lg text-sm text-center font-bold outline-none focus:ring-1 focus:ring-emerald-500:border-blue-500:ring-blue-500" value={it.jumlah} onChange={e => updateQty(idx, e.target.value)} />
                                        ) : (
                                            <span className="font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg text-sm">+{it.jumlah}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <button disabled={isProcessing} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl mt-4 transition-all flex justify-center items-center shadow-lg shadow-emerald-200">
                        {isProcessing ? "Memproses..." : "Konfirmasi Return Masuk (Tambah Stok)"}
                    </button>
                </form>
            </Modal>
        </div>
    );
}