import React, { useState, useEffect, useRef } from 'react';
import { formatRp, parseNominal } from '../../utils/money';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { QrCode, Scan, X, Loader2, Camera, CameraOff, RefreshCw, Upload, FileText } from '../icons/Icons';

// ==========================================
// Upload QR (read-only): file hanya diproses di browser, TIDAK dikirim/disimpan ke server
// ==========================================
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_PDF_PAGES = 3;
const MAX_CANVAS_DIM = 2400;
const FILE_READER_ELEMENT_ID = 'efaktur-qr-file-reader';

const loadImage = (blob) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca file gambar.')); };
    img.src = url;
});

const canvasToFile = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(new File([b], 'qr.png', { type: 'image/png' })) : reject(new Error('Gagal memproses gambar.'))), 'image/png');
});

// Decode QR dari satu file gambar menggunakan html5-qrcode (tanpa kamera)
const decodeQrFromImageFile = async (file) => {
    const reader = new Html5Qrcode(FILE_READER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
    });
    try {
        return await reader.scanFile(file, false);
    } finally {
        try { reader.clear(); } catch (e) { /* ignore */ }
    }
};

// Coba decode gambar utuh; jika gagal, coba crop per kuadran + upscale
// (QR e-Faktur umumnya berada di pojok dokumen dan bisa terlalu kecil untuk dideteksi)
const decodeQrWithFallback = async (blob) => {
    try {
        return await decodeQrFromImageFile(blob instanceof File ? blob : new File([blob], 'qr.png', { type: blob.type || 'image/png' }));
    } catch (e) { /* lanjut ke fallback */ }

    const img = await loadImage(blob);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const regions = [
        [0, 0, W, H],                 // utuh (di-upscale)
        [W / 2, H / 2, W / 2, H / 2], // kanan bawah
        [W / 2, 0, W / 2, H / 2],     // kanan atas
        [0, H / 2, W / 2, H / 2],     // kiri bawah
        [0, 0, W / 2, H / 2],         // kiri atas
    ];

    for (const [sx, sy, sw, sh] of regions) {
        const scale = Math.max(1, Math.min(3, MAX_CANVAS_DIM / Math.max(sw, sh)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        try {
            return await decodeQrFromImageFile(await canvasToFile(canvas));
        } catch (e) { /* coba region berikutnya */ }
    }
    throw new Error('QR_NOT_FOUND');
};

// Helper mapping bulan bahasa Indonesia ke nomor bulan
const INDO_MONTHS = {
    januari: '01', februari: '02', maret: '03', april: '04',
    mei: '05', juni: '06', juli: '07', agustus: '08',
    september: '09', oktober: '10', november: '11', desember: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

// PPN cadangan (bila PPN tidak terbaca dari faktur): 12% x DPP Nilai Lain, dibulatkan ke rupiah sama dengan backend:
// desimal < 0,50 turun, >= 0,50 naik. Dihitung dalam sen bulat (12% = x12 / 10000) agar tidak terkena galat float.
const ppnCadangan = (dpp) => Math.floor((Math.round(Number(dpp || 0) * 100) * 12 + 5000) / 10000);

// Parsing angka faktur memakai parser bersama ("720.720,00" -> 720720)
const parseIdrNum = (val) => {
    const n = parseNominal(val);
    return Number.isFinite(n) ? n : 0;
};

const parseIndoDate = (str) => {
    if (!str) return null;
    const m1 = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
    if (m1) {
        const mo = INDO_MONTHS[m1[2].toLowerCase()];
        if (mo) return `${m1[3]}-${mo}-${m1[1].padStart(2, '0')}`;
    }
    const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    const m3 = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m3) return `${m3[1]}-${m3[2].padStart(2, '0')}-${m3[3].padStart(2, '0')}`;
    return null;
};

// Ekstraksi baris teks dari halaman PDF via pdfjs
const extractLinesFromPage = async (page) => {
    const textContent = await page.getTextContent();
    if (!textContent || !textContent.items || textContent.items.length === 0) return [];

    const items = textContent.items
        .filter(it => it.str && it.str.trim().length > 0)
        .sort((a, b) => {
            const dy = b.transform[5] - a.transform[5];
            if (Math.abs(dy) > 3) return dy;
            return a.transform[4] - b.transform[4];
        });

    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const it of items) {
        const y = it.transform[5];
        if (lastY === null || Math.abs(lastY - y) <= 3) {
            currentLine.push(it.str);
        } else {
            lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
            currentLine = [it.str];
        }
        lastY = y;
    }
    if (currentLine.length > 0) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
    }
    return lines;
};

