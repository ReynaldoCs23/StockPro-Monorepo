import React from 'react';

const ReportPrintTemplate = ({ title, type, columns, data, dateRange }) => {
  // Compute Grand Total dynamically if type is transaction
  const grandTotal = type === 'transaction' 
    ? data.reduce((sum, item) => sum + (Number(item.totalTransaksi) || Number(item.total_nilai) || Number(item.total_jumlah) || (Number(item.qty) * Number(item.harga)) || 0), 0)
    : 0;

  return (
    <div className="hidden print:block w-full bg-white text-black p-0 m-0 print-safe-wrapper">
      {/* Company Header */}
      <div className="text-center mb-6 border-b-4 border-double border-black pb-2">
        <h1 className="font-bold text-2xl tracking-wide text-gray-900">PT MARA JAYA DEWI SAKTI</h1>
        <p className="text-xs text-gray-600 mt-1">Sistem Manajemen Inventaris - StockPro</p>
        <h2 className="font-semibold text-lg uppercase mt-4 text-gray-800">{title}</h2>
        {dateRange && <p className="text-xs font-medium">Periode: {dateRange}</p>}
        <p className="text-[10px] text-gray-500 mt-1">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
      </div>

      {/* Data Table */}
      <table className="w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-gray-100 print:bg-gray-100">
            {columns.filter(col => (col.header || col.label) !== 'Aksi').map((col, idx) => (
              <th key={idx} className="border border-black px-3 py-2 text-left font-bold">{col.header || col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="page-break-inside-avoid print:break-inside-avoid">
              {columns.filter(col => (col.header || col.label) !== 'Aksi').map((col, colIdx) => {
                  let cellValue = row[col.accessor || col.key];
                  if (col.render) cellValue = col.render(row);
                  else if (col.exportFormat) cellValue = col.exportFormat(cellValue, row);
                  else if (col.format) cellValue = col.format(cellValue, row);

                  return (
                    <td key={colIdx} className="border border-black px-3 py-2">
                      {cellValue}
                    </td>
                  );
              })}
            </tr>
          ))}
        </tbody>
        {/* Aggregation Footer for Financial Reports */}
        {type === 'transaction' && grandTotal > 0 && (
          <tfoot className="print-summary-group print:break-inside-avoid">
            <tr className="font-bold bg-gray-50">
              <td colSpan={columns.filter(col => (col.header || col.label) !== 'Aksi').length - 1} className="border border-black px-3 py-2 text-right">GRAND TOTAL:</td>
              <td className="border border-black px-3 py-2 text-left font-extrabold text-sm">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(grandTotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default ReportPrintTemplate;
