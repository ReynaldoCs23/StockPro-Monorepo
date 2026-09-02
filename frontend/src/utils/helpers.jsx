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