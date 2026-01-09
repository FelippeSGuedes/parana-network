import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import logoSvg from './logo.svg';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';

export default function Dashboard() {
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    // Inject fonts and icons for parity with provided HTML
    const injectLink = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const l = document.createElement('link');
      l.href = href; l.rel = 'stylesheet'; document.head.appendChild(l);
    };
    injectLink('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    if (!document.querySelector('script[src="https://unpkg.com/lucide@latest"]')) {
      const s = document.createElement('script'); s.src = 'https://unpkg.com/lucide@latest'; s.async = true; document.head.appendChild(s);
      s.onload = () => { try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch {} };
    }
    if (!document.querySelector('script[src="https://cdn.jsdelivr.net/npm/chart.js"]')) {
      const s2 = document.createElement('script'); s2.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s2.async = true; document.head.appendChild(s2);
    }
  }, []);

  const titleFor = {
    dashboard: 'Visão Geral',
    mapa: 'Mapa em Tempo Real',
    usuarios: 'Usuários',
    permissoes: 'Permissões'
  };

  const subtitleFor = {
    dashboard: 'Monitoramento em tempo real da infraestrutura de rede',
    mapa: 'Topologia lógica e status dos dispositivos',
    usuarios: 'Gerenciar contas de usuário',
    permissoes: 'Perfis e permissões de acesso'
  };

  return (
    <div className="bg-slate-900 text-gray-200 flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <nav id="sidebar" className="w-64 bg-slate-800 flex flex-col transition-all duration-300 ease-in-out h-screen fixed shadow-lg">
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <div className="flex items-center space-x-3 overflow-hidden">
            <img src="/Login/Imgs/logo.png" onError={(e)=>{e.currentTarget.onerror=null; e.currentTarget.src=logoSvg;}} className="h-8 w-8 rounded-sm flex-shrink-0 object-cover" alt="Parana Network" />
            <div className="flex flex-col sidebar-text overflow-hidden ml-2">
              <span className="font-bold text-lg text-white truncate">Parana Network</span>
              <span className="text-xs text-gray-400 truncate">Monitoramento Inteligente</span>
            </div>
          </div>
          <button id="toggleSidebar" title="Recolher menu" className="text-gray-400 hover:text-white sidebar-text">
            <i data-lucide="chevrons-left-right" className="w-5 h-5"></i>
          </button>
        </div>

        <div className="p-4">
          <button className="w-full flex items-center justify-center text-sm px-3 py-2 bg-green-600/20 text-green-400 rounded-lg border border-green-500/30">
            <i data-lucide="link" className="w-4 h-4 mr-2"></i>
            <span className="sidebar-text">Conectado (Zabbix API)</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
          <ul className="py-1 space-y-1">
            <li>
              <button type="button" onClick={() => setView('dashboard')} className={`nav-link flex items-center space-x-3 px-4 py-3 rounded-lg mx-2 ${view==='dashboard' ? 'text-white bg-indigo-600' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                <i data-lucide="layout-dashboard" className="w-5 h-5"></i>
                <span className="sidebar-text font-medium">Visão Geral</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setView('mapa')} className={`nav-link flex items-center space-x-3 px-4 py-3 rounded-lg mx-2 ${view==='mapa' ? 'text-white bg-indigo-600' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                <i data-lucide="map" className="w-5 h-5"></i>
                <span className="sidebar-text font-medium">Mapa em Tempo Real</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setView('usuarios')} className={`nav-link flex items-center space-x-3 px-4 py-3 rounded-lg mx-2 ${view==='usuarios' ? 'text-white bg-indigo-600' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                <i data-lucide="users" className="w-5 h-5"></i>
                <span className="sidebar-text font-medium">Usuários</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setView('permissoes')} className={`nav-link flex items-center space-x-3 px-4 py-3 rounded-lg mx-2 ${view==='permissoes' ? 'text-white bg-indigo-600' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}>
                <i data-lucide="shield-check" className="w-5 h-5"></i>
                <span className="sidebar-text font-medium">Permissões</span>
              </button>
            </li>
            <li>
              <button type="button" data-page-link="ferramentas" className="nav-link flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-lg mx-2">
                <i data-lucide="terminal-square" className="w-5 h-5"></i>
                <span className="sidebar-text font-medium">Ferramentas</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="border-t border-slate-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              <img className="h-9 w-9 rounded-full object-cover flex-shrink-0" src="https://placehold.co/100x100/6366F1/E0E7FF?text=F" alt="Avatar" />
              <div className="flex flex-col overflow-hidden sidebar-text">
                <span className="text-sm font-medium text-white truncate">felipegustavo1@email.com</span>
              </div>
            </div>
            <div className="flex items-center space-x-1 sidebar-text">
              <button title="Configurações" className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-md">
                <i data-lucide="settings" className="w-5 h-5"></i>
              </button>
              <button title="Sair" className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-md">
                <i data-lucide="log-out" className="w-5 h-5"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content" className="flex-1 flex flex-col overflow-auto transition-all duration-300 ease-in-out" style={{ marginLeft: '16rem' }}>
        <header className="flex items-center justify-between h-16 px-6 bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
          <div className="flex items-center">
            <div>
              <h1 id="page-title" className="text-xl font-semibold text-white">{titleFor[view]}</h1>
              <p id="page-subtitle" className="text-sm text-gray-400">{subtitleFor[view]}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow">
              <i data-lucide="refresh-cw" className="w-4 h-4 mr-2"></i>
              Atualizar Dados
            </button>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1 overflow-auto">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'mapa' && <MapPage />}
          {view === 'usuarios' && <UsersPage />}
          {view === 'permissoes' && <PermissionsPage />}
        </div>
      </main>
    </div>
  );
}
