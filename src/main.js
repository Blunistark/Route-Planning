// RouteCraft Studio — Main Controller with Formal Presentation, Permanent Labels & Callout Dialog
import { sampleCampusPlan } from './sampleData.js';
import { CanvasEngine } from './canvasEngine.js';
import { DrawingTools } from './drawingTools.js';
import { AnimationEngine } from './animationEngine.js';
import { PresentationMode } from './presentationMode.js';
import { ExportService } from './exportService.js';

let appState = JSON.parse(JSON.stringify(sampleCampusPlan));

// DOM Elements
const stageViewport = document.getElementById('stageViewport');
const stageContent = document.getElementById('stageContent');
const stageSvg = document.getElementById('stageSvg');
const stagePinsLayer = document.getElementById('stagePinsLayer');
const stagePermanentLabelsLayer = document.getElementById('stagePermanentLabelsLayer');
const mapImage = document.getElementById('mapImage');

const svgRoutesLayer = document.getElementById('svgRoutesLayer');
const svgZonesLayer = document.getElementById('svgZonesLayer');
const svgActivePathLayer = document.getElementById('svgActivePathLayer');
const svgTravelerLayer = document.getElementById('svgTravelerLayer');

// Tools & HUD
const toolPan = document.getElementById('toolPan');
const toolPlace = document.getElementById('toolPlace');
const toolLabel = document.getElementById('toolLabel');
const toolPath = document.getElementById('toolPath');
const toolZone = document.getElementById('toolZone');

const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnFitView = document.getElementById('btnFitView');
const btnResetView = document.getElementById('btnResetView');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const projectTitleInput = document.getElementById('projectTitle');

// Bottom Playback
const btnPlayPause = document.getElementById('btnPlayPause');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const btnPrevStep = document.getElementById('btnPrevStep');
const btnNextStep = document.getElementById('btnNextStep');
const currentStepLabel = document.getElementById('currentStepLabel');
const currentStepCounter = document.getElementById('currentStepCounter');
const timelineStepPills = document.getElementById('timelineStepPills');
const animSpeedSelect = document.getElementById('animSpeedSelect');
const btnPresent = document.getElementById('btnPresent');
const btnPresentationFullscreen = document.getElementById('btnPresentationFullscreen');
const btnSampleTour = document.getElementById('btnSampleTour');

// Modals & Exports
const btnExportPptx = document.getElementById('btnExportPptx');
const btnRecordVideo = document.getElementById('btnRecordVideo');
const exportModal = document.getElementById('exportModal');
const btnCloseExportModal = document.getElementById('btnCloseExportModal');
const btnGeneratePptx = document.getElementById('btnGeneratePptx');
const btnStartVideoRecording = document.getElementById('btnStartVideoRecording');
const btnDownloadHtml = document.getElementById('btnDownloadHtml');
const recordingProgressBox = document.getElementById('recordingProgressBox');
const recordingStatusTitle = document.getElementById('recordingStatusTitle');
const recordingStatusSubtitle = document.getElementById('recordingStatusSubtitle');
const recordingBtnLabel = document.getElementById('recordingBtnLabel');

const btnExportJson = document.getElementById('btnExportJson');
const btnImportJson = document.getElementById('btnImportJson');
const jsonFileInput = document.getElementById('jsonFileInput');

// Settings Checkboxes
const chkShowDialogOnFocus = document.getElementById('chkShowDialogOnFocus');
const chkPermanentLabelsVisible = document.getElementById('chkPermanentLabelsVisible');

// Initialize Engines
const canvasEngine = new CanvasEngine(
  stageViewport,
  stageContent,
  stageSvg,
  stagePinsLayer,
  mapImage
);

let drawingTools = null;
let animationEngine = null;
let presentationMode = null;
let exportService = null;

canvasEngine.onZoomChange = (scale) => {
  zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
};

