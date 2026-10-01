import { useState } from 'react';
import { generateApplicationBackup, validateBackupFile, restoreApplicationBackup } from '../services/backup';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Download, Upload, Shield, AlertTriangle,
  CheckCircle2, FileText, RefreshCw, HardDrive,
} from 'lucide-react';

export default function BackupRestore() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [validationInfo, setValidationInfo] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const backupData = await generateApplicationBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const filename = `libraryos_backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success('Backup exported successfully.');
    } catch {
      toast.error('Failed to generate backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const val = validateBackupFile(json);
        if (val.valid) {
          setParsedBackup(json);
          setValidationInfo(val);
        } else {
          toast.error(val.message || 'Invalid backup file structure.');
          setParsedBackup(null);
          setValidationInfo(null);
        }
      } catch {
        toast.error('The selected file is not a valid JSON file.');
        setParsedBackup(null);
        setValidationInfo(null);
      }
    };
    reader.readAsText(file);
  };

  const executeRestore = async () => {
    if (!parsedBackup) return;
    setImporting(true);
    setConfirmModal(false);

    try {
      const res = await restoreApplicationBackup(parsedBackup);
      toast.success(`Restore complete! ${res.totalRestored} records restored.`);
      setSelectedFile(null);
      setParsedBackup(null);
      setValidationInfo(null);
    } catch (err) {
      toast.error(err.message || 'Failed to restore backup.');
    } finally {
      setImporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center min-h-screen bg-[#0f1117] flex flex-col items-center justify-center">
        <Shield size={36} className="text-[#ef4444] mb-3" />
        <h2 className="text-white text-lg font-bold">Access Restricted</h2>
        <p className="text-[#6b7280] text-sm mt-1 max-w-sm">
          System backup and restore requires Administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117] space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold">Backup & Restore</h1>
        <p className="text-[#6b7280] text-sm mt-0.5">Safely export and restore LibraryOS database records</p>
      </div>

      {/* Security Notice */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-4 flex items-start gap-3">
        <Shield size={20} className="text-[#10b981] shrink-0 mt-0.5" />
        <div className="text-xs text-[#9ca3af] space-y-1">
          <div className="text-white font-semibold">Security & Privacy Assurance</div>
          <div>
            All exported backups contain sanitized catalog, member, circulation, and setting records only.
            Passwords, auth tokens, private API keys, and service account credentials are <strong>never</strong> included in backups.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EXPORT CARD */}
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-[#10b981]">
              <Download size={20} />
            </div>
            <h2 className="text-white text-base font-bold">Export Database Backup</h2>
            <p className="text-[#6b7280] text-xs leading-relaxed">
              Generates a timestamped JSON snapshot containing all books, registered students, active and returned loans, configuration settings, and activity logs.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#f5a623] text-black font-bold text-xs rounded-lg hover:bg-[#e09515] transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Compiling Backup…
                </>
              ) : (
                <>
                  <Download size={14} /> Download JSON Backup
                </>
              )}
            </button>
          </div>
        </div>

        {/* IMPORT CARD */}
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-950/40 border border-blue-800/40 flex items-center justify-center text-[#60a5fa]">
              <Upload size={20} />
            </div>
            <h2 className="text-white text-base font-bold">Restore From Backup</h2>
            <p className="text-[#6b7280] text-xs leading-relaxed">
              Upload a previously exported LibraryOS JSON file. Records are validated and safely merged without deleting existing data unless updated.
            </p>

            <div className="pt-2">
              <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1.5">
                Select Backup File (.json)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="w-full text-xs text-[#9ca3af] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1e2330] file:text-white hover:file:bg-[#283042] cursor-pointer"
              />
            </div>

            {/* Validation inspection preview */}
            {validationInfo && (
              <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-lg p-3 text-xs space-y-2 mt-3">
                <div className="flex items-center gap-1.5 text-[#10b981] font-semibold">
                  <CheckCircle2 size={14} /> Backup File Verified
                </div>
                <div className="grid grid-cols-2 gap-2 text-[#9ca3af]">
                  <div>Date: <span className="text-white">{validationInfo.createdAt?.slice(0, 10)}</span></div>
                  <div>Format: <span className="text-white">v{validationInfo.version}</span></div>
                </div>
                <div className="text-[#6b7280] pt-1 border-t border-[#1e2330]">
                  Records found: {Object.entries(validationInfo.counts).map(([k, v]) => `${v} ${k}`).join(', ')}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
              onClick={() => setConfirmModal(true)}
              disabled={!parsedBackup || importing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#10b981] text-black font-bold text-xs rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-40"
            >
              {importing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Restoring Records…
                </>
              ) : (
                <>
                  <Upload size={14} /> Review & Restore
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-[#f5a623] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Confirm Database Restore</h3>
                <p className="text-xs text-[#6b7280]">Please verify before proceeding</p>
              </div>
            </div>

            <p className="text-xs text-[#d1d5db] leading-relaxed">
              You are about to restore <strong className="text-white">{selectedFile?.name}</strong>. Existing records with matching IDs will be updated.
            </p>

            <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-lg p-3 text-xs space-y-1">
              {Object.entries(validationInfo?.counts || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[#9ca3af]">
                  <span className="capitalize">{k}:</span>
                  <span className="text-white font-semibold">{v} records</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="flex-1 py-2 text-xs border border-[#374151] text-[#d1d5db] rounded-lg hover:bg-[#1e2330] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeRestore}
                className="flex-1 py-2 text-xs font-bold bg-[#f5a623] text-black rounded-lg hover:bg-[#e09515] transition-colors"
              >
                Yes, Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
