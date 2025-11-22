import React, { useState } from 'react';
import { X, Settings, Database, ShieldCheck, Trash2, AlertTriangle, Loader2, AlertCircle } from 'lucide-react';
import { SUPABASE_URL } from '../constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetAll: () => Promise<void>;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, onResetAll }) => {
  const [isReseting, setIsReseting] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1>(0); // 0: Idle, 1: Confirmed once

  if (!isOpen) return null;

  const handleFullReset = async () => {
    if (resetStep === 0) {
      setResetStep(1);
      return;
    }

    // Execute reset
    setIsReseting(true);
    await onResetAll();
    setIsReseting(false);
    setResetStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-slate-700 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Configurações
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Backend Info */}
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Backend Supabase
              </h3>
              
              <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                      <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      <div>
                          <p className="text-emerald-400 font-bold text-sm">Conexão Ativa</p>
                          <p className="text-slate-400 text-xs">Utilizando banco de dados PostgreSQL</p>
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Project URL</label>
                      <input 
                          readOnly 
                          value={SUPABASE_URL} 
                          className="w-full bg-black/30 border border-slate-700 rounded px-3 py-2 text-slate-300 text-xs font-mono"
                      />
                  </div>
              </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-900/10 rounded-lg border border-red-900/30 p-4">
              <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Zona de Perigo
              </h3>
              
              <p className="text-slate-400 text-sm mb-4">
                Ações irreversíveis que afetam todo o seu histórico de dados.
              </p>

              {resetStep === 1 && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-200 text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>Tem certeza absoluta? Isso apagará permanentemente todo o seu progresso de todos os dias. Esta ação não pode ser desfeita.</p>
                </div>
              )}

              <button 
                onClick={handleFullReset}
                disabled={isReseting}
                className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 transition-colors font-semibold border ${
                  resetStep === 1 
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-500' 
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20'
                }`}
              >
                {isReseting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                {isReseting ? 'Apagando...' : resetStep === 1 ? 'CONFIRMAR EXCLUSÃO TOTAL' : 'Apagar Todo o Histórico'}
              </button>
              
              {resetStep === 1 && (
                <button 
                  onClick={() => setResetStep(0)}
                  className="w-full mt-2 text-slate-400 text-sm hover:text-white p-2"
                >
                  Cancelar
                </button>
              )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end bg-slate-800 rounded-b-xl">
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
             Fechar
          </button>
        </div>
      </div>
    </div>
  );
};