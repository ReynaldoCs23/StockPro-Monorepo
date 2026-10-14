import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { QrCode, Scan, X, Loader2, Camera, CameraOff, RefreshCw } from '../icons/Icons';

export default function EFakturScannerModal({ isOpen, onClose, onScan, isProcessing }) {
    const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
    const [qrUrl, setQrUrl] = useState('');
    const [cameraError, setCameraError] = useState(null);
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

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
                </div>

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
