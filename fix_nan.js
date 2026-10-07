const fs = require('fs');

function replaceInFile(file, searchStr, replaceStr) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes(searchStr)) {
        content = content.replace(searchStr, replaceStr);
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
}

// 1. Fix NaN-NaN-NaN in BarangMasuk.jsx
const fileMasuk = 'frontend/src/pages/BarangMasuk.jsx';
replaceInFile(fileMasuk, 'const safeStart = getLocalYYYYMMDD(new Date(startDate));', 'const safeStart = getLocalYYYYMMDD(startDate || new Date());');
replaceInFile(fileMasuk, 'const safeEnd = getLocalYYYYMMDD(new Date(endDate));', 'const safeEnd = getLocalYYYYMMDD(endDate || new Date());');
replaceInFile(fileMasuk, 'const safeStart = getLocalYYYYMMDD(new Date(startDate));', 'const safeStart = getLocalYYYYMMDD(startDate || new Date());');
replaceInFile(fileMasuk, 'const safeEnd = getLocalYYYYMMDD(new Date(endDate));', 'const safeEnd = getLocalYYYYMMDD(endDate || new Date());');
replaceInFile(fileMasuk, 'const safeStart = getLocalYYYYMMDD(new Date(startDate));', 'const safeStart = getLocalYYYYMMDD(startDate || new Date());');
replaceInFile(fileMasuk, 'const safeEnd = getLocalYYYYMMDD(new Date(endDate));', 'const safeEnd = getLocalYYYYMMDD(endDate || new Date());');

// Do all occurrences with global regex
let masuk = fs.readFileSync(fileMasuk, 'utf8');
masuk = masuk.replace(/getLocalYYYYMMDD\(new Date\(startDate\)\)/g, 'getLocalYYYYMMDD(startDate || new Date())');
masuk = masuk.replace(/getLocalYYYYMMDD\(new Date\(endDate\)\)/g, 'getLocalYYYYMMDD(endDate || new Date())');
fs.writeFileSync(fileMasuk, masuk);

// 2. Fix NaN-NaN-NaN in BarangKeluar.jsx
const fileKeluar = 'frontend/src/pages/BarangKeluar.jsx';
let keluar = fs.readFileSync(fileKeluar, 'utf8');
keluar = keluar.replace(/getLocalYYYYMMDD\(new Date\(filterStart\)\)/g, 'getLocalYYYYMMDD(filterStart || new Date())');
keluar = keluar.replace(/getLocalYYYYMMDD\(new Date\(filterEnd\)\)/g, 'getLocalYYYYMMDD(filterEnd || new Date())');
fs.writeFileSync(fileKeluar, keluar);

// 3. Fix NaN-NaN-NaN in BarangReturn.jsx
const fileReturn = 'frontend/src/pages/BarangReturn.jsx';
let ret = fs.readFileSync(fileReturn, 'utf8');
ret = ret.replace(/getLocalYYYYMMDD\(new Date\(startDate\)\)/g, 'getLocalYYYYMMDD(startDate || new Date())');
ret = ret.replace(/getLocalYYYYMMDD\(new Date\(endDate\)\)/g, 'getLocalYYYYMMDD(endDate || new Date())');
fs.writeFileSync(fileReturn, ret);


// 4. Fix Null Integrity Constraint in MasterBarang.jsx
const fileMaster = 'frontend/src/pages/MasterBarang.jsx';
let master = fs.readFileSync(fileMaster, 'utf8');
master = master.replace(
    'const payload = { ...formData, rasio_konversi: Number(formData.rasio_konversi) || 1 };',
    'const payload = { ...formData, rasio_konversi: Number(formData.rasio_konversi) || 1, hargaBeli: Number(formData.hargaBeli) || 0, hargaBeli_besar: Number(formData.hargaBeli_besar) || 0, hargaJual: Number(formData.hargaJual) || 0, hargaJual_besar: Number(formData.hargaJual_besar) || 0 };'
);
fs.writeFileSync(fileMaster, master);

console.log("All fixes applied!");
