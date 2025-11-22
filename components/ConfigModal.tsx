import React, { useState } from 'react';
import { X, Settings, Save } from 'lucide-react';
import { GOOGLE_SCRIPT_URL } from '../constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Configurações
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Google Sheets Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Integração</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                URL do Web App (Google Apps Script)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={GOOGLE_SCRIPT_URL}
                  readOnly
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-400 cursor-not-allowed text-sm font-mono"
                />
                <div className="absolute right-3 top-3 text-emerald-500 text-xs font-bold">
                    CONECTADO
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                  O link da planilha já está configurado internamente no sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end shrink-0 bg-slate-800 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
             Fechar
          </button>
        </div>
      </div>
    </div>
  );
};