// Drawing Tools: Places, Permanent Labels, Routes, and Zone Boundaries

export class DrawingTools {
  constructor(canvasEngine, appState, onUpdateCallback) {
    this.engine = canvasEngine;
    this.state = appState;
    this.onUpdate = onUpdateCallback;

    // Temporary drawing state
    this.isDrawing = false;
    this.drawingType = null; // 'path' or 'zone'
    this.activePoints = [];

    // Dragging waypoint handle state
    this.draggingWaypoint = null;
    this.draggingLabel = null;

    // UI elements
    this.instructionPill = document.getElementById('drawingInstruction');
    this.instructionText = document.getElementById('instructionText');
    this.btnFinish = document.getElementById('btnFinishDrawing');
    this.btnCancel = document.getElementById('btnCancelDrawing');

    this.activePathLayer = document.getElementById('svgActivePathLayer');

    this.initUI();
  }

  initUI() {
    this.btnFinish.addEventListener('click', () => this.finishDrawing());
    this.btnCancel.addEventListener('click', () => this.cancelDrawing());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.isDrawing) {
        if (e.key === 'Escape') this.cancelDrawing();
        else if (e.key === 'Enter') this.finishDrawing();
      }
    });

    // Pointer move listener
    this.engine.container.addEventListener('pointermove', (e) => {
      if (this.isDrawing && this.activePoints.length > 0) {
        const coords = this.engine.screenToMap(e.clientX, e.clientY);
        this.renderDrawingPreview(coords);
      } else if (this.draggingLabel) {
        const coords = this.engine.screenToMap(e.clientX, e.clientY);
        const label = this.state.permanentLabels.find(l => l.id === this.draggingLabel);
        if (label) {
          label.x = coords.x;
          label.y = coords.y;
          this.onUpdate();
        }
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.draggingLabel) {
        this.draggingLabel = null;
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
      desc: `Formal presentation stop ${nextBadge}.`,
      x: coords.x,
      y: coords.y,
      color: chosenColor,
      metric: 'Presentation Point',
      tag: 'Campus Node',
      notes: `Notes for stop ${nextBadge}.`
    };

    this.state.stops.push(newStop);
    this.state.selectedStopId = newStop.id;
    this.onUpdate();

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
        points: [
          { x: prevStop.x, y: prevStop.y },
          { x: coords.x, y: coords.y }
        ]
      };
      this.state.routes.push(newRoute);
      this.onUpdate();
    }
  }

  // --- Add Permanent Map Label ---
  addPermanentLabel(coords) {
    const labelText = prompt('Enter permanent label text (e.g. Football Ground, North Gate, Dibburu Road):', 'Reference Landmark');
    if (!labelText || !labelText.trim()) return;

    if (!this.state.permanentLabels) this.state.permanentLabels = [];

    const newLabel = {
      id: `label-${Date.now()}`,
      text: labelText.trim(),
      x: coords.x,
      y: coords.y,
      style: 'default' // 'default', 'dark-style', 'road-style'
    };

    this.state.permanentLabels.push(newLabel);
    this.state.selectedLabelId = newLabel.id;
    this.onUpdate();
  }

  // --- Route Path Drawing ---
  startPathDrawing() {
    this.isDrawing = true;
    this.drawingType = 'path';
    this.activePoints = [];
    this.showInstruction('Click on map to place route waypoints. Press Enter or ✓ when done.');
  }

  handlePathClick(coords) {
    if (!this.isDrawing) {
      this.startPathDrawing();
    }
    this.activePoints.push({ x: coords.x, y: coords.y });
    this.renderDrawingPreview();
  }

  // --- Zone Boundary Drawing ---
  startZoneDrawing() {
    this.isDrawing = true;
    this.drawingType = 'zone';
    this.activePoints = [];
    this.showInstruction('Click corners to outline boundary zone. Press Enter or ✓ when done.');
  }

  handleZoneClick(coords) {
    if (!this.isDrawing) {
      this.startZoneDrawing();
    }
    this.activePoints.push({ x: coords.x, y: coords.y });
    this.renderDrawingPreview();
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
      const newRoute = {
        id: `route-${Date.now()}`,
        fromStopId: null,
        toStopId: null,
        title: `Route Corridor ${this.state.routes.length + 1}`,
        color: '#DC2626',
        strokeWidth: 4,
        style: 'formal',
        avatar: 'dot',
        duration: 3.0,
        points: [...this.activePoints]
      };
      this.state.routes.push(newRoute);
    } else if (this.drawingType === 'zone') {
      const newZone = {
        id: `zone-${Date.now()}`,
        title: `Zone Boundary ${this.state.zones.length + 1}`,
        color: '#16A34A',
        fillOpacity: 0.18,
        strokeWidth: 2,
        points: [...this.activePoints]
      };
      this.state.zones.push(newZone);
    }

    this.cancelDrawing();
    this.onUpdate();
  }

  cancelDrawing() {
    this.isDrawing = false;
    this.drawingType = null;
    this.activePoints = [];
    this.activePathLayer.innerHTML = '';
    this.hideInstruction();
  }

  showInstruction(text) {
    this.instructionText.textContent = text;
    this.instructionPill.classList.remove('hidden');
  }

  hideInstruction() {
    this.instructionPill.classList.add('hidden');
  }

  buildSmoothSvgPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }
}
