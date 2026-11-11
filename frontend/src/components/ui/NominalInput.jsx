import React, { useState } from 'react';
import { formatRupiah, parseNominal } from '../../utils/money';

/**
 * Input nominal uang. Menerima ketikan/tempelan "720.720,00", "720720.00", atau "720720"
 * dan mengirim ANGKA (720720) ke onChange. Saat tidak fokus, ditampilkan "720.720,00".
 * Nilai yang disimpan/dikirim ke API tetap angka biasa, bukan string berformat.
 */
export default function NominalInput({ value, onChange, className = '', placeholder, required, disabled, title }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const isEmpty = value === '' || value === null || value === undefined;

    const shown = editing ? text : (isEmpty ? '' : formatRupiah(value));

    return (
        <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={className}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            title={title}
            value={shown}
            onFocus={() => { setEditing(true); setText(isEmpty ? '' : formatRupiah(value)); }}
            onBlur={() => setEditing(false)}
            onChange={(e) => {
                const raw = e.target.value;
                setText(raw);
                if (raw.trim() === '') { onChange(''); return; }
                const n = parseNominal(raw);
                if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
        />
    );
}
