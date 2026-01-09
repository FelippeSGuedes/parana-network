import React from 'react';
import NetworkTopology from '../NetworkTopology';

export default function MapPage() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Mapa em Tempo Real</h2>
          <p className="text-sm text-gray-400">Topologia lógica - conexões entre dispositivos</p>
        </div>
      </div>
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg">
        <NetworkTopology apiBase={process.env.REACT_APP_API_BASE_URL || ''} />
      </div>
    </div>
  );
}