function initApp() {
  canvasEngine.setDimensions(appState.imageWidth || 738, appState.imageHeight || 1454);

  animationEngine = new AnimationEngine(
    canvasEngine,
    appState,
    {
      travelerLayer: svgTravelerLayer,
      routesLayer: svgRoutesLayer,
      pinsLayer: stagePinsLayer,
      zonesLayer: svgZonesLayer
    },
    (stepIdx, stepData, totalSteps) => {
      onStepChanged(stepIdx, stepData, totalSteps);
    }
  );

  drawingTools = new DrawingTools(canvasEngine, appState, () => {
    renderAllLayers();
    updateSidebarLists();
    animationEngine.compileSteps();
    renderTimelinePills();
  });

  canvasEngine.onCanvasClick = (coords, event) => {
    drawingTools.handleCanvasClick(coords, event);
  };

  presentationMode = new PresentationMode(canvasEngine, animationEngine, appState);
  exportService = new ExportService(appState, canvasEngine, animationEngine);

  bindUIEvents();

  mapImage.onload = () => {
    canvasEngine.setDimensions(mapImage.naturalWidth, mapImage.naturalHeight);
    canvasEngine.fitToScreen(40);
  };
  if (mapImage.complete) {
    canvasEngine.setDimensions(mapImage.naturalWidth || 738, mapImage.naturalHeight || 1454);
    setTimeout(() => canvasEngine.fitToScreen(40), 100);
  }

  renderAllLayers();
  updateSidebarLists();
  renderTimelinePills();
  animationEngine.goToStep(0, false);
}

