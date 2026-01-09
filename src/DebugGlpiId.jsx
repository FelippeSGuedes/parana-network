import React, { useEffect, useMemo, useState } from 'react';

// Página de depuração simples para inspecionar nomes e idProximoEquipamento
// Acesse em: http://localhost:3000/glpi_id
// - Mostra um resumo dos itens com idProximoEquipamento
// - Exibe os 12 primeiros caracteres calculados para origem e destino
// - Tenta casar destinos com os rádios retornados e mostra resultado

const normalize = (s) => String(s || '').trim();
const key12 = (s) => normalize(s).slice(0, 12).toUpperCase();

export default function DebugGlpiId() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiBase, setApiBase] = useState('');

  useEffect(() => {
    // Por padrão, usar mesma origem (relativo) para funcionar com proxy/gateway/túneis
    // Se quiser apontar para outra base, defina localStorage.API_BASE_URL ou query ?api=
    try {
      const { search } = window.location;
      const qs = new URLSearchParams(search || '');
      const override = qs.get('api') || qs.get('apibase') || localStorage.getItem('API_BASE_URL') || localStorage.getItem('apiBase') || localStorage.getItem('api');
      if (override) {
        if (/^https?:\/\//i.test(override)) {
          setApiBase(String(override).replace(/\/$/, ''));
        } else if (/^\d+$/.test(String(override))) {
          const { protocol, hostname } = window.location;
          const host = hostname.includes(':') ? `[${hostname}]` : hostname;
          setApiBase(`${protocol}//${host}:${override}`);
        } else {
          setApiBase('');
        }
      } else {
        setApiBase('');
      }
    } catch {
      setApiBase('');
    }
  }, []);

  useEffect(() => {
    if (!apiBase) return;
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(`${apiBase}/api/radios?showUnknown=1`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const js = await resp.json();
        if (!aborted) setData(Array.isArray(js.radios) ? js.radios : []);
      } catch (e) {
        if (!aborted) setError(e.message);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [apiBase]);

  const itemsWithNext = useMemo(() => data.filter(r => r && r.idProximoEquipamento && String(r.idProximoEquipamento).trim()), [data]);

  const indexByKeys = useMemo(() => {
    const idx = new Map();
    for (const r of data) {
      const name = r.name || r.nome || r.id;
      const kMain = key12(name);
      if (kMain) idx.set(kMain, r);
      // Se nome tem partes separadas por '/', indexa partes
      String(name)
        .split(/\s*\/\s+/)
        .map(t => t.trim())
        .filter(Boolean)
        .forEach(p => {
          const k = key12(p);
          if (k) idx.set(k, r);
        });
      // labelSegments
      if (Array.isArray(r.labelSegments)) {
        for (const seg of r.labelSegments) {
          const t = seg && seg.text ? String(seg.text).trim() : '';
          if (!t) continue;
          const k = key12(t);
          if (k) idx.set(k, r);
        }
      }
    }
    return idx;
  }, [data]);

  const rows = useMemo(() => {
    const out = [];
    for (const r of itemsWithNext) {
      const srcName = r.name || r.id;
      const srcK = key12(srcName);
      const raw = String(r.idProximoEquipamento || '');
      const parts = raw.split(/[\/;,\n]+/).map(t => t.trim()).filter(Boolean);
      for (const p of parts) {
        const dstK = key12(p);
        const found = indexByKeys.get(dstK);
        out.push({
          src: srcName,
          srcK,
          rawTarget: p,
          dstK,
          matched: !!found,
          dstName: found ? (found.name || found.id) : null,
        });
      }
    }
    return out;
  }, [itemsWithNext, indexByKeys]);

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <h2>Depuração: GLPI idProximoEquipamento</h2>
      {loading && <div>Carregando…</div>}
      {error && <div style={{ color: '#ef4444' }}>Erro: {error}</div>}
      {!loading && !error && (
        <>
          <div style={{ marginBottom: 10 }}>
            Total de rádios: <b>{data.length}</b> — Com idProximoEquipamento: <b>{itemsWithNext.length}</b>
          </div>
          <div style={{ marginBottom: 10 }}>
            Sucesso de casamento (por destino): <b>{rows.filter(r => r.matched).length}</b> / <b>{rows.length}</b>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Origem</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Chave(12)</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Destino (raw)</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Chave(12)</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Casou?</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 4px' }}>Destino resolvido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '4px 4px' }}>{r.src}</td>
                  <td style={{ padding: '4px 4px', fontFamily: 'monospace' }}>{r.srcK}</td>
                  <td style={{ padding: '4px 4px' }}>{r.rawTarget}</td>
                  <td style={{ padding: '4px 4px', fontFamily: 'monospace' }}>{r.dstK}</td>
                  <td style={{ padding: '4px 4px', color: r.matched ? '#16a34a' : '#dc2626' }}>{r.matched ? 'Sim' : 'Não'}</td>
                  <td style={{ padding: '4px 4px' }}>{r.dstName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
