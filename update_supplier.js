const fs = require('fs');

let f = fs.readFileSync('frontend/src/pages/Supplier.jsx', 'utf8');

f = f.replace("const [formData, setFormData] = useState({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' });", 
"const [formData, setFormData] = useState({ nama: '', alamat: '', kota: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' });");

f = f.replace("setFormData({ nama: '', alamat: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' });", 
"setFormData({ nama: '', alamat: '', kota: '', telp: '', npwp: '', nik: '', penanggung_jawab: '', tipe_partner: 'supplier' });");

f = f.replace("setFormData({ nama: row.nama, alamat: row.alamat, telp: row.telp, npwp: row.npwp || '', nik: row.nik || '', penanggung_jawab: row.penanggung_jawab || '', tipe_partner: row.tipe_partner || 'supplier' });", 
"setFormData({ nama: row.nama, alamat: row.alamat, kota: row.kota || '', telp: row.telp, npwp: row.npwp || '', nik: row.nik || '', penanggung_jawab: row.penanggung_jawab || '', tipe_partner: row.tipe_partner || 'supplier' });");

f = f.replace("{ key: 'alamat', label: 'Alamat' },", 
"{ key: 'kota', label: 'Kota', format: v => v || '-' },\n        { key: 'alamat', label: 'Alamat' },");

f = f.replace('<label className="block text-sm font-medium mb-1 text-slate-700">No. Telp / WhatsApp</label>', 
`<label className="block text-sm font-medium mb-1 text-slate-700">Kota</label>
                        <input placeholder="Contoh: KAB. BULELENG / KOTA TABANAN" required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none:border-blue-500:ring-blue-500" value={formData.kota} onChange={e=>setFormData({...formData, kota: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">No. Telp / WhatsApp</label>`);

fs.writeFileSync('frontend/src/pages/Supplier.jsx', f);

let faktur = fs.readFileSync('frontend/src/components/ui/FakturPajak.jsx', 'utf8');
faktur = faktur.replace("const signatureCity = extractCity(isPembelian ? entityData.alamat : MY_COMPANY.alamat);", "const signatureCity = isPembelian && entityData.kota ? entityData.kota : extractCity(MY_COMPANY.alamat);");
fs.writeFileSync('frontend/src/components/ui/FakturPajak.jsx', faktur);
