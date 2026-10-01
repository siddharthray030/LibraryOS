import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { findBookByCode } from '../../services/firestore';
import {
  Camera, Keyboard, X, Search, CheckCircle2, AlertTriangle,
  ArrowRight, BookOpen, RefreshCw, Barcode as BarcodeIcon,
} from 'lucide-react';

export default function BookScannerModal({ isOpen, onClose, onSelectBook, onIssueBook, onReturnBook }) {
  const [tab, setTab] = useState('camera'); // 'camera' | 'manual'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundBook, setFoundBook] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const scannerRef = useRef(null);
  const readerElementId = 'html5-qrcode-reader';

  // Stop camera on unmount or tab switch
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setFoundBook(null);
      setSearchError(null);
      setManualCode('');
      setCameraError(null);
    }
  }, [isOpen]);

  const handleBookCodeFound = async (rawCode) => {
    if (!rawCode) return;
    let cleanCode = String(rawCode).trim();

    // If QR payload is JSON string, parse it
    try {
      if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
        const parsed = JSON.parse(cleanCode);
        cleanCode = parsed.isbn || parsed.barcode || parsed.libraryId || parsed.id || cleanCode;
      }
    } catch {}

    setSearching(true);
    setSearchError(null);

    try {
      const book = await findBookByCode(cleanCode);
      if (book) {
        setFoundBook(book);
        // Play subtle success feedback sound or pause camera
        if (scannerRef.current && scannerRef.current.isScanning) {
          await scannerRef.current.pause(true);
        }
      } else {
        setSearchError(`No book found matching code: "${cleanCode}". Try checking the ISBN or Barcode.`);
      }
    } catch (err) {
      setSearchError('Error searching book database.');
    } finally {
      setSearching(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setFoundBook(null);
    setSearchError(null);

    try {
      // Check if camera is available
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError('No camera devices detected on this device. Use manual entry below.');
        setTab('manual');
        return;
      }

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 180 },
        aspectRatio: 1.333334,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBookCodeFound(decodedText);
        },
        () => {
          // ignore scan frame misses
        }
      );

      setCameraActive(true);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError('Camera permission was denied. Please allow camera access in your browser or use manual entry.');
      } else {
        setCameraError('Unable to start camera scanner. Switched to manual barcode entry.');
      }
      setTab('manual');
      setCameraActive(false);
    }
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (!manualCode.trim()) return;
    handleBookCodeFound(manualCode);
  };

  const handleScanAnother = async () => {
    setFoundBook(null);
    setSearchError(null);
    setManualCode('');
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch {
        startCamera();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2330]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/30 flex items-center justify-center text-[#f5a623]">
              <BarcodeIcon size={17} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Scan / Search Book</h2>
              <p className="text-[#6b7280] text-xs">Barcode, QR Code, or ISBN lookup</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b7280] hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#1e2330] bg-[#0b0f1a]">
          <button
            onClick={() => { setTab('camera'); stopCamera(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'camera' ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a623]/5' : 'border-transparent text-[#6b7280] hover:text-[#d1d5db]'
            }`}
          >
            <Camera size={14} /> Camera Scanner
          </button>
          <button
            onClick={() => { setTab('manual'); stopCamera(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'manual' ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a623]/5' : 'border-transparent text-[#6b7280] hover:text-[#d1d5db]'
            }`}
          >
            <Keyboard size={14} /> Manual Code Entry
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* CAMERA TAB */}
          {tab === 'camera' && (
            <div className="space-y-4">
              {!cameraActive && !foundBook && (
                <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#1e2330] flex items-center justify-center mx-auto text-[#f5a623]">
                    <Camera size={24} />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold">Ready to Scan</h3>
                    <p className="text-[#6b7280] text-xs mt-1 max-w-xs mx-auto">
                      Click below to request camera permission and point at any book barcode or QR code.
                    </p>
                  </div>
                  {cameraError && (
                    <div className="bg-red-950/40 border border-red-800/40 text-[#ef4444] text-xs p-2.5 rounded-lg flex items-center gap-2 text-left">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}
                  <button
                    onClick={startCamera}
                    className="px-5 py-2.5 bg-[#f5a623] text-black font-bold text-xs rounded-lg hover:bg-[#e09515] transition-colors"
                  >
                    Start Camera Scanning
                  </button>
                </div>
              )}

              {/* Viewport container */}
              <div
                id={readerElementId}
                className={`w-full overflow-hidden rounded-xl border border-[#1e2330] bg-black ${!cameraActive || foundBook ? 'hidden' : 'block'}`}
                style={{ minHeight: '220px' }}
              />

              {cameraActive && !foundBook && (
                <div className="flex items-center justify-between text-xs text-[#6b7280]">
                  <span className="flex items-center gap-1.5 text-[#10b981]">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" /> Camera Active
                  </span>
                  <button onClick={stopCamera} className="text-[#ef4444] hover:underline">
                    Stop Camera
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MANUAL TAB */}
          {tab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold">
                Enter Barcode, ISBN, or Library ID
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5563]" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="e.g. 9780132350884, LIB-235088..."
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-white text-sm pl-10 pr-24 py-2.5 rounded-xl outline-none focus:border-[#f5a623] font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searching || !manualCode.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#f5a623] text-black text-xs font-bold rounded-lg hover:bg-[#e09515] disabled:opacity-50 transition-colors"
                >
                  {searching ? 'Finding…' : 'Find'}
                </button>
              </div>
            </form>
          )}

          {/* Loading feedback */}
          {searching && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#f5a623]">
              <RefreshCw size={14} className="animate-spin" /> Looking up book in catalogue...
            </div>
          )}

          {/* Search error feedback */}
          {searchError && !searching && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3.5 text-xs text-[#ef4444] flex items-start gap-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <div>{searchError}</div>
                <button
                  onClick={handleScanAnother}
                  className="mt-2 text-[#d1d5db] underline hover:text-white"
                >
                  Try another code
                </button>
              </div>
            </div>
          )}

          {/* Book Found Card */}
          {foundBook && (
            <div className="bg-[#0b0f1a] border border-[#10b981]/40 rounded-xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-[#10b981] shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Book Found</span>
                    <h3 className="text-white text-base font-bold leading-tight">{foundBook.title}</h3>
                    <p className="text-[#6b7280] text-xs mt-0.5">{foundBook.author} · {foundBook.category || 'General'}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#f5a623] bg-[#131720] border border-[#1e2330] px-2 py-0.5 rounded shrink-0">
                  {foundBook.libraryId || `LIB-${foundBook.id?.slice(0, 6)}`}
                </span>
              </div>

              {/* Inventory summary */}
              <div className="grid grid-cols-2 gap-2 bg-[#131720] border border-[#1e2330] rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[#6b7280]">Available Copies:</span>
                  <div className="text-sm font-bold mt-0.5 text-white">
                    <span className={(foundBook.availableQuantity ?? foundBook.available ?? 0) > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                      {foundBook.availableQuantity ?? foundBook.available ?? 0}
                    </span>
                    <span className="text-[#6b7280] font-normal"> / {foundBook.totalQuantity ?? foundBook.copies ?? 0}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#6b7280]">ISBN / Barcode:</span>
                  <div className="text-xs font-mono text-[#9ca3af] mt-0.5 truncate">
                    {foundBook.isbn || foundBook.barcode || '—'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(foundBook.availableQuantity ?? foundBook.available ?? 0) > 0 ? (
                  <button
                    onClick={() => {
                      onClose();
                      onIssueBook ? onIssueBook(foundBook) : onSelectBook?.(foundBook);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#f5a623] text-black text-xs font-bold rounded-lg hover:bg-[#e09515] transition-colors"
                  >
                    Issue This Book <ArrowRight size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onClose();
                      onReturnBook ? onReturnBook(foundBook) : onSelectBook?.(foundBook);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#10b981] text-black text-xs font-bold rounded-lg hover:bg-[#059669] transition-colors"
                  >
                    Return This Book <ArrowRight size={13} />
                  </button>
                )}

                <button
                  onClick={() => {
                    onClose();
                    onSelectBook?.(foundBook);
                  }}
                  className="px-3 py-2 border border-[#374151] text-[#d1d5db] text-xs font-medium rounded-lg hover:bg-[#131720] transition-colors"
                >
                  View Details
                </button>

                <button
                  onClick={handleScanAnother}
                  className="px-3 py-2 text-[#9ca3af] text-xs hover:text-white transition-colors"
                >
                  Scan Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
