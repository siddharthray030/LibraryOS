import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Download, Printer, QrCode as QrIcon, Barcode as BarcodeIcon } from 'lucide-react';

export default function BarcodeQRGenerator({ book, showDownload = true, showPrint = true }) {
  const barcodeRef = useRef(null);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState(null);

  const identifier = (book?.barcode || book?.isbn || book?.libraryId || book?.id || 'LIB-000000').trim();

  useEffect(() => {
    if (!book) return;
    setError(null);

    // Generate Barcode
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, identifier, {
          format: 'CODE128',
          lineColor: '#ffffff',
          width: 1.6,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          textMargin: 4,
          background: 'transparent',
        });
      } catch (err) {
        // Fallback with clean numeric/alphanumeric
        try {
          JsBarcode(barcodeRef.current, identifier.replace(/[^a-zA-Z0-9]/g, '') || '000000', {
            format: 'CODE128',
            lineColor: '#ffffff',
            width: 1.6,
            height: 48,
            displayValue: true,
            background: 'transparent',
          });
        } catch {
          setError('Invalid barcode characters');
        }
      }
    }

    // Generate QR Code data URL
    const qrPayload = JSON.stringify({
      id: book.id,
      title: book.title,
      isbn: book.isbn || identifier,
      libraryId: book.libraryId || `LIB-${book.id?.slice(0, 6)}`,
    });

    QRCode.toDataURL(qrPayload, {
      width: 160,
      margin: 1,
      color: {
        dark: '#ffffff',
        light: '#131720',
      },
    }).then(setQrUrl).catch(() => setError('Failed to generate QR code'));
  }, [book, identifier]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const barcodeSvgHtml = barcodeRef.current ? barcodeRef.current.outerHTML : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Book Label - ${book?.title || 'Book'}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .label-card {
      width: 320px;
      border: 2px dashed #000;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
    }
    .lib-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #333;
      margin-bottom: 4px;
    }
    .book-title {
      font-size: 15px;
      font-weight: bold;
      color: #000;
      margin: 4px 0 2px 0;
      line-height: 1.2;
    }
    .book-author {
      font-size: 12px;
      color: #555;
      margin-bottom: 12px;
    }
    .codes-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin: 10px 0;
    }
    .qr-img {
      width: 72px;
      height: 72px;
    }
    .barcode-svg {
      max-width: 190px;
      height: 52px;
    }
    .barcode-svg rect { fill: #fff !important; }
    .barcode-svg text, .barcode-svg path { fill: #000 !important; stroke: #000 !important; }
    .footer-id {
      font-size: 11px;
      font-family: monospace;
      font-weight: bold;
      color: #222;
      margin-top: 8px;
      border-top: 1px solid #ddd;
      padding-top: 6px;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="label-card">
    <div class="lib-header">LibraryOS — Property of School Library</div>
    <div class="book-title">${book?.title || 'Unknown Title'}</div>
    <div class="book-author">${book?.author || 'Unknown Author'}</div>
    <div class="codes-row">
      ${qrUrl ? `<img src="${qrUrl}" class="qr-img" alt="QR Code" />` : ''}
      <div>${barcodeSvgHtml}</div>
    </div>
    <div class="footer-id">ID: ${book?.libraryId || identifier} · Cat: ${book?.category || 'General'}</div>
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${(book?.title || 'book').replace(/[^a-zA-Z0-9]/g, '_')}_qr.png`;
    a.click();
  };

  return (
    <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-xl p-4 text-center">
      <div className="text-xs uppercase tracking-widest text-[#6b7280] font-semibold mb-3 flex items-center justify-center gap-2">
        <BarcodeIcon size={14} className="text-[#f5a623]" /> Barcode & QR Label
      </div>

      {error ? (
        <p className="text-xs text-[#ef4444] py-4">{error}</p>
      ) : (
        <div className="flex flex-col items-center gap-3 my-2">
          {/* Barcode Display */}
          <div className="bg-[#131720] border border-[#1e2330] rounded-lg p-3 w-full flex justify-center overflow-hidden">
            <svg ref={barcodeRef} className="max-w-full" />
          </div>

          {/* QR Code Display */}
          {qrUrl && (
            <div className="flex items-center gap-4 bg-[#131720] border border-[#1e2330] rounded-lg p-3 w-full justify-center">
              <img src={qrUrl} alt="Book QR Code" className="w-20 h-20 rounded bg-white p-1" />
              <div className="text-left text-xs space-y-1">
                <div className="text-white font-medium truncate max-w-[170px]">{book?.title}</div>
                <div className="text-[#6b7280]">ID: <span className="text-[#f5a623] font-mono">{book?.libraryId || identifier}</span></div>
                <div className="text-[#6b7280]">ISBN: <span className="text-[#9ca3af] font-mono">{book?.isbn || '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-[#1e2330]">
        {showPrint && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f5a623] text-black rounded-lg hover:bg-[#e09515] transition-colors"
          >
            <Printer size={13} /> Print Label
          </button>
        )}
        {showDownload && qrUrl && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#d1d5db] border border-[#1e2330] rounded-lg hover:bg-[#131720] transition-colors"
          >
            <Download size={13} /> QR Image
          </button>
        )}
      </div>
    </div>
  );
}
