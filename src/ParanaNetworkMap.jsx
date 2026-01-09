// FEITO POR FELIPPE GUEDES , VOCÊ NÃO DEVERIA ESTAR AQUI SE NÃO FOR DESENVOLVEDOR AUTORIZADO.
// ESTE CÓDIGO É FORNECIDO "NO ESTADO EM QUE SE ENCONTRA", SEM GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLÍCITAS.
//ESSE CÓDIGO É MEU ENTÃO PROVAVELMENTE NINGUEM VAI TER ACESSO HAHAHAAHAHAH
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, IconLayer, TextLayer, BitmapLayer } from "@deck.gl/layers";
import { PathLayer } from "@deck.gl/layers";
import { TerrainLayer, TripsLayer } from "@deck.gl/geo-layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import MapGL from "react-map-gl";
import WeatherWidget from './components/WeatherWidget';
import AdminConsole from "./admin/AdminConsole";

// Ícones importados do src/icons (garante bundle pelo CRA)
import DA_G from "./icons/DA.G.png";
import DA_R from "./icons/DA.R.png";
import DA_GR from "./icons/DA.GR.png";
import DA_O from "./icons/DA.O.png";

import GAB_DCU_G from "./icons/Gab. DCU-G.png";
import GAB_DCU_R from "./icons/Gab. DCU-R.png";
import GAB_DCU_GR from "./icons/Gab. DCU-GR.png";
import GAB_DCU_O from "./icons/Gab. DCU-O.png";

import GAB_DCU_GE_B2B_G from "./icons/Gab. DCU+GE+B2B-G.png";
import GAB_DCU_GE_B2B_R from "./icons/Gab. DCU+GE+B2B-R.png";
import GAB_DCU_GE_B2B_GR from "./icons/Gab. DCU+GE+B2B-GR.png";
import GAB_DCU_GE_B2B_O from "./icons/Gab. DCU+GE+B2B-O.png";

import P70_G from "./icons/P70.G.png";
import P70_R from "./icons/P70.R.png";

import REP_BACKHAUL_G from "./icons/Rep. Backhaul.G.png";
import REP_BACKHAUL_R from "./icons/Rep. Backhaul.R.png";
import REP_BACKHAUL_GR from "./icons/Rep. Backhaul.GR.png";
import REP_BACKHAUL_O from "./icons/Rep. Backhaul.O.png";

// Ícones especiais para DCU agregada (dcu_inicial)
import DCU_INICIAL_G from "./icons/dcu_inicial.g.png";
import DCU_INICIAL_R from "./icons/dcu_inicial.r.png";

const ICON_URLS = {
  "DA.G.png": DA_G,
  "DA.R.png": DA_R,
  "DA.GR.png": DA_GR,
  "DA.O.png": DA_O,
  "Gab. DCU-G.png": GAB_DCU_G,
  "Gab. DCU-R.png": GAB_DCU_R,
  "Gab. DCU-GR.png": GAB_DCU_GR,
  "Gab. DCU-O.png": GAB_DCU_O,
  "Gab. DCU+GE+B2B-G.png": GAB_DCU_GE_B2B_G,
  "Gab. DCU+GE+B2B-R.png": GAB_DCU_GE_B2B_R,
  "Gab. DCU+GE+B2B-GR.png": GAB_DCU_GE_B2B_GR,
  "Gab. DCU+GE+B2B-O.png": GAB_DCU_GE_B2B_O,
  "P70.G.png": P70_G,
  "P70.R.png": P70_R,
  "Rep. Backhaul.G.png": REP_BACKHAUL_G,
  "Rep. Backhaul.R.png": REP_BACKHAUL_R,
  "Rep. Backhaul.GR.png": REP_BACKHAUL_GR,
  "Rep. Backhaul.O.png": REP_BACKHAUL_O,
  "dcu_inicial.G.png": DCU_INICIAL_G,
  "dcu_inicial.R.png": DCU_INICIAL_R,
  // Suporte a nomes em minúsculo (ambiente Windows pode não diferenciar, mas o bundler sim)
  "dcu_inicial.g.png": DCU_INICIAL_G,
  "dcu_inicial.r.png": DCU_INICIAL_R,
};

// Helpers fora do componente para estabilidade e evitar warnings do ESLint
const normalizeTypeLabel = (raw) => {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sem acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

// Normalização para busca (case/acentos)
const normalizeForSearch = (raw) =>
  String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Classificação para contagens no resumo
const classifyTypeForCount = (tipoRaw) => {
  if (!tipoRaw) return 'Other';
  const label = normalizeTypeLabel(tipoRaw);
  if (label.includes('dcu_inicial')) return 'DCU';
  if (/\bp70\b/.test(label)) return 'P70';
  if (label.includes('backhaul')) return 'BackHaul';
  if (label === 'da' || label.startsWith('da ')) return 'DA';
  if (label.includes('gab') && label.includes('dcu')) return 'DCU';
  return 'Other';
};

  const resolveIconName = (tipoRaw, status) => {
  if (!tipoRaw) return null;
  const label = normalizeTypeLabel(tipoRaw);
  // status: 'online' | 'offline' | 'inactive' | 'mixed'
  let suffix = 'R';
  if (status === 'online') suffix = 'G';
  else if (status === 'mixed') suffix = 'O';
  else if (status === 'inactive') suffix = 'GR';

  const has = (s) => label.includes(s);

  // P70
  if (/\bp70\b/.test(label)) {
    // P70 só tem G/R; para mixed/inactive, degradar para R/G respectivamente
    const sfx = (suffix === 'G' || suffix === 'R') ? suffix : (suffix === 'GR' ? 'R' : 'R');
    return `P70.${sfx}.png`;
  }
  // Backhaul
  if (has('backhaul')) return `Rep. Backhaul.${suffix}.png`;
  // DA
  if (label === 'da' || label.startsWith('da ')) return `DA.${suffix}.png`;
  // DCU agregada especial: dcu_inicial.* com fallback para Gab. DCU
  if (has('dcu_inicial')) {
    // existem apenas .g/.r para dcu_inicial: para mixed/inactive, usamos Gab. DCU-O/GR
    if (suffix === 'G' || suffix === 'R') {
      const desired = `dcu_inicial.${suffix}.png`;
      if (Object.prototype.hasOwnProperty.call(ICON_URLS, desired)) {
        return desired;
      }
    }
    // fallback para variantes especiais
    if (suffix === 'O') return `Gab. DCU-O.png`;
    if (suffix === 'GR') return `Gab. DCU-GR.png`;
    return `Gab. DCU-${suffix}.png`;
  }
  // Gab. DCU+GE (agregados): usar ícone Gab. DCU existente
  if (has('gab') && has('dcu') && has('ge') && !has('b2b')) {
    return `Gab. DCU-${suffix}.png`;
  }
  // DCU + GE + B2B
  if (has('gab') && has('dcu') && has('ge') && has('b2b')) {
    return `Gab. DCU+GE+B2B-${suffix}.png`;
  }
  // Tipo puro "B2B" deve usar o mesmo ícone de Gab. DCU+GE+B2B
  if (label === 'b2b') {
    return `Gab. DCU+GE+B2B-${suffix}.png`;
  }
  // DCU (SE) ou DCU+GE
  if (has('gab') && has('dcu') && (has('se') || has('ge'))) {
    return `Gab. DCU-${suffix}.png`;
  }

  return null;
};

// Token fornecido pelo usuário para carregar mapas e tiles de relevo do Mapbox.
const MAPBOX_TOKEN =
  "pk.eyJ1IjoiZmVsaXBwZWd1ZWRlcyIsImEiOiJjbWdqdmJhdzcwbm52Mmlvam1tcDBxZHRhIn0.KOmJr0i_kVzcXQgX1biogQ";

const MAP_STYLE_OPTIONS = [
  { id: 'satellite', label: 'Satellite + Streets', description: 'Imagem real com nomes de ruas', style: 'mapbox://styles/mapbox/satellite-streets-v12', tone: 'dark', supportsTerrain: true },
  { id: 'google-hybrid', label: 'Google Maps (Experimental)', description: 'Satélite Google (Experimental)', style: {
      version: 8,
      sources: {
        'google-hybrid': {
          type: 'raster',
          tiles: [
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'google-hybrid',
          type: 'raster',
          source: 'google-hybrid',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    }, tone: 'dark', supportsTerrain: false },
  { id: 'streets', label: 'Streets', description: 'Cartografia urbana detalhada', style: 'mapbox://styles/mapbox/streets-v12', tone: 'light', supportsTerrain: false },
  { id: 'outdoors', label: 'Outdoors', description: 'Ênfase em relevo/trilhas', style: 'mapbox://styles/mapbox/outdoors-v12', tone: 'light', supportsTerrain: false },
  { id: 'light', label: 'Light', description: 'Tema claro neutro', style: 'mapbox://styles/mapbox/light-v11', tone: 'light', supportsTerrain: false },
  { id: 'dark', label: 'Dark', description: 'Tema escuro para salas de operação', style: 'mapbox://styles/mapbox/dark-v11', tone: 'dark', supportsTerrain: false },
  { id: 'night', label: 'Navigation Night', description: 'Alto contraste noturno', style: 'mapbox://styles/mapbox/navigation-night-v1', tone: 'dark', supportsTerrain: false },
  { id: 'terrain', label: 'Terrain', description: 'Dá destaque a elevações', style: 'mapbox://styles/mapbox/terrain-v2', tone: 'light', supportsTerrain: true },
];

const DEFAULT_MAP_STYLE_ID = MAP_STYLE_OPTIONS[0].id;
const MAP_STYLE_STORAGE_KEY = 'parana-network-map';
const LANGUAGE_STORAGE_KEY = 'parana-network-language';
const AVAILABILITY_TARGET_PCT = 99.8;
const RSSI_TARGET_DBM = -85;
const LQI_TARGET_BY_RATE = {
  250: 21,
  500: 14,
  1000: 6,
};

// Recorte aproximado do Oeste do Paraná (para mascarar a camada de clima)
const WEST_PARANA_POLYGON = [
  [-54.84, -26.45],
  [-54.60, -25.35],
  [-54.45, -24.60],
  [-54.30, -23.90],
  [-54.10, -23.55],
  [-53.40, -23.30],
  [-52.80, -23.20],
  [-52.30, -23.50],
  [-52.10, -24.30],
  [-52.05, -25.10],
  [-52.20, -25.70],
  [-52.50, -26.10],
  [-53.20, -26.50],
  [-54.00, -26.60],
  [-54.40, -26.55],
];
const WEST_PARANA_BOUNDS = [-54.84, -26.60, -51.00, -23.10]; // [minLng, minLat, maxLng, maxLat]
const WEATHER_CANVAS_SIZE = 1024;
const DEFAULT_RAIN_CELLS = [
  { id: 'foz', lat: -25.55, lng: -54.58, mm: 42 },
  { id: 'cascavel', lat: -24.95, lng: -53.45, mm: 28 },
  { id: 'toledo', lat: -24.73, lng: -53.74, mm: 18 },
  { id: 'marechal', lat: -24.56, lng: -54.06, mm: 10 },
  { id: 'guarapuava', lat: -25.38, lng: -51.46, mm: 6 }, // borda leste mais clara
];
const DEFAULT_TEMPERATURES = [
  { id: 'Foz do Iguaçu', lat: -25.55, lng: -54.58, temp: 26 },
  { id: 'Cascavel', lat: -24.95, lng: -53.45, temp: 24 },
  { id: 'Toledo', lat: -24.73, lng: -53.74, temp: 25 },
  { id: 'Marechal C. Rondon', lat: -24.56, lng: -54.06, temp: 24 },
  { id: 'Guarapuava', lat: -25.38, lng: -51.46, temp: 21 },
];
const WEATHER_LOCATIONS = DEFAULT_TEMPERATURES;

const TRANSLATIONS = {
  pt: {
    tabFilters: 'Filtros',
    tabActions: 'Ações',
    tabSettings: 'Config',
    tabData: 'Dados',
    searchLabel: 'Busca',
    searchPlaceholder: 'Nome ou ID...',
    groupsLabel: 'Grupos',
    groupsNone: 'Todos os grupos',
    groupSinglePrefix: 'Grupo: ',
    groupMultiPrefix: 'Grupos: ',
    groupManyTemplate: '{count} grupos selecionados',
    groupsEmpty: 'Nenhum grupo disponível',
    typesTitle: 'Tipos',
    statusTitle: 'Status',
    statusOnline: 'Online',
    statusOffline: 'Offline',
    statusUnknown: 'Inativo',
    summaryOnline: 'Online',
    summaryOffline: 'Offline',
    summaryUnknown: 'Inativo',
    summaryTotal: 'Total',
    displayTitle: 'Exibição',
    displayIcons: 'Ícones',
    displayNames: 'Nomes',
    displayLinks: 'Links',
    legendTitle: 'Legenda',
    legendOnline: 'Online',
    legendOffline: 'Offline',
    legendInactiveText: 'Inativo (sem status do Zabbix)',
    legendLinksTitle: 'Ligações GLPI — cores e comportamento',
    legendLinksOnline: 'Online: ambos os pontos GE online (linha e luz verdes).',
    legendLinksOffline: 'Offline: ambos os pontos GE offline (linha e luz vermelhas).',
    legendLinksMixed: 'Laranja: Online × Offline ou Online × Inativo (na ligação). Ícone também fica laranja se o próprio equipamento for parcial.',
    legendLinksInactive: 'Inativo: sem fluxo nem feixe animado; permanece estático e exibe um “X” cinza no meio do link.',
    languageCardTitle: 'Idioma',
    languageLabel: 'Selecione o idioma da interface',
    languageOptionPt: 'Português (Brasil)',
    languageOptionEn: 'English',
    loadingLabel: 'Carregando equipamentos',
    fullscreenTitle: 'Tela Cheia',
    fullscreenDescription: 'Use o modo imersivo para ocultar painéis e maximizar o mapa. Atalho: F11.',
    fullscreenEnter: 'Entrar em tela cheia',
    fullscreenExit: 'Sair de tela cheia',
    fullscreenHint: 'Atalho: F11',
    dataCardTitle: 'Dados',
    dataAvailabilityTitle: 'Disponibilidade',
    dataRegionLabel: 'Região',
    dataRegionSubtitle: 'Equipamentos online',
    dataDcuLabel: 'DCU',
    dataDcuSubtitle: 'Disponibilidade',
    dataLqiLabel: 'LQI',
    dataRssiLabel: 'RSSI',
    dataWithinTarget: 'Dentro do target',
    dataOutsideTarget: 'Fora do target',
    dataAvailabilityTargetLabel: 'Disp. ≥ target',
    dataNoData: 'Sem dados',
    customStyleFallback: '{label} (estilo personalizado)',
    climateTitle: 'Clima',
    climateToggle: 'Mostrar camada climática',
    climateOpacity: 'Intensidade visual',
    climateLegend: 'Escala de chuva (mm)',
    climateWeak: 'Fraca',
    climateModerate: 'Moderada',
    climateStrong: 'Forte',
    climateLightning: 'Relâmpagos apenas em chuva intensa',
    climateTempToggle: 'Mostrar temperatura atual',
  },
  en: {
    tabFilters: 'Filters',
    tabActions: 'Actions',
    tabSettings: 'Config',
    tabData: 'Data',
    searchLabel: 'Search',
    searchPlaceholder: 'Name or ID...',
    groupsLabel: 'Groups',
    groupsNone: 'All groups',
    groupSinglePrefix: 'Group: ',
    groupMultiPrefix: 'Groups: ',
    groupManyTemplate: '{count} groups selected',
    groupsEmpty: 'No groups available',
    typesTitle: 'Types',
    statusTitle: 'Status',
    statusOnline: 'Online',
    statusOffline: 'Offline',
    statusUnknown: 'Inactive',
    summaryOnline: 'Online',
    summaryOffline: 'Offline',
    summaryUnknown: 'Inactive',
    summaryTotal: 'Total',
    displayTitle: 'Display',
    displayIcons: 'Icons',
    displayNames: 'Names',
    displayLinks: 'Links',
    legendTitle: 'Legend',
    legendOnline: 'Online',
    legendOffline: 'Offline',
    legendInactiveText: 'Inactive (no Zabbix status)',
    legendLinksTitle: 'GLPI links — colors and behavior',
    legendLinksOnline: 'Online: both GE endpoints online (green line and glow).',
    legendLinksOffline: 'Offline: both GE endpoints offline (red line and glow).',
    legendLinksMixed: 'Orange: Online vs Offline or Online vs Inactive along the link. The icon also turns orange when the equipment is mixed.',
    legendLinksInactive: 'Inactive: no flow or beam animation; remains static and shows a gray “X” on the link.',
    languageCardTitle: 'Language',
    languageLabel: 'Choose the interface language',
    languageOptionPt: 'Portuguese (Brazil)',
    languageOptionEn: 'English',
    loadingLabel: 'Loading equipment',
    fullscreenTitle: 'Fullscreen',
    fullscreenDescription: 'Hide panels and expand the map for an immersive view. Shortcut: F11.',
    fullscreenEnter: 'Enter fullscreen',
    fullscreenExit: 'Exit fullscreen',
    fullscreenHint: 'Shortcut: F11',
    dataCardTitle: 'Data',
    dataAvailabilityTitle: 'Availability',
    dataRegionLabel: 'Region',
    dataRegionSubtitle: 'Online equipment',
    dataDcuLabel: 'DCU',
    dataDcuSubtitle: 'Availability',
    dataLqiLabel: 'LQI',
    dataRssiLabel: 'RSSI',
    dataWithinTarget: 'Within target',
    dataOutsideTarget: 'Out of target',
    dataAvailabilityTargetLabel: 'Availability ≥ target',
    dataNoData: 'No data',
    customStyleFallback: '{label} (custom style)',
    climateTitle: 'Weather',
    climateToggle: 'Show weather layer',
    climateOpacity: 'Layer intensity',
    climateLegend: 'Rain scale (mm)',
    climateWeak: 'Light',
    climateModerate: 'Moderate',
    climateStrong: 'Heavy',
    climateLightning: 'Lightning only on heavy rain',
    climateTempToggle: 'Show current temperature',
  },
};

const formatTemplate = (template, vars) => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars && vars[key] != null ? vars[key] : ''));
};

const buildGroupSelectionLabel = (groups, translation) => {
  if (!groups?.length) return translation.groupsNone;
  if (groups.length === 1) return `${translation.groupSinglePrefix}${groups[0]}`;
  if (groups.length <= 3) return `${translation.groupMultiPrefix}${groups.join(', ')}`;
  return formatTemplate(translation.groupManyTemplate, { count: groups.length });
};
const resolveApiBaseUrl = () => {
  // 1) Build-time env override (CRA)
  if (process.env.REACT_APP_API_BASE_URL) {
    return String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, search, origin, port } = window.location;
    const host = hostname.includes(":") ? `[${hostname}]` : hostname;

    // Em ambientes públicos (ex.: Cloudflare quick tunnel), evitar overrides apontando para localhost,
    // porque isso vira o localhost do visitante e quebra cookies/sessão.
    const isPublicTunnel = /\.trycloudflare\.com$/i.test(hostname);

    // 2) Runtime overrides: querystring or localStorage (no rebuild needed)
    try {
      const qs = new URLSearchParams(search || "");
      const qApi = qs.get("api") || qs.get("apibase");
      const lsApi = (typeof window !== 'undefined' && window.localStorage)
        ? (localStorage.getItem("API_BASE_URL") || localStorage.getItem("apiBase") || localStorage.getItem("api"))
        : null;
      const override = qApi || lsApi;
      if (override) {
        // If it's a full URL, use as-is; if it's a port, compose with current host
        if (/^https?:\/\//i.test(override)) {
          const normalized = String(override).replace(/\/$/, "");
          if (isPublicTunnel && /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
            return "";
          }
          return normalized;
        }
        const p = String(override).trim();
        if (/^\d+$/.test(p)) {
          return `${protocol}//${host}:${p}`;
        }
      }
    } catch {}

    // 3) Default: same-origin (relative) to work with CRA proxy, gateway e túnel (ngrok)
    // Returning empty string makes fetch(`${API_BASE_URL}/api/...`) => '/api/...'
    // which is ideal behind proxies and public tunnels.
    return "";
  }

  // SSR/fallback — prefer same-origin path
  return "";
};

const API_BASE_URL = resolveApiBaseUrl();

// Helper: fetch wrapper that measures latency and returns { ok, status, json, ms }
const timedFetch = async (input, init) => {
  const start = performance.now();
  try {
    const resp = await fetch(input, init);
    const ms = Math.round(performance.now() - start);
    let json = null;
    try { json = await resp.json(); } catch (e) {}
    return { ok: resp.ok, status: resp.status, json, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return { ok: false, status: 0, json: null, ms, error: err };
  }
};

// Normalização de nome para regras (maiusc, hífens unicode -> '-')
const normalizeNameForRules = (raw) => {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\s*-\s*/g, '-');
};

// 7º caractere 'A' (ex.: CEL-S-A-022) — usado para regras especiais de DCU "A"
const isABy7thChar = (name) => {
  if (!name) return false;
  const n = String(name).trim().toUpperCase();
  return n.length >= 7 && n[6] === 'A';
};

// Status dominante pelo GE quando existir composição (labelSegments)
// Regra: se houver segmento com "-GE-":
//   - GE offline => offline
//   - GE online => online
//   - GE desconhecido => 'unknown'
// Se não houver GE, retorna null (sem override)
const geDominantStatus = (node) => {
  const segs = Array.isArray(node?.labelSegments) ? node.labelSegments : [];
  if (!segs.length) return null;
  const ge = segs.find(s => /-GE-/i.test(String(s?.text || '')));
  if (!ge) return null;
  const st = ge && ge.status;
  if (st === 'online') return 'online';
  if (st === 'offline') return 'offline';
  return 'unknown';
};

