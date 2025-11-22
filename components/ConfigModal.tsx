import React, { useState } from 'react';
import { X, Settings, CheckCircle, AlertTriangle, Activity, Terminal, FileJson } from 'lucide-react';
import { GOOGLE_SCRIPT_URL } from '../constants';
import { diagnoseSheetConnection } from '../services/storageService';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsLoading(true);
    setDiagnosis(null);
    const result = await diagnoseSheetConnection(GOOGLE_SCRIPT_URL);
    setDiagnosis(result);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-xl w-full max-w-3xl border border-slate-700 shadow-2xl flex flex-col my-8 max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Configurações
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Google Sheets Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Integração Google Sheets</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                URL do Web App
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={GOOGLE_SCRIPT_URL}
                  readOnly
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-400 cursor-not-allowed text-sm font-mono truncate"
                />
                <div className="absolute right-3 top-3 text-emerald-500 text-xs font-bold">
                    CONECTADO
                </div>
              </div>
            </div>

            {/* Diagnostic Area */}
            <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Diagnóstico de Conexão
                    </h4>
                    <button 
                        onClick={handleTestConnection}
                        disabled={isLoading}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Testando...' : 'Testar Conexão'}
                    </button>
                </div>

                {diagnosis && (
                    <div className="space-y-3 text-xs font-mono">
                        <div className="grid grid-cols-2 gap-2">
                             <div className="flex items-center gap-2">
                                <span className="text-slate-500">Status:</span>
                                <span className={diagnosis.status === 200 ? "text-emerald-400" : "text-red-400"}>
                                    {diagnosis.status || 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Tipo Estrutura:</span>
                                <span className="text-white">{diagnosis.structureType || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Linhas:</span>
                                <span className="text-white">{diagnosis.rowCount}</span>
                            </div>
                        </div>

                        {diagnosis.error ? (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-200 whitespace-pre-wrap">
                                <AlertTriangle className="w-4 h-4 mb-1 inline mr-2" />
                                {diagnosis.error}
                                {diagnosis.rawPreview && (
                                    <div className="mt-2 pt-2 border-t border-red-500/30 opacity-75 font-mono text-[10px]">
                                        {diagnosis.rawPreview}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="mt-2">
                                    <span className="text-slate-500 block mb-1">Colunas Detectadas:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {diagnosis.headersDetected?.map((h: string, i: number) => (
                                            <span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">
                                                {h}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-slate-500 flex items-center gap-1">
                                            <Terminal className="w-3 h-3" />
                                            Amostra (Linha 1):
                                        </span>
                                        <button onClick={() => setShowRaw(!showRaw)} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                                            <FileJson className="w-3 h-3" /> {showRaw ? 'Ocultar Raw' : 'Ver JSON Bruto'}
                                        </button>
                                    </div>
                                    
                                    {showRaw ? (
                                         <pre className="bg-black/50 p-2 rounded border border-slate-800 overflow-x-auto text-[10px] text-slate-300 max-h-40 overflow-y-auto">
                                            {diagnosis.rawJsonSnippet}
                                         </pre>
                                    ) : (
                                        <pre className="bg-black/50 p-2 rounded border border-slate-800 overflow-x-auto text-emerald-300">
                                            {JSON.stringify(diagnosis.firstRowSample, null, 2)}
                                        </pre>
                                    )}
                                </div>

                                <div className="mt-3 p-2 bg-blue-500/10 text-blue-200 rounded border border-blue-500/20">
                                    <CheckCircle className="w-3 h-3 inline mr-1" />
                                    Verifique se as colunas acima batem com sua planilha. O sistema tentará adivinhar a data automaticamente.
                                </div>
                            </>
                        )}
                    </div>
                )}

                {!diagnosis && !isLoading && (
                    <p className="text-slate-500 text-xs">
                        Clique em testar para ver exatamente o que o Google está enviando.
                    </p>
                )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end shrink-0 bg-slate-800 rounded-b-xl">
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