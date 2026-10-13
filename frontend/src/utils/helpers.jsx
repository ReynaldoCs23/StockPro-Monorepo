// 1. Generate ID Otomatis (Contoh: BRG001, SUP002)
export const generateId = (prefix, list, idKey) => {
    if (!list || list.length === 0) return `${prefix}001`;
    let maxId = 0;
    list.forEach(item => {
        const num = parseInt(String(item[idKey]).replace(prefix, '')) || 0;
        if (num > maxId) maxId = num;
    });
    return `${prefix}${(maxId + 1).toString().padStart(3, '0')}`;
};

// 2. Format Mata Uang Rupiah
export const formatRp = (angka) => new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0 
}).format(angka || 0);

// 3. Format Sumbu Y Grafik (Contoh: 1.000.000 -> 1M)
export const formatYAxis = (val) => {
    if(val >= 1000000) return `${(val/1000000).toFixed(1)}M`;
    if(val >= 1000) return `${(val/1000).toFixed(0)}k`;
    return val;
};

// 4. Membuat Array Tanggal untuk Rentang Waktu (Keperluan Grafik)
export const getDaysArray = (start, end) => {
    let arr = [];
    for(let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
        arr.push(new Date(dt).toISOString().split('T')[0]);
    }
    return arr;
};

// 5. Ekspor Data ke File CSV (Excel)
export const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
        Object.values(obj).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}_${new Date().getTime()}.csv`;
    a.click();
};

// 5b. Format Rupiah untuk Export CSV (maks 2 desimal, contoh: "Rp 1.965.405,60")
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const formatRpExport = (angka) => 'Rp ' + new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
}).format(round2(angka));

// 5b-2. Format angka biasa untuk Export CSV agar terbaca sebagai ANGKA di Excel locale Indonesia
//       (tanpa pemisah ribuan, desimal pakai koma, maks 2 desimal). Contoh: 1965405.5999 -> "1965405,6"
export const formatAngkaExport = (angka) => String(round2(angka)).replace('.', ',');

// 5c. Flatten transaksi (1 item = 1 baris) dengan nilai keuangan per item
//     Discount, DPP, dan PPN header dialokasikan proporsional sesuai porsi total item.
export const flattenTransactionsForExport = (transactions = []) => {
    const rows = [];
    transactions.forEach(trx => {
        const items = Array.isArray(trx.items) ? trx.items : [];
        if (items.length === 0) {
            rows.push({
                ...trx,
                _itemTotal: null,
                _itemDiscount: Number(trx.potongan_harga) || 0,
                _itemHargaJual: null,
                _itemDpp: Number(trx.dpp) || 0,
                _itemPpn: Number(trx.pajak_nominal) || 0
            });
            return;
        }

        const lines = items.map(item => {
            const qty = Number(item.jumlah_transaksi ?? item.jumlah) || 0;
            const harga = Number(item.harga_satuan) || 0;
            return { item, qty, harga, total: round2(qty * harga) };
        });
        const subtotal = lines.reduce((s, l) => s + l.total, 0);
        const discount = Number(trx.potongan_harga) || 0;
        const pajakPersen = Number(trx.pajak_persen) || 0;
        const storedDpp = Number(trx.dpp) || 0;
        const storedPpn = Number(trx.pajak_nominal) || 0;

        lines.forEach(({ item, qty, harga, total }) => {
            const share = subtotal > 0 ? total / subtotal : 1 / lines.length;
            const dpp = storedDpp > 0 ? storedDpp * share : total * 11 / 12;
            const ppn = storedPpn > 0 ? storedPpn * share : dpp * 12 / 100 * (pajakPersen > 0 ? 1 : 0);
            rows.push({
                ...trx,
                _itemName: item.namaBarang || item.item_nama || '-',
                _itemHargaSatuan: harga,
                _itemQty: qty,
                _itemSatuan: item.satuan_transaksi || '-',
                _itemTotal: total,
                _itemDiscount: round2(discount * share),
                _itemHargaJual: total,
                _itemDpp: round2(dpp),
                _itemPpn: round2(ppn)
            });
        });
    });
    return rows;
};

// 6. Mendapatkan Tanggal Hari Ini (Format YYYY-MM-DD)
export const getLocalYYYYMMDD = (dateStr = null) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 7. Format Tanggal Aman Zona Waktu (Single-HQ Timezone)
export const formatLocalDate = (dateStr) => {
    if (!dateStr) return '-';
    
    // Menangani format datetime standar SQL (spasi) maupun ISO 8601 (T)
    const rawDate = String(dateStr); 
    const dateOnly = rawDate.split('T')[0].split(' ')[0]; 
    const [year, month, day] = dateOnly.split('-');
    
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
};

// 8. Normalisasi Markdown AI (mengubah baris tabel '||' menjadi baris baru dan memastikan spacing)
export const formatAIMarkdown = (text) => {
    if (!text || typeof text !== 'string') return '';
    let formatted = text;

    // Normalisasi baris tabel yang tergabung dengan '||' menjadi '|\n|'
    formatted = formatted.replace(/\|\s*\|/g, '|\n|');

    // Beri baris kosong sebelum tabel jika didahului teks biasa
    formatted = formatted.replace(/([^\n])\n(\|.+?\|)/g, '$1\n\n$2');

    // Beri baris kosong setelah tabel jika diikuti teks biasa
    formatted = formatted.replace(/(\|.+?\|)\n([^\n\|])/g, '$1\n\n$2');

    return formatted;
};