function bindUIEvents() {
  // Tool switching
  const setTool = (mode, activeBtn) => {
    canvasEngine.setMode(mode);
    [toolPan, toolPlace, toolLabel, toolPath, toolZone].forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');

    if (mode === 'path') drawingTools.startPathDrawing();
    else if (mode === 'zone') drawingTools.startZoneDrawing();
    else drawingTools.cancelDrawing();
  };

  toolPan.addEventListener('click', () => setTool('pan', toolPan));
  toolPlace.addEventListener('click', () => setTool('place', toolPlace));
  toolLabel.addEventListener('click', () => setTool('label', toolLabel));
  toolPath.addEventListener('click', () => setTool('path', toolPath));
  toolZone.addEventListener('click', () => setTool('zone', toolZone));

  // Zoom HUD
  btnZoomIn.addEventListener('click', () => canvasEngine.zoomIn());
  btnZoomOut.addEventListener('click', () => canvasEngine.zoomOut());
  btnFitView.addEventListener('click', () => canvasEngine.fitToScreen(40));
  btnResetView.addEventListener('click', () => canvasEngine.resetZoom());

  projectTitleInput.addEventListener('input', (e) => {
    appState.title = e.target.value;
  });

  // Sidebar Tabs
  const tabBtns = document.querySelectorAll('.sidebar-tabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      if (targetId === 'stops') document.getElementById('tabStops').classList.add('active');
      if (targetId === 'labels') document.getElementById('tabLabels').classList.add('active');
      if (targetId === 'routes') document.getElementById('tabRoutes').classList.add('active');
      if (targetId === 'zones') document.getElementById('tabZones').classList.add('active');
      if (targetId === 'settings') document.getElementById('tabSettings').classList.add('active');
    });
  });

  // Quick Action Buttons
  document.getElementById('btnAddStopQuick').addEventListener('click', () => setTool('place', toolPlace));
  document.getElementById('btnAddLabelQuick').addEventListener('click', () => setTool('label', toolLabel));
  document.getElementById('btnDrawRouteQuick').addEventListener('click', () => setTool('path', toolPath));
  document.getElementById('btnDrawZoneQuick').addEventListener('click', () => setTool('zone', toolZone));

  // Settings Checkboxes
  chkShowDialogOnFocus.addEventListener('change', (e) => {
    appState.showDialogOnFocus = e.target.checked;
    if (!e.target.checked) animationEngine.hideCalloutDialog();
  });

  chkPermanentLabelsVisible.addEventListener('change', (e) => {
    appState.showPermanentLabels = e.target.checked;
    stagePermanentLabelsLayer.style.display = e.target.checked ? 'block' : 'none';
  });

  // Playback Controls
  btnPlayPause.addEventListener('click', () => {
    const isPlaying = animationEngine.togglePlay();
    updatePlayPauseIcon(isPlaying);
  });

  btnNextStep.addEventListener('click', () => animationEngine.nextStep());
  btnPrevStep.addEventListener('click', () => animationEngine.prevStep());

  animSpeedSelect.addEventListener('change', (e) => {
    animationEngine.setSpeed(parseFloat(e.target.value));
  });

  // Presentation Mode Trigger
  btnPresent.addEventListener('click', () => presentationMode.enter());
  btnPresentationFullscreen.addEventListener('click', () => presentationMode.enter());

  // Reset to Sample Plan
  btnSampleTour.addEventListener('click', () => {
    appState = JSON.parse(JSON.stringify(sampleCampusPlan));
    projectTitleInput.value = appState.title;
    renderAllLayers();
    updateSidebarLists();
    animationEngine.compileSteps();
    renderTimelinePills();
    animationEngine.goToStep(0, false);
    canvasEngine.fitToScreen(40);
  });

  // Export Modal Triggers
  btnExportPptx.addEventListener('click', () => exportModal.classList.remove('hidden'));
  btnRecordVideo.addEventListener('click', () => exportModal.classList.remove('hidden'));
  btnCloseExportModal.addEventListener('click', () => exportModal.classList.add('hidden'));

  btnGeneratePptx.addEventListener('click', async () => {
    btnGeneratePptx.disabled = true;
    btnGeneratePptx.textContent = 'Generating PowerPoint Deck...';
    try {
      await exportService.exportToPptx();
    } catch (err) {
      console.error(err);
      alert('Error generating PPTX: ' + err.message);
    } finally {
      btnGeneratePptx.disabled = false;
      btnGeneratePptx.textContent = 'Download .pptx File';
    }
  });

  btnStartVideoRecording.addEventListener('click', async () => {
    btnStartVideoRecording.disabled = true;
    recordingProgressBox.classList.remove('hidden');
    recordingBtnLabel.textContent = 'Recording video...';

    try {
      await exportService.recordVideo((cur, total, title) => {
        recordingStatusTitle.textContent = `Recording slide: ${title}`;
        recordingStatusSubtitle.textContent = `Progress ${cur} of ${total} (${Math.round((cur / total) * 100)}%)`;
      });
    } catch (err) {
      console.error(err);
      alert('Error recording video: ' + err.message);
    } finally {
      recordingProgressBox.classList.add('hidden');
      btnStartVideoRecording.disabled = false;
      recordingBtnLabel.textContent = 'Record & Download Video';
    }
  });

  btnDownloadHtml.addEventListener('click', () => exportService.exportStandaloneHtml());

  // JSON Save / Load
  btnExportJson.addEventListener('click', () => exportService.exportJson());
  btnImportJson.addEventListener('click', () => jsonFileInput.click());
  jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        appState = JSON.parse(evt.target.result);
        projectTitleInput.value = appState.title || 'Campus Presentation';
        renderAllLayers();
        updateSidebarLists();
        animationEngine.compileSteps();
        renderTimelinePills();
        animationEngine.goToStep(0, false);
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // Map Source
  const mapSelect = document.getElementById('mapSourceSelect');
  const uploadContainer = document.getElementById('uploadContainer');
  const fileInput = document.getElementById('fileInput');

  mapSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom_upload') {
      uploadContainer.classList.remove('hidden');
    } else {
      uploadContainer.classList.add('hidden');
      mapImage.src = './image.png';
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      mapImage.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function updatePlayPauseIcon(isPlaying) {
  if (isPlaying) {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    btnPlayPause.classList.add('play-active');
  } else {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    btnPlayPause.classList.remove('play-active');
  }
}

function onStepChanged(stepIdx, stepData, totalSteps) {
  currentStepLabel.textContent = stepData ? `${stepData.title}` : 'Overview';
  currentStepCounter.textContent = `Slide ${stepIdx + 1} / ${totalSteps}`;

  const pills = document.querySelectorAll('.step-segment-pill');
  pills.forEach((p, idx) => {
    p.classList.remove('active', 'completed');
    if (idx === stepIdx) p.classList.add('active');
    else if (idx < stepIdx) p.classList.add('completed');
  });

  if (presentationMode.isActive) {
    presentationMode.updateStep(stepIdx, stepData, totalSteps);
  }
}

function renderTimelinePills() {
  timelineStepPills.innerHTML = '';
  const total = animationEngine.steps.length;
  for (let i = 0; i < total; i++) {
    const pill = document.createElement('div');
    pill.className = 'step-segment-pill';
    if (i === animationEngine.currentStep) pill.classList.add('active');
    pill.title = animationEngine.steps[i].title;
    pill.addEventListener('click', () => {
      animationEngine.goToStep(i, true);
    });
    timelineStepPills.appendChild(pill);
  }
}

// -------------------------------------------------------------
// Layer Rendering
// -------------------------------------------------------------
export function renderAllLayers() {
  renderPermanentLabels();
  renderStopsPins();
  renderRoutesSvg();
  renderZonesSvg();

  document.getElementById('badgeStopsCount').textContent = appState.stops.length;
  document.getElementById('badgeLabelsCount').textContent = (appState.permanentLabels || []).length;
  document.getElementById('badgeRoutesCount').textContent = appState.routes.length;
  document.getElementById('badgeZonesCount').textContent = appState.zones.length;
}

// Render Permanent Labels
function renderPermanentLabels() {
  stagePermanentLabelsLayer.innerHTML = '';
  if (!appState.permanentLabels) appState.permanentLabels = [];

  appState.permanentLabels.forEach(lbl => {
    const el = document.createElement('div');
    el.className = `permanent-map-label ${lbl.style || 'default'}`;
    el.setAttribute('data-label-id', lbl.id);
    el.style.left = `${lbl.x}px`;
    el.style.top = `${lbl.y}px`;
    el.textContent = lbl.text;

    // Pointer down for dragging label
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      drawingTools.draggingLabel = lbl.id;
    });

    // Double click to rename label
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const updated = prompt('Edit permanent label text:', lbl.text);
      if (updated && updated.trim()) {
        lbl.text = updated.trim();
        renderPermanentLabels();
        updateSidebarLists();
      }
    });

    stagePermanentLabelsLayer.appendChild(el);
  });
}

