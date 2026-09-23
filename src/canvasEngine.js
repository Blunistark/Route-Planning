// Canvas & Viewport Engine for Pan, Zoom, Coordinate Transform, and Layer Rendering

export class CanvasEngine {
  constructor(containerEl, stageContentEl, svgEl, pinsLayerEl, bgImageEl) {
    this.container = containerEl;
    this.stage = stageContentEl;
    this.svg = svgEl;
    this.pinsLayer = pinsLayerEl;
    this.bgImage = bgImageEl;

    // Viewport transform state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;

    // Map bounds
    this.mapWidth = 738;
    this.mapHeight = 1454;

    // Dragging state
    this.isPanning = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialPanX = 0;
    this.initialPanY = 0;

    // Camera animation frame
    this.cameraAnimId = null;

    // Interaction mode: 'pan', 'place', 'path', 'zone'
    this.mode = 'pan';

    // Callbacks
    this.onCanvasClick = null;
    this.onZoomChange = null;

    this.initEvents();
  }

  setDimensions(width, height) {
    if (!width || !height || width <= 0 || height <= 0) return;
    this.mapWidth = width;
    this.mapHeight = height;
    this.stage.style.width = `${width}px`;
    this.stage.style.height = `${height}px`;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.style.width = `${width}px`;
    this.svg.style.height = `${height}px`;
  }

  initEvents() {
    this.pointerDownPos = null;
    this.hasMovedSignificantly = false;

    // Wheel zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAt(cursorX, cursorY, zoomFactor);
    }, { passive: false });

    // Pointer down for pan or drawing
    this.container.addEventListener('pointerdown', (e) => {
      // Ignore if clicking on interactive controls (hud buttons, pins, etc.)
      if (e.target.closest('.hud-controls') || e.target.closest('.instruction-pill')) return;

      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.hasMovedSignificantly = false;

      if (this.mode === 'pan' || e.button === 1 || e.button === 2 || e.shiftKey || e.spaceKey) {
        this.isPanning = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialPanX = this.panX;
        this.initialPanY = this.panY;
        this.container.classList.add('grabbing');
        try { this.container.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    // Pointer move
    this.container.addEventListener('pointermove', (e) => {
      if (this.pointerDownPos) {
        if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 6) {
          this.hasMovedSignificantly = true;
        }
      }

      if (this.isPanning) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.panX = this.initialPanX + dx;
        this.panY = this.initialPanY + dy;
        this.applyTransform();
      }
    });

    // Pointer up
    this.container.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.classList.remove('grabbing');
        try { this.container.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    // Canvas Click (for placing stops, drawing paths/zones)
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.hud-controls') || e.target.closest('.instruction-pill')) return;

      // If user moved/dragged significantly, don't trigger click action
      if (this.hasMovedSignificantly) {
        this.hasMovedSignificantly = false;
        return;
      }

      if (this.pointerDownPos) {
        const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
        this.pointerDownPos = null;
        if (dist > 6) return;
      }

      const coords = this.screenToMap(e.clientX, e.clientY);
      // Check if within bounds with small margin, clamp to map boundaries
      const margin = 30;
      if (coords.x >= -margin && coords.x <= this.mapWidth + margin &&
          coords.y >= -margin && coords.y <= this.mapHeight + margin) {
        const clampedCoords = {
          x: Math.max(0, Math.min(this.mapWidth, coords.x)),
          y: Math.max(0, Math.min(this.mapHeight, coords.y))
        };
        if (this.onCanvasClick) {
          this.onCanvasClick(clampedCoords, e);
        }
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.updateZoomDisplay();
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.container.classList.remove('crosshair', 'grabbing');
    if (mode === 'place' || mode === 'label' || mode === 'path' || mode === 'zone') {
      this.container.classList.add('crosshair');
    }
  }

  applyTransform() {
    this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    this.updateZoomDisplay();
  }

  updateZoomDisplay() {
    if (this.onZoomChange) {
      this.onZoomChange(this.scale);
    }
  }

  zoomAt(screenX, screenY, factor) {
    const oldScale = this.scale;
    const newScale = Math.min(Math.max(oldScale * factor, 0.2), 5.0);
    if (newScale === oldScale) return;

    // Zoom towards cursor location
    this.panX = screenX - (screenX - this.panX) * (newScale / oldScale);
    this.panY = screenY - (screenY - this.panY) * (newScale / oldScale);
    this.scale = newScale;

    this.applyTransform();
  }

  zoomIn() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1.25);
  }

  zoomOut() {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 0.8);
  }

  resetZoom() {
    this.scale = 1.0;
    const rect = this.container.getBoundingClientRect();
    this.panX = (rect.width - this.mapWidth) / 2;
    this.panY = (rect.height - this.mapHeight) / 2;
    this.applyTransform();
  }

  fitToScreen(padding = 40) {
    const rect = this.container.getBoundingClientRect();
    const availableW = rect.width - padding * 2;
    const availableH = rect.height - padding * 2;

    const scaleW = availableW / this.mapWidth;
    const scaleH = availableH / this.mapHeight;
    const newScale = Math.min(scaleW, scaleH, 1.2);

    this.scale = newScale;
    this.panX = (rect.width - this.mapWidth * newScale) / 2;
    this.panY = (rect.height - this.mapHeight * newScale) / 2;

    this.applyTransform();
  }

  // Smooth cinematic camera movement to focus on a point or bounding box
  panTo(targetX, targetY, targetZoom = null, durationMs = 700) {
    if (this.cameraAnimId) {
      cancelAnimationFrame(this.cameraAnimId);
    }

    const rect = this.container.getBoundingClientRect();
    const startScale = this.scale;
    const endScale = targetZoom !== null ? targetZoom : this.scale;

    const startPanX = this.panX;
    const startPanY = this.panY;

    const endPanX = (rect.width / 2) - (targetX * endScale);
    const endPanY = (rect.height / 2) - (targetY * endScale);

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);

      // Smooth easeInOutCubic
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.scale = startScale + (endScale - startScale) * ease;
      this.panX = startPanX + (endPanX - startPanX) * ease;
      this.panY = startPanY + (endPanY - startPanY) * ease;
      this.applyTransform();

      if (progress < 1.0) {
        this.cameraAnimId = requestAnimationFrame(animate);
      } else {
        this.cameraAnimId = null;
      }
    };

    this.cameraAnimId = requestAnimationFrame(animate);
  }

  // Focus on a bounding box containing points
  fitBounds(points, padding = 60, durationMs = 700) {
    if (!points || points.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const boxW = Math.max(maxX - minX, 100);
    const boxH = Math.max(maxY - minY, 100);

    const rect = this.container.getBoundingClientRect();
    const scaleW = (rect.width - padding * 2) / boxW;
    const scaleH = (rect.height - padding * 2) / boxH;
    const targetZoom = Math.min(Math.max(Math.min(scaleW, scaleH), 0.5), 2.2);

    this.panTo(centerX, centerY, targetZoom, durationMs);
  }

  screenToMap(screenX, screenY) {
    const rect = this.container.getBoundingClientRect();
    const localX = screenX - rect.left - this.panX;
    const localY = screenY - rect.top - this.panY;
    return {
      x: Math.round(localX / this.scale),
      y: Math.round(localY / this.scale)
    };
  }

  mapToScreen(mapX, mapY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: rect.left + this.panX + mapX * this.scale,
      y: rect.top + this.panY + mapY * this.scale
    };
  }
}
