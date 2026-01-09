import React, { useState, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Shield, 
  Activity, 
  RefreshCw, 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  MoreVertical, 
  Mail,
  ChevronDown,
  ExternalLink,
  Home, 
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
  UserPlus,
  Trash,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  UserCircle
} from 'lucide-react';

/**
 * PAINEL ADMIN - VERSÃO COMPACTA PRO
 * Atualização: Adicionadas animações premium de hover nos cartões de utilizadores.
 * Redução de escala em todos os componentes para maior densidade.
 */

const App = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Utilizadores');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteMode, setIsInviteMode] = useState(true);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [noPermission, setNoPermission] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [newUserForm, setNewUserForm] = useState({ email: '', username: '', password: '', role: 'user', active: true });

  // Busca dados reais do backend (rota: /auth/admin/users) e verifica /auth/me
  useEffect(() => {
    const prefix = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    const trim = (s) => (String(s || '').replace(/\/$/, ''));
    const root = trim(prefix);

    (async () => {
      try {
        // check current user
        const meRes = await fetch(`${root}/auth/me`, { credentials: 'include' });
        if (!meRes.ok) {
          setNoPermission(true);
          return;
        }
        const meJson = await meRes.json();
        const u = meJson && meJson.user ? meJson.user : meJson;
        setCurrentUser(u || null);
        const role = (u && (u.role || u.user_type)) || '';
        if (!role || (role !== 'super_admin' && role !== 'admin')) {
          setNoPermission(true);
          return;
        }

        // fetch users list
        setIsLoadingUsers(true);
        setUsersError(null);
        const res = await fetch(`${root}/auth/admin/users`, { credentials: 'include' });
        if (!res.ok) {
          setUsersError(`Erro ao carregar usuários (HTTP ${res.status})`);
          setUsers([]);
        } else {
          const json = await res.json();
          setUsers(json.users || json || []);
        }
      } catch (err) {
        setUsersError(err && err.message ? err.message : String(err));
        setUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    })();
  }, []);

  const getApiRoot = () => {
    const prefix = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    return String(prefix || '').replace(/\/$/, '');
  };

  const handleCreateUser = async () => {
    const root = getApiRoot();
    if (!newUserForm.email || !newUserForm.password) {
      setUsersError('E-mail e senha são obrigatórios');
      return;
    }
    try {
      setIsLoadingUsers(true);
      setUsersError(null);
      const res = await fetch(`${root}/auth/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newUserForm.email,
          username: newUserForm.username,
          password: newUserForm.password,
          role: newUserForm.role,
          active: newUserForm.active ? 1 : 0
        })
      });
      if (!res.ok) {
        setUsersError(`Falha ao criar usuário (HTTP ${res.status})`);
        return;
      }
      const json = await res.json();
      if (json && json.user) setUsers(prev => [json.user, ...prev]);
      setIsModalOpen(false);
      setNewUserForm({ email: '', username: '', password: '', role: 'user', active: true });
    } catch (err) {
      setUsersError(err && err.message ? err.message : String(err));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSaveProfile = async (updated) => {
    const root = getApiRoot();
    if (!updated || !updated.id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const body = { username: updated.username, role: updated.role, active: updated.active ? 1 : 0 };
      if (updated.password) body.password = updated.password;
      const res = await fetch(`${root}/auth/admin/users/${encodeURIComponent(updated.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        setProfileError(`Falha ao salvar usuário (HTTP ${res.status})`);
        return;
      }
      const json = await res.json();
      if (json && json.user) {
        setUsers(prev => prev.map(u => (u.id === json.user.id ? json.user : u)));
        setProfileUser(null);
      }
    } catch (err) {
      setProfileError(err && err.message ? err.message : String(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleUserStatus = (id) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));
  };

  const filteredUsers = users.filter(u => {
    const hay = String((u && (u.full_name || u.username || u.email)) || '').toLowerCase();
    return hay.includes((searchTerm || '').toLowerCase());
  });

  // calcula 'Acessos' como número de usuários com `last_login` nos últimos 30 dias
  const accessesCount = users.reduce((acc, u) => {
    try {
      if (!u) return acc;
      const candidate = u.last_login || u.lastLogin || u.last_access || u.lastSeen;
      if (!candidate) return acc;
      const d = new Date(candidate);
      if (isNaN(d)) return acc;
      const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 30) return acc + 1;
      return acc;
    } catch (e) {
      return acc;
    }
  }, 0);

  const handleDeleteUser = async (id) => {
    if (!id) return;
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
    const root = getApiRoot();
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const res = await fetch(`${root}/auth/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        setUsersError(`Falha ao excluir usuário (HTTP ${res.status})`);
        return;
      }
      // remover do estado
      setUsers(prev => prev.filter(u => (u.id || u.user_id || String(u.email || u.username || '')) !== id && u.id !== id));
      // fechar modal de perfil se estava aberto para esse usuário
      if (profileUser && (profileUser.id === id || profileUser.user_id === id)) setProfileUser(null);
    } catch (err) {
      setUsersError(err && err.message ? err.message : String(err));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0a1a] text-slate-300 font-sans flex relative overflow-hidden">
      
      {/* BACKGROUND AURORA */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-fuchsia-600/5 blur-[100px] rounded-full"></div>
      </div>

      {/* SIDEBAR COMPACTA */}
      <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} bg-[#140e21]/90 backdrop-blur-xl border-r border-white/5 transition-all duration-300 flex flex-col z-50 relative shadow-2xl shadow-black`}>
        <div className="p-4 flex items-center gap-2 overflow-hidden">
          <motion.div 
            whileHover={{ rotate: 90 }}
            className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-lg flex-shrink-0 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <span className="text-white font-black text-lg italic tracking-tighter">B</span>
          </motion.div>
          {isSidebarOpen && (
            <span className="font-black text-white tracking-tighter text-lg uppercase">ADMIN</span>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavItem icon={<Home size={18}/>} label="Home" active={activeTab === 'Home'} isOpen={isSidebarOpen} onClick={() => setActiveTab('Home')} />
          <NavItem icon={<Users size={18}/>} label="Utilizadores" active={activeTab === 'Utilizadores'} isOpen={isSidebarOpen} onClick={() => setActiveTab('Utilizadores')} />
          <NavItem icon={<Briefcase size={18}/>} label="Projetos" active={activeTab === 'Projetos'} isOpen={isSidebarOpen} onClick={() => setActiveTab('Projetos')} />
          <NavItem icon={<Settings size={18}/>} label="Definições" active={activeTab === 'Configuracoes'} isOpen={isSidebarOpen} onClick={() => setActiveTab('Configuracoes')} />
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/5 truncate">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-fuchsia-600 to-pink-600 flex items-center justify-center text-white font-black text-[10px]">FG</div>
            {isSidebarOpen && (
              <div className="flex-1 truncate">
                <p className="text-[10px] font-bold text-white truncate">Felippe Guedes</p>
                <p className="text-[8px] text-slate-500 uppercase font-bold">Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10 text-base">
        
        {/* HEADER REDUZIDO */}
        <header className="h-16 border-b border-white/5 bg-[#0f0a1a]/40 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 border border-white/5">
              {isSidebarOpen ? <Menu size={16} /> : <X size={16} />}
            </button>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              {activeTab} <Sparkles size={14} className="text-yellow-400" />
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <motion.button 
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={() => setIsModalOpen(true)}
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 uppercase tracking-wider border border-white/10"
             >
               <Plus size={14} strokeWidth={3} /> ADICIONAR
             </motion.button>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* STATS - MENORES */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <StatCard label="Total" value={users.length ? String(users.length) : '—'} trend="+12%" type="indigo" icon={<Users size={22}/>} />
              <StatCard label="Ativos" value={users.filter(u => u.active || u.status === 'active').length || '—'} trend="+8%" type="emerald" icon={<CheckCircle2 size={22}/>} />
              <StatCard label="Admins" value={users.filter(u => (u.role || u.user_type) === 'admin' || (u.role || u.user_type) === 'super_admin').length || '—'} trend="Ok" type="fuchsia" icon={<Shield size={22}/>} />
              <StatCard label="Acessos" value={accessesCount || '—'} trend="+22%" type="amber" icon={<Activity size={22}/>} />
            </div>

            {/* BARRA DE BUSCA COMPACTA */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col md:flex-row gap-3 items-center backdrop-blur-md">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <FilterSelect label="Função" />
                <div className="h-6 w-[1px] bg-white/10"></div>
                <div className="flex bg-white/5 border border-white/5 rounded-xl p-1">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><LayoutGrid size={14} /></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><List size={14} /></button>
                </div>
              </div>
            </div>

            {/* GRID DE UTILIZADORES MENORES */}
            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'} gap-4`}>
              <AnimatePresence mode="popLayout">
                {isLoadingUsers && (
                  <div className="col-span-full text-center py-8 text-slate-400">Carregando usuários…</div>
                )}
                {!isLoadingUsers && usersError && (
                  <div className="col-span-full text-center py-8 text-red-400">{usersError}</div>
                )}
                {!isLoadingUsers && !usersError && filteredUsers.map((user, idx) => (
                  <UserCard 
                    key={user.id || user.user_id || `${idx}`} 
                    user={user} 
                    index={idx}
                    onToggleStatus={() => toggleUserStatus(user.id)} 
                    onViewProfile={(u) => setProfileUser(u)}
                    onDelete={() => handleDeleteUser(user.id || user.user_id || user.email || user.username)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de permissão */}
      <AnimatePresence>
        {noPermission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-gray-900">SEM PERMISSÃO</h2>
              <p className="mt-2 text-sm text-gray-700">Seu usuário não tem permissão para acessar o Painel Admin.</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => { window.location.href = '/'; }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Voltar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL ADICIONAR UTILIZADOR */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#140e21] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <UserPlus size={18} className="text-indigo-400" /> Adicionar Utilizador
                  </h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Gerenciamento de Sistema</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* FORMULÁRIO DE CRIAÇÃO DE USUÁRIO */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nome</label>
                  <input value={newUserForm.username} onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5" placeholder="Nome completo ou usuário" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">E-mail</label>
                  <input value={newUserForm.email} onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5" placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Senha</label>
                  <input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5" placeholder="Senha" />
                </div>
                <div className="flex gap-3 items-center">
                  <select value={newUserForm.role} onChange={(e) => setNewUserForm(prev => ({ ...prev, role: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <label className="ml-auto flex items-center gap-2 text-xs"><input type="checkbox" checked={newUserForm.active} onChange={(e) => setNewUserForm(prev => ({ ...prev, active: e.target.checked }))} /> Ativo</label>
                </div>
                {usersError && <div className="text-red-400">{usersError}</div>}
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleCreateUser} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all border border-white/10">Criar Utilizador</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PERFIL / EDITAR USUÁRIO */}
      <AnimatePresence>
        {profileUser && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => setProfileUser(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-[#0b0711] border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white">Perfil: {(profileUser.full_name || profileUser.username || profileUser.email || 'Usuário')}</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nome</label>
                  <input value={profileUser.username || profileUser.full_name || ''} onChange={(e) => setProfileUser(prev => ({ ...prev, username: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">E-mail</label>
                  <input value={profileUser.email || ''} readOnly className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/40 border border-white/5" />
                </div>
                <div className="flex gap-2 items-center">
                  <select value={profileUser.role || profileUser.user_type || 'user'} onChange={(e) => setProfileUser(prev => ({ ...prev, role: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <label className="flex items-center gap-2 ml-auto text-xs"><input type="checkbox" checked={!!(profileUser.active || profileUser.status === 'active')} onChange={(e) => setProfileUser(prev => ({ ...prev, active: e.target.checked }))} /> Ativo</label>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nova senha (opcional)</label>
                  <input type="password" value={profileUser.password || ''} onChange={(e) => setProfileUser(prev => ({ ...prev, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a]/60 border border-white/5" />
                </div>
                {profileError && <div className="text-red-400">{profileError}</div>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setProfileUser(null)} className="px-4 py-2 rounded-lg bg-white/5">Fechar</button>
                <button onClick={() => handleSaveProfile(profileUser)} disabled={profileSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{profileSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #332a4d; border-radius: 10px; }
      `}</style>
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---

const NavItem = ({ icon, label, active, isOpen, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all group relative ${active ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
  >
    <span className={active ? 'text-indigo-400' : ''}>{icon}</span>
    {isOpen && <span className="text-xs font-bold uppercase tracking-widest">{label}</span>}
    {active && isOpen && <div className="ml-auto w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]"></div>}
  </button>
);

const StatCard = ({ label, value, trend, type, icon }) => {
  const themes = {
    indigo: { hex: "#818CF880", iconColor: "text-indigo-400" },
    emerald: { hex: "#31BE8C80", iconColor: "text-emerald-400" },
    fuchsia: { hex: "#E879F980", iconColor: "text-fuchsia-400" },
    amber: { hex: "#FBBF2480", iconColor: "text-amber-400" }
  };
  const current = themes[type];

  return (
    <motion.div 
      whileHover="hover" initial="initial"
      variants={{
        initial: { backgroundColor: "rgba(26, 20, 37, 0.4)", y: 0 },
        hover: { backgroundColor: current.hex, y: -4 }
      }}
      className="border border-white/5 rounded-3xl p-4 group relative overflow-hidden backdrop-blur-xl shadow-lg"
    >
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${current.iconColor} group-hover:text-white transition-all`}>
          {icon}
        </div>
        <div className="text-[8px] font-black bg-white/10 px-2 py-0.5 rounded-full text-white uppercase tracking-tighter">
           {trend}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-white/70">{label}</p>
        <h3 className="text-2xl font-black text-white tracking-tighter">{value}</h3>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-black/20 overflow-hidden">
        <motion.div variants={{ initial: { x: "-100%" }, hover: { x: "0%" } }} className="h-full w-full bg-white/40" />
      </div>
    </motion.div>
  );
};

const UserCard = forwardRef(({ user, onToggleStatus, onViewProfile, onDelete, index }, ref) => {
  const typeConfig = {
    super_admin: { label: "Super Admin", color: "text-fuchsia-400", bg: "from-fuchsia-600 to-pink-600" },
    admin: { label: "Admin", color: "text-indigo-400", bg: "from-indigo-600 to-violet-600" },
    user: { label: "User", color: "text-cyan-400", bg: "from-blue-600 to-cyan-600" }
  };
  const roleKey = (user && (user.user_type || user.role)) || 'user';
  const config = typeConfig[roleKey] || typeConfig.user;

  const displayName = (user && (user.full_name || user.username || user.email)) || 'Usuário';
  const statusActive = ((user && (user.status || (user.active ? 'active' : ''))) || '').toLowerCase() === 'active';

  // último acesso: tenta vários campos comuns e formata como "Há 2h", "Há 3d", ou 'agora'
  const lastSeenRaw = user && (user.last_login || user.lastLogin || user.last_access || user.lastSeen || user.last_seen || user.lastAccess || user.lastSeenAt);
  const lastSeenDate = lastSeenRaw ? new Date(lastSeenRaw) : null;
  const lastSeenText = (() => {
    if (!lastSeenDate || isNaN(lastSeenDate.getTime())) return '—';
    const diff = Date.now() - lastSeenDate.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'agora';
    const min = Math.floor(sec / 60);
    if (min < 60) return `Há ${min}m`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days}d`;
  })();

  return (
    <motion.div 
      ref={ref} layout 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -12, 
        scale: 1.02,
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }}
      className="bg-[#1a1425]/40 border border-white/5 rounded-3xl p-5 transition-all group backdrop-blur-xl shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)] hover:border-indigo-500/40 relative overflow-hidden"
    >
      {/* Glow de fundo que aparece suavemente no hover */}
      <div className={`absolute -inset-1 bg-gradient-to-br ${config.bg} opacity-0 group-hover:opacity-[0.05] blur-2xl transition-opacity duration-500`}></div>

      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="flex items-center gap-3 truncate">
          <motion.div 
            whileHover={{ rotate: 10 }}
            className={`w-10 h-10 bg-gradient-to-br ${config.bg} rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:shadow-indigo-500/20 transition-all`}
          >
            {String(displayName).charAt(0)}
          </motion.div>
          <div className="truncate">
            <h3 className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{displayName}</h3>
            <span className={`text-[8px] font-black uppercase tracking-widest ${config.color} flex items-center gap-1`}>
              <Shield size={10} strokeWidth={2.5} /> {config.label}
            </span>
          </div>
        </div>
        <button className="text-slate-600 hover:text-white transition-colors"><MoreVertical size={16} /></button>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 mb-5 flex items-center gap-2 truncate group-hover:bg-white/10 transition-colors relative z-10">
        <Mail size={12} className="text-indigo-400 flex-shrink-0" />
        <span className="text-[10px] text-slate-400 truncate font-bold">{user.email || ''}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5 py-3 border-y border-white/5 relative z-10 group-hover:border-white/10 transition-colors">
        <div>
          <p className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">Atividade</p>
          <p className="text-[10px] font-black text-slate-200 truncate group-hover:text-white">{lastSeenText}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">Status</p>
          <div className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-lg border transition-all ${statusActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-slate-500 border-white/5'}`}>
            <div className={`w-1 h-1 rounded-full ${statusActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
            {String((user && (user.status || (user.active ? 'active' : 'unknown'))) || 'unknown').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => onViewProfile && onViewProfile(user)} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 group-hover:text-indigo-300 transition-colors">
            Ver Perfil <ExternalLink size={10} strokeWidth={2.5} />
          </button>
          <button onClick={() => onDelete && onDelete(user)} className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1 hover:text-red-300 transition-colors">
            Excluir <Trash size={12} />
          </button>
        </div>
        <button onClick={onToggleStatus} className={`w-9 h-4.5 rounded-full relative transition-all ${statusActive ? 'bg-emerald-600 group-hover:bg-emerald-500 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}>
          <motion.div animate={{ left: statusActive ? 22 : 3 }} className="absolute top-0.75 w-3 h-3 bg-white rounded-full shadow-lg" />
        </button>
      </div>
    </motion.div>
  );
});

const InputGroup = ({ label, placeholder, icon, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative group">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors">{icon}</div>}
      <input 
        type={type}
        placeholder={placeholder}
        className={`w-full bg-white/5 border border-white/10 rounded-xl py-2.5 ${icon ? 'pl-9' : 'px-4'} pr-4 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white/[0.08] transition-all placeholder:text-slate-700`}
      />
    </div>
  </div>
);

const FilterSelect = ({ label }) => (
  <button className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest group">
    {label} <ChevronDown size={12} className="opacity-30" />
  </button>
);

export default function AdminConsole({ apiBaseUrl }) {
  return (
    <div className="min-h-screen w-full">
      <App apiBaseUrl={apiBaseUrl} />
    </div>
  );
}
