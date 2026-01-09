import React, { useState } from 'react';
import { X, Plus, Search } from 'lucide-react';

export default function AdminConsoleFixed({ onClose }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([
    { id: 'u1', name: 'Felippe Guedes', email: 'felippegustavo1@gmail.com', status: 'active' },
    { id: 'u2', name: 'Ana Silva', email: 'ana.silva@base44.io', status: 'active' }
  ]);

  const toggle = (id) => setUsers(u => u.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'grid', placeItems: 'center' }}>
      <div onClick={() => onClose && onClose()} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ zIndex: 230, width: 'min(1000px, 96%)' }}>
        <div className="bg-[#0f0a1a] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-white">Painel Admin</h3>
            <button onClick={() => onClose && onClose()} className="p-2"><X /></button>
          </div>

          <div className="mb-4 flex gap-2">
            <Search />
            <input className="flex-1 p-2 bg-white/5 rounded" placeholder="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="p-2 bg-indigo-600 rounded text-white" onClick={() => {}}><Plus /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).map(u => (
              <div key={u.id} className="p-3 bg-[#1a1425]/40 rounded">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="text-xs px-2 py-1 rounded border">{u.status}</div>
                    <button onClick={() => toggle(u.id)} className="text-sm">Alternar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