const shouldDiscardByName = (name) => {
  const n = normalizeNameForRules(name);
  if (!n) return false;
  if (n.includes('-S-R-')) return true; // padrão direto
  const seventhIsR = n.length >= 7 && n[6] === 'R';
  if (seventhIsR) return true;
  const tokens = n.split('-').filter(Boolean);
  const thirdTokenIsR = tokens.length >= 3 && tokens[2] === 'R';
  return thirdTokenIsR;
};

// Normaliza status vindo do backend/Zabbix para 'online' | 'offline' | 'unknown'
// Cobertura extra: valores numéricos/booleanos (Zabbix icmpping: 1=UP, 0=DOWN)
const normalizeStatus = (raw) => {
  if (raw === true) return 'online';
  if (raw === false) return 'offline';

  if (typeof raw === 'number') {
    if (raw === 1) return 'online';
    if (raw === 0) return 'offline';
  }

  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  // Mapear variações comuns vindas do Zabbix/GLPI/integrações
  const on = [
    'online', 'up', 'ativo', 'on', 'operacional', 'available', 'ok', 'reachable',
    'alive', 'running', 'success'
  ];
  const off = [
    'offline', 'down', 'inativo', 'off', 'indisponivel', 'indisponível', 'unavailable', 'nok', 'falha', 'unreachable',
    'problem', 'timeout', 'failed'
  ];
  if (on.includes(s)) return 'online';
  if (off.includes(s)) return 'offline';
  // Strings numéricas
  if (s === '1') return 'online';
  if (s === '0') return 'offline';
  return 'unknown';
};

// Configuração inicial da câmera com perspectiva 3D sobre o estado do Paraná.
const INITIAL_VIEW_STATE = {
  longitude: -51.9,
  latitude: -24.5,
  zoom: 7,
  pitch: 50,
  bearing: 30,
  maxPitch: 85,
};

const API_RETRY_INTERVAL = 15000;

const ONLINE_COLOR = [34, 197, 94, 220];
const OFFLINE_COLOR = [220, 64, 52, 220];
const UNKNOWN_COLOR = [0x74, 0x75, 0x72, 220]; // cinza #747572 (Inativo)
const LINK_THICKNESS_MULTIPLIER = 1.3; // 30% mais grosso nas linhas de ligação
const LINK_BASE_WIDTH_PX = 1.2 * LINK_THICKNESS_MULTIPLIER;
const LINK_FLOW_WIDTH_PX = 1.1 * LINK_THICKNESS_MULTIPLIER;
const LINK_BEAM_WIDTH_PX = 1.8 * LINK_THICKNESS_MULTIPLIER;
const LINK_BEAM_FALLBACK_WIDTH_PX = 1.6 * LINK_THICKNESS_MULTIPLIER;
const LINK_BASE_MIN_PIXELS = Math.ceil(LINK_BASE_WIDTH_PX);
const LINK_FLOW_MIN_PIXELS = Math.ceil(LINK_FLOW_WIDTH_PX);
const LINK_BEAM_MIN_PIXELS = Math.ceil(LINK_BEAM_WIDTH_PX);
const LINK_BEAM_FALLBACK_MIN_PIXELS = Math.ceil(LINK_BEAM_FALLBACK_WIDTH_PX);
const LINK_SAMPLE_HEIGHT_ACTIVE = Math.max(3, Math.round(3 * LINK_THICKNESS_MULTIPLIER));
const LINK_SAMPLE_HEIGHT_INACTIVE = Math.max(2, Math.round(2 * LINK_THICKNESS_MULTIPLIER));

const enforceCoordinateBounds = (value, type) => {
  if (!Number.isFinite(value)) return null;
  const limit = type === "latitude" ? 90 : 180;
  return Math.abs(value) <= limit ? value : null;
};

