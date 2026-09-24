// Saved Routes Service — Local Storage Persistence & Shareable Link Generation
import { sampleCampusPlan } from './sampleData.js';

const STORAGE_KEY = 'routecraft_saved_routes_v1';

export class SavedRoutesService {
  constructor() {
    this.savedRoutes = this.loadFromStorage();
    if (this.savedRoutes.length === 0) {
      this.seedDefaultPresets();
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved routes from storage:', e);
    }
    return [];
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.savedRoutes));
    } catch (e) {
      console.warn('Failed to save routes to storage:', e);
    }
  }

  seedDefaultPresets() {
    const defaultRoutes = sampleCampusPlan.routes || [];
    const defaultStops = sampleCampusPlan.stops || [];

    const preset1 = {
      id: 'preset-master-tour',
      name: 'Full Campus Master Plan Tour',
      desc: 'Complete 3-corridor transit loop connecting Administration, Innovation, Engineering, and West Sports Arena.',
      createdAt: new Date().toISOString(),
      isDefault: true,
      routes: JSON.parse(JSON.stringify(defaultRoutes)),
      stops: JSON.parse(JSON.stringify(defaultStops))
    };

    const preset2 = {
      id: 'preset-admin-innov',
      name: 'South Admin to Innovation Link',
      desc: 'Direct pedestrian corridor between Main Administration (1) and Innovation Pavilion (18).',
      createdAt: new Date().toISOString(),
      isDefault: true,
      routes: defaultRoutes.slice(0, 1).map(r => JSON.parse(JSON.stringify(r))),
      stops: defaultStops.slice(0, 2).map(s => JSON.parse(JSON.stringify(s)))
    };

    const preset3 = {
      id: 'preset-cross-campus',
      name: 'Cross-Campus West Sports Spine',
      desc: 'High-capacity western connection from Academic Wing (5) to regulation Sports Arena (7).',
      createdAt: new Date().toISOString(),
      isDefault: true,
      routes: defaultRoutes.slice(2, 3).map(r => JSON.parse(JSON.stringify(r))),
      stops: defaultStops.slice(2, 4).map(s => JSON.parse(JSON.stringify(s)))
    };

    this.savedRoutes = [preset1, preset2, preset3];
    this.saveToStorage();
  }

  getAll() {
    return this.savedRoutes;
  }

  getById(id) {
    return this.savedRoutes.find(r => r.id === id);
  }

  saveRouteSet(name, desc, routes, stops = []) {
    if (!routes || routes.length === 0) {
      throw new Error('No routes available to save.');
    }

    const cleanName = (name || '').trim() || `Saved Route Plan (${new Date().toLocaleDateString()})`;
    const newPreset = {
      id: `saved-route-${Date.now()}`,
      name: cleanName,
      desc: (desc || '').trim() || `${routes.length} corridor${routes.length > 1 ? 's' : ''} mapped across campus.`,
      createdAt: new Date().toISOString(),
      isDefault: false,
      routes: JSON.parse(JSON.stringify(routes)),
      stops: JSON.parse(JSON.stringify(stops || []))
    };

    // Prepend so newest appears first
    this.savedRoutes.unshift(newPreset);
    this.saveToStorage();
    return newPreset;
  }

  renameRouteSet(id, newName) {
    const preset = this.getById(id);
    if (!preset) return false;
    preset.name = newName.trim() || preset.name;
    this.saveToStorage();
    return true;
  }

  deleteRouteSet(id) {
    const idx = this.savedRoutes.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.savedRoutes.splice(idx, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Generate a shareable URL containing the route plan encoded in hash
  generateShareableLink(routeSet) {
    const payload = {
      v: 1,
      name: routeSet.name,
      desc: routeSet.desc,
      routes: routeSet.routes,
      stops: routeSet.stops || []
    };

    const jsonStr = JSON.stringify(payload);
    // Base64 encode safely for UTF-8
    let encoded = '';
    try {
      encoded = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch (_) {
      encoded = encodeURIComponent(jsonStr);
    }

    const base = window.location.origin + window.location.pathname;
    return `${base}#routes=${encoded}`;
  }

  // Parse shareable route data from URL hash
  parseFromHash(hashString) {
    const hash = hashString || window.location.hash;
    if (!hash) return null;

    const match = hash.match(/#routes=([^&]+)/);
    if (!match || !match[1]) return null;

    const raw = match[1];
    try {
      let jsonStr = '';
      try {
        jsonStr = decodeURIComponent(Array.prototype.map.call(atob(raw), (c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (_) {
        jsonStr = decodeURIComponent(raw);
      }

      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.routes)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse route payload from URL hash:', e);
    }
    return null;
  }
}
