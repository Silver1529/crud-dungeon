// components/ui/Toast.jsx
'use client';
// EDUCATIONAL: thin wrapper sobre Sonner. Color-coded por método HTTP.
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Info, Trash2 } from 'lucide-react';

const METHOD_COLORS = {
  GET: 'text-cyan-300',
  POST: 'text-emerald-300',
  PUT: 'text-amber-300',
  DELETE: 'text-rose-300',
};

export function notifyApi({ method, status, ms }) {
  const color = METHOD_COLORS[method] || 'text-slate-300';
  const icon =
    status >= 400 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
    : method === 'DELETE' ? <Trash2 className="w-3.5 h-3.5 text-rose-300" />
    : method === 'GET' ? <Info className="w-3.5 h-3.5 text-cyan-300" />
    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />;

  toast.custom(() => (
    <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 font-mono text-xs">
      {icon}
      <span className={color + ' font-bold'}>{method}</span>
      <span className="text-slate-300">→ {status}</span>
      <span className="text-slate-500 ml-auto">{ms}ms</span>
    </div>
  ));
}

export { toast };
