import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

/**
 * Reusable QR Code component for invoices, products, etc.
 * @param {string} value - The data to encode in the QR code
 * @param {string} label - Optional label below the QR code
 * @param {number} size - QR code size in pixels (default 128)
 * @param {boolean} showDownload - Show download button
 * @param {string} filename - Download filename
 */
export default function QRCodeGenerator({ value, label, size = 128, showDownload = true, filename = 'qrcode' }) {
  const handleDownload = () => {
    const svg = document.getElementById(`qr-${filename}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = size + 20;
    canvas.height = size + 40;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 10, 10, size, size);
      if (label) {
        ctx.fillStyle = '#334155';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvas.width / 2, size + 25);
      }
      const a = document.createElement('a');
      a.download = `${filename}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-block">
        <QRCodeSVG
          id={`qr-${filename}`}
          value={value}
          size={size}
          bgColor="#ffffff"
          fgColor="#1e293b"
          level="M"
          includeMargin={false}
        />
      </div>
      {label && <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{label}</p>}
      {showDownload && (
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
        >
          <Download size={10} /> Download
        </button>
      )}
    </div>
  );
}