// Parser teks e-Faktur terpadu (mendukung Coretax & PER-03 DJP)
const parseFakturTextLines = (lines) => {
    if (!lines || lines.length === 0) return null;
    const fullText = lines.join('\n');

    // 1. Nomor Faktur (Coretax 16 digit atau PER-03 XXX.XXX-XX.XXXXXXXX)
    let nomorFaktur = '';
    const mNo = fullText.match(/(?:Kode dan Nomor Seri Faktur Pajak|Nomor Faktur Pajak|Nomor Faktur|Nomor Dokumen)\s*[:\s]\s*([0-9\.\-\/]{13,24})/i);
    if (mNo) {
        nomorFaktur = mNo[1].trim();
    } else {
        const mFall = fullText.match(/\b(0[1-9][0-9][\.\-0-9]{11,18})\b/);
        if (mFall) nomorFaktur = mFall[1].trim();
    }

    // 2. Identitas Penjual (Supplier)
    let penjualNama = '';
    let penjualNpwp = '';
    const mPenjualSection = fullText.match(/(?:Pengusaha\s+Kena\s+Pajak|Identitas\s+Penjual|Data\s+Penjual)([\s\S]*?)(?:Pembeli\s+Barang\s+Kena\s+Pajak|Identitas\s+Pembeli|Data\s+Pembeli|$)/i);
    const penjualText = mPenjualSection ? mPenjualSection[1] : fullText;

    const mPenjualNama = penjualText.match(/Nama(?:\s*Wajib\s*Pajak)?\s*[:\s]\s*([^\r\n]+)/i);
    if (mPenjualNama) penjualNama = mPenjualNama[1].replace(/^[^\w]+/, '').trim();

    const mPenjualNpwp = penjualText.match(/NPWP(?:\s*\/\s*NIK)?\s*[:\s]\s*([0-9\.\-]+)/i);
    if (mPenjualNpwp) penjualNpwp = mPenjualNpwp[1].trim();

    // 3. Identitas Pembeli
    let pembeliNama = '';
    let pembeliNpwp = '';
    const mPembeliSection = fullText.match(/(?:Pembeli\s+Barang\s+Kena\s+Pajak|Identitas\s+Pembeli|Data\s+Pembeli)([\s\S]*?)(?:Barang\s+Kena\s+Pajak|Harga\s+Jual|Dasar\s+Pengenaan|$)/i);
    const pembeliText = mPembeliSection ? mPembeliSection[1] : '';

    if (pembeliText) {
        const mPembeliNama = pembeliText.match(/Nama(?:\s*Wajib\s*Pajak)?\s*[:\s]\s*([^\r\n]+)/i);
        if (mPembeliNama) pembeliNama = mPembeliNama[1].replace(/^[^\w]+/, '').trim();

        const mPembeliNpwp = pembeliText.match(/NPWP(?:\s*\/\s*NIK)?\s*[:\s]\s*([0-9\.\-]+)/i);
        if (mPembeliNpwp) pembeliNpwp = mPembeliNpwp[1].trim();
    }

    // 4. Nilai Finansial
    let dpp = 0;
    let ppn = 0;
    let ppnbm = 0;

    const mDpp = fullText.match(/(?:Dasar\s+Pengenaan\s+Pajak|DPP)\s*[:\s]?\s*(?:Rp\.?)?\s*([0-9\.\,]+)/i);
    if (mDpp) dpp = parseIdrNum(mDpp[1]);

    const mPpn = fullText.match(/(?:Jumlah\s+PPN|Total\s+PPN|Pajak\s+Pertambahan\s+Nilai|PPN\s+11%|PPN)\s*[:\s]?\s*(?:Rp\.?)?\s*([0-9\.\,]+)/i);
    if (mPpn) ppn = parseIdrNum(mPpn[1]);

    const mPpnbm = fullText.match(/(?:Jumlah\s+PPnBM|Total\s+PPnBM|PPnBM)\s*[:\s]?\s*(?:Rp\.?)?\s*([0-9\.\,]+)/i);
    if (mPpnbm) ppnbm = parseIdrNum(mPpnbm[1]);

    // Fallback: Jika DPP belum terbaca, gunakan nilai Harga Jual / Penggantian
    if (dpp === 0) {
        const mHargaJual = fullText.match(/(?:Harga\s+Jual\s*\/?\s*Penggantian)\s*[:\s]?\s*(?:Rp\.?)?\s*([0-9\.\,]+)/i);
        if (mHargaJual) dpp = parseIdrNum(mHargaJual[1]);
    }
    if (ppn === 0 && dpp > 0) {
        ppn = ppnCadangan(dpp); // hanya bila PPN tidak terbaca dari faktur
    }

    // 5. Tanggal Faktur
    let tanggal = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        const parsed = parseIndoDate(lines[i]);
        if (parsed) {
            tanggal = parsed;
            break;
        }
    }
    if (!tanggal) {
        tanggal = new Date().toISOString().split('T')[0];
    }

    // 6. Rincian Barang / Jasa
    const items = [];
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/Nama\s+Barang\s+Kena\s+Pajak|Jasa\s+Kena\s+Pajak/i.test(line)) {
            inTable = true;
            continue;
        }
        if (/Harga\s+Jual\s*\/?\s*Penggantian|Dasar\s+Pengenaan\s+Pajak/i.test(line)) {
            inTable = false;
            break;
        }
        if (inTable) {
            const mItem = line.match(/^(\d+)[\.\s]+(.+?)\s+([0-9\.\,]+)$/);
            if (mItem) {
                const totalItem = parseIdrNum(mItem[3]);
                items.push({
                    nama: mItem[2].trim(),
                    jumlah: 1,
                    harga_satuan: totalItem,
                    total: totalItem,
                    dpp: totalItem,
                    ppn: ppnCadangan(totalItem)
                });
            }
        }
    }

    if (items.length === 0 && dpp > 0) {
        items.push({
            nama: 'Penyerahan BKP / JKP sesuai Faktur ' + (nomorFaktur || ''),
            jumlah: 1,
            harga_satuan: dpp,
            total: dpp,
            dpp: dpp,
            ppn: ppn
        });
    }

    return {
        nomor_faktur: nomorFaktur,
        no_faktur: nomorFaktur,
        tanggal: tanggal,
        npwp: penjualNpwp,
        nama: penjualNama,
        supplier_name: penjualNama,
        nama_pembeli: pembeliNama,
        npwp_pembeli: pembeliNpwp,
        dpp: dpp,
        ppn: ppn,
        ppnbm: ppnbm,
        items: items
    };
};