// Render Formal Pins
function renderStopsPins() {
  stagePinsLayer.innerHTML = '';

  appState.stops.forEach((stop, idx) => {
    const pin = document.createElement('div');
    pin.className = 'map-pin';
    pin.setAttribute('data-stop-id', stop.id);
    pin.style.left = `${stop.x}px`;
    pin.style.top = `${stop.y}px`;
    pin.style.setProperty('--pin-color', stop.color || '#DC2626');

    pin.innerHTML = `
      <div class="pin-disc-wrapper">
        <div class="pin-pulse-halo"></div>
        <div class="pin-number-badge">${stop.badge || idx + 1}</div>
        <div class="pin-needle"></div>
        <div class="pin-shadow"></div>
      </div>
      <div class="pin-tooltip-label">${stop.title}</div>
    `;

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      appState.selectedStopId = stop.id;
      canvasEngine.panTo(stop.x, stop.y, 1.35, 450);
      if (appState.showDialogOnFocus !== false) {
        animationEngine.showCalloutDialog(stop);
      }
      updateSidebarLists();
    });

    stagePinsLayer.appendChild(pin);
  });
}

function renderRoutesSvg() {
  let svgHtml = '';

  appState.routes.forEach(route => {
    if (!route.points || route.points.length < 2) return;
    const pathD = drawingTools.buildSmoothSvgPath(route.points);
    const color = route.color || '#DC2626';
    const width = route.strokeWidth || 4;

    svgHtml += `
      <path d="${pathD}"
        class="route-path"
        data-route-id="${route.id}"
        fill="none"
        stroke="${color}"
        stroke-width="${width}"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    `;
  });

  svgRoutesLayer.innerHTML = svgHtml;
}

