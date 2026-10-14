import useAppStore from '../store/useAppStore';
import React, { useState, useEffect } from 'react';
import FakturPajak from '../components/ui/FakturPajak';
import { ArrowUpFromLine, Package, Calendar, Trash2, QrCode } from '../components/icons/Icons';
import StatCardMini from '../components/ui/StatCardMini';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import ReportPrintTemplate from '../components/ui/ReportPrintTemplate';
import SuratJalanMakloon from '../components/ui/SuratJalanMakloon';
import EFakturScannerModal from '../components/ui/EFakturScannerModal';
import { apiCall } from '../utils/api';
import { generateId, getLocalYYYYMMDD, formatRp, formatLocalDate, formatAngkaExport, flattenTransactionsForExport } from '../utils/helpers';

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
    const [formData, setFormData] = useState({ tanggal: todayString, tujuan: 'Penjualan ke Customer', namaPembeli: '', keterangan: '', no_faktur: '' });
    // Detail Data
    const [cartItems, setCartItems] = useState([{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '' }]);
    const [pajakPersen, setPajakPersen] = useState(11);
    const [potonganHarga, setPotonganHarga] = useState(0);
    const [uangMuka, setUangMuka] = useState(0);
    const [ppnbm, setPpnbm] = useState(0);
    const [targetKodeBarang, setTargetKodeBarang] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

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

    const fetchOutboundTransactions = async () => {
        if (!isApiOffline) {
            setIsProcessing(true);
            const safeStart = getLocalYYYYMMDD(filterStart || new Date());
            const safeEnd = getLocalYYYYMMDD(filterEnd || new Date());
            try {
                const data = await apiCall(`/transactions?category=outbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&page=${currentPage}`);
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
            } catch (e) {
                // handle error
            } finally {
                setIsProcessing(false);
            }
        }
    };

    useEffect(() => {
        fetchOutboundTransactions();
    }, [filterType, filterStart, filterEnd, currentPage]);

    const fetchAllForExport = async () => {
        setIsProcessing(true);
        const safeStart = getLocalYYYYMMDD(filterStart || new Date());
        const safeEnd = getLocalYYYYMMDD(filterEnd || new Date());
        try {
            const response = await apiCall(`/transactions?category=outbound&filter=${filterType}&start_date=${safeStart}&end_date=${safeEnd}&per_page=all`);
            const data = response.data || [];
            // Flatten: 1 item = 1 row (nilai keuangan dihitung per item)
            return flattenTransactionsForExport(data);
        } catch (e) {
            console.error("Export Error:", e);
            return [];
        } finally {
            setIsProcessing(false);
        }
    };

    const exportColumnsCSV = [
        { key: 'idTransaksi', label: 'ID' },
        { key: 'no_faktur', label: 'No.faktur' },
        { key: '_itemName', label: 'Nama Barang' },
        { key: '_itemHargaSatuan', label: 'Harga satuan', exportFormat: (v) => v == null ? '-' : formatAngkaExport(v) },
        { key: '_itemQty', label: 'Qty' },
        { key: '_itemSatuan', label: 'Satuan' },
        { key: '_itemTotal', label: 'Total', exportFormat: (v) => v == null ? '-' : formatAngkaExport(v) },
        { key: '_itemDiscount', label: 'Discount', exportFormat: (v) => formatAngkaExport(v) },
        { key: '_itemHargaJual', label: 'Harga Jual/Penggantian/DPP', exportFormat: (v) => v == null ? '-' : formatAngkaExport(v) },
        { key: '_itemDpp', label: 'DPP Nilai Lain/DPP', exportFormat: (v) => formatAngkaExport(v) },
        { key: '_itemPpn', label: 'PPN', exportFormat: (v) => formatAngkaExport(v) },
        { key: 'keterangan', label: 'Ket' },
        { key: 'tanggal', label: 'Tanggal Faktur', exportFormat: (val) => val ? new Date(val).toLocaleDateString('id-ID') : '-' }
    ];

    const isMakloonOut = formData.tujuan === 'Kirim ke Vendor Makloon';
    const makloonVendors = suppliers.filter(s => s.tipe_partner === 'vendor' || s.idSupplier.startsWith('VEN'));
    const produkJadiItems = items.filter(i => ['produk jadi', 'barang jadi'].includes((i.tipeBarang || '').toLowerCase()));
    // Filter barang yang boleh dipilih di transaksi keluar:
    // - Penjualan ke Customer: Barang Jadi dan Jasa
    // - Kirim ke Vendor Makloon: HANYA Bahan Baku
    // - Non Produksi / Inventaris / Lainnya tidak ditampilkan
    const availableItems = items.filter(i => {
        const tipe = (i.tipeBarang || '').toLowerCase().trim();
        if (isMakloonOut) {
            return tipe === 'bahan baku' || tipe === 'kemasan';
        } else {
            return tipe === 'barang jadi' || tipe === 'produk jadi' || tipe === 'jasa';
        }
    });

    const openAddModal = () => {
        setEditId(null);
        setFormData({ tanggal: todayString, tujuan: 'Penjualan ke Customer', namaPembeli: '', keterangan: '', no_faktur: '' });
        setCartItems([{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '', harga_satuan: '' }]);
        setTargetKodeBarang('');
        setPotonganHarga(0);
        setUangMuka(0);
        setPpnbm(0);
        setErrorMsg(''); setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditId(row.idTransaksi);
        setFormData({
            tanggal: row.tanggal ? getLocalYYYYMMDD(row.tanggal) : todayString,
            tujuan: row.tujuan || 'Penjualan ke Customer',
            namaPembeli: row.namaPembeli || '',
            keterangan: row.keterangan || '',
            no_faktur: row.no_faktur || ''
        });
        setCartItems(row.items && row.items.length > 0 ? row.items.map(item => ({
            ...item,
            kodeBarang: item.kodeBarang,
            jumlah: item.jumlah_transaksi || item.jumlah,
            lokasi_asal: item.lokasi_asal || '',
            lokasi_tujuan: item.lokasi_tujuan || '',
            satuan_transaksi: item.satuan_transaksi || items.find(i => i.kodeBarang === item.kodeBarang)?.satuan_dasar || '',
            harga_satuan: item.harga_satuan || item.hargaJual || ''
        })) : [{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '', harga_satuan: '' }]);
        
        setPotonganHarga(row.potongan_harga || 0);
        setUangMuka(row.uang_muka || 0);
        setPpnbm(row.ppnbm || 0);
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

    const handleAddRow = () => setCartItems([...cartItems, { kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: formData.namaPembeli || '', satuan_transaksi: '', harga_satuan: '' }]);
    const handleRemoveRow = (index) => setCartItems(cartItems.filter((_, i) => i !== index));
    const handleRowChange = (index, field, value) => {
        const newCart = [...cartItems];
        newCart[index][field] = value;
        if (field === 'kodeBarang') {
            const item = items.find(i => i.kodeBarang === value);
            if (item) {
                const hargaJual = Number(item.hargaJual || 0);
                newCart[index].satuan_transaksi = item.satuan_dasar || '';
                
                const targetTotal = Number(newCart[index].target_total || 0) || (Number(newCart[index].jumlah || 0) * Number(newCart[index].harga_satuan || 0));
                
                if (hargaJual > 0) {
                    newCart[index].harga_satuan = hargaJual;
                    if (targetTotal > 0) {
                        const rawQty = targetTotal / hargaJual;
                        const roundedQty = Math.abs(rawQty - Math.round(rawQty)) < 0.01 ? Math.round(rawQty) : Math.round(rawQty * 100) / 100;
                        newCart[index].jumlah = roundedQty > 0 ? roundedQty : 1;
                    }
                } else {
                    newCart[index].harga_satuan = item.hargaJual || 0;
                }
            }
        }
        if (field === 'satuan_transaksi') {
            const item = items.find(i => i.kodeBarang === newCart[index].kodeBarang);
            if (item) {
                const isBesar = value === item.satuan_besar;
                const rasio = Number(item.rasio_konversi || 1);
                newCart[index].harga_satuan = isBesar ? (Number(item.hargaJual_besar) || Number(item.hargaJual || 0) * rasio) : Number(item.hargaJual || 0);

                const targetTotal = Number(newCart[index].target_total || 0);
                if (targetTotal > 0 && Number(newCart[index].harga_satuan) > 0) {
                    const rawQty = targetTotal / Number(newCart[index].harga_satuan);
                    const roundedQty = Math.abs(rawQty - Math.round(rawQty)) < 0.01 ? Math.round(rawQty) : Math.round(rawQty * 100) / 100;
                    newCart[index].jumlah = roundedQty > 0 ? roundedQty : 1;
                }
            }
        }
        setCartItems(newCart);
    };

    const getActualBaseQty = (row) => {
        const item = items.find(i => i.kodeBarang === row.kodeBarang);
        if (!item || !row.jumlah) return 0;
        return row.satuan_transaksi === item.satuan_besar ? Number(row.jumlah) * Number(item.rasio_konversi || 1) : Number(row.jumlah);
    };

    const executeDelete = async (row) => {
        const id = typeof row === 'string' ? row : row.idTransaksi;
        const status = typeof row === 'string' ? 'draft' : (row.status || 'draft');
        setIsProcessing(true);
        try {
            if (!isApiOffline) {
                await apiCall(`/transaction/OUT/${id}`, 'DELETE', {
                    log_user: currentUser.namaLengkap,
                    log_detail: `Menghapus Transaksi Keluar (${status}): ${id}`
                });
            }
            setOutbound(prev => (Array.isArray(prev) ? prev : []).filter(t => t.idTransaksi !== id));
            setToast({ message: "Transaksi berhasil dihapus!", type: "success" });
            setConfirmAction(null);
            await fetchOutboundTransactions();
        } catch (e) {
            setToast({ message: "Gagal menghapus: " + e.message, type: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = (idOrRow) => {
        const row = (typeof idOrRow === 'object' && idOrRow !== null)
            ? idOrRow
            : ((Array.isArray(outbound) ? outbound : []).find(t => t.idTransaksi === idOrRow) || { idTransaksi: idOrRow, status: 'draft' });
        setConfirmAction({ type: 'delete', row });
    };

    const handlePrintRow = (row) => {
        setPrintData(row);
    };

    // Auto-Fill Form dari Hasil Scan e-Faktur (DJP QR Code)
    // PERINGATAN: Fungsi ini HANYA mengisi state form di layar dan TIDAK menyimpan ke database
    const handleScanSuccess = async (qrUrl) => {
        setIsScanning(true);
        try {
            const res = await apiCall('/efaktur/extract', 'POST', { qrUrl });
            const data = res?.data || res;

            if (!data) {
                throw new Error('Data e-Faktur tidak ditemukan atau format tidak sesuai.');
            }

            // 1. Ekstrak data faktur
            const nomorFaktur = data.no_faktur || data.nomor_faktur || '';
            const rawCustomerName = data.nama_pembeli || data.nama || '';
            const tanggalFaktur = data.tanggal ? getLocalYYYYMMDD(data.tanggal) : formData.tanggal;
            const dppVal = Number(data.dpp || 0);
            const ppnbmVal = Number(data.ppnbm || 0);

            // 2. Hubungan Finansial:
            // Rumus DJP: DPP = Harga Jual * 11/12
            // Maka: Harga Jual (Subtotal) = DPP * 12/11
            const hargaJualTotal = dppVal > 0 ? Math.round(dppVal * 12 / 11) : (Number(data.total || 0) || 0);

            // 3. Cocokkan Pelanggan dengan Master Customer
            let matchedCustomer = rawCustomerName;
            if (customers && customers.length > 0 && rawCustomerName) {
                const cleanRaw = rawCustomerName.toLowerCase().replace(/^(pt\.?|cv\.?|ud\.?)\s+/i, '').trim();
                const found = customers.find(c => {
                    const cleanC = (c.nama || '').toLowerCase().replace(/^(pt\.?|cv\.?|ud\.?)\s+/i, '').trim();
                    const npwpMatch = (data.npwp_pembeli || data.npwp) && c.npwp && c.npwp.replace(/\D/g, '') === (data.npwp_pembeli || data.npwp).replace(/\D/g, '');
                    return npwpMatch || cleanC.includes(cleanRaw) || cleanRaw.includes(cleanC);
                });
                if (found) {
                    matchedCustomer = found.nama;
                }
            }

            // 4. Update State Form (Auto-Fill SAJA - TIDAK memanggil handleSubmit)
            setFormData(prev => ({
                ...prev,
                no_faktur: nomorFaktur || prev.no_faktur,
                tanggal: tanggalFaktur,
                namaPembeli: matchedCustomer || prev.namaPembeli,
                keterangan: prev.keterangan || (data.npwp_pembeli || data.npwp ? `e-Faktur NPWP: ${data.npwp_pembeli || data.npwp}` : 'Scan e-Faktur DJP')
            }));

            // PPN diatur ke 11% dari Harga Jual (sesuai ketentuan terkini)
            setPajakPersen(11);
            if (ppnbmVal > 0) {
                setPpnbm(ppnbmVal);
            }

            // 5. Update Cart Items (Qty dihitung dari: Harga Jual / Harga Satuan Master Barang)
            const defaultLocation = locations?.[0]?.idLokasi || '';
            let mappedCart = [];

            if (Array.isArray(data.items) && data.items.length > 0) {
                mappedCart = data.items.map(it => {
                    const matchedItem = items.find(i => 
                        (i.nama && it.nama && i.nama.toLowerCase().includes(it.nama.toLowerCase())) ||
                        (i.nama && it.nama && it.nama.toLowerCase().includes(i.nama.toLowerCase()))
                    );

                    // PENTING: Jangan fallback ke items[0] jika tidak ada kecocokan nama di master barang,
                    // agar tidak salah memilih barang lain.
                    const chosenItem = matchedItem || null;

                    const itemDpp = Number(it.dpp || it.total || it.harga_satuan || 0) || dppVal;
                    const itemHargaJual = itemDpp > 0 ? Math.round(itemDpp * 12 / 11) : hargaJualTotal;

                    let finalQty = Number(it.jumlah) || 1;
                    let finalUnitPrice = chosenItem ? itemHargaJual : '';

                    if (chosenItem && Number(chosenItem.hargaJual) > 0) {
                        finalUnitPrice = Number(chosenItem.hargaJual);
                        const rawQty = itemHargaJual / finalUnitPrice;
                        finalQty = Math.abs(rawQty - Math.round(rawQty)) < 0.01 ? Math.round(rawQty) : Math.round(rawQty * 100) / 100;
                        if (finalQty <= 0) finalQty = 1;
                    }

                    return {
                        kodeBarang: chosenItem ? chosenItem.kodeBarang : '',
                        jumlah: chosenItem ? finalQty : 1,
                        harga_satuan: chosenItem ? finalUnitPrice : '',
                        lokasi_asal: defaultLocation,
                        lokasi_tujuan: matchedCustomer || '',
                        satuan_transaksi: chosenItem ? chosenItem.satuan_dasar : '',
                        target_total: itemHargaJual
                    };
                });
            }

            // Jika mappedCart masih kosong tapi ada DPP faktur: buat 1 baris
            if (mappedCart.length === 0 && dppVal > 0) {
                mappedCart = [{
                    kodeBarang: '',
                    jumlah: 1,
                    harga_satuan: '',
                    lokasi_asal: defaultLocation,
                    lokasi_tujuan: matchedCustomer || '',
                    satuan_transaksi: '',
                    target_total: hargaJualTotal
                }];
            }

            if (mappedCart.length > 0) {
                setCartItems(mappedCart);
            } else {
                setCartItems(prev => prev.map(item => ({
                    ...item,
                    lokasi_tujuan: matchedCustomer || item.lokasi_tujuan
                })));
            }

            const hasUnselectedItem = mappedCart.some(c => !c.kodeBarang);
            setToast({
                message: hasUnselectedItem
                    ? `e-Faktur (${nomorFaktur || rawCustomerName}) berhasil dibaca. Barcode tidak memuat rincian nama barang, silakan pilih nama barang pada dropdown.`
                    : `e-Faktur (${nomorFaktur || rawCustomerName}) berhasil diisi ke form! Silakan periksa & sesuaikan sebelum menyimpan.`,
                type: 'success'
            });
            setIsScannerOpen(false);
        } catch (error) {
            setToast({
                message: 'Gagal mengekstrak e-Faktur: ' + (error.message || 'Format tidak valid'),
                type: 'error'
            });
        } finally {
            setIsScanning(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = cartItems.filter(c => c.kodeBarang && c.jumlah > 0);
        if (validItems.length === 0) return setToast({ message: 'Minimal masukkan satu barang!', type: 'error' });

        // Validasi Stok Multi-Item (kecuali Jasa yang tidak memerlukan stok fisik)
        for (let it of validItems) {
            const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
            const isJasa = (stockData?.tipeBarang || '').toLowerCase().trim() === 'jasa';
            if (isJasa) continue;
            const baseQty = getActualBaseQty(it);
            if (Number(stockData?.stok || 0) < baseQty) {
                setErrorMsg(`Stok tidak cukup untuk ${stockData?.nama || it.kodeBarang}! (Sisa: ${stockData?.stok || 0} ${stockData?.satuan_dasar || ''}, Dibutuhkan: ${baseQty})`);
                return;
            }
        }

        setIsProcessing(true);
        const isMakloon = formData.tujuan === 'Kirim ke Vendor Makloon';

        // Validasi Tipe Barang: Penjualan = Barang Jadi / Jasa, Makloon = Hanya Bahan Baku
        for (let it of validItems) {
            const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
            const tipe = (stockData?.tipeBarang || '').toLowerCase().trim();
            if (isMakloon) {
                if (tipe !== 'bahan baku' && tipe !== 'kemasan') {
                    setIsProcessing(false);
                    setErrorMsg(`Untuk Makloon hanya boleh memilih Bahan Baku! (${stockData?.nama || it.kodeBarang} bertipe ${stockData?.tipeBarang || '-'})`);
                    return;
                }
            } else {
                if (tipe !== 'barang jadi' && tipe !== 'produk jadi' && tipe !== 'jasa') {
                    setIsProcessing(false);
                    setErrorMsg(`Untuk Penjualan hanya boleh memilih Barang Jadi atau Jasa! (${stockData?.nama || it.kodeBarang} bertipe ${stockData?.tipeBarang || '-'})`);
                    return;
                }
            }
        }

        const idPrefix = isMakloon ? 'MKL-OUT' : 'INV-OUT';
        const finalId = editId || generateId(idPrefix, outbound, 'idTransaksi');

        // Kalkulasi Total Transaksi
        let totalTransaksiValue = 0;
        if (formData.tujuan === 'Penjualan ke Customer') {
            validItems.forEach(it => {
                const stockData = items.find(i => i.kodeBarang === it.kodeBarang);
                const isBesar = it.satuan_transaksi === stockData?.satuan_besar;
                const rasio = Number(stockData?.rasio_konversi || 1);
                const unitPrice = (it.harga_satuan !== '' && it.harga_satuan !== undefined)
                    ? Number(it.harga_satuan)
                    : (isBesar ? (Number(stockData?.hargaJual_besar) || Number(stockData?.hargaJual || 0) * rasio) : Number(stockData?.hargaJual || 0));
                totalTransaksiValue += (Number(it.jumlah) * unitPrice);
            });
        }
        const subtotalDasar = Math.max(0, totalTransaksiValue - Number(potonganHarga || 0) - Number(uangMuka || 0));
        const dppCalc = formData.tujuan === 'Penjualan ke Customer' ? Math.round(subtotalDasar * 11 / 12 * 100) / 100 : 0;
        const pajakNominal = totalTransaksiValue * (pajakPersen / 100);
        const grandTotal = totalTransaksiValue + pajakNominal;

        const payload = {
            idTransaksi: finalId,
            ...formData,
            target_kode_barang: isMakloon ? targetKodeBarang : null,
            totalTransaksi: grandTotal,
            pajak_persen: pajakPersen,
            pajak_nominal: pajakNominal,
            potongan_harga: potonganHarga,
            uang_muka: uangMuka,
            ppnbm: ppnbm,
            dpp: dppCalc,
            subtotal: totalTransaksiValue,
            items: validItems.map(item => {
                const stockData = items.find(i => i.kodeBarang === item.kodeBarang);
                const isBesar = item.satuan_transaksi === stockData?.satuan_besar;
                const rasio = Number(stockData?.rasio_konversi || 1);
                const unitPrice = (item.harga_satuan !== '' && item.harga_satuan !== undefined)
                    ? Number(item.harga_satuan)
                    : (isBesar ? (Number(stockData?.hargaJual_besar) || Number(stockData?.hargaJual || 0) * rasio) : Number(stockData?.hargaJual || 0));
                return {
                    ...item,
                    namaBarang: stockData?.nama || '',
                    harga_satuan: parseFloat(unitPrice.toFixed(2)),
                    harga_modal_satuan: parseFloat(unitPrice.toFixed(2)),
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
                if (usedItem && (it.tipeBarang || '').toLowerCase().trim() !== 'jasa') {
                    return { ...it, stok: Number(it.stok) - getActualBaseQty(usedItem) };
                }
                return it;
            }));

            if (isApiOffline) addSimulatedLog('CREATE', 'Transaksi Keluar', `Menambah Transaksi Keluar: ${payload.idTransaksi}`);
            setToast({ message: "Transaksi berhasil disimpan!", type: "success" });
            setModalOpen(false); setErrorMsg('');
        } catch (e) { setErrorMsg("Error Validation: " + e.message); }
        finally { setIsProcessing(false); }
    };

    const executeApprove = async (row) => {
        setIsProcessing(true);
        try {
            await apiCall(`/transaction/${row.idTransaksi}/approve`, 'POST');
            await fetchOutboundTransactions();
            setToast({ message: 'Transaksi berhasil di-approve!', type: 'success' });
            setConfirmAction(null);
        } catch(e) { setToast({ message: e.message, type: 'error' }); }
        finally { setIsProcessing(false); }
    };

    const executeVoid = async (row) => {
        setIsProcessing(true);
        try {
            await apiCall(`/transaction/${row.idTransaksi}/void`, 'POST');
            await fetchOutboundTransactions();
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
        const safeStart = getLocalYYYYMMDD(filterStart || new Date());
        const safeEnd = getLocalYYYYMMDD(filterEnd || new Date());
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
                    title="Transaksi Keluar" filename="Transaksi_Keluar" data={filteredOutbound}
                    onExportCSV={fetchAllForExport}
                    exportColumns={exportColumnsCSV}
                    onPrintLaporan={handlePrintLaporan}
                    customFilter={
                        <div className="relative mr-2 w-full md:w-auto">
                            <select id="filter-jenis-transaksi-keluar" value={filterType} onChange={e => setFilterType(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 cursor-pointer w-full font-medium">
                                <option value="">Semua Jenis Transaksi</option>
                                <option value="customer">Penjualan</option>
                                <option value="makloon">Pengiriman Bahan Baku</option>
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
                    extraActions={(row) => {
                        const status = (row.status || '').toLowerCase();
                        return (
                            <>
                                {status === 'draft' && (
                                    <>
                                        <button onClick={() => handleApprove(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Approve Transaksi"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></button>
                                        {can('delete_barang_keluar') && <button onClick={() => handleDelete(row)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Draft"><Trash2 className="w-4 h-4" /></button>}
                                    </>
                                )}
                                {status === 'completed' && <button onClick={() => handleVoid(row)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Void Transaksi"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>}
                                {status === 'void' && can('delete_barang_keluar') && (
                                    <button onClick={() => handleDelete(row)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Transaksi Void"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </>
                        );
                    }}
                />
            </div>
            
            {!isPrintingRow && <ReportPrintTemplate title="Laporan Transaksi Keluar" type="transaction" data={fullPrintData || filteredOutbound} columns={reportColumns} />}

            <ConfirmModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (confirmAction?.type === 'approve') {
                        executeApprove(confirmAction.row);
                    } else if (confirmAction?.type === 'void') {
                        executeVoid(confirmAction.row);
                    } else if (confirmAction?.type === 'delete') {
                        executeDelete(confirmAction.row);
                    }
                    setConfirmAction(null);
                }}
                title={
                    confirmAction?.type === 'approve' ? "Approve Transaksi" :
                    confirmAction?.type === 'void' ? "Batalkan Transaksi (Void)" :
                    "Hapus Transaksi"
                }
                message={
                    confirmAction?.type === 'approve' ? "Approve transaksi ini? Stok fisik akan terpotong secara FIFO." :
                    confirmAction?.type === 'void' ? "Batalkan (Void) transaksi ini? Alokasi FIFO akan dikembalikan." :
                    `Yakin ingin menghapus permanen transaksi ${confirmAction?.row?.idTransaksi || ''} (${(confirmAction?.row?.status || '').toLowerCase() === 'void' ? 'Void' : 'Draft'})? Data tidak dapat dikembalikan.`
                }
                confirmText={
                    confirmAction?.type === 'approve' ? "Ya, Approve" :
                    confirmAction?.type === 'void' ? "Ya, Batalkan (Void)" :
                    "Ya, Hapus Permanen"
                }
                variant={confirmAction?.type === 'approve' ? "info" : "danger"}
            />

            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setErrorMsg(''); }} title="Input Transaksi Keluar" width="max-w-4xl">
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
                            <select className="w-full p-2.5 border border-slate-200 rounded-lg:border-blue-500:ring-blue-500" value={formData.tujuan} onChange={e => {
                                const newTujuan = e.target.value;
                                setFormData({ ...formData, tujuan: newTujuan, namaPembeli: '' });
                                setCartItems([{ kodeBarang: '', jumlah: '', lokasi_asal: '', lokasi_tujuan: '', satuan_transaksi: '', harga_satuan: '' }]);
                            }}>
                                <option value="Penjualan ke Customer">Penjualan ke Customer</option>
                                <option value="Kirim ke Vendor Makloon">Kirim ke Vendor Makloon</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-slate-700">No. Faktur (Opsional)</label>
                                <button
                                    type="button"
                                    onClick={() => setIsScannerOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                                    title="Scan QR e-Faktur DJP untuk auto-fill form"
                                >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Scan QR e-Faktur</span>
                                </button>
                            </div>
                            <input type="text" placeholder="Masukkan Nomor Faktur Manual / Hasil Scan" className="w-full p-2.5 border rounded-xl:border-blue-500:ring-blue-500" value={formData.no_faktur} onChange={e => setFormData({ ...formData, no_faktur: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">{isMakloonOut ? 'Nama Vendor Makloon' : 'Nama Pelanggan / Distributor'}</label>
                            <select required className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none:border-blue-500:ring-blue-500" value={formData.namaPembeli} onChange={e => {
                                const name = e.target.value;
                                setFormData({ ...formData, namaPembeli: name });
                                setCartItems(prev => prev.map(item => ({ ...item, lokasi_tujuan: name })));
                            }}>
                                <option value="">{isMakloonOut ? 'Pilih Vendor Makloon...' : 'Pilih Pelanggan...'}</option>
                                {formData.namaPembeli && !customers.some(c => c.nama === formData.namaPembeli) && !makloonVendors.some(s => s.nama === formData.namaPembeli) && (
                                    <option value={formData.namaPembeli}>{formData.namaPembeli} (e-Faktur)</option>
                                )}
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
                                    const satuanOptions = selectedItem ? [...new Set([selectedItem.satuan_dasar, selectedItem.satuan_besar].filter(Boolean))] : [];
                                    const lineSubtotal = Number(item.jumlah) * Number(item.harga_satuan || 0);
                                    const selectableItems = availableItems.some(i => i.kodeBarang === item.kodeBarang)
                                        ? availableItems
                                        : (item.kodeBarang && selectedItem ? [...availableItems, selectedItem] : availableItems);

                                    return (
                                    <div key={idx} className="flex gap-2 items-center flex-wrap">
                                        <select required className="flex-1 min-w-[180px] p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.kodeBarang} onChange={e => handleRowChange(idx, 'kodeBarang', e.target.value)}>
                                            <option value="">{isMakloonOut ? 'Pilih Bahan Baku...' : 'Pilih Barang Jadi / Jasa...'}</option>
                                            {selectableItems.map(i => {
                                                const isJasa = (i.tipeBarang || '').toLowerCase().trim() === 'jasa';
                                                return (
                                                    <option key={i.kodeBarang} value={i.kodeBarang}>
                                                        [{i.satuan_dasar}] {i.nama} {isJasa ? '(Jasa)' : `(Fisik: ${i.stok} | Booking: ${i.stok_booking || 0} | Tersedia: ${i.stok_tersedia ?? i.stok})`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <input type="number" step="any" min="1" required placeholder="Qty" className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.jumlah} onChange={e => handleRowChange(idx, 'jumlah', e.target.value)} />
                                        <select className="w-20 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.satuan_transaksi} onChange={e => handleRowChange(idx, 'satuan_transaksi', e.target.value)}>
                                            {satuanOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <input type="number" step="any" placeholder="Harga Satuan" required min="0" className="w-32 p-2 border rounded-lg text-sm:border-blue-500:ring-blue-500" value={item.harga_satuan} onChange={e => handleRowChange(idx, 'harga_satuan', e.target.value)} title="Harga Jual Satuan" />
                                        <input type="text" readOnly className="w-28 p-2 border rounded-lg text-sm bg-slate-100 text-slate-600:border-blue-500:ring-blue-500 hidden md:block" value={item.lokasi_tujuan || 'Lok. Tujuan...'} title="Otomatis dari Pelanggan" />
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
                            return sum + (Number(it.jumlah) * Number(it.harga_satuan || 0));
                        }, 0);
                        const taxNominal = subtotal * (pajakPersen / 100);
                        const subtotalDasar = Math.max(0, subtotal - Number(potonganHarga || 0) - Number(uangMuka || 0));
                        const dppVisual = Math.round(subtotalDasar * 11 / 12 * 100) / 100;
                        return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Potongan Harga (Rp)</label>
                                        <input type="number" step="any" className="w-full p-2 border rounded-lg text-sm" value={potonganHarga} onChange={e => setPotonganHarga(Number(e.target.value) || 0)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Uang Muka (Rp)</label>
                                        <input type="number" step="any" className="w-full p-2 border rounded-lg text-sm" value={uangMuka} onChange={e => setUangMuka(Number(e.target.value) || 0)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Jumlah PPnBM (Rp)</label>
                                        <input type="number" step="any" className="w-full p-2 border rounded-lg text-sm" value={ppnbm} onChange={e => setPpnbm(Number(e.target.value) || 0)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Dasar Pengenaan Pajak (DPP)</label>
                                        <input type="text" readOnly className="w-full p-2 border border-slate-200 bg-slate-100 rounded-lg text-sm font-semibold text-slate-600" value={formatRp(dppVisual)} title="Subtotal Dasar" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Pajak / PPN (%)</label>
                                    <input type="number" step="any" min="0" max="100" className="w-24 p-2 border rounded-lg text-sm text-center font-bold:border-blue-500:ring-blue-500" value={pajakPersen} onChange={e => setPajakPersen(Number(e.target.value) || 0)} />
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
                                        <th className="uppercase tracking-wider py-3 px-4 text-slate-700 font-semibold text-xs text-right text-emerald-600">Sisa Batch</th>
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
                                            <td className="py-3 px-4 text-emerald-600 font-bold text-right">{t.qty_sisa !== undefined ? t.qty_sisa : '-'}</td>
                                            <td className="py-3 px-4 text-right font-bold text-indigo-700">{t.qty_diambil}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan={7} className="py-3 px-4 text-right font-bold text-slate-700 text-xs uppercase">Total Qty Outbound</td>
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

            {/* Modal Scanner QR e-Faktur DJP */}
            <EFakturScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanSuccess}
                isProcessing={isScanning}
            />
        </div>
    );
}