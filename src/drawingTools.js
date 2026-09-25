// Drawing Tools: Places, Permanent Labels, Routes (with Split & Branching & Arrowheads), and Zone Boundaries

export class DrawingTools {
  constructor(canvasEngine, appState, onUpdateCallback) {
    this.engine = canvasEngine;
    this.state = appState;
    this.onUpdate = onUpdateCallback;

    // Temporary drawing state
    this.isDrawing = false;
    this.drawingType = null; // 'path' or 'zone'
    this.activePoints = [];
    this.branchSourceTitle = null;

    // Dragging state
    this.draggingLabel = null;
    this.draggingStop = null;

    // Callbacks to notify UI when tool mode completes
    this.onFinishMode = null;
    this.onCancelMode = null;

    // UI elements
    this.instructionPill = document.getElementById('drawingInstruction');
    this.instructionText = document.getElementById('instructionText');
    this.btnFinish = document.getElementById('btnFinishDrawing');
    this.btnCancel = document.getElementById('btnCancelDrawing');

    this.activePathLayer = document.getElementById('svgActivePathLayer');

    this.initUI();
  }

  initUI() {
    this.btnFinish.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finishDrawing();
    });

    this.btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cancelDrawing();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.isDrawing) {
        if (e.key === 'Escape') this.cancelDrawing();
        else if (e.key === 'Enter') this.finishDrawing();
      }
    });

    // Double-click on canvas to finish drawing route or zone
    this.engine.container.addEventListener('dblclick', (e) => {
      if (this.isDrawing && this.activePoints.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        this.finishDrawing();
      }
    });

    // Pointer move listener for route preview or dragging items
    this.engine.container.addEventListener('pointermove', (e) => {
      // If canvas is actively panning, do not distort drawing preview or drag elements
      if (this.engine.isPanning) {
        return;
      }

      if (this.isDrawing && this.activePoints.length > 0) {
        const coords = this.engine.screenToMap(e.clientX, e.clientY);
        this.renderDrawingPreview(coords);
      } else if (this.draggingLabel) {
        const coords = this.engine.screenToMap(e.clientX, e.clientY);
        const label = this.state.permanentLabels?.find(l => l.id === this.draggingLabel);
        if (label) {
          label.x = Math.round(coords.x);
          label.y = Math.round(coords.y);
          const el = document.querySelector(`[data-label-id="${label.id}"]`);
          if (el) {
            el.style.left = `${label.x}px`;
            el.style.top = `${label.y}px`;
          }
        }
      } else if (this.draggingStop) {
        const coords = this.engine.screenToMap(e.clientX, e.clientY);
        const stop = this.state.stops?.find(s => s.id === this.draggingStop);
        if (stop) {
          stop.x = Math.round(coords.x);
          stop.y = Math.round(coords.y);
          const pin = document.querySelector(`.map-pin[data-stop-id="${stop.id}"]`);
          if (pin) {
            pin.style.left = `${stop.x}px`;
            pin.style.top = `${stop.y}px`;
          }
          // Update connected routes
          this.state.routes?.forEach(r => {
            if (r.fromStopId === stop.id && r.points?.length > 0) {
              r.points[0] = { x: stop.x, y: stop.y };
            }
            if (r.toStopId === stop.id && r.points?.length > 0) {
              r.points[r.points.length - 1] = { x: stop.x, y: stop.y };
            }
          });
          const svgRoutesLayer = document.getElementById('svgRoutesLayer');
          if (svgRoutesLayer) {
            // Re-render routes live while dragging stop
            this.onUpdate();
          }
        }
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.draggingLabel || this.draggingStop) {
        this.draggingLabel = null;
        this.draggingStop = null;
        this.onUpdate();
      }
    });
  }

  handleCanvasClick(coords, event) {
    if (this.engine.mode === 'place') {
      this.addPlace(coords);
    } else if (this.engine.mode === 'label') {
      this.addPermanentLabel(coords);
    } else if (this.engine.mode === 'path') {
      this.handlePathClick(coords);
    } else if (this.engine.mode === 'zone') {
      this.handleZoneClick(coords);
    }
  }

  // --- Add Formal Place Milestone ---
  addPlace(coords) {
    const nextBadge = this.state.stops.length + 1;
    const colors = ['#DC2626', '#2563EB', '#D97706', '#16A34A', '#7C3AED'];
    const chosenColor = colors[(nextBadge - 1) % colors.length];

    const newStop = {
      id: `stop-${Date.now()}`,
      badge: nextBadge,
      title: `Campus Stop ${nextBadge}`,
      desc: `Stop ${nextBadge} description.`,
      x: coords.x,
      y: coords.y,
      color: chosenColor,
      metric: '',
      tag: '',
      notes: `Notes for stop ${nextBadge}.`
    };

    this.state.stops.push(newStop);
    this.state.selectedStopId = newStop.id;

    // Auto-link to previous stop if available
    if (this.state.stops.length >= 2) {
      const prevStop = this.state.stops[this.state.stops.length - 2];
      const newRoute = {
        id: `route-${Date.now()}`,
        fromStopId: prevStop.id,
        toStopId: newStop.id,
        title: `Path: Stop ${prevStop.badge} to ${newStop.badge}`,
        color: chosenColor,
        strokeWidth: 4,
        style: 'formal',
        avatar: 'dot',
        duration: 2.8,
        arrowEnd: true,
        arrowStart: false,
        arrowSize: 'standard',
        points: [
          { x: prevStop.x, y: prevStop.y },
          { x: coords.x, y: coords.y }
        ]
      };
      this.state.routes.push(newRoute);
    }

    this.onUpdate();

    // Switch to stops tab and focus the title input for editing
    const tabStops = document.querySelector('.tab-btn[data-tab="stops"]');
    if (tabStops) tabStops.click();
    setTimeout(() => {
      const titleInput = document.getElementById('editStopTitle');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 60);

    // Return to pan tool
    if (this.onFinishMode) {
      this.onFinishMode();
    }
  }

  // --- Add Permanent Map Label ---
  addPermanentLabel(coords) {
    if (!this.state.permanentLabels) this.state.permanentLabels = [];

    const nextCount = this.state.permanentLabels.length + 1;
    const newLabel = {
      id: `label-${Date.now()}`,
      text: `Landmark ${nextCount}`,
      x: coords.x,
      y: coords.y,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 11,
      style: 'default' // 'default', 'dark-style', 'road-style', 'blueprint-style', 'minimal-style'
    };

    this.state.permanentLabels.push(newLabel);
    this.state.selectedLabelId = newLabel.id;
    this.onUpdate();

    // Switch to labels tab and focus input
    const tabLabels = document.querySelector('.tab-btn[data-tab="labels"]');
    if (tabLabels) tabLabels.click();
    setTimeout(() => {
      const card = document.querySelector(`[data-label-card-id="${newLabel.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const input = card.querySelector('.edit-label-text');
        if (input) {
          input.focus();
          input.select();
        }
      }
    }, 60);

    if (this.onFinishMode) {
      this.onFinishMode();
    }
  }

  // --- Route Path Drawing ---
  startPathDrawing(initialPoints = [], sourceTitle = null, sourceColor = null) {
    this.isDrawing = true;
    this.drawingType = 'path';
    this.activePoints = initialPoints ? [...initialPoints] : [];
    this.branchSourceTitle = sourceTitle;
    this.branchSourceColor = sourceColor;

    if (this.activePoints.length > 0) {
      this.showInstruction(`Branching from "${sourceTitle || 'Corridor'}". Click map to place next waypoints. Press ✓ Done when finished.`);
      this.renderDrawingPreview();
    } else {
      this.showInstruction('Click map to place route waypoints. Double-click or press ✓ Done to complete.');
    }
  }

  handlePathClick(coords) {
    if (!this.isDrawing) {
      this.startPathDrawing();
    }

    // Ignore duplicate clicks on the exact same point
    if (this.activePoints.length > 0) {
      const last = this.activePoints[this.activePoints.length - 1];
      if (Math.hypot(last.x - coords.x, last.y - coords.y) < 4) {
        return;
      }
    }

    this.activePoints.push({ x: coords.x, y: coords.y });
    this.renderDrawingPreview();

    const prefix = this.branchSourceTitle ? `Branching (${this.branchSourceTitle}):` : 'Route points:';
    this.showInstruction(`${prefix} ${this.activePoints.length} points. Click next waypoint or press ✓ Done when finished.`);
  }

  // --- Split Route At Waypoint or Midpoint ---
  splitRoute(routeId, waypointIndex = null) {
    const routeIndex = this.state.routes.findIndex(r => r.id === routeId);
    if (routeIndex === -1) return null;

    const original = this.state.routes[routeIndex];
    if (!original.points || original.points.length < 2) return null;

    let part1Points = [];
    let part2Points = [];

    if (original.points.length === 2) {
      // Create a midpoint to split into two segments
      const p0 = original.points[0];
      const p1 = original.points[1];
      const mid = {
        x: Math.round((p0.x + p1.x) / 2),
        y: Math.round((p0.y + p1.y) / 2)
      };
      part1Points = [p0, mid];
      part2Points = [mid, p1];
    } else {
      let splitIdx = waypointIndex;
      if (splitIdx === null || splitIdx === undefined) {
        splitIdx = Math.floor(original.points.length / 2);
      } else if (splitIdx <= 0) {
        // If user picked the very first point, split after the first segment
        splitIdx = 1;
      } else if (splitIdx >= original.points.length - 1) {
        // If user picked the very last point, split before the last segment
        splitIdx = original.points.length - 2;
      }
      part1Points = original.points.slice(0, splitIdx + 1);
      part2Points = original.points.slice(splitIdx);
    }

    const dur = original.duration || 3.0;
    const dur1 = Math.max(1.4, Math.round(dur * 0.5 * 10) / 10);
    const dur2 = Math.max(1.4, Math.round(dur * 0.5 * 10) / 10);

    const part1 = {
      ...original,
      id: `route-${Date.now()}-1`,
      title: `${original.title || 'Corridor'} (Leg 1)`,
      toStopId: null,
      arrowEnd: false, // continues on second leg
      arrowStart: original.arrowStart || false,
      arrowStyle: original.arrowStart ? 'start' : 'none',
      arrowSize: original.arrowSize || 'standard',
      duration: dur1,
      points: part1Points
    };

    const part2 = {
      ...original,
      id: `route-${Date.now()}-2`,
      title: `${original.title || 'Corridor'} (Leg 2)`,
      fromStopId: null,
      arrowEnd: original.arrowEnd !== false,
      arrowStart: false,
      arrowStyle: original.arrowStyle || 'end',
      arrowSize: original.arrowSize || 'standard',
      duration: dur2,
      points: part2Points
    };

    // Replace original route with the two split legs
    this.state.routes.splice(routeIndex, 1, part1, part2);
    this.onUpdate();

    // Select the routes tab
    const tabRoutes = document.querySelector('.tab-btn[data-tab="routes"]');
    if (tabRoutes) tabRoutes.click();

    return [part1, part2];
  }

  // --- Branch a New Route from an Existing Route Waypoint ---
  branchRoute(routeId, waypointIndex = null) {
    const route = this.state.routes.find(r => r.id === routeId);
    if (!route || !route.points || route.points.length === 0) return;

    let branchPoint = null;
    let ptLabel = '';
    if (waypointIndex !== null && waypointIndex !== undefined && route.points[waypointIndex]) {
      branchPoint = route.points[waypointIndex];
      ptLabel = `Point ${waypointIndex + 1}`;
    } else {
      // Default to midpoint or last point
      const midIdx = Math.floor(route.points.length / 2);
      branchPoint = route.points[midIdx] || route.points[0];
      ptLabel = 'Midpoint';
    }

    // Activate Route tool mode and start drawing from the branch point
    this.engine.setMode('path');
    const toolPathBtn = document.getElementById('toolPath');
    if (toolPathBtn) {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      toolPathBtn.classList.add('active');
    }

    const branchName = route.title ? `${route.title} (${ptLabel})` : 'Corridor Branch';
    this.startPathDrawing([{ x: branchPoint.x, y: branchPoint.y }], branchName, route.color || null);
  }

  // --- Zone Boundary Drawing ---
  startZoneDrawing() {
    this.isDrawing = true;
    this.drawingType = 'zone';
    this.activePoints = [];
    this.showInstruction('Click corners to outline boundary zone. Double-click or press ✓ Done to complete.');
  }

  handleZoneClick(coords) {
    if (!this.isDrawing) {
      this.startZoneDrawing();
    }

    // Ignore duplicate clicks on the exact same point
    if (this.activePoints.length > 0) {
      const last = this.activePoints[this.activePoints.length - 1];
      if (Math.hypot(last.x - coords.x, last.y - coords.y) < 4) {
        return;
      }
    }

    this.activePoints.push({ x: coords.x, y: coords.y });
    this.renderDrawingPreview();

    this.showInstruction(`Zone corners: ${this.activePoints.length}. Click next corner or press ✓ Done when finished.`);
  }

  renderDrawingPreview(currentCursor = null) {
    let pts = [...this.activePoints];
    if (currentCursor && this.isDrawing) {
      pts.push(currentCursor);
    }
    if (pts.length < 1) {
      this.activePathLayer.innerHTML = '';
      return;
    }

    let svgHtml = '';
    const strokeColor = this.drawingType === 'zone' ? '#16A34A' : '#DC2626';

    if (this.drawingType === 'zone') {
      const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
      svgHtml += `<polygon points="${pointsStr}" fill="${strokeColor}" fill-opacity="0.2" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="6,4" />`;
    } else {
      const pathD = this.buildSmoothSvgPath(pts);
      svgHtml += `<path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3.5" stroke-dasharray="6,4" />`;

      // Directional arrow head at current end
      if (pts.length >= 2) {
        const pEnd = pts[pts.length - 1];
        const pPrev = pts[pts.length - 2];
        const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
        const arrowLength = 12;
        const arrowWidth = 7;
        const leftX = pEnd.x - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle);
        const leftY = pEnd.y - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle);
        const rightX = pEnd.x - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle);
        const rightY = pEnd.y - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle);
        svgHtml += `<polygon points="${pEnd.x},${pEnd.y} ${leftX},${leftY} ${rightX},${rightY}" fill="${strokeColor}" />`;
      }
    }

    pts.forEach((p) => {
      svgHtml += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.8" />`;
    });

    this.activePathLayer.innerHTML = svgHtml;
  }

  finishDrawing() {
    if (!this.isDrawing || this.activePoints.length < 2) {
      this.cancelDrawing();
      return;
    }

    if (this.drawingType === 'path') {
      // Find closest stops to start and end of path if near
      let fromStopId = null;
      let toStopId = null;
      if (this.state.stops && this.state.stops.length > 0) {
        const startP = this.activePoints[0];
        const endP = this.activePoints[this.activePoints.length - 1];
        const nearStart = this.state.stops.find(s => Math.hypot(s.x - startP.x, s.y - startP.y) < 90);
        const nearEnd = this.state.stops.find(s => s.id !== nearStart?.id && Math.hypot(s.x - endP.x, s.y - endP.y) < 90);
        if (nearStart) fromStopId = nearStart.id;
        if (nearEnd) toStopId = nearEnd.id;
      }

      const routeNum = this.state.routes.length + 1;
      const title = this.branchSourceTitle
        ? `Branch of ${this.branchSourceTitle}`
        : `Route Corridor ${routeNum}`;

      const routeColors = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0284C7', '#E11D48'];
      const chosenColor = this.branchSourceColor || routeColors[this.state.routes.length % routeColors.length];

      const newRoute = {
        id: `route-${Date.now()}`,
        fromStopId: fromStopId,
        toStopId: toStopId,
        title: title,
        color: chosenColor,
        strokeWidth: 4,
        style: 'formal',
        avatar: 'dot',
        duration: 3.0,
        arrowEnd: true,
        arrowStart: false,
        arrowSize: 'standard',
        points: [...this.activePoints]
      };
      this.state.routes.push(newRoute);

      const tabRoutes = document.querySelector('.tab-btn[data-tab="routes"]');
      if (tabRoutes) tabRoutes.click();
    } else if (this.drawingType === 'zone') {
      const zoneNum = this.state.zones.length + 1;
      const newZone = {
        id: `zone-${Date.now()}`,
        title: `Zone Boundary ${zoneNum}`,
        color: '#16A34A',
        fillOpacity: 0.18,
        strokeWidth: 2,
        points: [...this.activePoints]
      };
      this.state.zones.push(newZone);

      const tabZones = document.querySelector('.tab-btn[data-tab="zones"]');
      if (tabZones) tabZones.click();
    }

    this.isDrawing = false;
    this.drawingType = null;
    this.activePoints = [];
    this.branchSourceTitle = null;
    this.activePathLayer.innerHTML = '';
    this.hideInstruction();

    this.onUpdate();

    if (this.onFinishMode) {
      this.onFinishMode();
    }
  }

  cancelDrawing() {
    this.isDrawing = false;
    this.drawingType = null;
    this.activePoints = [];
    this.branchSourceTitle = null;
    this.activePathLayer.innerHTML = '';
    this.hideInstruction();

    if (this.onCancelMode) {
      this.onCancelMode();
    }
  }

  showInstruction(text) {
    this.instructionText.textContent = text;
    this.instructionPill.classList.remove('hidden');
  }

  hideInstruction() {
    this.instructionPill.classList.add('hidden');
  }

  buildSmoothSvgPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }
}
