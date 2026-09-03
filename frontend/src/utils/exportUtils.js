import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Export data to PDF with branding
 */
export function exportToPDF({ title, subtitle, headers, rows, filename }) {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241);
  doc.text('MarketMind AI', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Sales Intelligence Platform', 14, 21);

  // Title
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, 35);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 42);
  }

  // Date
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 48);

  // Table
  autoTable(doc, {
    startY: 52,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} — MarketMind AI`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`${filename || title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/**
 * Export data to Excel
 */
export function exportToExcel({ title, headers, rows, filename, sheetName }) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-width columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || title || 'Data');

  XLSX.writeFile(wb, `${filename || title.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}

/**
 * Quick export helper for common page data
 */
export function quickExport({ format, title, subtitle, headers, rows, filename }) {
  if (format === 'pdf') {
    exportToPDF({ title, subtitle, headers, rows, filename });
  } else {
    exportToExcel({ title, headers, rows, filename });
  }
}
