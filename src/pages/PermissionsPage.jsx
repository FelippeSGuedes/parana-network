import React from 'react';

export default function PermissionsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-white">Permissões</h2>
        <button className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow">
          <i data-lucide="user-plus" className="w-5 h-5 mr-2"></i>
          Nova Permissão
        </button>
      </div>

      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-lg">
        <h3 className="text-lg font-medium text-white mb-3">Perfis de Acesso</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-900 rounded">
            <div>
              <div className="font-semibold text-white">Administrador</div>
              <div className="text-sm text-gray-400">Acesso total ao sistema</div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-400 hover:text-white" title="Editar"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
              <button className="text-red-400 hover:text-red-300" title="Remover"><i data-lucide="trash-2" className="w-4 h-4"></i></button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900 rounded">
            <div>
              <div className="font-semibold text-white">Operador</div>
              <div className="text-sm text-gray-400">Consulta e gerenciamento limitado</div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-400 hover:text-white" title="Editar"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900 rounded">
            <div>
              <div className="font-semibold text-white">Leitura</div>
              <div className="text-sm text-gray-400">Somente leitura</div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-gray-400 hover:text-white" title="Editar"><i data-lucide="edit-2" className="w-4 h-4"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