const parseCoordinateValue = (rawValue, type) => {
  if (Number.isFinite(rawValue)) {
    return enforceCoordinateBounds(rawValue, type);
  }

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const text = String(rawValue).trim();
  if (!text) {
    return null;
  }

  const normalizedText = text.replace(/,/g, ".").toUpperCase();
  const directionMatch = normalizedText.match(/[NSEW]/);

  const resolveSign = (baseValue) => {
    if (directionMatch) {
      const direction = directionMatch[0];
      if (direction === "S" || direction === "W") {
        return -1;
      }
      if (direction === "N" || direction === "E") {
        return 1;
      }
    }

    if (baseValue < 0) {
      return -1;
    }

    if (/^-/.test(normalizedText)) {
      return -1;
    }

    return 1;
  };

  if (/[°º'"]/u.test(normalizedText)) {
    const sanitizedForDms = normalizedText.replace(/[^0-9.+°º'"\s-]/g, " ");
    const dmsParts = sanitizedForDms
      .split(/[^0-9.+-]+/)
      .filter(Boolean)
      .map(Number.parseFloat);

    if (dmsParts.length && Number.isFinite(dmsParts[0])) {
      const [degreesRaw, minutesRaw = 0, secondsRaw = 0] = dmsParts;
      const sign = resolveSign(degreesRaw);
      const minutes = Number.isFinite(minutesRaw) ? Math.abs(minutesRaw) : 0;
      const seconds = Number.isFinite(secondsRaw) ? Math.abs(secondsRaw) : 0;
      const decimal =
        Math.abs(degreesRaw) +
        minutes / 60 +
        seconds / 3600;

      return enforceCoordinateBounds(decimal * sign, type);
    }
  }

  const decimalMatch = normalizedText.match(/[+-]?\d+(?:\.\d+)?/);
  if (!decimalMatch) {
    return null;
  }

  const parsed = Number.parseFloat(decimalMatch[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const sign = resolveSign(parsed);
  const result = Math.abs(parsed) * sign;

  return enforceCoordinateBounds(result, type);
};

// Tenta derivar status diretamente de campos de ping do Zabbix, se presentes
const deriveStatusFromPing = (record) => {
  if (!record || typeof record !== 'object') return null;
  const candidates = [
    record.icmpping,
    record.icmpping_value,
    record.icmppingstatus,
    record.ping,
    record.zabbix_icmpping,
    record.icmpPing,
    record.icmp_ping,
    record.zabbix_ping,
  ];
  for (const v of candidates) {
    const ns = normalizeStatus(v);
    if (ns === 'online' || ns === 'offline') return ns;
  }
  return null;
};

// Detecta se o registro contém alguma informação que indique existência no Zabbix
// Inclui também hosts desabilitados/inativos (devem aparecer como "Inativos" no mapa)
const hasZabbixInfo = (record) => {
  if (!record || typeof record !== 'object') return false;
  const keys = Object.keys(record).map(k => k.toLowerCase());
  const zabbixKeys = [
    'icmpping','icmpping_value','icmppingstatus','ping','zabbix_icmpping','icmp_ping','icmpPing','zabbix_ping',
    'zabbix_hostid','zabbix_host','zabbixid','zabbix_id',
    // indicadores comuns de presença no Zabbix, mesmo se inativo/desabilitado
    'hostid','available','zabbix_available','status_zabbix','host_status'
  ];
  for (const k of zabbixKeys) {
    if (keys.includes(k)) return true;
  }
  // Fallback: se o campo status parece vir do Zabbix (valores 'online'/'offline' ou 0/1)
  const s = record.status ?? record.state ?? record.situacao ?? record.Status ?? record.STATUS;
  // Zabbix costuma expor: available (0=unknown,1=up,2=down), status (0=enabled,1=disabled)
  if (typeof s === 'number') {
    if (s === 1 || s === 0 || s === 2) return true; // considerar 2 (down) como presença também
  }
  if (typeof s === 'string') {
    const sl = s.trim().toLowerCase();
    if (['online','offline','up','down','inactive','inativo','disabled','desabilitado','unknown'].includes(sl)) return true;
  }
  return false;
};



const ParanaNetworkMap = () => {
  const [radioBase, setRadioBase] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [nextRetryTimestamp, setNextRetryTimestamp] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [autoRefreshMs, setAutoRefreshMs] = useState(0); // default: Não Atualizar
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [panelHidden, setPanelHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document !== 'undefined') {
      const doc = document;
      return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
    }
    return false;
  });
  const panelHiddenBeforeFullscreenRef = useRef(false);
  const panelHiddenRef = useRef(panelHidden);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [apiLatencyMs, setApiLatencyMs] = useState(null);
  const [detailsCache, setDetailsCache] = useState({}); // id -> details object
  const [detailsLoading, setDetailsLoading] = useState({});
  const [hoveredId, setHoveredId] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayFading, setOverlayFading] = useState(false);
  const didSignalReadyRef = useRef(false);
  const [activeTab, setActiveTab] = useState('filters'); // 'filters' | 'actions' | 'settings'
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false); // Novo estado para o dropdown customizado
  const [groupsError, setGroupsError] = useState(null);
  // UI panes e toggles
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [timePickerLabel, setTimePickerLabel] = useState('Últimos 15 minutos');
  const [hideLabels, setHideLabels] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [showIcons, setShowIcons] = useState(true);
  const [typeFilters, setTypeFilters] = useState({ DCU: true, P70: true, BackHaul: true, DA: true, Other: true });
  const [statusFilters, setStatusFilters] = useState({ online: true, offline: true, unknown: true });
  const [onlyWithIcon, setOnlyWithIcon] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [nameMode, setNameMode] = useState('contains'); // 'contains' | 'exact'
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showLinks, setShowLinks] = useState(true); // ligações GLPI (ligado para facilitar visualização)
  const [showWeather, setShowWeather] = useState(false);
  const [showClimateModal, setShowClimateModal] = useState(false);
  const [weatherOpacity, setWeatherOpacity] = useState(0.75);
  const [weatherFrame, setWeatherFrame] = useState(0);
  const [rainCells] = useState(DEFAULT_RAIN_CELLS);
  const [showTemperature, setShowTemperature] = useState(true);
  const [temperaturePoints, setTemperaturePoints] = useState(DEFAULT_TEMPERATURES);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [mapStyleId, setMapStyleId] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
        if (stored && MAP_STYLE_OPTIONS.some(opt => opt.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return DEFAULT_MAP_STYLE_ID;
  });
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedLang = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLang && TRANSLATIONS[storedLang]) {
          return storedLang;
        }
      } catch {}
    }
    return 'pt';
  });
  // Ping UI state
  const [pingModalOpen, setPingModalOpen] = useState(false);
  const [pingScope, setPingScope] = useState('visible'); // 'visible' | 'group'
  const [pingRunning, setPingRunning] = useState(false);
  const [pingResults, setPingResults] = useState(null);
  const [pingSingleName, setPingSingleName] = useState('');
  const [pingInputError, setPingInputError] = useState(null);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const weatherCanvasRef = useRef(null);
  const weatherFlashesRef = useRef([]);

  const nearestTemperature = useMemo(() => {
    if (!showTemperature || !temperaturePoints.length) return null;
    const centerLng = Number(viewState?.longitude) || 0;
    const centerLat = Number(viewState?.latitude) || 0;
    const toRad = (d) => (d * Math.PI) / 180;
    const hav = (a, b) => {
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const v = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
    };
    const sorted = [...temperaturePoints].map(tp => ({ ...tp, dist: hav({ lat: centerLat, lng: centerLng }, tp) }));
    sorted.sort((a, b) => a.dist - b.dist);
    return sorted[0] || null;
  }, [showTemperature, temperaturePoints, viewState]);

  const weatherWidgetData = useMemo(() => {
    const tempPoint = nearestTemperature;
    if (!tempPoint) return null;
    // calcula a célula de chuva mais próxima do ponto de temperatura
    const toRad = (d) => (d * Math.PI) / 180;
    const hav = (a, b) => {
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const v = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
      return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
    };
    let nearestRain = null;
    if (Array.isArray(rainCells) && rainCells.length) {
      nearestRain = [...rainCells]
        .map(r => ({ ...r, dist: hav({ lat: tempPoint.lat, lng: tempPoint.lng }, { lat: r.lat, lng: r.lng }) }))
        .sort((a, b) => a.dist - b.dist)[0];
    }
    const rainMm = nearestRain ? (nearestRain.mm || 0) : 0;
    // Se a célula de chuva mais próxima estiver muito longe, ignore chuva.
    const rainDistanceKm = nearestRain ? (nearestRain.dist || 9999) : 9999;
    const RAIN_DISTANCE_THRESHOLD_KM = 80; // considerar chuva apenas se a célula estiver dentro de 80km

    let condition = 'Nublado';
    if (rainDistanceKm <= RAIN_DISTANCE_THRESHOLD_KM) {
      if (rainMm >= 25) condition = 'Tempestade';
      else if (rainMm >= 8) condition = 'Chuva';
    }
    // Se não há chuva próxima o suficiente, basear em temperatura
    if (condition === 'Nublado' && (tempPoint.temp || 0) >= 28) condition = 'Ensolarado';
    const feelsLike = Math.round((tempPoint.temp || 0) + 3);
    const humidity = `${40 + Math.round(Math.max(0, 20 - (tempPoint.temp || 0)))}%`;
    const wind = `${8 + Math.round((tempPoint.temp || 0) / 3)} km/h`;
    const uv = (tempPoint.temp || 0) > 30 ? 'Muito Alto' : (tempPoint.temp || 0) > 25 ? 'Alto' : 'Moderado';
    return {
      city: tempPoint.id,
      temp: Math.round(tempPoint.temp),
      condition,
      feelsLike,
      humidity,
      wind,
      uvIndex: uv,
    };
  }, [nearestTemperature, rainCells]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const doc = document;
    const activeFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || doc.mozFullScreenElement;
    const target = containerRef.current || doc.documentElement;
    if (!activeFs) {
      const request = target && (target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen || target.mozRequestFullScreen);
      if (request) {
        panelHiddenBeforeFullscreenRef.current = panelHiddenRef.current;
        setPanelHidden(true);
        try {
          const result = request.call(target);
          if (result && typeof result.catch === 'function') {
            result.catch((err) => console.warn('[fullscreen] request failed', err));
          }
        } catch (err) {
          console.warn('[fullscreen] request failed', err);
        }
      }
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen || doc.mozCancelFullScreen;
      if (exit) {
        try {
          const result = exit.call(doc);
          if (result && typeof result.catch === 'function') {
            result.catch((err) => console.warn('[fullscreen] exit failed', err));
          }
        } catch (err) {
          console.warn('[fullscreen] exit failed', err);
        }
      }
    }
  }, [setPanelHidden]);

  useEffect(() => {
    panelHiddenRef.current = panelHidden;
  }, [panelHidden]);

  // Load current user info (for greeting/logout)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.user) setCurrentUser(data.user);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchUser();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) { /* ignore */ }
    const next = encodeURIComponent(window.location.pathname || '/');
    // Use relative path so origin doesn't change (prevents redirect to backend host)
    window.location.href = `/Login/?next=${next}`;
  }, []);

  // Temperatura via OpenWeatherMap (fallback para mock se falhar)
  useEffect(() => {
    if (!showTemperature) return undefined;
    let stop = false;
    const apiKey = process.env.REACT_APP_OWM_KEY || 'ef131c4207bd80d9662570e442e1a51b';
    const fetchTemps = async () => {
      try {
        const results = await Promise.all(WEATHER_LOCATIONS.map(async (loc) => {
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lng}&appid=${apiKey}&units=metric`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const data = await resp.json();
          const temp = data && data.main && Number(data.main.temp);
          if (!Number.isFinite(temp)) return null;
          return { ...loc, temp };
        }));
        const filtered = results.filter(Boolean);
        if (!stop && filtered.length) {
          setTemperaturePoints(filtered);
        }
      } catch (e) {
        // fallback silently to defaults
      }
      if (!stop) {
        setTimeout(fetchTemps, 10 * 60 * 1000); // refresh a cada 10 min
      }
    };
    fetchTemps();
    return () => { stop = true; };
  }, [showTemperature]);

  // Renderiza nuvens/chuva em canvas e anima com drift + raios pontuais
  useEffect(() => {
    if (!showWeather) return undefined;
    const canvas = weatherCanvasRef.current || (weatherCanvasRef.current = document.createElement('canvas'));
    canvas.width = WEATHER_CANVAS_SIZE;
    canvas.height = WEATHER_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const [minLng, minLat, maxLng, maxLat] = WEST_PARANA_BOUNDS;
    const spanLng = maxLng - minLng;
    const spanLat = maxLat - minLat;
    const project = (lng, lat) => {
      const x = ((lng - minLng) / spanLng) * canvas.width;
      const y = (1 - (lat - minLat) / spanLat) * canvas.height;
      return [x, y];
    };
    const polygonPx = WEST_PARANA_POLYGON.map(([lng, lat]) => project(lng, lat));

    let timer = null;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      polygonPx.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();

      // Mancha fixa (radar-like) para dar referência visual estática
      const fixed = { lng: -53.8, lat: -24.9, mm: 30 };
      const [fx, fy] = project(fixed.lng, fixed.lat);
      const fIntensity = Math.min(1, fixed.mm / 60);
      const fShade = Math.round(220 - fIntensity * 170);
      const fAlpha = 0.55 * weatherOpacity;
      const fRadius = 320;
      const gFixed = ctx.createRadialGradient(fx, fy, 0, fx, fy, fRadius);
      gFixed.addColorStop(0, `rgba(${fShade},${fShade},${fShade},${fAlpha})`);
      gFixed.addColorStop(0.6, `rgba(${fShade},${fShade},${fShade},${fAlpha * 0.65})`);
      gFixed.addColorStop(1, `rgba(${fShade},${fShade},${fShade},0)`);
      ctx.fillStyle = gFixed;
      ctx.beginPath();
      ctx.arc(fx, fy, fRadius, 0, Math.PI * 2);
      ctx.fill();

      const now = performance.now();
      const heavyCells = [];
      rainCells.forEach((cell, idx) => {
        const mm = Math.max(0, Number(cell.mm) || 0);
        if (mm <= 0) return;
        if (mm >= 20) heavyCells.push(cell);

        // small spatial drift for animation
        const driftX = Math.sin(now / 8200 + idx * 0.9) * 0.12;
        const driftY = Math.cos(now / 9100 + idx * 0.85) * 0.09;
        const [cx, cy] = project(cell.lng + driftX * 0.15, cell.lat + driftY * 0.15);

        const intensity = Math.min(1, mm / 60);

        // color scale (technical, non-neon):
        // - weak (mm < 10): very dark (near black)
        // - moderate (10 <= mm < 30): gray shades
        // - strong (30 <= mm < 50): white (high concentration)
        // - severe (mm >= 50): red (alert)
        let c;
        if (mm >= 50) c = [220, 40, 40];
        else if (mm >= 30) c = [255, 255, 255];
        else if (mm >= 10) c = [170, 170, 170];
        else c = [28, 28, 30];

        // subtle pulsing factor so layer looks live but not flashy
        const pulse = 0.88 + 0.12 * Math.sin(now / 700 + idx * 0.6);

        // base alpha respects intensity and global weatherOpacity, remain semi-transparent
        const alphaBase = Math.max(0.05, 0.55 * intensity) * weatherOpacity;
        const alpha = Math.min(1, Math.max(0, alphaBase * pulse));

        // radius with slight time-based variation
        const radius = 40 + intensity * 220 * (0.92 + 0.16 * Math.sin(now / 1100 + idx));

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`);
        g.addColorStop(0.45, `rgba(${c[0]},${c[1]},${c[2]},${alpha * 0.55})`);
        g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      const nowMs = Date.now();
      let flashes = (weatherFlashesRef.current || []).filter(f => (nowMs - f.start) < f.ttl);
      if (heavyCells.length && Math.random() < 0.28) {
        const base = heavyCells[Math.floor(Math.random() * heavyCells.length)];
        const jitterLng = (Math.random() - 0.5) * 0.08;
        const jitterLat = (Math.random() - 0.5) * 0.06;
        flashes = flashes.concat({
          position: [base.lng + jitterLng, base.lat + jitterLat],
          start: nowMs,
          ttl: 900 + Math.random() * 600,
          radius: 900 + base.mm * 60,
        });
      }
      weatherFlashesRef.current = flashes;

      setWeatherFrame((f) => (f + 1) % 1_000_000);
      timer = setTimeout(loop, 450);
    };

    loop();
    return () => { if (timer) clearTimeout(timer); };
  }, [showWeather, rainCells, weatherOpacity]);

  const isSuperAdmin = useMemo(() => currentUser?.role === 'super_admin', [currentUser]);

  useEffect(() => {
    if (!isSuperAdmin && showAdminConsole) setShowAdminConsole(false);
  }, [isSuperAdmin, showAdminConsole]);

  // helper para executar ping via backend (/api/ping) e atualizar estado
  const doPing = async (names) => {
    setPingModalOpen(true);
    setPingRunning(true);
    setPingResults(null);
    try {
      const body = { names: Array.isArray(names) ? names : [String(names || '')] };
      const resp = await timedFetch(`${API_BASE_URL}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setApiLatencyMs(resp.ms ?? null);
      if (!resp.ok) {
        setPingResults({ ok: false, error: `HTTP ${resp.status}` });
      } else {
        setPingResults(resp.json || { ok: false, error: 'Resposta inválida' });
      }
    } catch (e) {
      setPingResults({ ok: false, error: e?.message || String(e) });
    } finally {
      setPingRunning(false);
    }
  };

  // Fallback: mapa de métricas conhecidas por nome (reaproveita o que já funciona nos mapas)
  const metricsByName = useMemo(() => {
    const map = new Map();
    const parseTxRate = (raw) => {
      if (!raw) return null;
      const pick = (obj, key) => (obj && Object.prototype.hasOwnProperty.call(obj, key)) ? obj[key] : undefined;
      const pd = (raw && (raw.pd || raw.PD || raw.Pd)) || raw;
      const candidates = [
        pick(raw, 'taxadetransmissofield'), pick(raw, 'taxaDeTransmissoField'), pick(raw, 'taxa_transmissao'),
        (pd ? pd.taxadetransmissofield : undefined), (pd ? pd.taxaDeTransmissoField : undefined)
      ].filter(v => v != null);
      for (const c of candidates) {
        const s = String(c);
        const m = s.match(/([0-9]{2,4})/);
        if (m) {
          const n = Number(m[1]);
          if ([250, 500, 1000].includes(n)) return n;
        }
      }
      return null;
    };
    const push = (name, avail, rssi, lqi, raw) => {
      if (!name) return;
      const key = String(name).trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          availabilityPct: (typeof avail === 'number' ? avail : null),
          rssi: (typeof rssi === 'number' ? rssi : null),
          lqi: (typeof lqi === 'number' ? lqi : null),
          txRateKbps: parseTxRate(raw) || null,
        });
      }
    };
    try {
      for (const r of radioBase || []) {
        if (!r) continue;
        // Métricas do próprio nó
        push(r.name, r['icmp.success.24h'], r.rssi, r.lqi, r.raw || r);
        // Métricas por segmento (agregados com labelSegments)
        if (Array.isArray(r.labelSegments)) {
          for (const seg of r.labelSegments) {
            if (!seg) continue;
            push(seg.text, seg['icmp.success.24h'], seg.rssi, seg.lqi, (r.raw || r));
          }
        }
      }
    } catch {}
    return map;
  }, [radioBase]);

  const REFRESH_PRESETS = [
    { label: '30 Min', value: 30 * 60000 },
    { label: '1 Hora', value: 60 * 60000 },
    { label: '2 Horas', value: 120 * 60000 },
    { label: '24 Horas', value: 24 * 60 * 60000 },
    { label: 'Não Atualizar', value: 0 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleId);
      } catch {}
    }
  }, [mapStyleId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {}
    }
  }, [language]);

  const selectedMapStyle = useMemo(() => {
    return MAP_STYLE_OPTIONS.find(opt => opt.id === mapStyleId) || MAP_STYLE_OPTIONS[0];
  }, [mapStyleId]);
  const currentMapStyle = selectedMapStyle.style;
  const t = useMemo(() => TRANSLATIONS[language] || TRANSLATIONS.pt, [language]);
  const readableMapStyle = useMemo(() => {
    if (typeof selectedMapStyle.style === 'string') {
      return selectedMapStyle.style;
    }
    return formatTemplate(t.customStyleFallback, { label: selectedMapStyle.label });
  }, [selectedMapStyle, t]);
  const isLightMapTheme = selectedMapStyle?.tone === 'light';
  const supportsNativeTerrain = !!selectedMapStyle?.supportsTerrain;
  const hasSelectedGroups = selectedGroups.length > 0;
  const selectedGroupsLabel = useMemo(() => buildGroupSelectionLabel(selectedGroups, t), [selectedGroups, t]);
  const formatPercent = (value, decimals = 1) => {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toFixed(decimals)}%`;
  };
  const formatCounts = (good, total) => {
    if (!total) return t.dataNoData;
    return `${good}/${total}`;
  };

  const searchableEquipmentNames = useMemo(() => {
    const set = new Set();
    for (const radio of radioBase) {
      const main = normalizeForSearch(radio?.name || radio?.id);
      if (main) set.add(main);
      if (Array.isArray(radio?.labelSegments)) {
        for (const seg of radio.labelSegments) {
          const segName = normalizeForSearch(seg?.text);
          if (segName) set.add(segName);
        }
      }
    }
    return set;
  }, [radioBase]);

  // Não simulamos mais status; usamos o status real vindo do backend.

  useEffect(() => {
    let isActive = true;
    let retryTimer;

    const scheduleRetry = (message) => {
      if (!isActive) return;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      setLoadError(
        `${message} Nova tentativa em ${API_RETRY_INTERVAL / 1000}s.`
      );
      const nextAttempt = Date.now() + API_RETRY_INTERVAL;
      setNextRetryTimestamp(nextAttempt);
      retryTimer = setTimeout(() => {
        setRetryAttempt((previous) => previous + 1);
      }, API_RETRY_INTERVAL);
    };

    const loadRadios = async (triggeredByAuto = false) => {
      try {
        if (!isActive) return;

        setIsLoading(true);
        setLoadError(null);
        setNextRetryTimestamp(null);

    const query = (() => {
      if (!hasSelectedGroups) return '';
      const params = new URLSearchParams();
      selectedGroups.forEach(groupName => {
        if (groupName) params.append('group', groupName);
      });
      const serialized = params.toString();
      return serialized ? `?${serialized}` : '';
    })();
    const resp = await timedFetch(`${API_BASE_URL}/api/radios${query}`);
        setApiLatencyMs(resp.ms ?? null);
        if (!resp.ok) {
          throw new Error(`Erro ao carregar rádios: ${resp.status}`);
        }

        const payload = resp.json ?? { radios: [] };
        const radiosFromApi = Array.isArray(payload.radios)
          ? payload.radios
          : [];

        if (!isActive) return;

        const normalized = radiosFromApi
          .map((radio, index) => {
            // Filtro frontend extra (safety): ignora nomes com 7º char 'R' ou padrão -S-R-
            if (shouldDiscardByName(radio.name ?? radio.nome)) {
              return null;
            }
            const latitude = parseCoordinateValue(radio.latitude, "latitude");
            const longitude = parseCoordinateValue(
              radio.longitude,
              "longitude"
            );

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }

            // Propaga labelSegments (se vier do backend) preservando métricas por segmento
            const segments = Array.isArray(radio.labelSegments)
              ? radio.labelSegments.map(s => ({
                  text: String(s.text || '').trim(),
                  status: normalizeStatus(s.status),
                  // preservar métricas individuais quando presentes no backend
                  rssi: s?.rssi ?? null,
                  lqi: s?.lqi ?? null,
                  tipoEquipamento: s?.tipoEquipamento ?? s?.tipo ?? null,
                  ['icmp.success.24h']: (s && (s['icmp.success.24h'] ?? s.icmp_success_24h ?? s.icmpSuccess24h ?? s.availability)) ?? null,
                  modoOperacao: s?.modoOperacao ?? null,
                }))
              : undefined;

            // Status: prioriza Zabbix icmpping quando disponível
            const pingStatus = deriveStatusFromPing(radio);
            const statusNorm = pingStatus || normalizeStatus(
              radio.status ?? radio.state ?? radio.situacao ?? radio.Status ?? radio.STATUS
            );

            // Detecta se este registro tem informação vinda do Zabbix
            const presentInZabbix = hasZabbixInfo(radio) || (pingStatus !== null) || (statusNorm === 'online' || statusNorm === 'offline');

            return {
              id: radio.id ?? `radio-${index + 1}`,
              name: radio.name ?? radio.nome ?? `Rádio ${index + 1}`,
              status: statusNorm,
              hasZabbix: presentInZabbix,
              position: [longitude, latitude],
              // Propaga tipo para o IconLayer
              tipoEquipamento: radio.tipoEquipamento ?? radio.tipo ?? radio.type ?? null,
              // Propaga modo de operação
              modoOperacao: radio.modoOperacao ?? null,
              // Extrai PS POSTE seguindo o mesmo padrão usado para tipo: tenta pd.pspostefield primeiro, depois aliases
              psPoste: radio?.pd?.pspostefield ?? radio.pspostefield ?? radio.ps_poste ?? radio.psPoste ?? null,
              // Extrai azimute quando disponível (pd.azimutefield ou aliases)
              azimute:
                ((radio && radio.pd && (radio.pd.azimutefield ?? radio.pd.azimute)) ||
                radio.azimutefield || radio.azimute || radio.azimute_field || null),
              // Tipo de antena (quando houver objeto ou string)
              tipoAntena:
                (radio.tipodeantena && (typeof radio.tipodeantena === 'object' ? (radio.tipodeantena.name || radio.tipodeantena.label) : radio.tipodeantena)) ||
                (radio.plugin_fields_tipodeantenafielddropdowns && (typeof radio.plugin_fields_tipodeantenafielddropdowns === 'object' ? (radio.plugin_fields_tipodeantenafielddropdowns.name || radio.plugin_fields_tipodeantenafielddropdowns.label) : radio.plugin_fields_tipodeantenafielddropdowns)) ||
                null,
              // Propaga ID B2B para tooltip
              idB2b: radio.idB2b ?? radio["ID B2B"] ?? null,
              labelSegments: segments,
              idProximoEquipamento: radio.idProximoEquipamento || null,
              // preserva dados brutos da API para tooltips e diagnósticos (ex.: campos do GLPI / Zabbix)
              raw: radio,
            };
          })
          .filter(Boolean)
          // remover equipamentos sem presença no Zabbix conforme solicitado
          .filter(r => r.hasZabbix);

        // Diagnóstico: distribuição de status após normalização
        try {
          const statusStats = normalized.reduce((acc, r) => {
            const k = r.status || 'unknown';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {});
          console.info('[Status][normalized]', {
            online: statusStats.online || 0,
            offline: statusStats.offline || 0,
            unknown: statusStats.unknown || 0,
          });
        } catch {}

        // (diag movido para após withDcuAgg)

        if (!normalized.length) {
          const invalidCount = radiosFromApi.length;
          console.warn(
            invalidCount
              ? `Nenhum rádio com coordenadas válidas retornado pela API. Registros recebidos: ${invalidCount}.`
              : "A API respondeu sem registros de rádio."
          );
          scheduleRetry(
            invalidCount
              ? "Nenhum equipamento possui latitude/longitude válida no momento."
              : "Nenhum equipamento foi retornado pela API."
          );
          return;
        }

        if (normalized.length < radiosFromApi.length) {
          console.warn(
            `Ignorando ${radiosFromApi.length - normalized.length} registros sem coordenadas válidas.`
          );
        }

  // Log rápido: quantos itens possuem campo de próximo equipamento
  const withNextCount = radiosFromApi.filter(r => r && r.idProximoEquipamento && String(r.idProximoEquipamento).trim()).length;
  console.info('[GLPI] itens com idProximoEquipamento (raw API):', withNextCount);

  // Agrupamento DCU: nomes terminados com -001/-002/-003 em um único item
        const groupDcuTriplets = (items) => {
          const candidates = [];
          const byBase = new Map();
          const isDcu = (t) => {
            const lbl = normalizeTypeLabel(t);
            return lbl.includes('gab') && lbl.includes('dcu');
          };
          for (const r of items) {
            if (!isDcu(r.tipoEquipamento || r.tipo || r.type)) continue;
            const nm = String(r.name || '').trim();
            // Casa exatamente sufixos 001, 002 ou 003
            const m = nm.match(/^(.*?)-(001|002|003)$/);
            if (!m) continue;
            const base = m[1];
            const suffix = m[2];
            const key = base;
            const arr = byBase.get(key) || [];
            arr.push({ ...r, __dcuBase: base, __dcuSuffix: suffix });
            byBase.set(key, arr);
          }

          if (!byBase.size) return { result: items, groups: 0 };

          const consumedIds = new Set();
          const aggregates = [];
          for (const [base, arr] of byBase.entries()) {
            // Considera apenas grupos com pelo menos 2 membros do conjunto {001,002,003}
            const present = arr.filter(x => x.__dcuSuffix === '001' || x.__dcuSuffix === '002' || x.__dcuSuffix === '003');
            if (present.length < 2) continue;
            // Ordena por sufixo 001,002,003
            present.sort((a,b) => a.__dcuSuffix.localeCompare(b.__dcuSuffix, undefined, { numeric: true }));
            // Nome composto
            const parts = ['001','002','003'].map(suf => {
              const found = present.find(p => p.__dcuSuffix === suf);
              return found ? `${base}-${suf}` : null;
            }).filter(Boolean);
            const composedName = parts.join('/');
            // Status agregado
            let aggStatus = 'unknown';
            const anyOffline = present.some(p => p.status === 'offline');
            const anyOnline = present.some(p => p.status === 'online');
            if (anyOffline) aggStatus = 'offline'; else if (anyOnline) aggStatus = 'online';
            // Posição média
            const avg = present.reduce((acc, p) => {
              acc[0] += p.position[0];
              acc[1] += p.position[1];
              return acc;
            }, [0,0]);
            const pos = [avg[0]/present.length, avg[1]/present.length];
            // PS POSTE agregado (únicos, ordem de aparição)
            const psSet = new Set();
            for (const mem of present) {
              const v = (mem.psPoste ?? (mem.raw && (mem.raw.pd?.pspostefield ?? mem.raw.pspostefield)) ?? null);
              const vs = v != null ? String(v).trim() : '';
              if (vs) psSet.add(vs);
            }
            const psJoined = Array.from(psSet).join('/') || null;
            // Tipo de antena agregado (únicos)
            const tipoAntSet = new Set();
            for (const mem of present) {
              const v = (mem.tipoAntena ?? (mem.raw && (mem.raw.tipodeantena?.name || mem.raw.tipodeantena)) ?? null);
              const vs = v != null ? String(v).trim() : '';
              if (vs) tipoAntSet.add(vs);
            }
            const tipoAntJoined = Array.from(tipoAntSet).join('/') || null;
            // Azimute agregado (únicos)
            const azSet = new Set();
            for (const mem of present) {
              const v = (mem.azimute ?? (mem.raw && (mem.raw.pd?.azimutefield ?? mem.raw.azimutefield ?? mem.raw.azimute)) ?? null);
              const vs = v != null ? String(v).trim() : '';
              if (vs) azSet.add(vs);
            }
            const azJoined = Array.from(azSet).join('/') || null;
            // Marca consumidos
            present.forEach(p => consumedIds.add(p.id));
            // Tipo: manter DCU
            const tipo = 'dcu_inicial';
            // Unifica idProximoEquipamento dos membros para não perder ligações
            const collectTargets = (raw) => {
              if (!raw) return [];
              return String(raw)
                .split(/[\/;,\n]+/)
                .map(t => t.trim())
                .filter(Boolean);
            };
            const targetsSet = new Set();
            for (const mem of present) {
              const parts = collectTargets(mem.idProximoEquipamento);
              for (const p of parts) targetsSet.add(p);
            }
            const mergedProximo = Array.from(targetsSet).join(' / ') || null;
            aggregates.push({
              id: `dcu-agg-${base}`,
              name: composedName,
              status: aggStatus,
              position: pos,
              tipoEquipamento: tipo,
              psPoste: psJoined,
              tipoAntena: tipoAntJoined,
              tipodeantena: tipoAntJoined,
              azimute: azJoined,
              azimutefield: azJoined,
              idProximoEquipamento: mergedProximo,
              labelSegments: present.map(p => ({
                text: `${base}-${p.__dcuSuffix}`,
                status: p.status === 'online' ? 'online' : (p.status === 'offline' ? 'offline' : 'unknown'),
              })),
            });
          }

          if (!aggregates.length) return { result: items, groups: 0 };
          const result = items.filter(r => !consumedIds.has(r.id)).concat(aggregates);
          return { result, groups: aggregates.length };
        };

  const { result: withDcuAgg, groups: dcuAggCount } = groupDcuTriplets(normalized);
        if (dcuAggCount > 0) {
          console.info(`[DCU][Agg] ${dcuAggCount} grupo(s) agregados (-001/-002/-003).`);
          const sample = withDcuAgg.filter(x => String(x.tipoEquipamento||'').includes('dcu_inicial')).slice(0,3);
          if (sample.length) {
            console.info('[DCU][Agg][sample]', sample.map(s => ({ name: s.name, status: s.status, pos: s.position })));
          }
        }

        // Construção de ligações (edges) baseadas no GLPI: idProximoEquipamento
        // - pega até 12 primeiros caracteres do nome para identificar
        // - aceita múltiplos nomes no campo separados por '/', ';', ',' ou quebras de linha
        const buildEdges = (items) => {
          const idx = new Map(); // chave: 12 chars normalizados -> radio
          const key12 = (s) => String(s || '').trim().slice(0, 12).toUpperCase();
          const keysForItem = (r) => {
            const keys = new Set();
            // chave pelo nome completo
            const kMain = key12(r.name || r.id);
            if (kMain) keys.add(kMain);
            // se nome tiver múltiplos segmentos (ex: A/B/C), indexar cada parte
            const partsFromName = String(r.name || '')
              .split(/\s*\/\s+/)
              .map(t => t.trim())
              .filter(Boolean);
            for (const p of partsFromName) {
              const k = key12(p);
              if (k) keys.add(k);
            }
            // se houver labelSegments (ex: agregações), indexar textos
            if (Array.isArray(r.labelSegments)) {
              for (const seg of r.labelSegments) {
                const t = seg && seg.text ? String(seg.text).trim() : '';
                if (!t) continue;
                const k = key12(t);
                if (k) keys.add(k);
              }
            }
            return Array.from(keys);
          };
          items.forEach(r => {
            for (const k of keysForItem(r)) {
              // último ganha, mas todos apontam ao mesmo rádio agregado
              idx.set(k, r);
            }
          });
          const parseTargets = (raw) => {
            if (!raw) return [];
            return String(raw)
              .split(/[\/;,\n]+/)
              .map(t => t.trim())
              .filter(Boolean)
              .map(t => key12(t))
              .filter(Boolean);
          };
          const edges = [];
          for (const src of items) {
            const targets = parseTargets(src.idProximoEquipamento);
            if (!targets.length) continue;
            const srcKey = key12(src.name || src.id);
            for (const tk of targets) {
              const dst = idx.get(tk);
              if (!dst) continue;
              // evita edge para si próprio (mesma chave)
              if (dst === src || tk === srcKey) continue;
              edges.push({
                id: `${src.id}->${dst.id}`,
                from: src,
                to: dst,
              });
            }
          }
          return edges;
        };

  const edges = buildEdges(withDcuAgg);
  console.info('[GLPI][edges] construídas:', edges.length);

        // Diagnóstico dirigido (agora após withDcuAgg): verificar equipamento específico e logar PS POSTE
        try {
          const suspect = 'CEL-S-GE-029';
          const upper = (s) => String(s || '').toUpperCase();
          const rawMatch = radiosFromApi.find(r => upper(r.name || r.nome).includes(suspect));
          const normMatch = withDcuAgg.find(r => upper(r.name || r.id).includes(suspect))
            || normalized.find(r => upper(r.name || r.id).includes(suspect));
          if (rawMatch || normMatch) {
            const source = normMatch ? 'normalized' : (rawMatch ? 'raw' : 'unknown');
            const psFromNorm = normMatch?.psPoste ?? null;
            const psFromRaw = rawMatch?.pd?.pspostefield ?? rawMatch?.pspostefield ?? null;
            const chosenPs = psFromNorm ?? psFromRaw ?? null;
            console.info('[Diag][Match] CEL-S-GE-029', {
              name: (normMatch?.name || rawMatch?.name || rawMatch?.nome || '—'),
              status: (normMatch?.status || rawMatch?.status || 'unknown'),
              source,
              PsPoste: (chosenPs ?? 'Não Encontrado')
            });
          } else {
            console.info('[Diag][Match] CEL-S-GE-029', { found: false });
          }
        } catch {}

        if (isActive) {
          setRadioBase(withDcuAgg.map(r => ({ ...r, __edgesFrom: undefined })));
          setEdgesState(edges);
          setLoadError(null);
          setNextRetryTimestamp(null);
          setLastRefreshAt(Date.now());
          // Signal outer preloader (index.html) once on first successful load
          if (typeof window !== 'undefined' && !didSignalReadyRef.current) {
            try {
              window.dispatchEvent(new CustomEvent('app-ready'));
            } catch (e) {}
            // also attempt to hide legacy preloader id if present
            try {
              const pre = document.getElementById('preloader');
              if (pre) {
                pre.classList.add('hidden');
                setTimeout(() => { try { pre.style.display = 'none'; } catch (e) {} }, 700);
              }
            } catch (e) {}
            didSignalReadyRef.current = true;
          }
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
        }
      } catch (error) {
        console.error("Erro carregando rádios do backend:", error);
        scheduleRetry(
          "Não foi possível carregar os equipamentos em tempo real. Verifique o backend."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadRadios();

    return () => {
      isActive = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [retryAttempt, selectedGroups, hasSelectedGroups]);

  // Carregar grupos uma vez
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const resp = await timedFetch(`${API_BASE_URL}/api/groups`);
        setApiLatencyMs(resp.ms ?? null);
        if (resp.ok) {
          const data = resp.json ?? null;
          if (!aborted) {
            setGroups(Array.isArray(data?.groups) ? data.groups : []);
            setGroupsError(null);
          }
        } else {
          if (!aborted) setGroupsError(`Falha ao carregar grupos (HTTP ${resp.status})`);
        }
      } catch (e) {
        if (!aborted) setGroupsError(`Erro carregando grupos: ${e.message}`);
      }
    })();
    return () => { aborted = true; };
  }, []);

  // Fullscreen detection and panel sync
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const doc = document;
    const handler = () => {
      const active = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || doc.mozFullScreenElement);
      setIsFullscreen(active);
      if (active) {
        panelHiddenBeforeFullscreenRef.current = panelHiddenRef.current;
        setPanelHidden(true);
      } else {
        setPanelHidden(panelHiddenBeforeFullscreenRef.current);
      }
    };
    doc.addEventListener('fullscreenchange', handler);
    doc.addEventListener('webkitfullscreenchange', handler);
    doc.addEventListener('msfullscreenchange', handler);
    doc.addEventListener('mozfullscreenchange', handler);
    return () => {
      doc.removeEventListener('fullscreenchange', handler);
      doc.removeEventListener('webkitfullscreenchange', handler);
      doc.removeEventListener('msfullscreenchange', handler);
      doc.removeEventListener('mozfullscreenchange', handler);
    };
  }, [setPanelHidden]);

  // Atalho F11 para modo imersivo (usa Fullscreen API)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  // Polling configurável
  useEffect(() => {
    if (!autoRefreshMs) return undefined; // Parado
    const id = setInterval(() => {
      setRetryAttempt((prev) => prev + 1);
    }, autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs]);

  useEffect(() => {
    if (!nextRetryTimestamp) {
      setRetryCountdown(null);
      return undefined;
    }

    const updateCountdown = () => {
      const remainingMs = nextRetryTimestamp - Date.now();
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setRetryCountdown(seconds);
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [nextRetryTimestamp]);

  // Controla visibilidade do overlay de loading com fade-out suave
  useEffect(() => {
    if (isLoading) {
      setOverlayFading(false);
      setOverlayVisible(true);
      return undefined;
    }
    if (overlayVisible) {
      setOverlayFading(true);
      const t = setTimeout(() => {
        setOverlayVisible(false);
        setOverlayFading(false);
      }, 420);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isLoading]);

  // Removida simulação de alternância de status.

  // Estado local dos links (edges) criados a partir do GLPI
  const [edgesState, setEdgesState] = useState([]);

  // Combina os dados base com os status atuais para as camadas de pontos e linhas.
  // Propagação de status a jusante (P70 -> baixo) e orientação de links (P70 -> downstream)
  const { derivedStatusById, orientedEdges } = useMemo(() => {
    const result = { derivedStatusById: new Map(), orientedEdges: [] };
    if (!radioBase?.length || !edgesState?.length) return result;

    const toClass = (s) => (s === 'online' || s === 'offline') ? s : 'unknown';
    const sev = (cls) => (cls === 'offline' ? 2 : (cls === 'unknown' ? 1 : 0));
    const worst = (a, b) => {
      const sa = sev(a);
      const sb = sev(b);
      if (sa === sb) return a;
      return sa > sb ? a : b;
    };

    const nodesById = new Map(radioBase.map(r => [r.id, r]));
    const adj = new Map();
    const addAdj = (u, v) => {
      if (!adj.has(u)) adj.set(u, new Set());
      if (!adj.has(v)) adj.set(v, new Set());
      adj.get(u).add(v);
      adj.get(v).add(u);
    };
    for (const e of edgesState) {
      const u = e.from?.id;
      const v = e.to?.id;
      if (!u || !v) continue;
      if (!nodesById.has(u) || !nodesById.has(v)) continue;
      addAdj(u, v);
    }
    if (!adj.size) return result;

    const isP70 = (node) => classifyTypeForCount(node.tipoEquipamento || node.tipo || node.type) === 'P70';
    const roots = radioBase.filter(isP70).map(r => r.id);

    const dist = new Map();
    const parent = new Map();
    const derived = new Map();
    const q = [];
    for (const rid of roots) {
      if (!adj.has(rid)) continue;
      dist.set(rid, 0);
      parent.set(rid, null);
      const cls = toClass(nodesById.get(rid)?.status);
      derived.set(rid, cls);
      q.push(rid);
    }

    while (q.length) {
      const u = q.shift();
      const du = dist.get(u) ?? 0;
      const dcls = derived.get(u) ?? 'unknown';
      const neigh = adj.get(u) || new Set();
      for (const v of neigh) {
        if (!dist.has(v)) {
          dist.set(v, du + 1);
          parent.set(v, u);
          const vOwn = toClass(nodesById.get(v)?.status);
          const vDer = worst(vOwn, dcls);
          derived.set(v, vDer);
          q.push(v);
        }
      }
    }

    for (const [id, node] of nodesById.entries()) {
      if (!derived.has(id)) derived.set(id, toClass(node.status));
    }

    const oriented = [];
    for (const e of edgesState) {
      const u = e.from?.id;
      const v = e.to?.id;
      if (!u || !v) return;
      if (!nodesById.has(u) || !nodesById.has(v)) return;
      const du = dist.has(u) ? dist.get(u) : Number.POSITIVE_INFINITY;
      const dv = dist.has(v) ? dist.get(v) : Number.POSITIVE_INFINITY;
      let fromId = u, toId = v;
      if (du < dv) {
        fromId = u; toId = v;
      } else if (dv < du) {
        fromId = v; toId = u;
      } else {
        if (String(v).localeCompare(String(u)) < 0) { fromId = v; toId = u; }
      }
      oriented.push({ id: `${fromId}->${toId}`, from: nodesById.get(fromId), to: nodesById.get(toId) });
    }

    return { derivedStatusById: derived, orientedEdges: oriented };
  }, [radioBase, edgesState]);

  // Lista de rádios filtrada (status próprio do nó; a cascata é usada apenas para links)
  const radiosFiltered = useMemo(() => {
    if (!radioBase?.length) return [];
    const tokens = String(nameQuery)
      .split(/[;,\n]/)
      .map(t => normalizeForSearch(t))
      .filter(Boolean);
    return radioBase.filter(r => {
      // tipo
      const typ = classifyTypeForCount(r.tipoEquipamento || r.tipo || r.type);
      if (!typeFilters[typ]) return false;
      // status real do equipamento; inativos GLPI entram no mesmo filtro dos sem telemetria
      const st = (r.status === 'online' ? 'online' : (r.status === 'offline' ? 'offline' : 'unknown'));
      if (!statusFilters[st]) return false;
      // nome (tokens)
      if (tokens.length) {
        const nameNorm = normalizeForSearch(r.name || r.nome || r.id || '');
        if (nameMode === 'exact') {
          if (!tokens.some(t => nameNorm === t)) return false;
        } else {
          // contains
          if (!tokens.some(t => nameNorm.includes(t))) return false;
        }
      }
      return true;
    });
  }, [radioBase, typeFilters, statusFilters, nameQuery, nameMode]);

  // Conjunto para resumo (ignora filtros de status; inclui inativos)
  const radiosForSummary = useMemo(() => {
    if (!radioBase?.length) return [];
    const tokens = String(nameQuery)
      .split(/[;,\n]/)
      .map(t => normalizeForSearch(t))
      .filter(Boolean);
    return radioBase.filter(r => {
      const typ = classifyTypeForCount(r.tipoEquipamento || r.tipo || r.type);
      if (!typeFilters[typ]) return false;
      if (tokens.length) {
        const nameNorm = normalizeForSearch(r.name || r.nome || r.id || '');
        if (nameMode === 'exact') {
          if (!tokens.some(t => nameNorm === t)) return false;
        } else {
          if (!tokens.some(t => nameNorm.includes(t))) return false;
        }
      }
      return true;
    });
  }, [radioBase, typeFilters, nameQuery, nameMode]);

  // Filtra edges orientados com base no filtro atual de rádios (ambos os extremos devem estar visíveis)
  const filteredEdges = useMemo(() => {
    if (!orientedEdges?.length) return [];
    const setIds = new Set(radiosFiltered.map(r => r.id));
    return orientedEdges.filter(e => setIds.has(e.from.id) && setIds.has(e.to.id));
  }, [orientedEdges, radiosFiltered]);

  const visibleRadios = useMemo(() => {
    if (!mapInstance || typeof mapInstance.getBounds !== 'function') {
      return radiosFiltered;
    }
    try {
      const bounds = mapInstance.getBounds();
      if (!bounds || typeof bounds.contains !== 'function') {
        return radiosFiltered;
      }
      return radiosFiltered.filter((radio) => {
        const pos = Array.isArray(radio?.position) ? radio.position : null;
        if (!pos || pos.length < 2) return false;
        const lng = Number(pos[0]);
        const lat = Number(pos[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
        return bounds.contains([lng, lat]);
      });
    } catch (err) {
      console.warn('[visibleRadios] fallback to filtered list', err);
      return radiosFiltered;
    }
  }, [mapInstance, radiosFiltered, viewState]);

  // Ícones laranja quando o próprio equipamento for parcial (labelSegments) ou quando o nome agrega múltiplos itens (A/B/C) e houver mistura Online/Offline entre eles
  const mixedNodeIds = useMemo(() => {
    const ids = new Set();
    // 1) Pela presença de labelSegments com mistura
    for (const r of radiosFiltered) {
      const segs = Array.isArray(r.labelSegments) ? r.labelSegments : [];
      if (segs.length >= 2) {
        let on = false, problem = false; // problem = offline ou inactive
        for (const s of segs) {
          const st = s && s.status;
          const txt = s && s.text ? String(s.text) : '';
          // Ignorar DCU 'A' offline na avaliação de "misto"
          if (st === 'offline' && isABy7thChar(txt)) {
            // trata como se não fosse problema
            continue;
          }
          if (st === 'online') on = true; else if (st === 'offline' || st === 'inactive') problem = true;
        }
        if (on && problem) ids.add(r.id);
      }
    }
    // 2) Pelo nome agregado com '/': procurar itens correspondentes e avaliar mistura
    const key12 = (s) => String(s || '').trim().slice(0, 12).toUpperCase();
    const byKey = new Map();
    const statusById = new Map();
    const radioById = new Map();
    for (const r of radiosFiltered) {
      byKey.set(key12(r.name || r.id), r.id);
      statusById.set(r.id, r.status);
      radioById.set(r.id, r);
    }
    for (const r of radiosFiltered) {
      const name = String(r.name || '').trim();
      if (!name.includes('/')) continue;
      const parts = name.split(/\s*\/\s*/).map(p => key12(p)).filter(Boolean);
      if (parts.length < 2) continue;
      let anyOn = false, anyProblem = false;
      for (const pk of parts) {
        const rid = byKey.get(pk);
        if (!rid) continue;
        const node = radioById.get(rid);
        const st = statusById.get(rid) || 'unknown';
        // Ignorar DCU 'A' offline (não contam como problema, nem contam como online)
        if (st === 'offline' && node && isABy7thChar(node.name)) {
          continue;
        }
        if (st === 'online') anyOn = true; else if (st === 'offline' || st === 'inactive') anyProblem = true;
      }
      if (anyOn && anyProblem) ids.add(r.id);
    }
    return ids;
  }, [radiosFiltered]);

  // Contagens por tipo e status
  const counts = useMemo(() => {
    const base = {
      total: { online: 0, offline: 0 },
      DCU: { online: 0, offline: 0 },
      P70: { online: 0, offline: 0 },
      BackHaul: { online: 0, offline: 0 },
      DA: { online: 0, offline: 0 },
    };
    for (const r of radiosFiltered) {
      // Contagem por status deve refletir o status próprio do nó
      const vs = r.status;
      if (vs === 'online' || vs === 'offline') {
        base.total[vs] += 1;
        const typ = classifyTypeForCount(r.tipoEquipamento || r.tipo || r.type);
        if (base[typ]) base[typ][vs] += 1;
      }
    }
    return base;
  }, [radiosFiltered]);

  // Resumo com inativos
  const countsSummary = useMemo(() => {
    const res = { online: 0, offline: 0, unknown: 0, total: 0 };
    for (const r of radiosForSummary) {
      let st = 'unknown';
      if (r.status === 'online') st = 'online';
      else if (r.status === 'offline') st = 'offline';
      res[st] += 1;
    }
    res.total = radiosForSummary.length;
    return res;
  }, [radiosForSummary]);

  const dadosMetrics = useMemo(() => {
    const totals = {
      regionOnline: 0,
      regionTotal: 0,
      dcuOnline: 0,
      dcuTotal: 0,
      availabilityGood: 0,
      availabilityTotal: 0,
      availabilitySum: 0,
      rssiGood: 0,
      rssiTotal: 0,
      rssiSum: 0,
      lqiGood: 0,
      lqiTotal: 0,
      lqiSum: 0,
    };

    const source = visibleRadios || [];

    for (const radio of source) {
      if (!radio) continue;
      totals.regionTotal += 1;
      if (radio.status === 'online') totals.regionOnline += 1;

      const typ = classifyTypeForCount(radio.tipoEquipamento || radio.tipo || radio.type);
      if (typ === 'DCU') {
        totals.dcuTotal += 1;
        if (radio.status === 'online') totals.dcuOnline += 1;
      }

      const nameKey = String(radio.name || radio.id || '').trim();
      const metrics = nameKey ? metricsByName.get(nameKey) : null;

      const availabilityVal = (typeof radio['icmp.success.24h'] === 'number')
        ? radio['icmp.success.24h']
        : (metrics?.availabilityPct ?? null);
      if (typeof availabilityVal === 'number') {
        totals.availabilityTotal += 1;
        totals.availabilitySum += availabilityVal;
        if (availabilityVal >= AVAILABILITY_TARGET_PCT) {
          totals.availabilityGood += 1;
        }
      }

      const rssiVal = (typeof radio.rssi === 'number') ? radio.rssi : (metrics?.rssi ?? null);
      if (typeof rssiVal === 'number') {
        totals.rssiTotal += 1;
        totals.rssiSum += rssiVal;
        if (rssiVal >= RSSI_TARGET_DBM) {
          totals.rssiGood += 1;
        }
      }

      const txRate = Number(radio.txRateKbps ?? metrics?.txRateKbps ?? 0);
      const lqiTarget = Number.isFinite(txRate) ? LQI_TARGET_BY_RATE[txRate] : null;
      const lqiVal = (typeof radio.lqi === 'number') ? radio.lqi : (metrics?.lqi ?? null);
      if (typeof lqiVal === 'number') {
        totals.lqiTotal += 1;
        totals.lqiSum += lqiVal;
        if (lqiTarget != null && lqiVal <= lqiTarget) {
          totals.lqiGood += 1;
        }
      }
    }

    const pct = (good, total) => (total > 0 ? (good / total) * 100 : null);
    const avg = (sum, total) => (total > 0 ? sum / total : null);

    return {
      regionOnline: totals.regionOnline,
      regionTotal: totals.regionTotal,
      regionPct: pct(totals.regionOnline, totals.regionTotal),
      dcuOnline: totals.dcuOnline,
      dcuTotal: totals.dcuTotal,
      dcuPct: pct(totals.dcuOnline, totals.dcuTotal),
      availabilityGood: totals.availabilityGood,
      availabilityTotal: totals.availabilityTotal,
      availabilityPct: pct(totals.availabilityGood, totals.availabilityTotal),
      availabilityBad: Math.max(0, totals.availabilityTotal - totals.availabilityGood),
      availabilityAvg: avg(totals.availabilitySum, totals.availabilityTotal),
      rssiGood: totals.rssiGood,
      rssiTotal: totals.rssiTotal,
      rssiPct: pct(totals.rssiGood, totals.rssiTotal),
      rssiBad: Math.max(0, totals.rssiTotal - totals.rssiGood),
      rssiAvg: avg(totals.rssiSum, totals.rssiTotal),
      lqiGood: totals.lqiGood,
      lqiTotal: totals.lqiTotal,
      lqiPct: pct(totals.lqiGood, totals.lqiTotal),
      lqiBad: Math.max(0, totals.lqiTotal - totals.lqiGood),
      lqiAvg: avg(totals.lqiSum, totals.lqiTotal),
    };
  }, [visibleRadios, metricsByName]);

  // Mapeamento de tipos para nomes de arquivos (sem sufixo online/offline)
  // Regras fornecidas pelo usuário:
  // - "DA" -> DA.G.png / DA.R.png
  // - "Gab. DCU (SE)" ou "Gab. DCU+GE" -> "Gab. DCU-G.png" / "Gab. DCU-R.png"
  // - "Gab. DCU+GE+B2B" -> "Gab. DCU+GE+B2B-G.png" / "Gab. DCU+GE+B2B-R.png"
  // - "P70" -> P70.G.png / P70.R.png
  // - "Rep. Backhaul" -> Rep. Backhaul.G.png / Rep. Backhaul.R.png
  // Observação: manter nomes e tamanhos consistentes no diretório public/icons.


  // Converter para dados de IconLayer com url do public/icons
  const radiosWithIcons = useMemo(() => {
    return radiosFiltered.map(r => {
      // Regra principal: se existir GE no composto, usar o status do GE
      const geDom = geDominantStatus(r);
      const baseStatus = geDom || r.status;
      // prioridade: se GE definiu online/offline, respeitar isso; senão aplicar regras atuais
      let statusForIcon;
      if (geDom === 'online' || geDom === 'offline') {
        statusForIcon = geDom;
      } else {
        statusForIcon = (baseStatus !== 'online' && baseStatus !== 'offline')
          ? 'inactive'
          : (mixedNodeIds.has(r.id) ? 'mixed' : baseStatus);
      }
      const fileName = resolveIconName(r.tipoEquipamento || r.tipo || r.type, statusForIcon);
      const icon = fileName ? ICON_URLS[fileName] || null : null;
      return { ...r, visStatus: statusForIcon, iconUrl: icon, hasIcon: false };
    });
  }, [radiosFiltered, mixedNodeIds]);

  // Pré-carrega ícones e marca quais URLs estão disponíveis
  const [availableIcons, setAvailableIcons] = useState({});

  useEffect(() => {
  const uniqueUrls = Array.from(new Set(radiosWithIcons.map(r => r.iconUrl).filter(Boolean)));
    if (!uniqueUrls.length) return;

    uniqueUrls.forEach(url => {
      if (availableIcons[url] !== undefined) return; // já conhecido
      const img = new Image();
      img.onload = () => setAvailableIcons(prev => ({ ...prev, [url]: true }));
      img.onerror = () => setAvailableIcons(prev => ({ ...prev, [url]: false }));
      img.src = url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiosWithIcons]);

  const radiosWithIconsAvailability = useMemo(() => {
    let arr = radiosWithIcons.map(r => ({ ...r, hasIcon: !!(r.iconUrl && availableIcons[r.iconUrl]) }));
    if (onlyWithIcon) {
      arr = arr.filter(r => r.hasIcon);
    }
    return arr;
  }, [radiosWithIcons, availableIcons, onlyWithIcon]);

  // (removido: deduplicação agressiva) — veremos a união exata das fontes visuais

  // Diagnóstico: logar tipos sem mapeamento e ícones faltantes
  useEffect(() => {
    if (!radiosWithIcons.length) return;
    const unmappedTypes = new Set();
    const missingFiles = new Set();
    radiosWithIcons.forEach(r => {
      const typeLabel = r.tipoEquipamento || r.tipo || r.type;
      if (typeLabel && !r.iconUrl) {
        unmappedTypes.add(String(typeLabel));
      }
      if (r.iconUrl && availableIcons[r.iconUrl] === false) {
        missingFiles.add(r.iconUrl);
      }
    });
    if (unmappedTypes.size) {
      console.warn('[Ícones] Tipos sem mapeamento de ícone:', Array.from(unmappedTypes));
    }
    if (missingFiles.size) {
      console.warn('[Ícones] Arquivos de ícone não encontrados em /public/icons:', Array.from(missingFiles));
    }
  }, [radiosWithIcons, availableIcons]);

  // Evitar "F5 visual": só faz o fit inicial e quando mudar o grupo; não a cada refresh
  const lastFitGroupRef = useRef('__ALL__');
  const didInitialFitRef = useRef(false);

  const fitToData = React.useCallback(() => {
    if (!radioBase.length) return;
    const longitudes = radioBase.map((radio) => radio.position[0]);
    const latitudes = radioBase.map((radio) => radio.position[1]);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const lonSpan = Math.max(0.0005, maxLon - minLon);
    const latSpan = Math.max(0.0005, maxLat - minLat);
    const dominantSpan = Math.max(lonSpan, latSpan);
    const zoomAdjustment = Math.log2(1 / dominantSpan);
    const targetZoom = Math.max(5, Math.min(13, 6 + zoomAdjustment));
    setViewState((previous) => ({
      ...previous,
      longitude: centerLon,
      latitude: centerLat,
      zoom: Number.isFinite(targetZoom) ? targetZoom : previous.zoom,
      transitionDuration: 600,
    }));
  }, [radioBase]);

  const resetZoom = React.useCallback(() => {
    setViewState(prev => ({
      ...prev,
      longitude: INITIAL_VIEW_STATE.longitude,
      latitude: INITIAL_VIEW_STATE.latitude,
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
      transitionDuration: 600,
    }));
  }, []);

  const clearSelection = React.useCallback(() => {
    setNameQuery('');
    setNameMode('contains');
    setTypeFilters({ DCU: true, P70: true, BackHaul: true, DA: true, Other: true });
    setStatusFilters({ online: true, offline: true, unknown: true });
  }, []);

  useEffect(() => {
    if (!radioBase.length) return;
    const currentGroup = hasSelectedGroups ? selectedGroups.join('|') : '__ALL__';
    if (!didInitialFitRef.current) {
      fitToData();
      didInitialFitRef.current = true;
      lastFitGroupRef.current = currentGroup;
      return;
    }
    // Se mudou o grupo selecionado, ajustar uma vez
    if (currentGroup !== lastFitGroupRef.current) {
      fitToData();
      lastFitGroupRef.current = currentGroup;
    }
    // Demais atualizações (auto refresh): não recenter
  }, [radioBase, selectedGroups, hasSelectedGroups, fitToData]);

  // Valor auxiliar para forçar o recálculo das linhas em função dos status atuais.
  const statusSignature = useMemo(
    () => radiosWithIconsAvailability.map((r) => (r.visStatus === "online" ? 1 : 0)).join(""),
    [radiosWithIconsAvailability]
  );

  const terrainLayer = useMemo(
    () =>
      new TerrainLayer({
        id: "terrain",
        elevationDecoder: {
          r: 256,
          g: 1,
          b: 1 / 256,
          offset: -32768,
        },
        elevationData: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${MAPBOX_TOKEN}`,
        texture: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        tileSize: 512,
        wireframe: false,
        material: {
          ambient: 0.5,
          diffuse: 0.6,
          shininess: 32,
          specularColor: [60, 60, 60],
        },
      }),
    []
  );

  // Evita sobreposição: remove o ponto quando há um ícone na mesma posição
  const iconPositionKeys = useMemo(() => {
    if (!showIcons) return new Set();
    return new Set(
      radiosWithIconsAvailability
        .filter(r => r.hasIcon)
        .map(r => `${r.position[0].toFixed(6)}|${r.position[1].toFixed(6)}`)
    );
  }, [radiosWithIconsAvailability, showIcons]);

  const fetchDetails = React.useCallback(async (id) => {
    if (!id) return null;
    // Sanitizar ID para evitar chamadas a endpoints inexistentes quando o campo
    // vier com vários IDs concatenados (ex.: "4451+4997+1359") ou URL-encoded.
    const rawIdStr = String(id);
    let decoded = rawIdStr;
    try { decoded = decodeURIComponent(rawIdStr); } catch (e) {}
    // separar por +, espaço, vírgula, barra ou ponto-e-vírgula
    const parts = decoded.split(/[\+\s,;\/]+/).map(p => p.trim()).filter(Boolean);
    let primary = parts.length ? parts[0] : decoded;
    // extrair o primeiro grupo de dígitos caso venha com texto
    const m = primary.match(/\d+/);
    if (m) primary = m[0];
    const key = primary || decoded;

    // Se já tivermos cache para a chave sanitizada, usar
    if (detailsCache[key]) return detailsCache[key];

    try {
      setDetailsLoading(prev => ({ ...prev, [key]: true }));
      const candidates = [
        `${API_BASE_URL}/api/radios/${encodeURIComponent(key)}`,
        `${API_BASE_URL}/api/radio/${encodeURIComponent(key)}`,
        `${API_BASE_URL}/api/radios/details?id=${encodeURIComponent(key)}`,
        `${API_BASE_URL}/api/radios/${encodeURIComponent(key)}/details`,
      ];
      let final = null;
      for (const url of candidates) {
        try {
          const resp = await timedFetch(url);
          setApiLatencyMs(resp.ms ?? null);
          if (!resp.ok) continue;
          const j = resp.json;
          if (!j) continue;
          // Normalizar possíveis formatos
          if (j.radio && typeof j.radio === 'object') {
            final = j.radio;
            break;
          }
          if (Array.isArray(j.radios) && j.radios.length) {
            final = j.radios[0];
            break;
          }
          if (j && typeof j === 'object') {
            // heurística: se vier com campos esperados do GLPI/Zabbix
            if (j.pspostefield || j.azimutefield || j.tipodeantena || j.zabbix || j.metrics || j.icmpping || j.ping) {
              final = j;
              break;
            }
            // fallback genérico: se tem id/name
            if (j.id || j.name) {
              final = j;
              break;
            }
          }
        } catch (e) {
          // ignorar e tentar próximo candidato
        }
      }
      // cachear resultado (mesmo null) usando chave sanitizada para evitar storms
      setDetailsCache(prev => ({ ...prev, [key]: final }));
      return final;
    } finally {
      setDetailsLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [detailsCache]);

  // Dados dos rótulos: união (ícones + fallback) com deduplicação por proximidade (raio em metros)
  const labelData = useMemo(() => {
    const key6 = (d) => `${d.position[0].toFixed(6)}|${d.position[1].toFixed(6)}`;
    const iconData = radiosWithIconsAvailability.filter(r => r.hasIcon);
    const scatterData = radiosWithIconsAvailability.filter(r => !r.hasIcon && !iconPositionKeys.has(key6(r)));
    const union = [...iconData, ...scatterData];

    // Haversine leve para distância em metros
    const toRad = (deg) => (deg * Math.PI) / 180;
    const haversineMeters = (a, b) => {
      const [lon1, lat1] = a.position;
      const [lon2, lat2] = b.position;
      const R = 6371000; // raio da Terra em metros
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLon / 2);
      const aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    // Critério de preferência
    const score = (d) => {
      const segs = Array.isArray(d.labelSegments) ? d.labelSegments.length : 0;
      const isB2b = String(d.tipoEquipamento || '').toLowerCase().includes('b2b') ? 1 : 0;
      const hasIcon = d.hasIcon ? 1 : 0;
      const nameLen = String(d.name || d.id || '').length;
      // Peso: segmentos (1000) > B2B (100) > ícone (10) > tamanho do nome
      return (segs * 1000) + (isB2b * 100) + (hasIcon * 10) + nameLen;
    };

    const kept = [];
    const THRESHOLD_M = 10; // raio de 10 metros para agrupar
    for (const d of union) {
      let merged = false;
      for (let i = 0; i < kept.length; i++) {
        const k = kept[i];
        if (haversineMeters(d, k) <= THRESHOLD_M) {
          // mantém o de maior score
          if (score(d) > score(k)) kept[i] = d;
          merged = true;
          break;
        }
      }
      if (!merged) kept.push(d);
    }
    return kept;
  }, [radiosWithIconsAvailability, iconPositionKeys]);

  const scatterLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: "radios",
        data: radiosWithIconsAvailability.filter(r => !iconPositionKeys.has(`${r.position[0].toFixed(6)}|${r.position[1].toFixed(6)}`)),
        getPosition: (radio) => radio.position,
        getFillColor: (radio) => {
          if (radio.visStatus === "online") return ONLINE_COLOR;
          if (radio.visStatus === "offline") return OFFLINE_COLOR;
          return UNKNOWN_COLOR;
        },
        // Reduzir tamanho das bolinhas: usar pixels para tamanho consistente
  getRadius: (radio) => radio.hasIcon ? 0 : 2,
        radiusUnits: "pixels",
        radiusMinPixels: 1,
        radiusMaxPixels: 3,
        pickable: true,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        getLineColor: [0, 0, 0, 180],
        updateTriggers: {
          getFillColor: radiosWithIconsAvailability.map(r => r.visStatus).join('|'),
          getRadius: radiosWithIconsAvailability.map(r => (r.hasIcon ? 1 : 0)).join(""),
          data: Array.from(iconPositionKeys).join(','),
        },
      }),
    [radiosWithIconsAvailability, statusSignature, iconPositionKeys]
  );

  const iconLayer = useMemo(() => new IconLayer({
    id: 'radios-icons',
    data: radiosWithIconsAvailability.filter(r => r.hasIcon),
    pickable: true,
    getPosition: d => d.position,
    getIcon: d => ({
      url: d.iconUrl,
      width: 64,
      height: 64,
      anchorX: 32,
      anchorY: 64,
    }),
    // Tamanho consistente: pixels
    sizeUnits: 'pixels',
    getSize: d => {
      const typ = classifyTypeForCount(d.tipoEquipamento || d.tipo || d.type);
      return typ === 'P70' ? 32 : 14;
    },
    // Sem overlay: as cores já estão na arte (G/R/O/GR)
    getColor: d => [255, 255, 255, 255],
    updateTriggers: {
      getIcon: radiosWithIconsAvailability.map(r => `${r.iconUrl}|${r.visStatus}`).join('|'),
      getSize: radiosWithIconsAvailability.map(r => classifyTypeForCount(r.tipoEquipamento || r.tipo || r.type)).join('|'),
      getColor: 'static-color',
    }
  }), [radiosWithIconsAvailability, showIcons]);

  // Animação para P70: ondas concêntricas em volta do ícone
  const [animTime, setAnimTime] = useState(0);
  useEffect(() => {
    let rafId;
    let running = true;
    const tick = () => {
      if (!running) return;
      setAnimTime(performance.now());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { running = false; if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  const p70WavesData = useMemo(() => {
    const periodMs = 4000; // duração do ciclo completo
    const now = animTime;
    const maxRadiusPx = 80; // raio máximo em pixels
    const wavesPerPoint = 4;
    const res = [];
    const p70s = radiosWithIconsAvailability.filter(r => classifyTypeForCount(r.tipoEquipamento || r.tipo || r.type) === 'P70');
    for (const p of p70s) {
      for (let k = 0; k < wavesPerPoint; k++) {
        const phase = k / wavesPerPoint;
        const t = ((now % periodMs) / periodMs + phase) % 1; // 0..1
        const radius = t * maxRadiusPx;
        const baseAlpha = p.status === 'online' ? 160 : (p.status === 'offline' ? 200 : 180);
        const alpha = Math.max(0, Math.min(255, Math.round((1 - t) * baseAlpha)));
        const color = p.status === 'online' ? [34, 197, 94, alpha] : (p.status === 'offline' ? [220, 64, 52, alpha] : [148, 147, 150, alpha]);
        res.push({ position: p.position, radius, color });
      }
    }
    return res;
  }, [animTime, radiosWithIconsAvailability]);

  const p70WavesLayer = useMemo(() => new ScatterplotLayer({
    id: 'p70-waves',
    data: p70WavesData,
    pickable: false,
    getPosition: d => d.position,
    stroked: true,
    filled: false,
    getRadius: d => d.radius,
    radiusUnits: 'pixels',
    radiusMinPixels: 1,
    radiusMaxPixels: 100,
    lineWidthUnits: 'pixels',
    getLineWidth: 1.5,
    getLineColor: d => d.color,
    updateTriggers: {
      getRadius: animTime,
      getLineColor: animTime,
      data: p70WavesData.length,
    },
  }), [p70WavesData, animTime]);

  // Camada de conexões GLPI (linhas): cada metade da ligação herda a cor do status do nó adjacente (status próprio)
  // Regra por metade:
  // - Verde: nó Online
  // - Laranja: nó "mixed" (parcial)
  // - Vermelho: nó Offline
  // - Cinza: nó Inativo
  const linkSegments = useMemo(() => {
    if (!filteredEdges?.length) return [];
    const GREEN = [34, 197, 94, 200];
    const RED = [220, 64, 52, 220];
    const GRAY = [0x74, 0x75, 0x72, 220];
    const ORANGE = [0xEE, 0x96, 0x4B, 220];

    const classForNode = (node) => {
      const id = node?.id;
      // GE domina: se houver segmento GE, usar sua classe (offline -> vermelho; online -> verde)
      const geDom = geDominantStatus(node);
      if (geDom === 'online' || geDom === 'offline') return geDom;
      const segs = Array.isArray(node?.labelSegments) ? node.labelSegments : [];
      if (segs.length) {
        let anyOn = false, anyOff = false, anyOffNonA = false;
        for (const s of segs) {
          const st = s && s.status;
          const txt = s && s.text ? String(s.text) : '';
          if (st === 'online') anyOn = true;
          else if (st === 'offline') {
            anyOff = true;
            if (!isABy7thChar(txt)) anyOffNonA = true;
          }
        }
        if (anyOffNonA) return 'offline';
        if (anyOn) return 'online';
        if (anyOff) return 'online';
        return 'inactive';
      }
      // Caso simples: usa status do próprio nó, com exceção para A-offline
      let own = (node?.status === 'online' || node?.status === 'offline') ? node.status : 'inactive';
      if (own === 'offline' && isABy7thChar(node?.name)) own = 'online';
      if (mixedNodeIds.has(id)) return 'mixed';
      return own;
    };
    const colorFor = (cls) => (cls === 'online' ? GREEN : (cls === 'mixed' ? ORANGE : (cls === 'inactive' ? GRAY : RED)));

    const segments = [];
    for (const e of filteredEdges) {
      const a = e.from.position;
      const b = e.to.position;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ca = classForNode(e.from);
      const cb = classForNode(e.to);
      segments.push({ id: `${e.id}-half-a`, path: [a, mid], color: colorFor(ca), cls: ca });
      segments.push({ id: `${e.id}-half-b`, path: [mid, b], color: colorFor(cb), cls: cb });
    }
    return segments;
  }, [filteredEdges, mixedNodeIds]);

  // Segmentos por metade (para dashes/flow e partículas), coloridos pelo status próprio do nó adjacente
  const overallSegments = useMemo(() => {
    if (!filteredEdges?.length) return [];
    const GREEN = [34, 197, 94, 200];
    const RED = [220, 64, 52, 220];
    const GRAY = [0x74, 0x75, 0x72, 220];
    const ORANGE = [0xEE, 0x96, 0x4B, 220];
    const classForNode = (node) => {
      const id = node?.id;
      const geDom = geDominantStatus(node);
      if (geDom === 'online' || geDom === 'offline') return geDom;
      const segs = Array.isArray(node?.labelSegments) ? node.labelSegments : [];
      if (segs.length) {
        let anyOn = false, anyOff = false, anyOffNonA = false;
        for (const s of segs) {
          const st = s && s.status;
          const txt = s && s.text ? String(s.text) : '';
          if (st === 'online') anyOn = true;
          else if (st === 'offline') {
            anyOff = true;
            if (!isABy7thChar(txt)) anyOffNonA = true;
          }
        }
        if (anyOffNonA) return 'offline';
        if (anyOn) return 'online';
        if (anyOff) return 'online';
        return 'inactive';
      }
      let own = (node?.status === 'online' || node?.status === 'offline') ? node.status : 'inactive';
      if (own === 'offline' && isABy7thChar(node?.name)) own = 'online';
      if (mixedNodeIds.has(id)) return 'mixed';
      return own;
    };
    const colorFor = (cls) => (cls === 'online' ? GREEN : (cls === 'mixed' ? ORANGE : (cls === 'inactive' ? GRAY : RED)));
    const items = [];
    for (const e of filteredEdges) {
      const a = e.from.position;
      const b = e.to.position;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ca = classForNode(e.from);
      const cb = classForNode(e.to);
      items.push({ id: `${e.id}-seg-a`, path: [a, mid], color: colorFor(ca), cls: ca, fromId: e.from.id });
      items.push({ id: `${e.id}-seg-b`, path: [mid, b], color: colorFor(cb), cls: cb, fromId: e.to.id });
    }
    return items;
  }, [filteredEdges, mixedNodeIds]);

  const linksLayer = useMemo(() => new PathLayer({
    id: 'glpi-links',
    data: linkSegments,
    pickable: false,
    getPath: d => d.path,
    getWidth: LINK_BASE_WIDTH_PX,
    widthUnits: 'pixels',
    widthMinPixels: LINK_BASE_MIN_PIXELS,
    getColor: d => d.color,
    capRounded: true,
    jointRounded: true,
    parameters: { depthTest: false },
    visible: showLinks,
    updateTriggers: {
      data: linkSegments.length,
      visible: showLinks ? 1 : 0,
    },
  }), [linkSegments, showLinks]);

  // Removido: glow e faixa interna branca para evitar "capa branca"

  const linksFlowLayer = useMemo(() => {
    // Destaque na mesma cor (sem puxar para branco)
    const tone = (c, delta = 0.22) => {
      const r = Math.min(255, Math.round(c[0] * (1 + delta)));
      const g = Math.min(255, Math.round(c[1] * (1 + delta)));
      const b = Math.min(255, Math.round(c[2] * (1 + delta)));
      return [r, g, b, 245];
    };
    // não animar segmentos inativos (cinza)
    const data = overallSegments
      .filter(s => s.cls !== 'inactive')
      .map(s => ({ ...s, flowColor: tone(s.color, 0.22) }));
    return new PathLayer({
      id: 'glpi-links-flow',
      data,
      pickable: false,
      getPath: d => d.path,
      getWidth: LINK_FLOW_WIDTH_PX, // luz evidente porém sem "capa"
      widthUnits: 'pixels',
      widthMinPixels: LINK_FLOW_MIN_PIXELS,
  getColor: d => d.flowColor,
      capRounded: true,
      jointRounded: true,
      parameters: { depthTest: false },
      extensions: [new PathStyleExtension({ dash: true })],
  // dashes mais densos para mais "luzes" perceptíveis
  getDashArray: d => [1.0, 3.2],
      dashJustified: true,
  dashOffset: -(animTime / 1000) * 140, // fluxo levemente mais rápido
      visible: showLinks,
      updateTriggers: {
        data: data.length,
        dashOffset: animTime,
        visible: showLinks ? 1 : 0,
      },
    });
  }, [overallSegments, showLinks, animTime]);

  // Feixe de luz (TripsLayer) no caminho: substitui as bolinhas por um feixe animado
  const beamsData = useMemo(() => {
    if (!filteredEdges?.length || !showLinks) return [];

    // Paleta específica do feixe (beam)
    const BEAM_OFFLINE = [0x6B, 0x0F, 0x1A, 255];
    const BEAM_ONLINE = [0x68, 0x8E, 0x26, 255];
    const BEAM_MIXED = [0xEE, 0x96, 0x4B, 255];
    const BEAM_INACTIVE = [0x74, 0x75, 0x72, 255];

    const classForNode = (node) => {
      const id = node?.id;
      const geDom = geDominantStatus(node);
      if (geDom === 'online' || geDom === 'offline') return geDom;
      const segs = Array.isArray(node?.labelSegments) ? node.labelSegments : [];
      if (segs.length) {
        let anyOn = false, anyOff = false, anyOffNonA = false;
        for (const s of segs) {
          const st = s && s.status;
          const txt = s && s.text ? String(s.text) : '';
          if (st === 'online') anyOn = true;
          else if (st === 'offline') {
            anyOff = true;
            if (!isABy7thChar(txt)) anyOffNonA = true;
          }
        }
        if (anyOffNonA) return 'offline';
        if (anyOn) return 'online';
        if (anyOff) return 'online';
        return 'inactive';
      }
      let own = (node?.status === 'online' || node?.status === 'offline') ? node.status : 'inactive';
      if (own === 'offline' && isABy7thChar(node?.name)) own = 'online';
      if (mixedNodeIds.has(id)) return 'mixed';
      return own;
    };
    const colorForClass = (cls) => (cls === 'online' ? BEAM_ONLINE : (cls === 'mixed' ? BEAM_MIXED : (cls === 'inactive' ? BEAM_INACTIVE : BEAM_OFFLINE)));

    const beamsPerHalf = 2;
    const items = [];
    for (const e of filteredEdges) {
      const a = e.from.position;
      const b = e.to.position;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ca = classForNode(e.from);
      const cb = classForNode(e.to);

      const halves = [
        { id: 'a', path: [a, mid], cls: ca },
        { id: 'b', path: [mid, b], cls: cb },
      ];
      for (const h of halves) {
        if (h.cls === 'inactive') continue; // sem feixe em inativo
        const color = colorForClass(h.cls);
        for (let i = 0; i < beamsPerHalf; i++) {
          const phase = (i / beamsPerHalf) + ((e.id.length * (i + (h.id === 'a' ? 3 : 5))) % 7) / 700;
          items.push({
            id: `${e.id}-beam-${h.id}-${i}-fwd`,
            path: h.path,
            timestamps: [phase, phase + 1],
            color,
            width: LINK_BEAM_WIDTH_PX,
          });
          items.push({
            id: `${e.id}-beam-${h.id}-${i}-wrap`,
            path: h.path,
            timestamps: [phase - 1, phase],
            color,
            width: LINK_BEAM_WIDTH_PX,
          });
        }
      }
    }
    return items;
  }, [filteredEdges, showLinks, mixedNodeIds]);

  const linksBeamsLayer = useMemo(() => new TripsLayer({
    id: 'glpi-links-beams',
    data: beamsData,
    getPath: d => d.path,
    getTimestamps: d => d.timestamps,
    getColor: d => d.color,
    widthUnits: 'pixels',
    getWidth: d => d.width || LINK_BEAM_FALLBACK_WIDTH_PX,
    widthMinPixels: Math.max(LINK_BEAM_MIN_PIXELS, LINK_BEAM_FALLBACK_MIN_PIXELS),
    trailLength: 0.55, // rastro ainda presente mas menos "leitoso"
    currentTime: ((animTime / 1000) * 1.35) % 1,
    opacity: 0.96,
    capRounded: true,
    jointRounded: true,
    parameters: { depthTest: false },
    visible: showLinks,
    updateTriggers: {
      data: beamsData.length,
      currentTime: animTime,
      visible: showLinks ? 1 : 0,
    },
  }), [beamsData, showLinks, animTime]);

  // Camadas extras de streaks (muitos "raios") com offsets diferentes para densidade
  // Removidos múltiplos "rays" para manter visual limpo com um único destaque em movimento

  // Removidos: glows para evitar artefatos laterais

  // Partículas de fluxo sanguíneo dentro do caninho (pequenas "células" que se movem ao longo do caminho)
  const bloodMeta = useMemo(() => {
    if (!overallSegments?.length) return [];
    const nearly = (a, b, tol = 6) => Math.abs(a - b) <= tol;
    const classifyByColor = (c) => {
      const [r, g, b] = c;
      if (nearly(r, 34) && nearly(g, 197) && nearly(b, 94)) return 'online';
      if (nearly(r, 220) && nearly(g, 64) && nearly(b, 52)) return 'offline';
      if (nearly(r, 238) && nearly(g, 150) && nearly(b, 75)) return 'mixed'; // #EE964B
      return 'inactive';
    };

    // haversine entre dois [lon,lat]
    const toRad = (deg) => (deg * Math.PI) / 180;
    const havMeters = (a, b) => {
      const [lon1, lat1] = a;
      const [lon2, lat2] = b;
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLon / 2);
      const aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    const speedFor = (cls) => {
      // velocidades altas (m/s) para enfatizar fluxo
      if (cls === 'online') return 300;
      if (cls === 'mixed') return 220;
      if (cls === 'offline') return 150;
      return 0; // inactive sem animação
    };

    return overallSegments.map((s, idx) => {
      const a = s.path[0];
      const b = s.path[1];
      const len = Math.max(1, havMeters(a, b));
      const cls = classifyByColor(s.color);
      const speed = speedFor(cls);
      if (cls === 'inactive') return { a, b, len, color: s.color, speed, phases: [] };
      const count = Math.max(10, Math.min(48, Math.round(len / 160))); // densidade moderada
      const phases = Array.from({ length: count }, (_, i) => (i / count + ((idx * 31 + i * 17) % 100) / 100) % 1);
      return { a, b, len, color: s.color, speed, phases };
    });
  }, [overallSegments]);

  const bloodParticles = useMemo(() => {
    if (!bloodMeta?.length || !showLinks) return [];
    const items = [];
    const tSec = animTime / 1000;
    for (const m of bloodMeta) {
      const vx = (m.b[0] - m.a[0]);
      const vy = (m.b[1] - m.a[1]);
      const progressSpeed = m.speed / m.len; // fração do segmento por segundo
      for (const ph of m.phases) {
        const p = (ph + tSec * progressSpeed) % 1;
        const pos = [m.a[0] + vx * p, m.a[1] + vy * p];
        items.push({ position: pos, color: m.color });
      }
    }
    return items;
  }, [bloodMeta, animTime, showLinks]);

  const bloodCoreLayer = useMemo(() => {
    const strongerTone = (c) => {
      const r = c[0] ?? 0, g = c[1] ?? 0, b = c[2] ?? 0;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Se for quase cinza, usar um cinza mais escuro para contraste
      if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
        const v0 = Math.round((r + g + b) / 3);
        const v = Math.max(70, Math.min(200, Math.round(v0 * 0.7)));
        return [v, v, v, 245];
      }
      // Aumenta saturação levando o canal dominante próximo de 255
      const s = max > 0 ? (255 / max) : 1;
      let rr = Math.min(255, Math.round(r * s));
      let gg = Math.min(255, Math.round(g * s));
      let bb = Math.min(255, Math.round(b * s));
      // Escurece levemente para destacar sobre a faixa interna clara
      rr = Math.max(0, Math.round(rr * 0.9));
      gg = Math.max(0, Math.round(gg * 0.9));
      bb = Math.max(0, Math.round(bb * 0.9));
      return [rr, gg, bb, 245];
    };
    return new ScatterplotLayer({
    id: 'glpi-links-blood-core',
    data: bloodParticles,
    pickable: false,
    getPosition: d => d.position,
    filled: true,
    stroked: true,
    radiusUnits: 'pixels',
    getRadius: 1.3, // ligeiramente maior para evidenciar mais pontos de luz
    radiusMinPixels: 0.8,
    radiusMaxPixels: 2.4,
      getFillColor: d => strongerTone(d.color),
    lineWidthUnits: 'pixels',
    getLineWidth: 0.8,
    getLineColor: [0, 0, 0, 200], // contorno escuro para legibilidade
    updateTriggers: {
      data: bloodParticles.length,
    },
    visible: showLinks,
    });
  }, [bloodParticles, showLinks]);

  // Nomes abaixo de cada equipamento (sempre em branco)
  const textLayer = useMemo(() => {
    const labelColor = isLightMapTheme ? [15, 23, 42, 255] : [255, 255, 255, 255];
    return new TextLayer({
    id: 'labels',
    data: labelData,
    pickable: false,
    getPosition: d => d.position,
    getText: d => (d && d.name != null ? (typeof d.name === 'string' ? d.name : String(d.name)) : (d.id != null ? String(d.id) : '')),
    sizeUnits: 'pixels',
  getSize: 12,
  getColor: labelColor,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top', // texto nasce abaixo do ponto
    getPixelOffset: [0, 8],
    // removed outlineWidth/outlineColor to avoid requiring SDF font atlas
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    visible: !hideLabels,
    updateTriggers: {
      getText: labelData.map(r => (r.name || r.id || '')).join('|'),
      visible: hideLabels ? 1 : 0,
      colorTone: isLightMapTheme ? 1 : 0,
    }
  });
  }, [labelData, hideLabels, isLightMapTheme]);

  // Indicador "X" para ligações inativas (sem fluxo)
  const inactiveXData = useMemo(() => {
    return overallSegments
      .filter(s => s.cls === 'inactive')
      .map(s => {
        const a = s.path[0];
        const b = s.path[1];
        return { position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      });
  }, [overallSegments]);

  const inactiveXLayer = useMemo(() => new TextLayer({
    id: 'glpi-links-inactive-x',
    data: inactiveXData,
    pickable: false,
    getPosition: d => d.position,
    // use ASCII X to avoid missing glyph warnings in some fonts
    getText: () => 'X',
    sizeUnits: 'pixels',
    getSize: 12,
    getColor: [0x74, 0x75, 0x72, 255], // #747572
    // removed outline to avoid font SDF requirement
    visible: showLinks,
    updateTriggers: {
      data: inactiveXData.length,
      visible: showLinks ? 1 : 0,
    }
  }), [inactiveXData, showLinks]);

  const weatherLayer = useMemo(() => {
    if (!showWeather || !weatherCanvasRef.current) return null;
    return new BitmapLayer({
      id: 'weather-precip',
      image: weatherCanvasRef.current,
      bounds: WEST_PARANA_BOUNDS,
      opacity: weatherOpacity,
      desaturate: 0,
      transparentColor: [0, 0, 0, 0],
      tintColor: [255, 255, 255],
      pickable: false,
      parameters: { depthTest: false, depthWrite: false },
    });
  }, [showWeather, weatherOpacity, weatherFrame]);

  const lightningLayer = useMemo(() => {
    if (!showWeather) return null;
    const now = Date.now();
    const flashes = (weatherFlashesRef.current || []).filter(f => (now - f.start) < f.ttl);
    weatherFlashesRef.current = flashes;
    if (!flashes.length) return null;
    const data = flashes.map((f) => {
      const life = Math.min(1, (now - f.start) / f.ttl);
      return { ...f, alpha: 1 - life };
    });
    return new ScatterplotLayer({
      id: 'weather-lightning',
      data,
      pickable: false,
      getPosition: d => d.position,
      radiusUnits: 'meters',
      getRadius: d => d.radius,
      filled: true,
      stroked: true,
      getFillColor: d => [200, 225, 255, Math.round(255 * d.alpha)],
      getLineColor: d => [255, 255, 255, Math.round(180 * d.alpha)],
      getLineWidth: 1.2,
      lineWidthUnits: 'pixels',
      billboard: true,
      parameters: { depthTest: false },
      opacity: 0.95,
      updateTriggers: {
        frame: weatherFrame,
      },
    });
  }, [showWeather, weatherFrame]);

  const temperatureLayer = useMemo(() => {
    if (!showTemperature) return null;
    return new TextLayer({
      id: 'weather-temperature',
      data: temperaturePoints,
      pickable: false,
      getPosition: d => [d.lng, d.lat],
      getText: d => `${Math.round(d.temp)}°C`,
      getSize: 14,
      sizeUnits: 'pixels',
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [0, -6],
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      getColor: [255, 140, 0, 255],
      getBackgroundColor: [15, 23, 42, 180],
      // sem contorno; usamos cor quente + fundo semitransparente
    });
  }, [showTemperature, temperaturePoints]);

  const layers = useMemo(() => {
    // Ordem: base fina, destaque em dashes e feixe, partículas
    const arr = [];
    if (supportsNativeTerrain) {
      arr.push(terrainLayer);
    }
    if (weatherLayer) arr.push(weatherLayer);
    if (lightningLayer) arr.push(lightningLayer);
    if (temperatureLayer) arr.push(temperatureLayer);
    arr.push(
      linksLayer,
      inactiveXLayer,
      linksFlowLayer,
      linksBeamsLayer,
      p70WavesLayer,
    );
    if (showIcons) arr.push(iconLayer);
    arr.push(scatterLayer, textLayer);
    return arr;
  }, [supportsNativeTerrain, terrainLayer, weatherLayer, lightningLayer, temperatureLayer, linksLayer, inactiveXLayer, linksFlowLayer, linksBeamsLayer, p70WavesLayer, iconLayer, scatterLayer, textLayer, showIcons]);

  useEffect(() => {
    const map = mapInstance;
    if (!map) return undefined;

    if (!supportsNativeTerrain) {
      try {
        map.setTerrain(null);
      } catch {}
      return undefined;
    }

    const applyTerrain = () => {
      try {
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.terrain-rgb",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        map.setLight({ intensity: 0.5 });
      } catch (err) {
        console.warn('[terrain] erro ao aplicar terreno', err);
      }
    };

    applyTerrain();
    map.on("styledata", applyTerrain);

    return () => {
      map.off("styledata", applyTerrain);
    };
  }, [mapInstance, supportsNativeTerrain]);

  // sanitize viewState to avoid NaN values that break TileLayer/tileset computations
  const safeViewState = React.useMemo(() => {
    const s = { ...viewState };
    const keys = ['longitude', 'latitude', 'zoom', 'pitch', 'bearing'];
    let replaced = false;
    for (const k of keys) {
      if (!Number.isFinite(s[k])) {
        // fallback to initial view or 0
        s[k] = INITIAL_VIEW_STATE[k] != null ? INITIAL_VIEW_STATE[k] : 0;
        replaced = true;
      }
    }
    if (replaced) {
      // log once for debugging
      try { console.warn('[ParanaNetworkMap] viewState had invalid numbers, using safe fallback', s); } catch (e) {}
    }
    return s;
  }, [viewState]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "100%", // respeita a altura do container pai (preview/modal)
        backgroundColor: darkMode ? "#000" : "#e5e7eb",
        perspective: 1200,
      }}
    >
      {(!panelHidden || isClosing) && (
        <aside
          className={`nm-sidebar ${isOpening ? 'opening' : (isClosing ? 'closing' : !panelHidden ? 'open' : '')}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 350,
            zIndex: 12,
            display: 'flex',
            flexDirection: 'column',
            background: darkMode ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.98)',
            color: darkMode ? '#e2e8f0' : '#0f172a',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.45)'
          }}
        >
          {/* Header */}
          <div style={{ padding: '16px 16px 10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: 16, letterSpacing: 0.5 }}>Status da Rede ZabbMap</strong>
                  <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{selectedGroupsLabel}</span>
                </div>
              </div>
              <button onClick={() => {
                setIsClosing(true);
                setTimeout(() => { setPanelHidden(true); setIsClosing(false); }, 520);
              }} title="Ocultar painel" style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className="nm-btn nm-btn-outline"
                onClick={fitToData}
              >Centralizar</button>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              columnGap: 12,
              padding: '10px 16px 0 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden'
            }}
            className="nm-tabs-row"
          >
            {[
              { id: 'filters', label: t.tabFilters },
              { id: 'actions', label: t.tabActions },
              { id: 'data', label: t.tabData },
              { id: 'settings', label: t.tabSettings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nm-tab ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  color: activeTab === tab.id ? (darkMode ? '#fff' : '#0f172a') : '#94a3b8',
                  padding: '8px 0',
                  cursor: 'pointer',
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  flex: '1 1 0',
                  minWidth: 0,
                  textAlign: 'center'
                }}
              >
                {tab.label}
                <span className="nm-tab-indicator" style={{ opacity: activeTab === tab.id ? 1 : 0 }} />
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeTab === 'filters' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Busca */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t.searchLabel}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      style={{
                        width: '100%',
                        background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                        color: 'inherit',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 13,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = darkMode ? '#334155' : '#cbd5e1'}
                    />
                    {nameQuery && (
                      <button 
                        onClick={() => setNameQuery('')}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                      >✕</button>
                    )}
                  </div>
                </div>
                {/* Grupos */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t.groupsLabel}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <button
                        onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                        style={{
                          width: '100%',
                          height: 38,
                          background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                          color: 'inherit',
                          border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                          borderRadius: 6,
                          padding: '0 12px',
                          fontSize: 13,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginRight: 8,
                            color: selectedGroups.length === 0 ? '#94a3b8' : 'inherit',
                          }}
                        >
                          {selectedGroupsLabel}
                        </span>
                        <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
                      </button>
                      
                      {isGroupDropdownOpen && (
                        <>
                          <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                            onClick={() => setIsGroupDropdownOpen(false)} 
                          />
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            width: '100%',
                            background: darkMode ? '#1e293b' : '#ffffff',
                            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                            borderRadius: 8,
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            zIndex: 100,
                            maxHeight: 240,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 4
                          }}>
                            {groups.length === 0 && <div style={{ padding: 12, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{t.groupsEmpty}</div>}
                            {groups.map(g => {
                              const isSelected = selectedGroups.includes(g);
                              return (
                                <label 
                                  key={g} 
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    borderRadius: 6,
                                    background: isSelected ? (darkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'transparent',
                                    color: isSelected ? (darkMode ? '#60a5fa' : '#2563eb') : 'inherit',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? (darkMode ? 'rgba(59,130,246,0.25)' : '#dbeafe') : (darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9')}
                                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? (darkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'transparent'}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: 4, border: `1px solid ${isSelected ? '#3b82f6' : (darkMode ? '#475569' : '#cbd5e1')}`,
                                    background: isSelected ? '#3b82f6' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0
                                  }}>
                                    {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</span>}
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedGroups(prev => {
                                        if (prev.includes(g)) return prev.filter(x => x !== g);
                                        return [...prev, g];
                                      });
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g}</span>
                                </label>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      className="nm-btn"
                      onClick={() => setSelectedGroups([])}
                      title="Limpar seleção"
                      style={{ 
                        height: 38, padding: '0 12px', 
                        background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: 6, color: darkMode ? '#94a3b8' : '#64748b', cursor: 'pointer'
                      }}
                    >✕</button>
                    <button
                      className="nm-btn"
                      onClick={async () => {
                        try {
                          const resp = await timedFetch(`${API_BASE_URL}/api/groups`);
                          setApiLatencyMs(resp.ms ?? null);
                          if (resp.ok) {
                            const data = resp.json ?? null;
                            setGroups(Array.isArray(data?.groups) ? data.groups : []);
                            setGroupsError(null);
                          } else setGroupsError(`HTTP ${resp.status}`);
                        } catch (e) {
                          setGroupsError(e.message);
                        }
                      }}
                      title="Recarregar grupos"
                      style={{ 
                        height: 38, padding: '0 12px', 
                        background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                        borderRadius: 6, color: darkMode ? '#94a3b8' : '#64748b', cursor: 'pointer'
                      }}
                    >↻</button>
                  </div>
                  {groupsError && <div style={{ color: '#f87171', fontSize: 11, marginTop: 6 }}>{groupsError}</div>}
                </div>
                {/* Tipos */}
                <div className="nm-card" style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? 'rgba(30, 41, 59, 0.4)' : '#fff' }}>
                  <div className="nm-card-title" style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{t.typesTitle}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {[
                      { key: 'DCU', color: '#3b82f6' },
                      { key: 'P70', color: '#22c55e' },
                      { key: 'BackHaul', color: '#f59e0b' },
                      { key: 'DA', color: '#ef4444' },
                    ].map(t => {
                      const on = !!typeFilters[t.key];
                      return (
                        <label key={t.key} className={`nm-chip ${on ? 'active' : ''}`} style={{ ['--chip']: t.color }}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => setTypeFilters(prev => ({ ...prev, [t.key]: e.target.checked }))}
                          />
                          <span className="pip" />
                          <span className="text">{t.key}</span>
                          <span className="tick">✓</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {/* Status */}
                <div className="nm-card" style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? 'rgba(30, 41, 59, 0.4)' : '#fff' }}>
                  <div className="nm-card-title" style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{t.statusTitle}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                    {[
                      { key: 'online', label: t.statusOnline, color: '#22c55e' },
                      { key: 'offline', label: t.statusOffline, color: '#ef4444' },
                      { key: 'unknown', label: t.statusUnknown, color: '#94a3b8' },
                    ].map(s => {
                      const on = !!statusFilters[s.key];
                      return (
                        <label key={s.key} className={`nm-chip nm-chip-status ${on ? 'active' : ''}`} style={{ ['--chip']: s.color }}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => setStatusFilters(prev => ({ ...prev, [s.key]: e.target.checked }))}
                          />
                          <span className="pip" />
                          <span className="text">{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Dashboard Resumo */}
                <div className="nm-stats" style={{ marginTop: 4 }}>
                  <div className="nm-stat-card online" style={{ background: darkMode ? 'rgba(34, 197, 94, 0.1)' : '#dcfce7', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <div className="title" style={{ color: '#16a34a' }}>{t.summaryOnline}</div>
                    <div className="value" style={{ color: '#15803d' }}>{countsSummary.online}</div>
                  </div>
                  <div className="nm-stat-card offline" style={{ background: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div className="title" style={{ color: '#dc2626' }}>{t.summaryOffline}</div>
                    <div className="value" style={{ color: '#b91c1c' }}>{countsSummary.offline}</div>
                  </div>
                  <div className="nm-stat-card inactive" style={{ background: darkMode ? 'rgba(148, 163, 184, 0.08)' : '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
                    <div className="title" style={{ color: '#94a3b8' }}>{t.summaryUnknown}</div>
                    <div className="value" style={{ color: '#94a3b8' }}>{countsSummary.unknown}</div>
                  </div>
                  <div className="nm-stat-card total" style={{ background: darkMode ? 'rgba(59, 130, 246, 0.1)' : '#dbeafe', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="title" style={{ color: '#2563eb' }}>{t.summaryTotal}</div>
                    <div className="value" style={{ color: '#1d4ed8' }}>{countsSummary.total}</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="nm-card">
                  <div className="nm-card-title">Auto Refresh</div>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Defina a cadência automática ou use as ações rápidas abaixo.</p>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Intervalo</label>
                  <select
                    value={autoRefreshMs}
                    onChange={(e) => setAutoRefreshMs(Number(e.target.value))}
                    style={{ width: '100%', background: darkMode ? '#0f172a' : '#f1f5f9', color: 'inherit', border: '1px solid #2c3e50', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  >
                    {REFRESH_PRESETS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="nm-btn nm-btn-primary" onClick={() => setRetryAttempt(p => p + 1)}>Atualizar Agora</button>
                    <button className="nm-btn nm-btn-outline" onClick={resetZoom}>Resetar Zoom</button>
                    <button className="nm-btn nm-btn-outline" onClick={clearSelection}>Limpar Seleção</button>
                  </div>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">{t.fullscreenTitle}</div>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{t.fullscreenDescription}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="nm-btn nm-btn-primary" onClick={toggleFullscreen}>
                      {isFullscreen ? t.fullscreenExit : t.fullscreenEnter}
                    </button>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.fullscreenHint}</span>
                  </div>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">Estilo do Mapa</div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Selecione o visual</label>
                  <select
                    value={mapStyleId}
                    onChange={(e) => setMapStyleId(e.target.value)}
                    style={{ width: '100%', background: darkMode ? '#0f172a' : '#f1f5f9', color: 'inherit', border: '1px solid #2c3e50', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  >
                    {MAP_STYLE_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label} — {opt.description}</option>
                    ))}
                  </select>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                    <div><strong>Descrição:</strong> {selectedMapStyle.description}</div>
                    <div style={{ marginTop: 4, wordBreak: 'break-all' }}><strong>Style URL:</strong> {readableMapStyle}</div>
                    <div style={{ marginTop: 4 }}><strong>Terreno:</strong> {supportsNativeTerrain ? 'Ativado' : 'Desativado'}</div>
                  </div>
                </div>
                

                {/* Pingar Equipamentos */}
                <div className="nm-card">
                  <div className="nm-card-title">Pingar Equipamentos</div>
                  <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Execute um teste rápido digitando o nome do equipamento ou selecione uma ação em massa.</p>
                    <label style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Equipamento individual</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        placeholder="Nome do equipamento (ex: AER-S-A-003)"
                        value={pingSingleName}
                        onChange={(e) => { setPingSingleName(e.target.value.toUpperCase()); if (pingInputError) setPingInputError(null); }}
                        style={{ 
                          flex: 1, 
                          background: darkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                          color: 'inherit', 
                          border: `1px solid ${pingInputError ? '#ef4444' : (darkMode ? '#334155' : '#cbd5e1')}`, 
                          borderRadius: 6, 
                          padding: '8px 12px', 
                          fontSize: 13,
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = pingInputError ? '#ef4444' : '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = pingInputError ? '#ef4444' : (darkMode ? '#334155' : '#cbd5e1')}
                      />
                      <button
                        className="nm-btn nm-btn-primary"
                        onClick={async () => {
                          const name = String(pingSingleName || '').trim();
                          if (!name) {
                            setPingInputError('Digite um nome válido antes de pingar.');
                            return;
                          }
                          const normalized = normalizeForSearch(name);
                          if (!searchableEquipmentNames.has(normalized)) {
                            setPingInputError(`"${name}" não foi encontrado na lista atual de equipamentos.`);
                            return;
                          }
                          setPingInputError(null);
                          await doPing([name]);
                        }}
                        disabled={pingRunning}
                        title="Pingar o equipamento digitado"
                      >{pingRunning ? 'Executando…' : 'Ping'}</button>
                    </div>
                    {pingInputError && (
                      <div style={{ fontSize: 12, color: '#fecaca', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 10px' }}>
                        {pingInputError}
                      </div>
                    )}
                    <div style={{ height: 1, background: 'rgba(148,163,184,0.2)', margin: '4px 0' }} />
                    <label style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Operações em massa</label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <button
                        className="nm-btn nm-btn-outline"
                        onClick={async () => {
                          const names = visibleRadios.map(r => String(r.name || r.id)).filter(Boolean);
                          if (!names.length) {
                            setPingInputError('Sem equipamentos visíveis para pingar. Ajuste filtros ou zoom.');
                            return;
                          }
                          setPingInputError(null);
                          await doPing(names);
                        }}
                        disabled={pingRunning || visibleRadios.length === 0}
                      >Pingar visíveis ({visibleRadios.length})</button>
                      <button
                        className="nm-btn nm-btn-outline"
                        onClick={async () => {
                          if (!hasSelectedGroups) {
                            setPingInputError('Selecione pelo menos um grupo antes de pingar em massa.');
                            return;
                          }
                          const names = radioBase.map(r => String(r.name || r.id)).filter(Boolean);
                          if (!names.length) {
                            setPingInputError('Nenhum equipamento disponível nos grupos selecionados.');
                            return;
                          }
                          setPingInputError(null);
                          await doPing(names);
                        }}
                        disabled={pingRunning || !hasSelectedGroups}
                      >Pingar grupos selecionados {hasSelectedGroups ? `(${selectedGroups.length})` : ''}</button>
                      <button className="nm-btn nm-btn-outline" onClick={() => { setPingInputError(null); setPingModalOpen(true); }}>Abrir Modal</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="nm-card" style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, background: darkMode ? 'rgba(15,23,42,0.5)' : '#fff' }}>
                  <div className="nm-card-title" style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{t.dataCardTitle}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8', marginBottom: 6 }}>{t.dataAvailabilityTitle}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <div style={{ borderRadius: 12, padding: 12, background: darkMode ? 'rgba(30,41,59,0.8)' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.dataRegionLabel}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#0f172a', marginTop: 4 }}>{formatPercent(dadosMetrics.regionPct)}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{t.dataRegionSubtitle}: {formatCounts(dadosMetrics.regionOnline, dadosMetrics.regionTotal)}</div>
                        </div>
                        <div style={{ borderRadius: 12, padding: 12, background: darkMode ? 'rgba(30,41,59,0.8)' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.dataDcuLabel}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#0f172a', marginTop: 4 }}>{formatPercent(dadosMetrics.dcuPct)}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{t.dataDcuSubtitle}: {formatCounts(dadosMetrics.dcuOnline, dadosMetrics.dcuTotal)}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <div style={{ borderRadius: 12, padding: 12, background: darkMode ? 'rgba(37,33,65,0.85)' : '#f9fafb', border: `1px solid ${darkMode ? 'rgba(129,140,248,0.25)' : '#e0e7ff'}` }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.dataLqiLabel} (média)</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#818cf8', marginTop: 4 }}>{dadosMetrics.lqiAvg != null ? dadosMetrics.lqiAvg.toFixed(1) : '—'}</div>
                        <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 6 }}>{t.dataWithinTarget}: {formatCounts(dadosMetrics.lqiGood, dadosMetrics.lqiTotal)}</div>
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>{t.dataOutsideTarget}: {formatCounts(dadosMetrics.lqiBad, dadosMetrics.lqiTotal)}</div>
                      </div>
                      <div style={{ borderRadius: 12, padding: 12, background: darkMode ? 'rgba(20,33,45,0.85)' : '#f0fdf4', border: `1px solid ${darkMode ? 'rgba(34,197,94,0.2)' : '#bbf7d0'}` }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.dataRssiLabel} (média)</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{dadosMetrics.rssiAvg != null ? `${dadosMetrics.rssiAvg.toFixed(0)} dBm` : '—'}</div>
                        <div style={{ fontSize: 11, color: '#86efac', marginTop: 6 }}>{t.dataWithinTarget}: {formatCounts(dadosMetrics.rssiGood, dadosMetrics.rssiTotal)}</div>
                        <div style={{ fontSize: 11, color: '#fda4af', marginTop: 2 }}>{t.dataOutsideTarget}: {formatCounts(dadosMetrics.rssiBad, dadosMetrics.rssiTotal)}</div>
                      </div>
                    </div>
                    <div style={{ borderRadius: 12, padding: 12, background: darkMode ? 'rgba(15,23,42,0.8)' : '#eef2ff', border: `1px solid ${darkMode ? 'rgba(59,130,246,0.25)' : '#c7d2fe'}` }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.dataAvailabilityTargetLabel}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>{formatPercent(dadosMetrics.availabilityAvg)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{t.dataWithinTarget}: {formatCounts(dadosMetrics.availabilityGood, dadosMetrics.availabilityTotal)}</div>
                      <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>{t.dataOutsideTarget}: {formatCounts(dadosMetrics.availabilityBad, dadosMetrics.availabilityTotal)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="nm-card">
                  <div className="nm-card-title">{t.languageCardTitle}</div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t.languageLabel}</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ width: '100%', background: darkMode ? '#0f172a' : '#f1f5f9', color: 'inherit', border: '1px solid #2c3e50', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  >
                    <option value="pt">{t.languageOptionPt}</option>
                    <option value="en">{t.languageOptionEn}</option>
                  </select>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">{t.displayTitle}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label className="nm-switch"><input type="checkbox" checked={showIcons} onChange={(e) => setShowIcons(e.target.checked)} /><span className="track"><span className="thumb" /></span><span className="label">{t.displayIcons}</span></label>
                    <label className="nm-switch"><input type="checkbox" checked={!hideLabels} onChange={(e) => setHideLabels(!e.target.checked)} /><span className="track"><span className="thumb" /></span><span className="label">{t.displayNames}</span></label>
                    <label className="nm-switch"><input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} /><span className="track"><span className="thumb" /></span><span className="label">{t.displayLinks}</span></label>
                  </div>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">{t.climateTitle}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label className="nm-switch" style={{ width: 'fit-content' }}>
                      <input type="checkbox" checked={showWeather} onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          // Prevent enabling: show modal explaining feature is in development
                          setShowClimateModal(true);
                          // keep showWeather false
                        } else {
                          setShowWeather(false);
                        }
                      }} />
                      <span className="track"><span className="thumb" /></span>
                      <span className="label">{t.climateToggle}</span>
                    </label>
                    <label className="nm-switch" style={{ width: 'fit-content' }}>
                      <input type="checkbox" checked={showTemperature} onChange={(e) => setShowTemperature(e.target.checked)} />
                      <span className="track"><span className="thumb" /></span>
                      <span className="label">{t.climateTempToggle}</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.climateOpacity}</span>
                      <input
                        type="range"
                        min={0.3}
                        max={1}
                        step={0.05}
                        value={weatherOpacity}
                        onChange={(e) => setWeatherOpacity(Number(e.target.value))}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.climateLegend}</span>
                      <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg, rgba(220,220,220,0.25), rgba(120,120,120,0.65), rgba(30,30,30,0.9))' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>{t.climateWeak}</span>
                        <span>{t.climateModerate}</span>
                        <span>{t.climateStrong}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{t.climateLightning}</span>
                    </div>
                    {/* Weather widget preview */}
                    {showWeather && (
                      <div style={{ marginTop: 12 }}>
                        <WeatherWidget data={weatherWidgetData} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">Tema</div>
                  <label className="nm-switch" style={{ width: 'fit-content' }}>
                    <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
                    <span className="track"><span className="thumb" /></span>
                    <span className="label">{darkMode ? 'Modo Escuro' : 'Modo Claro'}</span>
                  </label>
                </div>
                <div className="nm-card">
                  <div className="nm-card-title">{t.legendTitle}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#22c55e', display: 'inline-block' }} /> <span>{t.legendOnline}</span>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#ef4444', display: 'inline-block' }} /> <span>{t.legendOffline}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rodapé com usuário e atualização */}
            <div style={{ marginTop: 'auto', fontSize: 11, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: darkMode ? 'rgba(30,41,59,0.7)' : '#f1f5f9', border: `1px solid ${darkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0'}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, color: darkMode ? '#cbd5e1' : '#0f172a', fontWeight: 700 }}>
                    Olá, {currentUser?.username || currentUser?.email || 'usuário'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Acesso restrito</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isSuperAdmin && (
                    <button
                      onClick={() => { window.location.href = '/admin'; }}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: darkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe', color: darkMode ? '#bfdbfe' : '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}
                    >Painel Admin</button>
                  )}
                  <button
                    onClick={handleLogout}
                    style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >Sair</button>
                </div>
              </div>
              <div>
                Última atualização: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : '—'}
              </div>
            </div>
          </div>
        </aside>
      )}
      {/* Admin agora servido em rota /admin */}

      {showTemperature && nearestTemperature && (
        <div style={{ position: 'absolute', top: 24, right: '10%', zIndex: 20, width: 'min(420px,44vw)', transform: 'translateZ(0)' }}>
          <WeatherWidget data={weatherWidgetData} />
        </div>
      )}
      {/* Painel: Filtros de Equipamentos */}
      {showEquipmentPanel && (
        <div style={{ position: 'absolute', top: 68, right: 12, zIndex: 12, width: 260, background: darkMode ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.98)', color: darkMode ? '#e2e8f0' : '#0f172a', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <strong>Equipamentos</strong>
            <button onClick={() => setShowEquipmentPanel(false)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ padding: 10, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['DCU','P70','BackHaul','DA'].map(k => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>{k}</span>
                <input type="checkbox" checked={!!typeFilters[k]} onChange={(e) => setTypeFilters(prev => ({ ...prev, [k]: e.target.checked }))} />
              </label>
            ))}
          </div>
        </div>
      )}
      {panelHidden && (
        <button
          onClick={() => { setPanelHidden(false); setIsOpening(true); setTimeout(() => setIsOpening(false), 680); }}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 13,
          }}
          title="Mostrar painel"
        >Mostrar Painel</button>
      )}
      {/* Modal de Ping */}
      {pingModalOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 30, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 'min(98vw, 1040px)',
              maxHeight: '82vh',
              overflow: 'auto',
              background: darkMode ? 'rgba(17,24,39,0.98)' : '#fff',
              color: darkMode ? '#e2e8f0' : '#0f172a',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            className="ping-modal"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <strong>Resultados do Ping</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="nm-btn nm-btn-outline" onClick={() => setPingModalOpen(false)}>Fechar</button>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              {pingRunning && (
                <div style={{ padding: 12, borderRadius: 8, background: darkMode ? 'rgba(148,163,184,0.08)' : '#f1f5f9' }}>
                  Executando ping nos equipamentos selecionados…
                </div>
              )}
              {!pingRunning && pingResults && pingResults.ok && Array.isArray(pingResults.results) && (() => {
                // resumo
                const total = pingResults.total ?? pingResults.results.length;
                const okCount = pingResults.okCount ?? pingResults.results.filter(x => x && x.success).length;
                const failCount = pingResults.failCount ?? (total - okCount);
                const rttValues = pingResults.results.map(r => r && r.timeMs).filter(v => Number.isFinite(v));
                const avgRtt = rttValues.length ? Math.round(rttValues.reduce((a,b)=>a+b,0)/rttValues.length) : null;

                const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 };
                const cardBase = { flex: '1 1 120px', minWidth: 120, background: darkMode ? 'rgba(2,6,23,0.9)' : '#eef2ff', border: `1px solid ${darkMode ? 'rgba(34,197,94,0.2)' : '#86efac'}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
                const cardRed = { ...cardBase, border: `1px solid ${darkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}` };
                const cardBlue = { ...cardBase, border: `1px solid ${darkMode ? 'rgba(59,130,246,0.35)' : '#bfdbfe'}` };
                const muted = { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' };
                const bigNum = (color) => ({ fontSize: 26, fontWeight: 800, color });

                // tabela
                const thStyle = { padding: '8px 6px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', borderTop: '1px solid rgba(148,163,184,0.2)', borderBottom: '1px solid rgba(148,163,184,0.2)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' };
                const tdStyle = { padding: '8px 6px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word' };
                const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#67e8f9' };
                const pillStyle = (variant) => {
                  const base = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 28,
                    padding: '0 18px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    border: '1px solid transparent',
                    boxShadow: '0 0 8px rgba(0,0,0,0.25)'
                  };
                  if (variant === 'fail') {
                    return {
                      ...base,
                      color: '#fecaca',
                      borderColor: 'rgba(248,113,113,0.7)',
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(127,29,29,0.25))'
                    };
                  }
                  if (variant === 'partial') {
                    return {
                      ...base,
                      color: '#fde68a',
                      borderColor: 'rgba(251,191,36,0.8)',
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.16), rgba(120,53,15,0.3))'
                    };
                  }
                  return {
                    ...base,
                    color: '#ecfccb',
                    borderColor: 'rgba(74,222,128,0.85)',
                    background: 'linear-gradient(135deg, #22c55e, #0f9960)',
                    boxShadow: '0 0 12px rgba(34,197,94,0.35)'
                  };
                };
                const green = '#22c55e', red = '#ef4444', orange = '#f59e0b', orangeBg = 'rgba(245,158,11,0.12)';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Resumo */}
                    <div style={headerStyle}>
                      <div style={{ color: '#94a3b8', fontSize: 13 }}>
                        <div>Total: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{total}</span></div>
                        <div>Sucesso: <span style={{ color: green, fontWeight: 700 }}>{okCount}</span></div>
                        <div>Falha: <span style={{ color: red, fontWeight: 700 }}>{failCount}</span></div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
                        <div style={cardBase}>
                          <span style={muted}>Sucesso</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={bigNum(green)}>{okCount}</span>
                          </div>
                        </div>
                        <div style={cardRed}>
                          <span style={muted}>Falha</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={bigNum(red)}>{failCount}</span>
                          </div>
                        </div>
                        <div style={cardBlue}>
                          <span style={muted}>Tempo Médio RTT</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <span style={{ ...bigNum('#60a5fa'), fontSize: 22 }}>{avgRtt != null ? avgRtt : '—'}<span style={{ fontSize: 14, marginLeft: 2 }}>ms</span></span>
                          </div>
                          <span style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Preenchido</span>
                        </div>
                      </div>
                    </div>

                    {/* Tabela */}
                    <div style={{ overflowX: 'hidden' }}>
                      <table style={{ width: '100%', tableLayout: 'fixed', textAlign: 'left', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Nome</th>
                            <th style={thStyle}>Alvo</th>
                            <th style={thStyle}>RTT</th>
                            <th style={thStyle}>Disp.</th>
                            <th style={thStyle}>RSSI</th>
                            <th style={thStyle}>LQI</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pingResults.results.map((r, i) => {
                            const fb = metricsByName.get(String(r.name || '').trim());
                            const availVal = (r.availabilityPct != null ? r.availabilityPct : (fb ? fb.availabilityPct : null));
                            const rssiVal = (typeof r.rssi === 'number' ? r.rssi : (fb ? fb.rssi : null));
                            const lqiVal = (typeof r.lqi === 'number' ? r.lqi : (fb ? fb.lqi : null));
                            const rate = Number((r.txRateKbps != null ? r.txRateKbps : (fb ? fb.txRateKbps : 0)) || 0);
                            const dispBad = (availVal != null && availVal < 99.8);
                            const rssiBad = (typeof rssiVal === 'number' && rssiVal < -85);
                            const lqiBad = (() => {
                              if (typeof lqiVal !== 'number') return false;
                              if (rate === 250) return lqiVal > 21;
                              if (rate === 500) return lqiVal > 14;
                              if (rate === 1000) return lqiVal > 6;
                              return false;
                            })();
                            const anyBad = (dispBad || rssiBad || lqiBad);
                            const rowPartial = (r.success && anyBad);
                            const rowStyle = rowPartial ? { background: orangeBg } : {};
                            const fmtPct = (v) => (v == null ? '—' : `${(Math.round(v * 100) / 100).toFixed(2)}%`);
                            const fmtRssi = (v) => (v == null ? '—' : `${Math.round(v)} dBm`);
                            const fmtLqi = (v) => (v == null ? '—' : `${Math.round(v)}`);
                            const statusEl = (() => {
                              if (!r.success) return <span style={pillStyle('fail')}>NÃO PINGOU</span>;
                              if (rowPartial) return <span style={pillStyle('partial')}>FALHA PARCIAL</span>;
                              return <span style={pillStyle('ok')}>ONLINE</span>;
                            })();
                            return (
                              <tr key={i} style={rowStyle}>
                                <td style={{ ...tdStyle, fontWeight: 600, color: '#e2e8f0', wordBreak: 'break-word', whiteSpace: 'normal' }}>{String(r.name || '')}</td>
                                <td style={{ ...tdStyle, ...mono, wordBreak: 'break-word', whiteSpace: 'normal' }}>{r.target || '—'}</td>
                                <td style={{ ...tdStyle, whiteSpace: 'normal' }}><span style={{ fontWeight: 800, color: '#e2e8f0' }}>{r.timeMs != null ? r.timeMs : '—'}</span> <span style={{ color: '#94a3b8' }}>ms</span></td>
                                <td style={{ ...tdStyle, color: dispBad ? orange : green, fontWeight: 600, whiteSpace: 'normal' }}>{fmtPct(availVal)}</td>
                                <td style={{ ...tdStyle, color: rssiBad ? orange : green, fontWeight: 600, whiteSpace: 'normal' }}>{fmtRssi(rssiVal)}</td>
                                <td style={{ ...tdStyle, color: lqiBad ? orange : green, fontWeight: 600, whiteSpace: 'normal' }}>{fmtLqi(lqiVal)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{statusEl}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
              {!pingRunning && pingResults && !pingResults.ok && (
                <div style={{ color: '#ef4444' }}>Falha ao executar ping: {String(pingResults.error || 'Erro desconhecido')}</div>
              )}
              {!pingRunning && !pingResults && (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Escolha uma opção na seção "Pingar Equipamentos" e clique em "Iniciar Ping".</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal: Clima em desenvolvimento */}
      {showClimateModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 'min(92vw, 520px)', background: darkMode ? 'rgba(17,24,39,0.98)' : '#fff', color: darkMode ? '#e2e8f0' : '#0f172a', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Solução em Desenvolvimento</strong>
              <button className="nm-btn nm-btn-outline" onClick={() => setShowClimateModal(false)}>Fechar</button>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              A camada climática ainda está em desenvolvimento.
            </div>
          </div>
        </div>
      )}
        {/* Resumo da Rede removido daqui; agora dentro da aba Filtros como dashboard */}

        {/* Painel de Legenda (canto inferior direito) */}
        <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 10, width: 260, background: darkMode ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.98)', color: darkMode ? '#e2e8f0' : '#0f172a', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <strong>{t.legendTitle}</strong>
            <button onClick={() => setLegendCollapsed(v => !v)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>{legendCollapsed ? '▾' : '▴'}</button>
          </div>
          {!legendCollapsed && (
            <div style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={DA_G} alt="DA Online" width={14} height={14} />
                <div>DA <span style={{ color: '#22c55e' }}>{t.legendOnline}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={DA_R} alt="DA Offline" width={14} height={14} />
                <div>DA <span style={{ color: '#ef4444' }}>{t.legendOffline}</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={GAB_DCU_G} alt="Gab. DCU Online" width={14} height={14} />
                <div>Gab. DCU <span style={{ color: '#22c55e' }}>{t.legendOnline}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={GAB_DCU_R} alt="Gab. DCU Offline" width={14} height={14} />
                <div>Gab. DCU <span style={{ color: '#ef4444' }}>{t.legendOffline}</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={GAB_DCU_GE_B2B_G} alt="Gab. DCU+GE+B2B Online" width={14} height={14} />
                <div>Gab. DCU+GE+B2B <span style={{ color: '#22c55e' }}>{t.legendOnline}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={GAB_DCU_GE_B2B_R} alt="Gab. DCU+GE+B2B Offline" width={14} height={14} />
                <div>Gab. DCU+GE+B2B <span style={{ color: '#ef4444' }}>{t.legendOffline}</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={P70_G} alt="P70 Online" width={14} height={14} />
                <div>P70 <span style={{ color: '#22c55e' }}>{t.legendOnline}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={P70_R} alt="P70 Offline" width={14} height={14} />
                <div>P70 <span style={{ color: '#ef4444' }}>{t.legendOffline}</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={REP_BACKHAUL_G} alt="Rep. Backhaul Online" width={14} height={14} />
                <div>Rep. Backhaul <span style={{ color: '#22c55e' }}>{t.legendOnline}</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={REP_BACKHAUL_R} alt="Rep. Backhaul Offline" width={14} height={14} />
                <div>Rep. Backhaul <span style={{ color: '#ef4444' }}>{t.legendOffline}</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: 'span 2' }}>
                <span style={{ width: 24, height: LINK_SAMPLE_HEIGHT_INACTIVE, background: '#747572', display: 'inline-block' }} />
                <span>{t.legendInactiveText}</span>
              </div>

              <div style={{ gridColumn: 'span 2', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 8, color: '#cbd5e1' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.legendLinksTitle}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 24, height: LINK_SAMPLE_HEIGHT_ACTIVE, background: 'rgb(34,197,94)', display: 'inline-block', borderRadius: 2 }} />
                  <span>{t.legendLinksOnline}</span>
                  <span style={{ width: 24, height: LINK_SAMPLE_HEIGHT_ACTIVE, background: 'rgb(220,64,52)', display: 'inline-block', borderRadius: 2 }} />
                  <span>{t.legendLinksOffline}</span>
                  <span style={{ width: 24, height: LINK_SAMPLE_HEIGHT_ACTIVE, background: '#EE964B', display: 'inline-block', borderRadius: 2 }} />
                  <span>{t.legendLinksMixed}</span>
                  <span style={{ width: 24, height: LINK_SAMPLE_HEIGHT_ACTIVE, background: '#747572', display: 'inline-block', borderRadius: 2 }} />
                  <span>{t.legendLinksInactive}</span>
                </div>
              </div>
            </div>
          )}
        </div>
  <DeckGL
    controller={{ dragRotate: true }}
    layers={layers}
    viewState={safeViewState}
    onViewStateChange={({ viewState: next }) => setViewState(next)}
    onHover={({ object, x, y, layer }) => {
      const id = object && object.id ? object.id : null;
      if (id && id !== hoveredId) {
        setHoveredId(id);
        // fire-and-forget
        fetchDetails(id).catch(() => {});
      } else if (!id) {
        setHoveredId(null);
        }
    }}
    onContextMenu={({ object, layer, srcEvent }) => {
      // right-click on an icon: ping that equipment via Zabbix
      try {
        if (srcEvent && typeof srcEvent.preventDefault === 'function') srcEvent.preventDefault();
      } catch (e) {}
      if (!object) return;
      if (layer && (layer.id === 'radios' || layer.id === 'radios-icons')) {
        const name = String(object.name || object.id || '').trim();
        if (!name) return;
        // fire-and-forget; doPing will open modal and show results
        void doPing([name]);
      }
    }}
        getTooltip={({ object, layer, x, y }) => {
          if (!object) return null;
          if (layer?.id === "radios" || layer?.id === 'radios-icons') {
            const vs = object.visStatus ?? object.status;
            const statusLabel = vs === "online" ? "Online" : (vs === 'offline' ? 'Offline' : 'Inativo');
            const tipo = object.tipoEquipamento || object.tipo || object.type || '—';
            const tipoLower = String(tipo).toLowerCase();
            const isLargeTooltipType = /b2b|backhaul/.test(tipoLower);
            const isComposite = Array.isArray(object.labelSegments) && object.labelSegments.length > 1;
            const idB2bLine = object.idB2b ? `\nID B2B: ${object.idB2b}` : '';

            // prefer details fetched on-demand, depois o raw original, depois o próprio objeto
            const raw = (detailsCache && detailsCache[object.id]) || object.raw || object;

            const getNestedInsensitive = (obj, path) => {
              if (!obj || typeof obj !== 'object') return undefined;
              // acesso literal
              if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
              const parts = path.split('.');
              let cur = obj;
              for (const part of parts) {
                if (!cur || typeof cur !== 'object') return undefined;
                const keys = Object.keys(cur);
                const match = keys.find(k => k.toLowerCase() === part.toLowerCase());
                if (match === undefined) return undefined;
                cur = cur[match];
              }
              return cur;
            };

            const pickAny = (candidates) => {
              for (const c of candidates) {
                // 1) literal top-level
                if (raw && Object.prototype.hasOwnProperty.call(raw, c)) {
                  const v = raw[c];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return v;
                }
                // 2) nested case-insensitive
                const v2 = getNestedInsensitive(raw, c);
                if (v2 !== undefined && v2 !== null && String(v2).trim() !== '') return v2;
                // 3) underscore variant
                const simple = c.replace(/\./g, '_');
                if (raw && Object.prototype.hasOwnProperty.call(raw, simple)) {
                  const v3 = raw[simple];
                  if (v3 !== undefined && v3 !== null && String(v3).trim() !== '') return v3;
                }
                // 4) check inside a `pd` subobject if present
                if (raw && raw.pd && typeof raw.pd === 'object') {
                  if (Object.prototype.hasOwnProperty.call(raw.pd, c)) return raw.pd[c];
                  const v4 = getNestedInsensitive(raw.pd, c);
                  if (v4 !== undefined && v4 !== null && String(v4).trim() !== '') return v4;
                }
              }
              return null;
            };

            // candidatos adaptados ao seu esquema solicitado
            const nomeBancoCandidates = ['db_name', 'database', 'banco_de_dados', 'nome_banco', 'nome_do_banco', 'banco', 'banco_de_dados_field'];
            const psCandidates = ['pd.pspostefield', 'pspostefield', 'ps_poste', 'psPoste', 'psposte', 'pd.ps_poste'];
            // Para TIPO DE ANTENA e AZIMUTE, aplicar a mesma regra do PS POSTE: usar apenas os campos normalizados
            // vindos do pipeline (frontend/backend) — nada de heurísticas amplas.
            // Mantemos candidatos apenas como fallback extremo se ambos estiverem ausentes.
            const tipoAntenaCandidates = ['tipodeantena', 'tipodeantena.name'];
            const azimuteCandidates = ['azimutefield'];
            // chaves Zabbix / métricas
            const rssiCandidates = ['net.if.avgRssi', 'ifNxApInfoAvgRssi', 'avgRssi', 'rssi', 'net_if_avgRssi', 'ifNxApInfoAvgRssi'];
            const lqiCandidates = ['net.if.avgLqi', 'ifNxApInfoAvgLqi', 'avgLqi', 'lqi', 'net_if_avgLqi'];
            const dispCandidates = ['icmp.success.24h', 'icmp_success_24h', 'icmpSuccess24h', 'availability', 'disponibilidade', 'icmp'];

            const nomeBanco = pickAny(nomeBancoCandidates);
            // PS POSTE: agora padronizado como o tipo — usar apenas o campo normalizado preenchido em loadRadios
            const psPoste = object?.psPoste ?? null;
            // Preferir campos normalizados no objeto (como fazemos com PS POSTE)
            let tipoAntena = object?.tipoAntena ?? object?.tipodeantena ?? null;
            const azimute = object?.azimute ?? object?.azimutefield ?? null;
            // Fallback opcional (evitar esconder totalmente caso o dado venha cru)
            if (tipoAntena == null) tipoAntena = pickAny(tipoAntenaCandidates);

            // Para RSSI/LQI/DISPONIBILIDADE queremos também tentar localizar o nome exato da chave Zabbix
            // Procura por qualquer propriedade cujo nome contenha 'rssi'/'lqi'/'icmp' e retorna {key, value}
            const findKeyAndValue = (obj, needleRegex) => {
              if (!obj || typeof obj !== 'object') return null;
              for (const k of Object.keys(obj)) {
                if (needleRegex.test(k)) {
                  const v = obj[k];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return { key: k, value: v };
                }
                // também busca recursivamente uma camada (ex.: metrics: { 'net.if.avgRssi': 23 })
                const child = obj[k];
                if (child && typeof child === 'object') {
                  for (const kk of Object.keys(child)) {
                    if (needleRegex.test(kk)) {
                      const vv = child[kk];
                      if (vv !== undefined && vv !== null && String(vv).trim() !== '') return { key: kk, value: vv };
                    }
                  }
                }
              }
              return null;
            };

            let rssiFound = findKeyAndValue(raw, /rssi/i) || (raw && raw.metrics && findKeyAndValue(raw.metrics, /rssi/i));
            let lqiFound = findKeyAndValue(raw, /lqi/i) || (raw && raw.metrics && findKeyAndValue(raw.metrics, /lqi/i));
            let dispFound = findKeyAndValue(raw, /icmp|availability|success/i) || (raw && raw.metrics && findKeyAndValue(raw.metrics, /icmp|availability|success/i));

            // normalize tipo antena if object
            if (tipoAntena && typeof tipoAntena === 'object') {
              tipoAntena = tipoAntena.name || tipoAntena.label || JSON.stringify(tipoAntena);
            }

            const fmt = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v)));

            // helpers HTML
            const esc = (s) => String(s == null ? '' : s)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

            const psFmt = fmt(psPoste) || '—';
            let tipoAntFmt = fmt(tipoAntena) || '—';
            const azFmt = fmt(azimute) || '—';

            // Conversores numéricos seguros
            const toNumber = (val) => {
              if (val == null) return null;
              if (typeof val === 'number' && Number.isFinite(val)) return val;
              const s = String(val).trim();
              if (!s) return null;
              const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
              if (!m) return null;
              const n = Number(m[0]);
              return Number.isFinite(n) ? n : null;
            };

            // Build sections HTML
            const title = esc(object.name || object.id);
            const tipoHtml = esc(tipo);
            const statusHtmlClass = (vs === 'online') ? 'online' : (vs === 'offline' ? 'offline' : '');
            const statusHtmlText = esc(statusLabel);

            const buildEquipBlock = (label, segStatus, rssi, lqi, disp, hideSignal) => {
              const cls = (segStatus === 'online') ? 'online' : 'offline';
              const statusText = segStatus === 'online' ? 'Online' : (segStatus === 'offline' ? 'Offline' : 'Inativo');
              const rssiTxt = (rssi == null) ? '—' : `${Math.round(rssi)} dBm`;
              const lqiTxt = (lqi == null) ? '—' : `${Math.round(lqi)}`;
              const dispNum = (disp == null) ? null : Math.round(disp);
              const dispTxt = dispNum == null ? '—' : `${dispNum}%`;
              const dispCls = (segStatus === 'online') ? 'online' : 'offline';
              return `
                <div class="equip ${cls}">
                  <h4>${esc(label)} (${esc(statusText)})</h4>
                  ${hideSignal ? '' : `
                  <div class="value-box"><span class="label">RSSI:</span> <span>${esc(rssiTxt)}</span></div>
                  <div class="value-box"><span class="label">LQI:</span> <span>${esc(lqiTxt)}</span></div>
                  `}
                  <div class="value-box"><span class="label">DISPONIBILIDADE:</span> <span class="${dispCls}">${esc(dispTxt)}</span></div>
                </div>
              `;
            };

            // Determine blocks (single or per-segment)
            let equipBlocksHtml = '';
            if (isComposite) {
              const segs = Array.isArray(object.labelSegments) ? object.labelSegments : [];
              const parentTypeLabel = String(object?.tipoEquipamento || object?.tipo || '').toLowerCase();
              const isDcuAggregate = parentTypeLabel.includes('dcu_inicial') || parentTypeLabel.includes('dcu-agg');
              for (const seg of segs) {
                const segStatus = (seg?.status === 'online' || seg?.status === 'offline') ? seg.status : 'offline';
                const segNameU = String(seg?.text || '').toUpperCase();
                const segNameLooksNonDcu = /-GE-| -A-/.test(segNameU);
                const segTypeLooksDcu = /(^|\b)DCU(\b|$)/i.test(String(seg?.tipoEquipamento || ''));
                const isDcuSeg = segTypeLooksDcu && !segNameLooksNonDcu;
                const segMode = String(seg?.modoOperacao || object?.modoOperacao || '').trim().toLowerCase();
                const isApSeg = segMode === 'access-point' || segMode === 'access point' || segMode === 'accesspoint';
                const hideSignal = isDcuAggregate || isDcuSeg || isApSeg;
                equipBlocksHtml += buildEquipBlock(seg?.text || '', segStatus, seg?.rssi, seg?.lqi, seg && seg['icmp.success.24h'], hideSignal);
              }
            } else {
              const nameU = String(object?.name || '').toUpperCase();
              const nameLooksNonDcu = /-GE-| -A-/.test(nameU);
              const typeLooksDcu = /(^|\b)DCU(\b|$)/i.test(String(object?.tipoEquipamento || object?.tipo || ''));
              const isDcuSingle = typeLooksDcu && !nameLooksNonDcu;
              const modeStr = String(object?.modoOperacao || (object?.raw && (object.raw.modoOperacao || object.raw.modo_operacao)) || '').trim().toLowerCase();
              const isAccessPoint = modeStr === 'access-point' || modeStr === 'access point' || modeStr === 'accesspoint';
              let rssiNum = toNumber(object?.rssi);
              if (rssiNum == null) {
                if (rssiFound) rssiNum = toNumber(rssiFound.value);
                if (rssiNum == null) rssiNum = toNumber(pickAny(rssiCandidates));
              }
              let lqiNum = toNumber(object?.lqi);
              if (lqiNum == null) {
                if (lqiFound) lqiNum = toNumber(lqiFound.value);
                if (lqiNum == null) lqiNum = toNumber(pickAny(lqiCandidates));
              }
              let dispNum = toNumber(object?.['icmp.success.24h']);
              if (dispNum == null) {
                if (dispFound) dispNum = toNumber(dispFound.value);
                if (dispNum == null) dispNum = toNumber(pickAny(dispCandidates));
              }
              equipBlocksHtml = buildEquipBlock(object.name || object.id, (vs === 'online' ? 'online' : (vs === 'offline' ? 'offline' : 'offline')), rssiNum, lqiNum, dispNum, (isDcuSingle || isAccessPoint));
            }

            // Detecta bordas para auto-ajustar o tooltip quando estiver próximo
            const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
            const pointerX = typeof x === 'number' ? x : null;
            const pointerY = typeof y === 'number' ? y : null;
            const tooltipWidthPx = isLargeTooltipType ? 320 : 260;
            const tooltipHeightPx = isComposite ? (isLargeTooltipType ? 300 : 260) : (isLargeTooltipType ? 240 : 200);
            const marginPx = 18;
            const edgeThresholdRatio = 0.5; // start repositioning when only 50% of the viewport remains
            const nearRightEdge = pointerX != null && viewportWidth > 0
              ? pointerX >= viewportWidth * (1 - edgeThresholdRatio)
              : pointerX != null && viewportWidth && (viewportWidth - pointerX) < (tooltipWidthPx + marginPx);
            const nearLeftEdge = pointerX != null && viewportWidth > 0
              ? pointerX <= viewportWidth * edgeThresholdRatio
              : pointerX != null && pointerX < (tooltipWidthPx * edgeThresholdRatio);
            const nearBottomEdge = pointerY != null && viewportHeight > 0
              ? pointerY >= viewportHeight * (1 - edgeThresholdRatio)
              : pointerY != null && viewportHeight && (viewportHeight - pointerY) < (tooltipHeightPx + marginPx);
            const nearTopEdge = pointerY != null && viewportHeight > 0
              ? pointerY <= viewportHeight * edgeThresholdRatio
              : pointerY != null && pointerY < (tooltipHeightPx * edgeThresholdRatio);

            let dynamicLiftPx = 0;
            if (nearBottomEdge && pointerY != null && viewportHeight > 0) {
              const bottomThresholdStart = viewportHeight * (1 - edgeThresholdRatio);
              const normalized = (pointerY - bottomThresholdStart) / (viewportHeight * edgeThresholdRatio);
              const closeness = Math.min(1, Math.max(0, normalized));
              const maxLiftPx = tooltipHeightPx * 0.65; // allow lift up to ~65% of tooltip height
              dynamicLiftPx = closeness * maxLiftPx;
            }
            const tooltipClassList = ['tooltip'];
            if (isLargeTooltipType) tooltipClassList.push('tooltip-wide');
            if (nearRightEdge) tooltipClassList.push('tooltip-edge-right');
            if (nearLeftEdge) tooltipClassList.push('tooltip-edge-left');
            if (nearBottomEdge) tooltipClassList.push('tooltip-edge-bottom');
            if (nearTopEdge) tooltipClassList.push('tooltip-edge-top');
            if ((nearRightEdge || nearLeftEdge) && !nearBottomEdge) {
              tooltipClassList.push('tooltip-edge-lift');
            }
            const tooltipClassName = tooltipClassList.join(' ');
            const tooltipLiftAttr = `style="--tooltip-lift:${dynamicLiftPx.toFixed(2)}px;"`;

            // Compose final HTML with styles (scoped to tooltip)
            const css = `
              <style>
                .tooltip { box-sizing: border-box; background: linear-gradient(160deg, rgba(8,12,25,0.85), rgba(20,35,65,0.82)); border: 1px solid rgba(56,189,248,0.2); border-radius: 12px; padding: 10px; width: 260px; max-width: 260px; box-shadow: 0 0 14px rgba(56,189,248,0.14), 0 0 6px rgba(0,0,0,0.45); font-size: 11px; backdrop-filter: blur(6px); position: relative; animation: fadeIn 0.18s ease-out; color: #fff; transform-origin: left top; pointer-events: none; overflow: visible; }
                .tooltip-wide { width: 320px; max-width: 320px; }
                @keyframes fadeIn { from {opacity: 0; transform: translateY(6px);} to {opacity: 1; transform: translateY(0);} }
                .tooltip::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(56,189,248,0.12), transparent 60%); opacity: 0.28; z-index: 0; pointer-events: none; }
                .tooltip * { position: relative; z-index: 1; word-break: break-word; overflow-wrap: anywhere; }
                .tooltip { margin-top: calc(12px - var(--tooltip-lift, 0px)); margin-left: 14px; }
                .tooltip-edge-right { margin-left: calc(-100% - 14px); transform-origin: right top; }
                .tooltip-edge-left { margin-left: 14px; transform-origin: left top; }
                .tooltip-edge-bottom { margin-top: calc(-100% - 12px - var(--tooltip-lift, 0px)); transform-origin: left bottom; }
                .tooltip-edge-top { margin-top: calc(12px - var(--tooltip-lift, 0px)); transform-origin: left top; }
                .tooltip-edge-lift { margin-top: calc(-100% - 12px - var(--tooltip-lift, 0px)); transform-origin: left bottom; }
                .tooltip-edge-right.tooltip-edge-lift { transform-origin: right bottom; }
                .tooltip-edge-right.tooltip-edge-bottom { transform-origin: right bottom; }
                .tooltip-edge-right.tooltip-edge-top { transform-origin: right top; }
                .tooltip-edge-left.tooltip-edge-lift { transform-origin: left bottom; }
                .tooltip-edge-left.tooltip-edge-bottom { transform-origin: left bottom; }
                .tooltip h3 { margin: 0 0 8px; font-size: clamp(12px, 1.4vw, 14px); background: linear-gradient(90deg, #38bdf8, #60a5fa, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700; text-shadow: 0 0 8px rgba(56,189,248,0.22); letter-spacing: 0.4px; word-break: break-word; }
                .tooltip p { margin: 2px 0; line-height: 1.3; font-size: 11px; }
                .label { color: #9ca3af; font-size: 11px; }
                .online { color: #22c55e; font-weight: 700; text-shadow: 0 0 5px rgba(34,197,94,0.35); font-size: 11px; }
                .offline { color: #ef4444; font-weight: 700; text-shadow: 0 0 5px rgba(239,68,68,0.35); font-size: 11px; }
                .equip { margin-top: 8px; padding: 6px 8px; border-radius: 10px; background: rgba(255,255,255,0.03); box-shadow: inset 0 0 8px rgba(56,189,248,0.06); transition: all 0.2s ease; }
                .equip.online { border-left: 3px solid #22c55e; }
                .equip.offline { border-left: 3px solid #ef4444; }
                .equip:hover { background: rgba(56,189,248,0.06); transform: scale(1.01); }
                .equip h4 { margin: 0 0 4px; font-size: 11px; display: flex; align-items: center; gap: 6px; }
                .equip.online h4::before { content: '🟢'; }
                .equip.offline h4::before { content: '🔴'; }
                .equip.online h4 { color: #22c55e; text-shadow: 0 0 5px rgba(34,197,94,0.35); }
                .equip.offline h4 { color: #ef4444; text-shadow: 0 0 5px rgba(239,68,68,0.35); }
                .value-box { margin-top: 6px; padding: 4px 6px; border-radius: 8px; background: rgba(255,255,255,0.04); display: flex; justify-content: space-between; align-items: center; font-weight: 600; flex-wrap: wrap; gap: 6px; font-size: 11px; }
                .value-box span { min-width: 0; }
                .value-box span:last-child { margin-left: auto; text-align: right; }
                .icon-antenna::before { content: '📶'; margin-right: 6px; }
                .icon-map::before { content: '🧭'; margin-right: 6px; }
              </style>
            `;

            const headerHtml = `
              <h3>${title}</h3>
              <p class="icon-antenna"><span class="label">Tipo:</span> ${tipoHtml}</p>
              <p><span class="label">Status:</span> <span class="${statusHtmlClass}">${statusHtmlText}</span></p>
              <p class="icon-map"><span class="label">PS POSTE:</span> ${esc(psFmt)}</p>
              <p><span class="label">TIPO DE ANTENA:</span> ${esc(tipoAntFmt)}</p>
              <p><span class="label">AZIMUTE:</span> ${esc(azFmt)}</p>
            `;

            const html = `
              ${css}
              <div class="${tooltipClassName}" ${tooltipLiftAttr}>
                ${headerHtml}
                ${equipBlocksHtml}
              </div>
            `;

            return {
              html,
              style: {
                padding: '0px',
                backgroundColor: 'transparent',
                border: 'none'
                // sem maxWidth para não limitar o container externo
              }
            };
          }
          return null;
        }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      >
        {isLoading && (
          <div
            className="nm-preload-overlay"
            style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center' }}
            role="status"
            aria-live="polite"
          >
            <div className="nm-loader-shell">
              <div className="nm-radar-wrapper">
                <span className="nm-radar-ring" />
                <span className="nm-radar-ring" />
                <span className="nm-radar-ring" />
                <span className="nm-pin-shadow" />
                <svg className="nm-map-pin-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#ef4444" />
                  <circle cx="12" cy="9" r="2.5" fill="white" />
                </svg>
              </div>
              <h1 className="nm-loader-title">
                <span className="zabb">Zabb</span>
                <span className="map">Map</span>
              </h1>
              <div className="nm-loader-progress">
                <span className="nm-loader-label">{t.loadingLabel}</span>
                <div className="nm-progress-track">
                  <div className="nm-progress-bar" />
                </div>
              </div>
            </div>
          </div>
        )}
        <MapGL
          reuseMaps
          mapStyle={currentMapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          attributionControl={false}
          maxPitch={85}
          onLoad={(event) => {
            // restored minimal onLoad: keep map reference and instance
            mapRef.current = event.target;
            setMapInstance(event.target);
          }}
        />
        </DeckGL>
    </div>
  );
};

export default ParanaNetworkMap;

