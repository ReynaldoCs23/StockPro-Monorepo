import { useEffect, useState } from 'react';
import { apiCall } from './api';

/**
 * Pratinjau nominal transaksi (subtotal, DPP, PPN, total) yang DIHITUNG BACKEND
 * (POST /transactions/hitung-nominal, aturan sama persis dengan saat transaksi disimpan).
 * Frontend tidak menghitung nominal sendiri.
 *
 * @param {object} p { jenis, isMakloon, items: [{qty, harga}], potongan, uangMuka, ppnbm, pajakPersen, enabled }
 * @returns {{ nominal: object|null, loading: boolean, error: boolean }}
 */
export default function useNominalPreview({ jenis, isMakloon = false, items = [], potongan = 0, uangMuka = 0, ppnbm = 0, pajakPersen = 0, enabled = true }) {
    const [state, setState] = useState({ nominal: null, loading: false, error: false });
    const body = JSON.stringify({
        jenis,
        is_makloon: !!isMakloon,
        items: items.map((it) => ({ qty: Number(it.qty) || 0, harga: Number(it.harga) || 0 })),
        potongan_harga: Number(potongan) || 0,
        uang_muka: Number(uangMuka) || 0,
        ppnbm: Number(ppnbm) || 0,
        pajak_persen: Number(pajakPersen) || 0,
    });

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        setState((s) => ({ ...s, loading: true, error: false }));
        const timer = setTimeout(async () => {
            try {
                const res = await apiCall('/transactions/hitung-nominal', 'POST', JSON.parse(body));
                const ok = res && res.total !== undefined;
                if (!cancelled) setState({ nominal: ok ? res : null, loading: false, error: !ok });
            } catch {
                if (!cancelled) setState({ nominal: null, loading: false, error: true });
            }
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [body, enabled]);

    return state;
}