// Ekstrak data Faktur Pajak dari PDF: membaca teks dokumen + deteksi QR code
const decodeQrFromPdf = async (file, onPreview) => {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
        const totalPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
        let allLines = [];
        let qrText = '';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);

            // 1. Ekstrak teks halaman PDF
            try {
                const lines = await extractLinesFromPage(page);
                allLines = allLines.concat(lines);
            } catch (txtErr) {
                console.warn('Gagal ekstrak teks dari halaman PDF ' + i, txtErr);
            }

            // 2. Render halaman ke canvas untuk preview & pembacaan barcode QR
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(3, MAX_CANVAS_DIM / Math.max(baseViewport.width, baseViewport.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;

            if (i === 1 && onPreview) {
                onPreview(canvas.toDataURL('image/jpeg', 0.6));
            }

            if (!qrText) {
                try {
                    qrText = await decodeQrWithFallback(await canvasToFile(canvas));
                } catch (e) { /* QR belum terdeteksi pada halaman ini */ }
            }
        }

        // 3. Parse isi teks e-Faktur / Coretax
        const parsed = parseFakturTextLines(allLines);

        // Jika berhasil mendapatkan data faktur dari teks dokumen PDF:
        if (parsed && (parsed.nomor_faktur || parsed.dpp > 0 || parsed.nama)) {
            return {
                ...parsed,
                qrUrl: qrText || ''
            };
        }

        // Jika PDF hanya berupa flat image hasil scan tanpa teks layer, gunakan QR text
        if (qrText) {
            return { qrUrl: qrText };
        }

        throw new Error('QR_NOT_FOUND');
    } finally {
        try { await pdf.destroy(); } catch (e) { /* ignore */ }
    }
};

