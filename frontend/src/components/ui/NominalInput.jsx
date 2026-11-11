import React, { useLayoutEffect, useRef, useState } from 'react';
import { formatRupiah, formatNominalInput, parseNominal } from '../../utils/money';

/**
 * Input nominal uang. Selalu tampil terformat seperti faktur ("720.720,00"), termasuk SAAT MENGETIK.
 * Menerima ketikan dan tempelan "720.720,00", "720720.00", atau "720720", lalu mengirim ANGKA (720720)
 * ke onChange. Nilai yang disimpan/dikirim ke API tetap angka biasa, bukan string berformat.
 */
export default function NominalInput({ value, onChange, className = '', placeholder, required, disabled, title }) {
    const inputRef = useRef(null);
    const caretRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const isEmpty = value === '' || value === null || value === undefined;

    const shown = editing ? text : (isEmpty ? '' : formatRupiah(value));

    // Kembalikan posisi kursor setelah teks diformat ulang
    useLayoutEffect(() => {
        if (caretRef.current !== null && inputRef.current && document.activeElement === inputRef.current) {
            inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
            caretRef.current = null;
        }
    });

    const apply = (next) => {
        setText(next.text);
        caretRef.current = next.caret;
        onChange(next.value);
    };

    return (
        <input
            ref={inputRef}
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
            onChange={(e) => apply(formatNominalInput(e.target.value, e.target.selectionStart ?? e.target.value.length, text))}
            onPaste={(e) => {
                // Tempelan bisa berformat apa saja ("720.720,00", "720720.00", "Rp 1.588.799")
                const n = parseNominal(e.clipboardData.getData('text'));
                if (!Number.isFinite(n) || n < 0) return;
                e.preventDefault();
                const formatted = formatRupiah(n);
                apply({ text: formatted, caret: formatted.indexOf(','), value: n });
            }}
        />
    );
}
