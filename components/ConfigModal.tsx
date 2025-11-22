import React from 'react';
import { X, Settings, Database, ShieldCheck } from 'lucide-react';
import { SUPABASE_URL } from '../constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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

                  <div className="text-xs text-slate-500">
                      As chaves de API foram configuradas hardcoded no código para simplificar o uso. Seus dados estão sendo salvos na tabela <code>daily_logs</code>.
                  </div>
              </div>
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