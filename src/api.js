const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1';

export const apiUrl = (path) => `${API_BASE}${path}`;

export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const SYSTEM_COLORS = [
  '#9b4b37', // red-brown
  '#7b5a7a', // purple
  '#3f7a67', // teal
  '#9a6131', // amber
  '#5e7480', // slate
  '#7a6340', // olive
];

const SYSTEM_ICONS = {
  "d&d": '⚔️', "dungeons": '⚔️', "ad&d": '⚔️',
  "pathfinder": '🗺️',
  "ironsworn": '🗡️',
  "cthulhu": '📚', "masks": '📚',
  "dragonbane": '🐉',
  "starfinder": '🚀',
  "shadowrun": '🌆',
  "vampire": '🩸',
  "warhammer": '🔨',
};

export function getCampaignStyle(campaign) {
  const sys = (campaign.rules_system || campaign.rulesSystem || '').toLowerCase();
  let icon = '🎲';
  for (const [key, val] of Object.entries(SYSTEM_ICONS)) {
    if (sys.includes(key)) { icon = val; break; }
  }
  let hash = 0;
  const seed = campaign.id || sys;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const color = SYSTEM_COLORS[hash % SYSTEM_COLORS.length];
  return { icon, color };
}
