import { useState, useEffect } from 'react';
import { X, Printer, CheckSquare, Square } from 'lucide-react';
import QRCode from 'qrcode';

export default function PrintLabelModal({ books = [], onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(books.map(b => b.id)));
  const [qrMap, setQrMap] = useState({});

  useEffect(() => {
    // Generate QR data URLs for all books
    let active = true;
    async function genAll() {
      const map = {};
      for (const b of books) {
        try {
          const payload = JSON.stringify({
            id: b.id,
            title: b.title,
            isbn: b.isbn || b.barcode || b.id,
            libraryId: b.libraryId || `LIB-${b.id?.slice(0, 6)}`,
          });
          map[b.id] = await QRCode.toDataURL(payload, { width: 90, margin: 1 });
        } catch {}
      }
      if (active) setQrMap(map);
    }
    genAll();
    return () => { active = false; };
  }, [books]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(books.map(b => b.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const selectedBooks = books.filter(b => selectedIds.has(b.id));

  const handlePrint = () => {
    if (selectedBooks.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = selectedBooks.map(b => {
      const qr = qrMap[b.id] || '';
      const libId = b.libraryId || (b.isbn ? `LIB-${b.isbn}` : `LIB-${b.id.slice(0, 6)}`);
      return `
        <div class="label-box">
          <div class="header">LibraryOS · School Library</div>
          <div class="title">${b.title || 'Untitled'}</div>
          <div class="author">${b.author || 'Unknown'}</div>
          <div class="code-area">
            ${qr ? `<img src="${qr}" class="qr-img" />` : ''}
            <div class="meta-col">
              <div class="lib-id">${libId}</div>
              <div class="sub-meta">ISBN: ${b.isbn || '—'}</div>
              <div class="sub-meta">Cat: ${b.category || 'General'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Print Book Labels - LibraryOS</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8mm;
    }
    .label-box {
      border: 1.5px dashed #444;
      border-radius: 6px;
      padding: 10px 14px;
      page-break-inside: avoid;
      box-sizing: border-box;
      height: 48mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #555;
      border-bottom: 1px solid #eee;
      padding-bottom: 2px;
    }
    .title {
      font-size: 13px;
      font-weight: bold;
      line-height: 1.2;
      margin: 3px 0 1px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .author {
      font-size: 11px;
      color: #444;
      margin-bottom: 4px;
    }
    .code-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qr-img {
      width: 48px;
      height: 48px;
    }
    .meta-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lib-id {
      font-family: monospace;
      font-weight: bold;
      font-size: 11px;
    }
    .sub-meta {
      font-size: 10px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2330]">
          <div>
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <Printer size={16} className="text-[#f5a623]" /> Print Book Labels
            </h2>
            <p className="text-[#6b7280] text-xs mt-0.5">Select books to print formatted A4 adhesive/catalog labels</p>
          </div>
          <button onClick={onClose} className="text-[#6b7280] hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0b0f1a] border-b border-[#1e2330] text-xs">
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="text-[#f5a623] hover:underline font-medium">Select All</button>
            <span className="text-[#374151]">|</span>
            <button onClick={deselectAll} className="text-[#9ca3af] hover:underline font-medium">Deselect All</button>
          </div>
          <span className="text-[#6b7280]">
            <span className="text-white font-semibold">{selectedBooks.length}</span> of {books.length} selected
          </span>
        </div>

        {/* Books List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {books.map(b => {
            const isChecked = selectedIds.has(b.id);
            return (
              <div
                key={b.id}
                onClick={() => toggleSelect(b.id)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-[#1a2035] border-[#f5a623]/40'
                    : 'bg-[#10141e] border-[#1e2330] hover:bg-[#151926]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 mr-2">
                  <button type="button" className="text-[#f5a623] shrink-0">
                    {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-[#4b5563]" />}
                  </button>
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{b.title}</div>
                    <div className="text-[#6b7280] text-xs">
                      {b.author} · ISBN: <span className="font-mono text-[#9ca3af]">{b.isbn || '—'}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#f5a623] bg-[#0b0f1a] px-2 py-0.5 rounded border border-[#1e2330] shrink-0">
                  {b.libraryId || `LIB-${b.id.slice(0, 6)}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2330]">
          <span className="text-xs text-[#6b7280]">Layout: A4 Printable Grid (2 columns)</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#374151] text-[#d1d5db] text-xs rounded-lg hover:bg-[#1e2330] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={selectedBooks.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#f5a623] text-black text-xs font-bold rounded-lg hover:bg-[#e09515] transition-colors disabled:opacity-50"
            >
              <Printer size={13} /> Print {selectedBooks.length} Label{selectedBooks.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