export default function EFakturScannerModal({ isOpen, onClose, onScan, isProcessing }) {
    const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual' | 'upload'
    const [qrUrl, setQrUrl] = useState('');
    const [cameraError, setCameraError] = useState(null);
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    // State mode upload
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const [isDecoding, setIsDecoding] = useState(false);
    const [decodedText, setDecodedText] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const scannerRef = useRef(null);
    const isStoppingRef = useRef(false);

    // Audio feedback saat QR berhasil di-scan
    const playSuccessBeep = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
        } catch (e) {
            // Audio context not allowed or unsupported
        }
    };

    // Fungsi menghentikan scanner kamera secara aman
    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning && !isStoppingRef.current) {
            isStoppingRef.current = true;
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.warn("Gagal menghentikan scanner kamera:", err);
            } finally {
                isStoppingRef.current = false;
                setIsCameraActive(false);
            }
        }
    };

    // Mulai streaming kamera & pendeteksi QR
    const startScanner = async (cameraId = null) => {
        setCameraError(null);
        setIsCameraStarting(true);

        try {
            // Dapatkan daftar kamera jika belum ada
            let availableDevices = cameras;
            if (availableDevices.length === 0) {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    availableDevices = devices;
                    setCameras(devices);
                    if (!cameraId) {
                        // Prioritaskan kamera belakang (environment) jika di mobile/tablet
                        const backCamera = devices.find(d => 
                            d.label.toLowerCase().includes('back') || 
                            d.label.toLowerCase().includes('belakang') ||
                            d.label.toLowerCase().includes('environment')
                        );
                        cameraId = backCamera ? backCamera.id : devices[0].id;
                        setSelectedCameraId(cameraId);
                    }
                } else {
                    throw new Error("Tidak ada kamera yang terdeteksi pada perangkat Anda.");
                }
            }

            const targetCameraId = cameraId || selectedCameraId || availableDevices[0]?.id;

            // Tunggu elemen DOM siap
            const elementId = "efaktur-qr-camera-viewport";
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error("Elemen viewport kamera belum siap.");
            }

            // Hentikan scanner aktif sebelumnya jika ada
            await stopScanner();

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(elementId, {
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    verbose: false
                });
            }

            const config = {
                fps: 15,
                qrbox: { width: 260, height: 260 },
                aspectRatio: 1.0,
            };

            await scannerRef.current.start(
                targetCameraId ? { deviceId: { exact: targetCameraId } } : { facingMode: "environment" },
                config,
                async (decodedText) => {
                    // Berhasil scan QR!
                    playSuccessBeep();
                    await stopScanner();
                    onScan(decodedText);
                },
                () => {
                    // Frame scan loop (bukan error fatal)
                }
            );

            setIsCameraActive(true);
        } catch (err) {
            console.error("Camera scanner error:", err);
            let msg = err.message || "Gagal membuka kamera.";
            if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
                msg = "Izin akses kamera ditolak oleh browser. Mohon izinkan akses kamera di pengaturan browser.";
            } else if (msg.includes("NotFoundError") || msg.includes("No camera")) {
                msg = "Tidak ditemukan kamera aktif pada perangkat ini.";
            } else if (msg.includes("NotReadableError") || msg.includes("in use")) {
                msg = "Kamera sedang digunakan oleh aplikasi lain atau browser tab lain.";
            }
            setCameraError(msg);
        } finally {
            setIsCameraStarting(false);
        }
    };

    // Effect saat modal terbuka / mode berganti
    useEffect(() => {
        if (!isOpen) {
            stopScanner();
            return;
        }

        if (scanMode === 'camera') {
            const timer = setTimeout(() => {
                startScanner(selectedCameraId);
            }, 250);
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        } else {
            stopScanner();
        }
    }, [isOpen, scanMode]);

    // Bersihkan preview object URL agar tidak bocor memori
    useEffect(() => {
        return () => {
            if (uploadPreview && uploadPreview.startsWith('blob:')) URL.revokeObjectURL(uploadPreview);
        };
    }, [uploadPreview]);

    const resetUpload = () => {
        setUploadFile(null);
        setUploadPreview(null);
        setUploadError(null);
        setDecodedText('');
        setIsDecoding(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Reset state upload saat modal ditutup
    useEffect(() => {
        if (!isOpen) resetUpload();
    }, [isOpen]);

    // Proses file yang di-upload: validasi -> decode QR di browser -> onScan
    const handleFileSelected = async (file) => {
        if (!file || isDecoding || isProcessing) return;
        resetUpload();

        if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
            setUploadError('Format file tidak didukung. Gunakan PNG, JPG, WEBP, atau PDF.');
            return;
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            setUploadError('Ukuran file melebihi batas 10 MB.');
            return;
        }

        const isPdf = file.type === 'application/pdf';
        setUploadFile(file);
        if (!isPdf) setUploadPreview(URL.createObjectURL(file));
        setIsDecoding(true);

        try {
            let scanResult;
            if (isPdf) {
                scanResult = await decodeQrFromPdf(file, setUploadPreview);
            } else {
                const qrText = await decodeQrWithFallback(file);
                scanResult = (qrText || '').trim();
            }

            if (!scanResult) throw new Error('QR_NOT_FOUND');

            const isObj = typeof scanResult === 'object' && scanResult !== null;
            let displayLabel = '';
            if (isObj) {
                if (scanResult.nomor_faktur) {
                    displayLabel = `No. Faktur: ${scanResult.nomor_faktur} | Supplier: ${scanResult.nama || '-'} | DPP: ${formatRp(scanResult.dpp || 0)}`;
                } else {
                    displayLabel = scanResult.qrUrl || 'Dokumen Faktur Pajak Berhasil Dibaca';
                }
            } else {
                displayLabel = scanResult;
            }

            setDecodedText(displayLabel);
            playSuccessBeep();
            onScan(scanResult);
        } catch (err) {
            console.warn('Upload QR decode error:', err);
            setUploadError(
                err?.message === 'QR_NOT_FOUND' || /No MultiFormat Readers|NotFoundException/i.test(err?.message || '')
                    ? 'Tidak dapat mendeteksi barcode QR maupun teks Faktur Pajak pada file. Pastikan dokumen jelas dan tidak buram.'
                    : 'Gagal membaca file: ' + (err?.message || 'File rusak atau tidak valid.')
            );
        } finally {
            setIsDecoding(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileSelected(file);
    };

    // Handle close modal
    const handleClose = async () => {
        await stopScanner();
        onClose();
    };

    // Handle submit input manual
    const handleManualSubmit = (e) => {
        e.preventDefault();
        const trimmed = qrUrl.trim();
        if (!trimmed) return;
        onScan(trimmed);
    };

    // Ganti perangkat kamera
    const handleCameraChange = async (newCameraId) => {
        setSelectedCameraId(newCameraId);
        await stopScanner();
        startScanner(newCameraId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Scan QR e-Faktur DJP</h3>
                            <p className="text-xs text-slate-500">Auto-fill form dari barcode faktur pajak</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        disabled={isProcessing}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Tutup Modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Pilihan Mode: Kamera vs Manual */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setScanMode('camera')}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            scanMode === 'camera'
                                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Camera className="w-4 h-4" />
                        <span>Kamera Langsung</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setScanMode('manual')}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            scanMode === 'manual'
                                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Scan className="w-4 h-4" />
                        <span>Scanner Gun / Tempel Link</span>
                    </button>
                    <button
                        type="button"
                        id="efaktur-tab-upload"
                        onClick={() => setScanMode('upload')}
                        disabled={isProcessing || isDecoding}
                        className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            scanMode === 'upload'
                                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Upload className="w-4 h-4" />
                        <span>Upload File</span>
                    </button>
                </div>

                {/* Container tersembunyi yang dibutuhkan html5-qrcode untuk scanFile() */}
                <div id={FILE_READER_ELEMENT_ID} className="hidden" />

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4">
                    {/* MODE 1: SCAN KAMERA */}
                    {scanMode === 'camera' && (
                        <div className="space-y-3">
                            <div className="relative w-full aspect-square max-h-[300px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner">
                                {/* Viewport element untuk html5-qrcode */}
                                <div id="efaktur-qr-camera-viewport" className="w-full h-full" />

                                {/* Loading state */}
                                {isCameraStarting && (
                                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center z-10">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-2" />
                                        <p className="text-sm font-semibold">Mengakses Kamera...</p>
                                        <p className="text-xs text-slate-400 mt-1">Izinkan browser menggunakan kamera Anda</p>
                                    </div>
                                )}

                                {/* Error state */}
                                {cameraError && (
                                    <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center z-20">
                                        <div className="p-3 bg-rose-500/20 text-rose-400 rounded-full mb-2">
                                            <CameraOff className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-bold text-rose-300 mb-1">Kamera Tidak Tersedia</p>
                                        <p className="text-xs text-slate-300 leading-relaxed mb-4 max-w-xs">{cameraError}</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startScanner(selectedCameraId)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                <span>Coba Lagi</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setScanMode('manual')}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                            >
                                                Gunakan Manual
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setScanMode('upload')}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                <span>Upload File</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Overlay Bingkai Scan Target (Aktif saat kamera streaming) */}
                                {isCameraActive && !cameraError && (
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                                        <div className="w-56 h-56 border-2 border-blue-500/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                                            {/* Sudut-sudut target */}
                                            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                                            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                                            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                                            
                                            {/* Garis laser pemindai animasi */}
                                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-[bounce_2s_infinite]" />
                                        </div>
                                    </div>
                                )}

                                {/* Indikator Loading Processing Backend */}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 z-30">
                                        <Loader2 className="w-9 h-9 animate-spin text-blue-400 mb-2" />
                                        <p className="text-sm font-bold">Mengekstrak Data e-Faktur...</p>
                                        <p className="text-xs text-slate-400 mt-1">Mengambil DPP, PPN, dan No. Faktur</p>
                                    </div>
                                )}
                            </div>

                            {/* Pilihan Kamera (Jika perangkat memiliki lebih dari 1 kamera) */}
                            {cameras.length > 1 && (
                                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                                        <Camera className="w-3.5 h-3.5 text-blue-600" /> Pilih Kamera:
                                    </span>
                                    <select
                                        value={selectedCameraId}
                                        onChange={(e) => handleCameraChange(e.target.value)}
                                        disabled={isProcessing}
                                        className="text-xs p-1 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-700 cursor-pointer max-w-[200px] truncate"
                                    >
                                        {cameras.map((c, idx) => (
                                            <option key={c.id} value={c.id}>
                                                {c.label || `Kamera ${idx + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <p className="text-[11px] text-center text-slate-500">
                                Arahkan kamera tepat ke barcode QR e-Faktur fisik. Deteksi akan berjalan otomatis.
                            </p>
                        </div>
                    )}

                    {/* MODE 2: INPUT SCANNER BARCODE GUN / PASTE URL MANUAL */}
                    {scanMode === 'manual' && (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                                <p className="font-semibold mb-1 flex items-center gap-1.5">
                                    <Scan className="w-4 h-4 text-blue-600" /> Barcode Scanner / Manual Link:
                                </p>
                                Tembakkan scanner 2D barcode fisik (scanner gun USB/Bluetooth) ke QR e-Faktur, atau salin-tempel link validasi DJP (URL diawali <code>https://efaktur.pajak.go.id/...</code>) ke kolom di bawah.
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Hasil Scan / URL e-Faktur
                                </label>
                                <textarea
                                    autoFocus
                                    rows={3}
                                    required
                                    disabled={isProcessing}
                                    placeholder="Contoh: https://efaktur.pajak.go.id/v1/faktur/validate?..."
                                    value={qrUrl}
                                    onChange={(e) => setQrUrl(e.target.value)}
                                    className="w-full p-3 text-xs md:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="submit"
                                    disabled={isProcessing || !qrUrl.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Mengekstrak Data...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Scan className="w-4 h-4" />
                                            <span>Ekstrak & Isi Form</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* MODE 3: UPLOAD FILE GAMBAR / PDF (READ-ONLY) */}
                    {scanMode === 'upload' && (
                        <div className="space-y-4">
                            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                                <p className="font-semibold mb-1 flex items-center gap-1.5">
                                    <Upload className="w-4 h-4 text-blue-600" /> Upload Gambar / PDF Faktur:
                                </p>
                                Pilih screenshot/foto QR atau file PDF e-Faktur. File <b>hanya dibaca di browser</b> untuk mengambil QR, tidak diunggah atau disimpan ke server.
                            </div>

                            <input
                                ref={fileInputRef}
                                id="efaktur-upload-input"
                                type="file"
                                accept={ALLOWED_UPLOAD_TYPES.join(',')}
                                className="hidden"
                                onChange={(e) => handleFileSelected(e.target.files?.[0])}
                            />

                            <div
                                role="button"
                                tabIndex={0}
                                id="efaktur-upload-dropzone"
                                onClick={() => !isDecoding && !isProcessing && fileInputRef.current?.click()}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                className={`relative w-full min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer overflow-hidden ${
                                    isDragging
                                        ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                        : uploadError
                                            ? 'border-rose-300 bg-rose-50/40'
                                            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
                                }`}
                            >
                                {uploadPreview ? (
                                    <img src={uploadPreview} alt="Preview file e-Faktur" className="max-h-[200px] max-w-full object-contain rounded-lg shadow-sm" />
                                ) : uploadFile ? (
                                    <div className="flex flex-col items-center text-slate-500">
                                        <FileText className="w-10 h-10 mb-2 text-blue-500" />
                                        <p className="text-xs font-semibold">Memuat dokumen...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-3">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">Klik untuk pilih file atau drag &amp; drop</p>
                                        <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, WEBP, atau PDF — maks. 10 MB</p>
                                    </div>
                                )}

                                {(isDecoding || isProcessing) && (
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 z-10">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-2" />
                                        <p className="text-sm font-bold">{isDecoding ? 'Membaca QR dari file...' : 'Mengekstrak Data e-Faktur...'}</p>
                                        <p className="text-xs text-slate-300 mt-1">{isDecoding ? 'Mendeteksi barcode pada dokumen' : 'Mengambil DPP, PPN, dan No. Faktur'}</p>
                                    </div>
                                )}
                            </div>

                            {uploadFile && (
                                <div className="flex items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <span className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span className="truncate">{uploadFile.name}</span>
                                        <span className="text-slate-400 shrink-0">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => { resetUpload(); fileInputRef.current?.click(); }}
                                        disabled={isDecoding || isProcessing}
                                        className="shrink-0 px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        Pilih File Lain
                                    </button>
                                </div>
                            )}

                            {uploadError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                                    {uploadError}
                                </div>
                            )}

                            {decodedText && !uploadError && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hasil Baca QR</label>
                                    <textarea
                                        readOnly
                                        rows={2}
                                        value={decodedText}
                                        className="w-full p-2.5 text-xs border border-emerald-200 bg-emerald-50/50 rounded-xl outline-none font-mono text-slate-700"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center text-xs text-slate-500">
                    <span className="italic">Data hasil scan hanya mengisi form layar, tidak langsung submit.</span>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>

            </div>
        </div>
    );
}
