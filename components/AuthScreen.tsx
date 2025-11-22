
import React, { useState } from 'react';
import { signIn, signUp } from '../services/authService';
import { Loader2, LogIn, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  
  // Credenciais pré-definidas conforme solicitado
  const [email, setEmail] = useState('admjhon@gmail.com');
  const [password, setPassword] = useState('jhonny12');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        if (data.user) onAuthSuccess(data.user);
      } else {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        if (data.user && !data.session) {
          setSuccessMsg("Conta criada! Verifique seu email para confirmar o cadastro antes de entrar.");
          setIsLogin(true); 
        } else if (data.user) {
          onAuthSuccess(data.user);
        }
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "Email ou senha incorretos." : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        {/* Background glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
        
        <div className="p-8 pb-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Routine Tracker Pro</h1>
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Faça login para sincronizar suas tarefas' : 'Crie sua conta e defina sua rotina'}
          </p>
        </div>

        <div className="px-8 pb-8">
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-3 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-4 py-3 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-start gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-lg flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isLogin ? <><LogIn className="w-5 h-5" /> Acessar Sistema</> : <><UserPlus className="w-5 h-5" /> Criar Conta</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-slate-500 hover:text-emerald-400 text-sm transition-colors font-medium"
            >
              {isLogin ? 'Ainda não tem conta? Cadastre-se' : 'Já possui conta? Entre agora'}
            </button>
          </div>
        </div>
        
        <div className="bg-slate-950 py-3 text-center border-t border-slate-800">
           <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Sistema Seguro v2.0</p>
        </div>
      </div>
    </div>
  );
};
