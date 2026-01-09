import React, { useEffect } from 'react';

export default function DashboardPage() {
  useEffect(() => {
    // Init Chart.js if available (chart script is injected globally by Dashboard)
    const init = async () => {
      try {
        if (!window.Chart) return;
        const ctx = document.getElementById('trafficChart');
        if (!ctx) return;
        // destroy existing
        if (ctx._chartInstance) { try { ctx._chartInstance.destroy(); } catch {} }
        const labels = Array.from({ length: 12 }).map((_, i) => `${i + 1}m`);
        const dataBandwidth = labels.map(() => Math.round(Math.random() * 800));
        const dataLatency = labels.map(() => Math.round(Math.random() * 60));
        ctx._chartInstance = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Bandwidth (Mbps)', data: dataBandwidth, borderColor: 'rgb(99,102,241)', backgroundColor: 'rgba(99,102,241,0.12)', fill: true, tension: 0.4 },
              { label: 'Latência (ms)', data: dataLatency, borderColor: 'rgb(59,130,246)', backgroundColor: 'rgba(59,130,246,0.06)', fill: false, tension: 0.4 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      } catch (e) {}
    };
    init();
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-4">
          <div className="p-3 rounded-full bg-indigo-600/20 text-indigo-400">
            <i data-lucide="hard-drive" className="w-6 h-6"></i>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-400">Dispositivos Totais</span>
            <p className="text-3xl font-bold text-white mt-1">1807 <span className="text-sm text-green-400">+2.1%</span></p>
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-4">
          <div className="p-3 rounded-full bg-green-600/20 text-green-400">
            <i data-lucide="wifi" className="w-6 h-6"></i>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-400">Online</span>
            <p className="text-3xl font-bold text-white mt-1">1572 <span className="text-sm text-green-400">+0.6%</span></p>
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-4">
          <div className="p-3 rounded-full bg-red-600/20 text-red-400">
            <i data-lucide="alert-triangle" className="w-6 h-6"></i>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-400">Alertas Críticos</span>
            <p className="text-3xl font-bold text-white mt-1">0 <span className="text-sm text-gray-400">—</span></p>
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-4">
          <div className="p-3 rounded-full bg-yellow-600/20 text-yellow-400">
            <i data-lucide="cpu" className="w-6 h-6"></i>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-400">CPU Média</span>
            <p className="text-3xl font-bold text-white mt-1">12% <span className="text-sm text-red-400">-0.4%</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Tráfego de Rede (Mbps)</h3>
          <div className="h-80">
            <canvas id="trafficChart"></canvas>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Alertas Recentes</h3>
          <div className="flex-1 space-y-4 overflow-y-auto text-gray-400">
            <div className="flex flex-col items-center justify-center h-full">
              <i data-lucide="check-circle-2" className="w-12 h-12"></i>
              <p className="mt-2">Nenhum alerta no momento</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
