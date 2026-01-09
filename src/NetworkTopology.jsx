import React, { useEffect, useRef, useState } from 'react';

const MAP_API = (typeof window !== 'undefined' && window.location) ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || ''}` : '';

export default function NetworkTopology({ apiBase }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Inject cytoscape if not present
    const ensureCytoscape = () => new Promise((resolve, reject) => {
      if (window.cytoscape) return resolve(window.cytoscape);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/cytoscape@3.24.0/dist/cytoscape.min.js';
      s.async = true;
      s.onload = () => resolve(window.cytoscape);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    let mounted = true;

    ensureCytoscape().then((cytoscape) => {
      if (!mounted) return;
      if (!containerRef.current) return;

      // sample data (placeholder) — replace by fetching /api/topology
      const sample = {
        nodes: [
          { data: { id: 'a', label: 'Core-RTR-01', ip: '10.0.0.1', status: 'online', cpu: '12%', mem: '44%', uptime: '12 days' } },
          { data: { id: 'b', label: 'SW-EDGE-02', ip: '10.0.1.2', status: 'online', cpu: '22%', mem: '31%', uptime: '3 days' } },
          { data: { id: 'c', label: 'DCU-001', ip: '10.0.2.3', status: 'offline', cpu: '0%', mem: '0%', uptime: '—' } },
          { data: { id: 'd', label: 'RADIO-07', ip: '10.0.3.4', status: 'online', cpu: '6%', mem: '12%', uptime: '1 day' } },
          { data: { id: 'e', label: 'P70-12', ip: '10.0.4.5', status: 'online', cpu: '8%', mem: '9%', uptime: '4 days' } }
        ],
        edges: [
          { data: { id: 'ae', source: 'a', target: 'e', traffic: 420 } },
          { data: { id: 'ab', source: 'a', target: 'b', traffic: 120 } },
          { data: { id: 'bd', source: 'b', target: 'd', traffic: 60 } },
          { data: { id: 'bc', source: 'b', target: 'c', traffic: 10 } }
        ]
      };

      const cy = window.cytoscape({
        container: containerRef.current,
        elements: [...sample.nodes, ...sample.edges],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': function (ele) {
                const s = ele.data('status');
                if (s === 'online') return '#22c55e';
                if (s === 'offline') return '#ef4444';
                return '#64748b';
              },
              'label': 'data(label)',
              'color': '#e6f0ff',
              'text-valign': 'center',
              'text-halign': 'center',
              'text-outline-width': 6,
              'text-outline-color': 'rgba(8,10,20,0.6)',
              'width': 48,
              'height': 48,
              'font-size': 11,
              'overlay-padding': 6
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#60a5fa',
              'curve-style': 'bezier',
              'opacity': 0.9,
              'target-arrow-shape': 'none'
            }
          },
          {
            selector: ':selected',
            style: {
              'border-width': 4,
              'border-color': '#7c3aed',
              'shadow-blur': 12,
              'shadow-color': '#7c3aed'
            }
          }
        ],
        layout: { name: 'cose', animate: true, randomize: false }
      });

      cyRef.current = cy;

      // Click handler
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        setSelected(node.data());
      });

      // Background tap clears
      cy.on('tap', (e) => {
        if (e.target === cy) setSelected(null);
      });

      // simple pulsing on edges to indicate traffic
      const pulse = () => {
        if (!cy || cy.destroyed) return;
        cy.edges().forEach(edge => {
          edge.animate({ style: { 'line-color': '#34d399' } }, { duration: 300 }).play();
          setTimeout(() => {
            if (!edge.removed) edge.animate({ style: { 'line-color': '#60a5fa' } }, { duration: 800 }).play();
          }, 300 + Math.random() * 400);
        });
      };
      const interval = setInterval(pulse, 1800);

      // try fetch real topology if apiBase provided
      (async () => {
        try {
          const base = apiBase || '';
          if (!base) return;
          const resp = await fetch(`${base}/api/topology`);
          if (!resp.ok) return;
          const data = await resp.json();
          // expected { nodes: [{id,label,ip,status,...}], edges: [{id,source,target,traffic}]
          if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            cy.elements().remove();
            cy.add([...data.nodes.map(n => ({ data: n })), ...data.edges.map(e => ({ data: e }))]);
            cy.layout({ name: 'cose', animate: true }).run();
          }
        } catch (e) { /* ignore */ }
      })();

      return () => {
        clearInterval(interval);
        try { cy.destroy(); } catch (e) {}
      };
    }).catch(() => {
      // ignore
    });

    return () => { mounted = false; };
  }, [apiBase]);

  return (
    <div className="w-full h-full flex gap-4" style={{ minHeight: 480 }}>
      <div className="flex-1 bg-slate-800 rounded-lg p-3 border border-slate-700 shadow-inner" style={{ minHeight: 480 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
        {!cyRef.current && (
          <div className="absolute text-sm text-gray-400 mt-4">Nenhum dispositivo no mapa</div>
        )}
      </div>
      <aside className="w-80 bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-lg glass" style={{ minHeight: 480 }}>
        <h3 className="text-white font-semibold mb-2">Detalhes do Dispositivo</h3>
        {!selected && <div className="text-gray-400">Clique em um nó para ver detalhes</div>}
        {selected && (
          <div className="space-y-2 text-sm text-gray-200">
            <div className="font-medium text-white">{selected.label || selected.id}</div>
            <div>IP: <span className="text-gray-300">{selected.ip || '—'}</span></div>
            <div>Status: <span className={`font-semibold ${selected.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>{selected.status}</span></div>
            <div>Uptime: <span className="text-gray-300">{selected.uptime || '—'}</span></div>
            <div>CPU: <span className="text-gray-300">{selected.cpu || '—'}</span></div>
            <div>Memória: <span className="text-gray-300">{selected.mem || '—'}</span></div>
            <div className="pt-2">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md mr-2">Ações</button>
              <button className="bg-gray-700 text-gray-200 px-3 py-1 rounded-md">Logs</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