function renderZonesSvg() {
  let svgHtml = '';

  appState.zones.forEach(zone => {
    if (!zone.points || zone.points.length < 3) return;
    const pts = zone.points.map(p => `${p.x},${p.y}`).join(' ');
    const color = zone.color || '#16A34A';
    const opacity = zone.fillOpacity || 0.16;

    svgHtml += `
      <polygon points="${pts}"
        class="zone-polygon"
        data-zone-id="${zone.id}"
        fill="${color}"
        fill-opacity="${opacity}"
        stroke="${color}"
        stroke-width="${zone.strokeWidth || 2}"
        stroke-dasharray="6,4"
      />
    `;
  });

  svgZonesLayer.innerHTML = svgHtml;
}

// -------------------------------------------------------------
// Sidebar Lists
// -------------------------------------------------------------
function updateSidebarLists() {
  // 1. Stops list
  const stopsList = document.getElementById('stopsList');
  stopsList.innerHTML = '';
  appState.stops.forEach((stop, idx) => {
    const card = document.createElement('div');
    const isSelected = appState.selectedStopId === stop.id;
    card.className = `item-card ${isSelected ? 'selected' : ''}`;

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <div class="item-num-disc" style="background:${stop.color || '#DC2626'}">${stop.badge || idx + 1}</div>
          <span class="item-card-title">${stop.title}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete stop">✕</button>
        </div>
      </div>
      <p class="item-card-desc">${stop.desc || 'No description'}</p>
      <div class="item-card-footer">
        <span>📍 X: ${stop.x}, Y: ${stop.y}</span>
        <span>${stop.metric || 'Milestone'}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete')) return;
      appState.selectedStopId = stop.id;
      canvasEngine.panTo(stop.x, stop.y, 1.35, 450);
      if (appState.showDialogOnFocus !== false) {
        animationEngine.showCalloutDialog(stop);
      }
      updateSidebarLists();
    });

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      appState.stops = appState.stops.filter(s => s.id !== stop.id);
      renderAllLayers();
      updateSidebarLists();
      animationEngine.compileSteps();
      renderTimelinePills();
    });

    if (isSelected) {
      const editBox = document.createElement('div');
      editBox.className = 'item-edit-box';
      editBox.innerHTML = `
        <label>Milestone Title</label>
        <input type="text" class="form-input" id="editStopTitle" value="${stop.title}">
        <label>Badge Number</label>
        <input type="number" class="form-input" id="editStopBadge" value="${stop.badge || idx + 1}">
        <label>Facility Category / Tag</label>
        <input type="text" class="form-input" id="editStopTag" value="${stop.tag || ''}">
        <label>Description (Shows in Dialog Box & Slide)</label>
        <textarea class="form-textarea" id="editStopDesc">${stop.desc || ''}</textarea>
        <label>Speaker Notes for PPT</label>
        <textarea class="form-textarea" id="editStopNotes">${stop.notes || ''}</textarea>
      `;

      editBox.querySelector('#editStopTitle').addEventListener('input', (e) => {
        stop.title = e.target.value;
        card.querySelector('.item-card-title').textContent = stop.title;
        renderStopsPins();
      });
      editBox.querySelector('#editStopBadge').addEventListener('input', (e) => {
        stop.badge = parseInt(e.target.value) || 1;
        renderStopsPins();
      });
      editBox.querySelector('#editStopTag').addEventListener('input', (e) => {
        stop.tag = e.target.value;
      });
      editBox.querySelector('#editStopDesc').addEventListener('input', (e) => {
        stop.desc = e.target.value;
      });
      editBox.querySelector('#editStopNotes').addEventListener('input', (e) => {
        stop.notes = e.target.value;
      });

      card.appendChild(editBox);
    }

    stopsList.appendChild(card);
  });

  // 2. Permanent Labels list
  const labelsList = document.getElementById('labelsList');
  labelsList.innerHTML = '';
  if (!appState.permanentLabels) appState.permanentLabels = [];

  appState.permanentLabels.forEach(lbl => {
    const card = document.createElement('div');
    card.className = 'item-card';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <span style="font-weight:700; color:#38BDF8;">🏷️</span>
          <span class="item-card-title">${lbl.text}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete label">✕</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:6px;">
        <input type="text" class="form-input edit-label-text" value="${lbl.text}">
      </div>
      <div class="item-card-footer">
        <span>📍 X: ${lbl.x}, Y: ${lbl.y}</span>
        <select class="form-select select-label-style" style="width: auto; padding: 2px 6px;">
          <option value="default" ${lbl.style === 'default' ? 'selected' : ''}>Standard White</option>
          <option value="dark-style" ${lbl.style === 'dark-style' ? 'selected' : ''}>Dark Slate</option>
          <option value="road-style" ${lbl.style === 'road-style' ? 'selected' : ''}>Road Amber</option>
        </select>
      </div>
    `;

    card.querySelector('.edit-label-text').addEventListener('input', (e) => {
      lbl.text = e.target.value;
      card.querySelector('.item-card-title').textContent = lbl.text;
      renderPermanentLabels();
    });

    card.querySelector('.select-label-style').addEventListener('change', (e) => {
      lbl.style = e.target.value;
      renderPermanentLabels();
    });

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      appState.permanentLabels = appState.permanentLabels.filter(l => l.id !== lbl.id);
      renderPermanentLabels();
      updateSidebarLists();
    });

    labelsList.appendChild(card);
  });

  // 3. Routes list
  const routesList = document.getElementById('routesList');
  routesList.innerHTML = '';
  appState.routes.forEach(route => {
    const card = document.createElement('div');
    card.className = 'item-card';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <span style="color:${route.color || '#DC2626'}">━━</span>
          <span class="item-card-title">${route.title || 'Route Corridor'}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete route">✕</button>
        </div>
      </div>
      <div class="item-card-footer">
        <span>Style: <strong>Formal</strong></span>
        <span>Duration: <strong>${route.duration || 2.8}s</strong></span>
      </div>
    `;

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      appState.routes = appState.routes.filter(r => r.id !== route.id);
      renderAllLayers();
      updateSidebarLists();
      animationEngine.compileSteps();
      renderTimelinePills();
    });

    routesList.appendChild(card);
  });

  // 4. Zones list
  const zonesList = document.getElementById('zonesList');
  zonesList.innerHTML = '';
  appState.zones.forEach(zone => {
    const card = document.createElement('div');
    card.className = 'item-card';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <span style="color:${zone.color || '#16A34A'}">⬡</span>
          <span class="item-card-title">${zone.title || 'Boundary Zone'}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete zone">✕</button>
        </div>
      </div>
      <div class="item-card-footer">
        <span>Perimeter Points: ${zone.points ? zone.points.length : 0}</span>
      </div>
    `;

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      appState.zones = appState.zones.filter(z => z.id !== zone.id);
      renderAllLayers();
      updateSidebarLists();
      animationEngine.compileSteps();
      renderTimelinePills();
    });

    zonesList.appendChild(card);
  });
}

initApp();
