import React from 'react';

export default function UsersPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-white">Usuários</h2>
        <button className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow">
          <i data-lucide="plus" className="w-5 h-5 mr-2"></i>
          Adicionar Usuário
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img className="h-10 w-10 rounded-full object-cover" src="https://placehold.co/100x100/6366F1/E0E7FF?text=F" alt="Avatar" />
              <div>
                <h4 className="font-semibold text-white">Felippe Guedes</h4>
                <span className="text-sm text-gray-400">felipegustavo1@email.com</span>
              </div>
            </div>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-500 text-indigo-100">Admin</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-400 border-t border-slate-700 pt-3">
            <span className="flex items-center"><i data-lucide="calendar" className="w-4 h-4 mr-2"></i>30 de outubro, 2025</span>
            <div className="space-x-2">
              <button className="text-gray-400 hover:text-white" title="Editar"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
              <button className="text-red-400 hover:text-red-300" title="Remover"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img className="h-10 w-10 rounded-full object-cover" src="https://placehold.co/100x100/4A5568/E2E8F0?text=A" alt="Avatar" />
              <div>
                <h4 className="font-semibold text-white">Admin User</h4>
                <span className="text-sm text-gray-400">admin@email.com</span>
              </div>
            </div>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-500 text-gray-100">User</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-400 border-t border-slate-700 pt-3">
            <span className="flex items-center"><i data-lucide="calendar" className="w-4 h-4 mr-2"></i>28 de outubro, 2025</span>
            <div className="space-x-2">
              <button className="text-gray-400 hover:text-white" title="Editar"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
              <button className="text-red-400 hover:text-red-300" title="Remover"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
