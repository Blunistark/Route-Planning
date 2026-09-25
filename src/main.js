// RouteCraft Studio — Main Controller with Formal Presentation, Permanent Labels & Callout Dialog
import { sampleCampusPlan } from './sampleData.js';
import { CanvasEngine } from './canvasEngine.js';
import { DrawingTools } from './drawingTools.js';
import { AnimationEngine } from './animationEngine.js';
import { PresentationMode } from './presentationMode.js';
import { ExportService } from './exportService.js';
import { SavedRoutesService } from './savedRoutesService.js';

let appState = JSON.parse(JSON.stringify(sampleCampusPlan));
let savedRoutesService = null;

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

let lastZoomBucket = 0;
canvasEngine.onZoomChange = (scale) => {
  zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
  const bucket = Math.round(scale * 4); // update every ~25% zoom interval
  if (bucket !== lastZoomBucket) {
    lastZoomBucket = bucket;
    renderPermanentLabels();
  }
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

  animationEngine.onPlaybackFinished = () => {
    updatePlayPauseIcon(false);
    document.body.classList.remove('animation-playing');
  };

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

  drawingTools.onFinishMode = () => {
    setTool('pan', toolPan);
  };
  drawingTools.onCancelMode = () => {
    setTool('pan', toolPan);
  };

  mapImage.onload = () => {
    if (mapImage.naturalWidth > 0 && mapImage.naturalHeight > 0) {
      canvasEngine.setDimensions(mapImage.naturalWidth, mapImage.naturalHeight);
      canvasEngine.fitToScreen(40);
    }
  };
  if (mapImage.complete && mapImage.naturalWidth > 0) {
    canvasEngine.setDimensions(mapImage.naturalWidth || 738, mapImage.naturalHeight || 1454);
    setTimeout(() => canvasEngine.fitToScreen(40), 100);
  }

  savedRoutesService = new SavedRoutesService();
  checkUrlHashForRoutes();
  window.addEventListener('hashchange', () => checkUrlHashForRoutes());

  renderAllLayers();
  updateSidebarLists();
  renderTimelinePills();
  animationEngine.goToStep(0, false);
}

let setTool = null;

function bindUIEvents() {
  // Tool switching
  setTool = (mode, activeBtn) => {
    canvasEngine.setMode(mode);
    [toolPan, toolPlace, toolLabel, toolPath, toolZone].forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    if (mode === 'path') {
      animationEngine.showAllRoutes();
      drawingTools.startPathDrawing();
    } else if (mode === 'zone') {
      drawingTools.startZoneDrawing();
    } else if (mode === 'place') {
      drawingTools.showInstruction('Click on map to place a new Stop. Press Esc to cancel.');
    } else if (mode === 'label') {
      drawingTools.showInstruction('Click on map to place a permanent Label. Press Esc to cancel.');
    } else {
      drawingTools.cancelDrawing();
    }
  };

  toolPan.addEventListener('click', () => setTool('pan', toolPan));
  toolPlace.addEventListener('click', () => setTool('place', toolPlace));
  toolLabel.addEventListener('click', () => setTool('label', toolLabel));
  toolPath.addEventListener('click', () => setTool('path', toolPath));
  toolZone.addEventListener('click', () => setTool('zone', toolZone));

  // Global keyboard shortcuts (when not typing in form controls)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    if (isTyping || presentationMode.isActive) return;

    const key = e.key.toLowerCase();
    if (key === 'v') {
      setTool('pan', toolPan);
    } else if (key === 'p') {
      setTool('place', toolPlace);
    } else if (key === 'l') {
      setTool('label', toolLabel);
    } else if (key === 'r') {
      setTool('path', toolPath);
    } else if (key === 'z') {
      setTool('zone', toolZone);
    } else if (key === 'f') {
      canvasEngine.fitToScreen(40);
    } else if (key === '1') {
      canvasEngine.resetZoom();
    } else if (key === '+' || key === '=') {
      canvasEngine.zoomIn();
    } else if (key === '-' || key === '_') {
      canvasEngine.zoomOut();
    }
  });

  // Zoom HUD
  btnZoomIn.addEventListener('click', () => canvasEngine.zoomIn());
  btnZoomOut.addEventListener('click', () => canvasEngine.zoomOut());
  btnFitView.addEventListener('click', () => canvasEngine.fitToScreen(40));
  btnResetView.addEventListener('click', () => canvasEngine.resetZoom());

  projectTitleInput.addEventListener('input', (e) => {
    appState.title = e.target.value;
  });

  // Mobile Sidebar Drawer Toggle & Backdrop
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebarPanel = document.getElementById('sidebarPanel');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  btnToggleSidebar?.addEventListener('click', () => {
    sidebarPanel?.classList.toggle('sidebar-open');
    sidebarBackdrop?.classList.toggle('active');
  });

  sidebarBackdrop?.addEventListener('click', () => {
    sidebarPanel?.classList.remove('sidebar-open');
    sidebarBackdrop?.classList.remove('active');
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
      if (targetId === 'routes') {
        document.getElementById('tabRoutes').classList.add('active');
        if (!animationEngine.isPlaying && !presentationMode.isActive) {
          animationEngine.showAllRoutes();
        }
      }
      if (targetId === 'saved') {
        document.getElementById('tabSaved').classList.add('active');
        renderSavedRoutesList();
      }
      if (targetId === 'zones') document.getElementById('tabZones').classList.add('active');
      if (targetId === 'settings') document.getElementById('tabSettings').classList.add('active');
    });
  });

  // Quick Action Buttons
  document.getElementById('btnAddStopQuick').addEventListener('click', () => setTool('place', toolPlace));
  document.getElementById('btnAddLabelQuick').addEventListener('click', () => setTool('label', toolLabel));
  document.getElementById('btnDrawRouteQuick').addEventListener('click', () => setTool('path', toolPath));
  document.getElementById('btnDrawZoneQuick').addEventListener('click', () => setTool('zone', toolZone));
  document.getElementById('btnShowAllRoutes')?.addEventListener('click', () => {
    animationEngine.showAllRoutes();
  });

  // Saved Routes Actions
  document.getElementById('btnQuickSaveRoutes')?.addEventListener('click', () => openSaveRouteModal());
  document.getElementById('btnSaveActiveRoutesFromTab')?.addEventListener('click', () => openSaveRouteModal());
  document.getElementById('btnOpenSaveRouteModal')?.addEventListener('click', () => openSaveRouteModal());
  document.getElementById('btnGoToSavedTab')?.addEventListener('click', () => {
    const savedTabBtn = document.querySelector('.sidebar-tabs .tab-btn[data-tab="saved"]');
    if (savedTabBtn) savedTabBtn.click();
  });

  // Save Route Modal Events
  document.getElementById('btnCloseSaveRouteModal')?.addEventListener('click', () => closeSaveRouteModal());
  document.getElementById('btnCancelSaveRoute')?.addEventListener('click', () => closeSaveRouteModal());
  document.getElementById('btnConfirmSaveRoute')?.addEventListener('click', () => handleConfirmSaveRoute());
  document.getElementById('btnCopyGeneratedLink')?.addEventListener('click', () => handleCopyModalLink());
  document.getElementById('savedRoutesSearch')?.addEventListener('input', (e) => {
    renderSavedRoutesList(e.target.value);
  });

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

  function syncAppStateReferences() {
    drawingTools.state = appState;
    animationEngine.state = appState;
    presentationMode.state = appState;
    exportService.state = appState;
  }

  // Reset to Sample Plan
  btnSampleTour.addEventListener('click', () => {
    appState = JSON.parse(JSON.stringify(sampleCampusPlan));
    syncAppStateReferences();
    projectTitleInput.value = appState.title;
    renderAllLayers();
    updateSidebarLists();
    animationEngine.compileSteps();
    renderTimelinePills();
    animationEngine.goToStep(0, false);
    canvasEngine.fitToScreen(40);
  });

  // Export Modal Triggers
  const resetExportNotice = () => {
    const notice = document.getElementById('exportDownloadNotice');
    notice?.classList.add('hidden');
  };
  btnExportPptx.addEventListener('click', () => {
    resetExportNotice();
    exportModal.classList.remove('hidden');
  });
  btnRecordVideo.addEventListener('click', () => {
    resetExportNotice();
    exportModal.classList.remove('hidden');
  });
  btnCloseExportModal.addEventListener('click', () => {
    resetExportNotice();
    exportModal.classList.add('hidden');
  });

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
    // Commit any currently focused duration input before capturing frames
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    animationEngine.compileSteps();

    btnStartVideoRecording.disabled = true;
    recordingProgressBox.classList.remove('hidden');
    recordingBtnLabel.textContent = 'Recording video...';

    const pacingSelect = document.getElementById('videoPacingSelect');
    const chosenPacing = pacingSelect?.value || 'standard';
    const fpsSelect = document.getElementById('videoFpsSelect');
    const chosenFps = fpsSelect?.value || '60';
    const orientSelect = document.getElementById('videoOrientationSelect');
    const chosenOrientation = orientSelect?.value || 'landscape';
    const noteSizeSelect = document.getElementById('videoNoteSizeSelect');
    const chosenNoteScale = parseFloat(noteSizeSelect?.value || '1.3');

    try {
      await exportService.recordVideo((cur, total, title) => {
        recordingStatusTitle.textContent = `Recording slide: ${title}`;
        recordingStatusSubtitle.textContent = `Progress ${cur} of ${total} (${Math.round((cur / total) * 100)}%) • Rendering ${chosenOrientation} ${chosenFps} FPS frames`;
      }, { pacing: chosenPacing, fps: chosenFps, orientation: chosenOrientation, noteScale: chosenNoteScale });
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
        syncAppStateReferences();
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
      mapImage.src = '/image.png';
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

  // Bulk Font Application to All Labels
  const btnApplyBulkFont = document.getElementById('btnApplyBulkFont');
  const bulkFontFamily = document.getElementById('bulkFontFamily');
  const bulkFontSize = document.getElementById('bulkFontSize');

  btnApplyBulkFont?.addEventListener('click', () => {
    const chosenFont = bulkFontFamily?.value || 'Plus Jakarta Sans';
    const chosenSize = parseInt(bulkFontSize?.value, 10) || 11;
    if (appState.permanentLabels) {
      appState.permanentLabels.forEach(lbl => {
        lbl.fontFamily = chosenFont;
        lbl.fontSize = chosenSize;
      });
      renderPermanentLabels();
      updateSidebarLists();
    }
  });

  // Batch Multi-Line Labels Modal
  const btnBatchLabelsModal = document.getElementById('btnBatchLabelsModal');
  const batchLabelsModal = document.getElementById('batchLabelsModal');
  const btnCloseBatchLabelsModal = document.getElementById('btnCloseBatchLabelsModal');
  const btnCancelBatchLabels = document.getElementById('btnCancelBatchLabels');
  const btnConfirmBatchLabels = document.getElementById('btnConfirmBatchLabels');
  const batchLabelsInput = document.getElementById('batchLabelsInput');
  const batchFontFamily = document.getElementById('batchFontFamily');
  const batchFontSize = document.getElementById('batchFontSize');
  const batchStylePreset = document.getElementById('batchStylePreset');

  btnBatchLabelsModal?.addEventListener('click', () => {
    batchLabelsModal?.classList.remove('hidden');
    if (batchLabelsInput) {
      batchLabelsInput.value = '';
      setTimeout(() => batchLabelsInput.focus(), 60);
    }
  });

  const closeBatchModal = () => batchLabelsModal?.classList.add('hidden');
  btnCloseBatchLabelsModal?.addEventListener('click', closeBatchModal);
  btnCancelBatchLabels?.addEventListener('click', closeBatchModal);

  btnConfirmBatchLabels?.addEventListener('click', () => {
    const text = batchLabelsInput?.value?.trim();
    if (!text) {
      closeBatchModal();
      return;
    }

    if (!appState.permanentLabels) appState.permanentLabels = [];

    // Blocks separated by double newline, or lines if no double newline
    let blocks = text.includes('\n\n')
      ? text.split(/\n\s*\n/)
      : text.split('\n');

    blocks = blocks.map(b => b.trim()).filter(Boolean);

    const fFamily = batchFontFamily?.value || 'Plus Jakarta Sans';
    const fSize = parseInt(batchFontSize?.value, 10) || 11;
    const fStyle = batchStylePreset?.value || 'default';

    // Center coordinates or evenly spread on the map
    const centerX = canvasEngine.naturalWidth > 0 ? canvasEngine.naturalWidth / 2 : 600;
    const centerY = canvasEngine.naturalHeight > 0 ? canvasEngine.naturalHeight / 2 : 450;
    const radius = 180;

    blocks.forEach((blockText, idx) => {
      const angle = (idx / Math.max(1, blocks.length)) * Math.PI * 2;
      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius);

      appState.permanentLabels.push({
        id: `label-${Date.now()}-${idx}`,
        text: blockText,
        x: x,
        y: y,
        fontFamily: fFamily,
        fontSize: fSize,
        style: fStyle
      });
    });

    closeBatchModal();
    renderPermanentLabels();
    updateSidebarLists();

    // Switch to labels tab
    const tabLabels = document.querySelector('.tab-btn[data-tab="labels"]');
    if (tabLabels) tabLabels.click();
  });

  // Waypoint Popover Actions (Node Notes, Splitting and Branching Paths, Corridor Colors)
  const btnCloseWaypointPopover = document.getElementById('btnCloseWaypointPopover');
  const btnPopoverSplitRoute = document.getElementById('btnPopoverSplitRoute');
  const btnPopoverBranchRoute = document.getElementById('btnPopoverBranchRoute');
  const btnSaveWaypointNote = document.getElementById('btnSaveWaypointNote');
  const btnClearWaypointNote = document.getElementById('btnClearWaypointNote');
  const popoverRouteColorPicker = document.getElementById('popoverRouteColorPicker');

  popoverRouteColorPicker?.addEventListener('input', (e) => {
    e.stopPropagation();
    if (activeWaypointContext && activeWaypointContext.route) {
      setRouteColor(activeWaypointContext.route, e.target.value);
    }
  });

  btnCloseWaypointPopover?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideWaypointPopover();
  });

  const btnPopoverNoteSizeDown = document.getElementById('btnPopoverNoteSizeDown');
  const btnPopoverNoteSizeUp = document.getElementById('btnPopoverNoteSizeUp');
  const waypointNoteSizeSelect = document.getElementById('waypointNoteSizeSelect');

  btnPopoverNoteSizeDown?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!waypointNoteSizeSelect) return;
    const sizes = [13, 15, 18, 22, 26, 32];
    const cur = parseInt(waypointNoteSizeSelect.value, 10) || 15;
    const idx = sizes.indexOf(cur);
    if (idx > 0) {
      waypointNoteSizeSelect.value = String(sizes[idx - 1]);
    }
  });

  btnPopoverNoteSizeUp?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!waypointNoteSizeSelect) return;
    const sizes = [13, 15, 18, 22, 26, 32];
    const cur = parseInt(waypointNoteSizeSelect.value, 10) || 15;
    const idx = sizes.indexOf(cur);
    if (idx < sizes.length - 1) {
      waypointNoteSizeSelect.value = String(sizes[idx + 1]);
    }
  });

  btnSaveWaypointNote?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeWaypointContext) return;
    const { route, waypointIdx } = activeWaypointContext;
    const noteInput = document.getElementById('waypointNodeNoteInput');
    const chkShow = document.getElementById('chkWaypointShowOnStart');
    const noteSizeSelect = document.getElementById('waypointNoteSizeSelect');
    const text = (noteInput ? noteInput.value : '').trim();
    const showOnStart = chkShow ? chkShow.checked : true;
    const noteSize = noteSizeSelect ? parseInt(noteSizeSelect.value, 10) : 15;

    if (route && route.points && route.points[waypointIdx]) {
      if (text) {
        route.points[waypointIdx].note = text;
        route.points[waypointIdx].showOnStart = showOnStart;
        route.points[waypointIdx].noteSize = noteSize;
        showToast(`Saved note (${noteSize}px) on Node #${waypointIdx + 1}!`, '📝');
      } else {
        delete route.points[waypointIdx].note;
        delete route.points[waypointIdx].showOnStart;
        delete route.points[waypointIdx].noteSize;
        showToast(`Cleared note on Node #${waypointIdx + 1}`, '🗑');
      }
      syncAppStateReferences();
      renderRoutesSvg();
      hideWaypointPopover();
    }
  });

  btnClearWaypointNote?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeWaypointContext) return;
    const { route, waypointIdx } = activeWaypointContext;
    if (route && route.points && route.points[waypointIdx]) {
      delete route.points[waypointIdx].note;
      delete route.points[waypointIdx].showOnStart;
      delete route.points[waypointIdx].noteSize;
      syncAppStateReferences();
      renderRoutesSvg();
      hideWaypointPopover();
      showToast(`Cleared note on Node #${waypointIdx + 1}`, '🗑');
    }
  });

  btnPopoverSplitRoute?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeWaypointContext) {
      const { route, waypointIdx } = activeWaypointContext;
      hideWaypointPopover();
      drawingTools.splitRoute(route.id, waypointIdx);
    }
  });

  btnPopoverBranchRoute?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeWaypointContext) {
      const { route, waypointIdx } = activeWaypointContext;
      hideWaypointPopover();
      drawingTools.branchRoute(route.id, waypointIdx);
    }
  });

  // Click outside closes waypoint popover
  window.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#waypointContextPopover') &&
        !e.target.closest('.waypoint-handle') &&
        !e.target.closest('.waypoint-touch-target')) {
      hideWaypointPopover();
    }
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

  const savedCount = savedRoutesService ? savedRoutesService.getAll().length : 0;
  const badgeSaved = document.getElementById('badgeSavedCount');
  if (badgeSaved) badgeSaved.textContent = savedCount;
  const tabSavedCounter = document.getElementById('routesTabSavedCounter');
  if (tabSavedCounter) tabSavedCounter.textContent = savedCount;
}

// Ensure SVG Arrowhead Markers are defined for all route colors
function ensureSvgMarkers() {
  const stageSvg = document.getElementById('stageSvg');
  if (!stageSvg) return;

  let defs = stageSvg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    stageSvg.prepend(defs);
  }

  const colors = new Set(['#DC2626', '#2563EB', '#D97706', '#16A34A', '#7C3AED', '#0F172A', '#38BDF8', '#475569']);
  appState.routes.forEach(r => {
    if (r.color) colors.add(r.color);
  });

  let markersHtml = '';
  colors.forEach(col => {
    const clean = col.replace(/[^a-zA-Z0-9]/g, '');
    // Standard End Arrow
    markersHtml += `
      <marker id="arrow-end-${clean}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="${col}" />
      </marker>
      <marker id="arrow-start-${clean}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
        <path d="M 9 1.5 L 0 5 L 9 8.5 z" fill="${col}" />
      </marker>
      <marker id="arrow-end-lg-${clean}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9.5" markerHeight="9.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="${col}" />
      </marker>
      <marker id="arrow-start-lg-${clean}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="9.5" markerHeight="9.5" orient="auto">
        <path d="M 9 1.5 L 0 5 L 9 8.5 z" fill="${col}" />
      </marker>
    `;
  });

  defs.innerHTML = markersHtml;
}

// Render Permanent Labels (supports custom font family, size, preset style, multi-line text, and de-cluttering)
function renderPermanentLabels() {
  stagePermanentLabelsLayer.innerHTML = '';
  if (!appState.permanentLabels) appState.permanentLabels = [];

  const labels = appState.permanentLabels;
  if (labels.length === 0) return;

  const currentScale = (canvasEngine && canvasEngine.scale > 0) ? canvasEngine.scale : 1.0;
  // Effective required distance in map space increases when zoomed out so labels do not overlap on screen
  const zoomFactor = Math.max(0.35, Math.min(1.2, currentScale));

  // Measure label bounds in map coordinate space
  const labelBoxes = labels.map(lbl => {
    const lines = String(lbl.text || '').split('\n');
    const fontSize = lbl.fontSize || 11;
    const lineH = Math.round(fontSize * 1.35);
    const boxH = Math.round((lines.length * lineH + 10) / zoomFactor);
    let maxLineLen = 0;
    lines.forEach(l => { if (l.length > maxLineLen) maxLineLen = l.length; });
    const boxW = Math.round(Math.min(240, Math.max(75, maxLineLen * fontSize * 0.65 + 16)) / zoomFactor);

    return {
      lbl,
      x: lbl.x,
      y: lbl.y,
      shiftX: 0,
      shiftY: 0,
      w: boxW,
      h: boxH
    };
  });

  // Iterative collision separation pass (staggers clustered labels)
  for (let iter = 0; iter < 10; iter++) {
    let hasOverlap = false;
    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) {
        const a = labelBoxes[i];
        const b = labelBoxes[j];
        const ax = a.x + a.shiftX;
        const ay = a.y + a.shiftY;
        const bx = b.x + b.shiftX;
        const by = b.y + b.shiftY;
        const pad = 10 / zoomFactor;
        const reqX = (a.w + b.w) / 2 + pad;
        const reqY = (a.h + b.h) / 2 + pad;
        const dx = Math.abs(ax - bx);
        const dy = Math.abs(ay - by);

        if (dx < reqX && dy < reqY) {
          hasOverlap = true;
          if (dy <= dx * 1.2) {
            const shift = Math.ceil((reqY - dy) / 2) + 2;
            if (ay <= by) {
              a.shiftY -= shift;
              b.shiftY += shift;
            } else {
              a.shiftY += shift;
              b.shiftY -= shift;
            }
          } else {
            const shift = Math.ceil((reqX - dx) / 2) + 2;
            if (ax <= bx) {
              a.shiftX -= shift;
              b.shiftX += shift;
            } else {
              a.shiftX += shift;
              b.shiftX += shift;
            }
          }
        }
      }
    }
    if (!hasOverlap) break;
  }

  labelBoxes.forEach(box => {
    const lbl = box.lbl;
    const el = document.createElement('div');
    el.className = `permanent-map-label ${lbl.style || 'default'}`;
    el.setAttribute('data-label-id', lbl.id);
    el.style.left = `${Math.round(box.x + box.shiftX)}px`;
    el.style.top = `${Math.round(box.y + box.shiftY)}px`;

    // Apply custom typography
    if (lbl.fontFamily) {
      el.style.fontFamily = `'${lbl.fontFamily}', system-ui, sans-serif`;
    }
    if (lbl.fontSize) {
      el.style.fontSize = `${lbl.fontSize}px`;
    }
    if (lbl.fontWeight) {
      el.style.fontWeight = lbl.fontWeight;
    }

    // innerText preserves multi-line breaks with white-space: pre-line
    el.innerText = lbl.text;

    // Pointer down for dragging label
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      drawingTools.draggingLabel = lbl.id;
    });

    // Double click to edit label in sidebar
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const tabLabels = document.querySelector('.tab-btn[data-tab="labels"]');
      if (tabLabels) tabLabels.click();
      setTimeout(() => {
        const card = document.querySelector(`[data-label-card-id="${lbl.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const input = card.querySelector('.edit-label-text');
          if (input) {
            input.focus();
            input.select();
          }
        }
      }, 50);
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

    let pinPointerDown = null;

    pin.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      pinPointerDown = { x: e.clientX, y: e.clientY };
      drawingTools.draggingStop = stop.id;
    });

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pinPointerDown) {
        const moved = Math.hypot(e.clientX - pinPointerDown.x, e.clientY - pinPointerDown.y);
        pinPointerDown = null;
        if (moved > 5) return;
      }
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

// Route color presets for intuitive palette selection & live theme sync
const ROUTE_COLOR_PRESETS = [
  { name: 'Crimson Red', hex: '#DC2626' },
  { name: 'Royal Blue', hex: '#2563EB' },
  { name: 'Emerald Green', hex: '#16A34A' },
  { name: 'Amber Orange', hex: '#D97706' },
  { name: 'Violet Purple', hex: '#7C3AED' },
  { name: 'Sky Cyan', hex: '#0284C7' },
  { name: 'Rose Pink', hex: '#E11D48' },
  { name: 'Canary Yellow', hex: '#EAB308' },
  { name: 'Teal Cyan', hex: '#0D9488' },
  { name: 'Slate Gray', hex: '#475569' }
];

function setRouteColor(route, newColor) {
  if (!route || !newColor) return;
  route.color = newColor;
  ensureSvgMarkers();
  renderRoutesSvg();

  // If playback step is currently on this route, update active traveler & step colors
  if (animationEngine && animationEngine.steps) {
    const curStep = animationEngine.steps[animationEngine.currentStep];
    if (curStep && curStep.type === 'route' && curStep.activeRouteId === route.id) {
      if (curStep.routeData) curStep.routeData.color = newColor;
      const travelerCircles = document.querySelectorAll('.traveler-token circle');
      if (travelerCircles && travelerCircles.length >= 2) {
        travelerCircles[0].setAttribute('fill', newColor);
        travelerCircles[1].setAttribute('stroke', newColor);
      }
    }
  }

  // Update route card in the Routes tab
  const card = document.querySelector(`.route-card[data-route-card-id="${route.id}"]`);
  if (card) {
    const icon = card.querySelector('.route-header-color-icon');
    if (icon) icon.style.color = newColor;
    const dot = card.querySelector('.route-header-color-dot');
    if (dot) dot.style.background = newColor;
    const hexTag = card.querySelector('.route-color-hex-tag');
    if (hexTag) hexTag.textContent = newColor.toUpperCase();
    const picker = card.querySelector('.route-native-color-picker');
    if (picker) picker.value = newColor;
    card.querySelectorAll('.route-color-swatch-btn').forEach(b => {
      const match = (b.getAttribute('data-color') || '').toLowerCase() === newColor.toLowerCase();
      b.classList.toggle('is-active', match);
      b.style.borderColor = match ? '#FFFFFF' : 'rgba(255,255,255,0.25)';
      b.style.boxShadow = match ? '0 0 0 2px #0B1120, 0 0 0 4px #FFFFFF' : 'none';
      b.style.transform = match ? 'scale(1.15)' : 'scale(1)';
    });
  }

  // Update popover if open for this route
  if (activeWaypointContext && activeWaypointContext.route && activeWaypointContext.route.id === route.id) {
    renderPopoverRouteColors(route);
  }

  syncAppStateReferences();
  renderTimelinePills();
}

function renderPopoverRouteColors(route) {
  const container = document.getElementById('popoverRouteSwatches');
  const hexLabel = document.getElementById('popoverRouteColorHex');
  const colorPicker = document.getElementById('popoverRouteColorPicker');
  if (!container || !route) return;

  const curColor = (route.color || '#DC2626').toLowerCase();
  if (hexLabel) hexLabel.textContent = (route.color || '#DC2626').toUpperCase();
  if (colorPicker) colorPicker.value = route.color || '#DC2626';

  container.innerHTML = ROUTE_COLOR_PRESETS.map(p => `
    <button type="button" class="popover-color-swatch-btn ${p.hex.toLowerCase() === curColor ? 'is-active' : ''}"
      data-color="${p.hex}" title="${p.name} (${p.hex})" style="background:${p.hex};"></button>
  `).join('');

  container.querySelectorAll('.popover-color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color');
      setRouteColor(route, col);
      showToast(`Corridor color updated to ${col}`, '🎨');
    });
  });
}

// Waypoint popover state
let activeWaypointContext = null;

function showWaypointPopover(route, waypointIdx, pt) {
  const popover = document.getElementById('waypointContextPopover');
  const title = document.getElementById('waypointPopoverTitle');
  const container = document.getElementById('canvasContainer');
  const noteInput = document.getElementById('waypointNodeNoteInput');
  const chkShow = document.getElementById('chkWaypointShowOnStart');
  const btnClear = document.getElementById('btnClearWaypointNote');
  if (!popover || !title || !container) return;

  activeWaypointContext = { route, waypointIdx, pt };
  title.textContent = `${route.title || 'Corridor'} (Node #${waypointIdx + 1})`;
  renderPopoverRouteColors(route);

  // Populate node note input and checkbox state
  if (noteInput) {
    noteInput.value = pt.note || '';
  }
  if (chkShow) {
    chkShow.checked = pt.showOnStart !== false;
  }
  const noteSizeSelect = document.getElementById('waypointNoteSizeSelect');
  if (noteSizeSelect) {
    noteSizeSelect.value = String(pt.noteSize || 15);
  }
  if (btnClear) {
    if (pt.note) {
      btnClear.classList.remove('hidden');
    } else {
      btnClear.classList.add('hidden');
    }
  }

  // Convert map image coordinates to screen coordinates relative to canvasContainer
  const screenPt = canvasEngine.mapToScreen(pt.x, pt.y);
  const contRect = container.getBoundingClientRect();

  let x = screenPt.x - contRect.left;
  let y = screenPt.y - contRect.top;

  const popoverW = 320;
  const popoverH = 295;

  // Clamp horizontally so popover stays comfortably within container
  x = Math.max(popoverW / 2 + 12, Math.min(contRect.width - popoverW / 2 - 12, x));

  // Determine vertical placement: if too close to top bar, place below node; otherwise above
  const isNearTop = (y - popoverH - 24) < 55;
  if (isNearTop) {
    popover.style.top = `${Math.round(y + 16)}px`;
    popover.classList.add('popover-arrow-top');
    popover.classList.remove('popover-arrow-bottom');
  } else {
    popover.style.top = `${Math.round(y - 14)}px`;
    popover.classList.add('popover-arrow-bottom');
    popover.classList.remove('popover-arrow-top');
  }

  popover.style.left = `${Math.round(x)}px`;
  popover.classList.remove('hidden');
}

function hideWaypointPopover() {
  const popover = document.getElementById('waypointContextPopover');
  if (popover) popover.classList.add('hidden');
  activeWaypointContext = null;
}

function renderRoutesSvg() {
  ensureSvgMarkers();
  let svgHtml = '';

  appState.routes.forEach(route => {
    if (!route.points || route.points.length < 2) return;
    const pathD = drawingTools.buildSmoothSvgPath(route.points);
    const color = route.color || '#DC2626';
    const cleanColor = color.replace(/[^a-zA-Z0-9]/g, '');
    const width = route.strokeWidth || 4;
    const isLarge = route.arrowSize === 'large';
    const szPrefix = isLarge ? 'lg-' : '';

    const hasEndArrow = route.arrowEnd !== false && route.arrowStyle !== 'none' && route.arrowStyle !== 'start';
    const hasStartArrow = route.arrowStart === true || route.arrowStyle === 'start' || route.arrowStyle === 'both';

    const endAttr = hasEndArrow ? `marker-end="url(#arrow-end-${szPrefix}${cleanColor})"` : '';
    const startAttr = hasStartArrow ? `marker-start="url(#arrow-start-${szPrefix}${cleanColor})"` : '';

    svgHtml += `
      <g class="route-group" data-route-id="${route.id}">
        <!-- Invisible wide hit-target for effortless clicking on the corridor -->
        <path d="${pathD}"
          class="route-hit-target"
          data-route-id="${route.id}"
          fill="none"
          stroke="transparent"
          stroke-width="22"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="cursor: pointer;"
        />
        <path d="${pathD}"
          class="route-path"
          data-route-id="${route.id}"
          fill="none"
          stroke="${color}"
          stroke-width="${width}"
          stroke-linecap="round"
          stroke-linejoin="round"
          ${endAttr}
          ${startAttr}
          style="cursor: pointer;"
        />
    `;

    // Render interactive waypoint handles with touch targets for splitting, branching, and node notes
    route.points.forEach((pt, pIdx) => {
      const hasNote = !!pt.note;
      const noteBadgeSvg = hasNote ? `
        <!-- Note Indicator Flag on Node -->
        <g class="waypoint-note-flag" pointer-events="none">
          <circle cx="${pt.x}" cy="${pt.y - 12}" r="7" fill="#F59E0B" stroke="#0F172A" stroke-width="1.2" />
          <text x="${pt.x}" y="${pt.y - 9}" font-size="8" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" fill="#000000" text-anchor="middle">📌</text>
        </g>
      ` : '';

      svgHtml += `
        <g class="waypoint-node-group" data-route-id="${route.id}" data-waypoint-idx="${pIdx}">
          <!-- Generous touch hit area (36px diameter) for mobile phones and precise clicks -->
          <circle cx="${pt.x}" cy="${pt.y}" r="18"
            class="waypoint-touch-target"
            data-route-id="${route.id}"
            data-waypoint-idx="${pIdx}"
            fill="transparent"
            style="cursor: pointer;"
          >
            <title>${route.title || 'Corridor'} Node #${pIdx + 1}${hasNote ? `: "${pt.note}" (triggers when animation starts)` : ' (Click to add note, split or branch)'}</title>
          </circle>
          <!-- Visual accent ring -->
          <circle cx="${pt.x}" cy="${pt.y}" r="8"
            class="waypoint-halo"
            stroke="${hasNote ? '#F59E0B' : color}"
            stroke-width="${hasNote ? '2' : '1.5'}"
            fill="none"
            opacity="${hasNote ? '0.75' : '0.4'}"
            pointer-events="none"
          />
          <!-- Core waypoint node -->
          <circle cx="${pt.x}" cy="${pt.y}" r="5"
            class="waypoint-handle"
            data-route-id="${route.id}"
            data-waypoint-idx="${pIdx}"
            fill="${hasNote ? '#FEF3C7' : '#FFFFFF'}"
            stroke="${hasNote ? '#F59E0B' : color}"
            stroke-width="2.5"
            style="cursor: pointer;"
          />
          ${noteBadgeSvg}
        </g>
      `;
    });

    svgHtml += `</g>`;
  });

  svgRoutesLayer.innerHTML = svgHtml;

  // Add touch and click handlers on waypoint targets
  svgRoutesLayer.querySelectorAll('.waypoint-touch-target, .waypoint-handle').forEach(target => {
    target.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    target.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const rId = target.getAttribute('data-route-id');
      const wpIdx = parseInt(target.getAttribute('data-waypoint-idx'), 10);
      const route = appState.routes.find(r => r.id === rId);
      if (route && route.points && route.points[wpIdx]) {
        showWaypointPopover(route, wpIdx, route.points[wpIdx]);
      }
    });
  });

  // Clicking anywhere along a route corridor selects and highlights it in sidebar
  svgRoutesLayer.querySelectorAll('.route-hit-target, .route-path').forEach(pathEl => {
    pathEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const rId = pathEl.getAttribute('data-route-id');
      const route = appState.routes.find(r => r.id === rId);
      if (route) {
        const tabRoutes = document.querySelector('.tab-btn[data-tab="routes"]');
        if (tabRoutes) tabRoutes.click();
        setTimeout(() => {
          const card = document.querySelector(`.route-card[data-route-card-id="${route.id}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            card.classList.add('item-card-highlight');
            setTimeout(() => card.classList.remove('item-card-highlight'), 1200);
          }
        }, 50);
      }
    });
  });

  // Keep route visibility strictly in sync with the current animation step
  if (animationEngine && animationEngine.steps && animationEngine.steps.length > 0) {
    if (animationEngine.allRoutesVisibleMode) {
      animationEngine.showAllRoutes();
    } else {
      const curStep = animationEngine.steps[animationEngine.currentStep] || animationEngine.steps[0];
      animationEngine.updateRoutesVisibility(curStep, false);
    }
  }
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
    card.setAttribute('data-label-card-id', lbl.id);

    const firstLine = (lbl.text || '').split('\n')[0] || 'Landmark Label';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <span style="font-weight:700; color:#38BDF8;">🏷️</span>
          <span class="item-card-title">${firstLine}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete label">✕</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:6px;">
        <label style="font-size:0.7rem; color:#94A3B8;">Text (Press Enter for multi-line)</label>
        <textarea class="form-textarea edit-label-text" rows="2" placeholder="Line 1&#10;Line 2">${lbl.text || ''}</textarea>
      </div>
      <div class="form-row" style="display:flex; gap:6px; margin-top:6px;">
        <div style="flex:1;">
          <label style="font-size:0.68rem; color:#94A3B8; display:block;">Font</label>
          <select class="form-select select-label-font form-select-xs" style="width:100%;">
            <option value="Plus Jakarta Sans" ${lbl.fontFamily === 'Plus Jakarta Sans' ? 'selected' : ''}>Sans (Jakarta)</option>
            <option value="Playfair Display" ${lbl.fontFamily === 'Playfair Display' ? 'selected' : ''}>Serif (Playfair)</option>
            <option value="Space Mono" ${lbl.fontFamily === 'Space Mono' ? 'selected' : ''}>Mono (Space)</option>
            <option value="Cinzel" ${lbl.fontFamily === 'Cinzel' ? 'selected' : ''}>Classical (Cinzel)</option>
            <option value="Oswald" ${lbl.fontFamily === 'Oswald' ? 'selected' : ''}>Bold (Oswald)</option>
          </select>
        </div>
        <div style="width:65px;">
          <label style="font-size:0.68rem; color:#94A3B8; display:block;">Size</label>
          <select class="form-select select-label-size form-select-xs" style="width:100%;">
            <option value="9" ${lbl.fontSize == 9 ? 'selected' : ''}>9px</option>
            <option value="11" ${!lbl.fontSize || lbl.fontSize == 11 ? 'selected' : ''}>11px</option>
            <option value="13" ${lbl.fontSize == 13 ? 'selected' : ''}>13px</option>
            <option value="16" ${lbl.fontSize == 16 ? 'selected' : ''}>16px</option>
            <option value="20" ${lbl.fontSize == 20 ? 'selected' : ''}>20px</option>
          </select>
        </div>
        <div style="width:90px;">
          <label style="font-size:0.68rem; color:#94A3B8; display:block;">Style</label>
          <select class="form-select select-label-style form-select-xs" style="width:100%;">
            <option value="default" ${lbl.style === 'default' ? 'selected' : ''}>White</option>
            <option value="dark-style" ${lbl.style === 'dark-style' ? 'selected' : ''}>Dark</option>
            <option value="road-style" ${lbl.style === 'road-style' ? 'selected' : ''}>Road</option>
            <option value="blueprint-style" ${lbl.style === 'blueprint-style' ? 'selected' : ''}>Blueprint</option>
            <option value="minimal-style" ${lbl.style === 'minimal-style' ? 'selected' : ''}>Outline</option>
          </select>
        </div>
      </div>
      <div class="item-card-footer" style="margin-top:6px;">
        <span>📍 X: ${lbl.x}, Y: ${lbl.y}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('select')) return;
      canvasEngine.panTo(lbl.x, lbl.y, 1.5, 450);
    });

    card.querySelector('.edit-label-text').addEventListener('input', (e) => {
      lbl.text = e.target.value;
      const fl = (lbl.text || '').split('\n')[0] || 'Landmark Label';
      card.querySelector('.item-card-title').textContent = fl;
      renderPermanentLabels();
    });

    card.querySelector('.select-label-font').addEventListener('change', (e) => {
      lbl.fontFamily = e.target.value;
      renderPermanentLabels();
    });

    card.querySelector('.select-label-size').addEventListener('change', (e) => {
      lbl.fontSize = parseInt(e.target.value, 10) || 11;
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

  // 3. Routes list with drag-and-drop reordering & sequencing
  const routesList = document.getElementById('routesList');
  routesList.innerHTML = '';
  routesList.className = 'routes-reorderable-list';

  appState.routes.forEach((route, rIdx) => {
    const card = document.createElement('div');
    card.className = 'item-card route-card';
    card.setAttribute('data-route-card-id', route.id);
    card.setAttribute('data-route-index', rIdx);
    card.setAttribute('draggable', 'true');

    const isEnd = route.arrowStyle === 'end' || (route.arrowEnd !== false && !route.arrowStyle);
    const isBoth = route.arrowStyle === 'both';
    const isStart = route.arrowStyle === 'start';
    const isNone = route.arrowStyle === 'none' || route.arrowEnd === false;

    const curRouteColor = route.color || '#DC2626';
    const colorSwatchesHtml = ROUTE_COLOR_PRESETS.map(p => {
      const isSelected = curRouteColor.toLowerCase() === p.hex.toLowerCase();
      return `
        <button type="button" class="route-color-swatch-btn ${isSelected ? 'is-active' : ''}"
          data-color="${p.hex}" title="${p.name} (${p.hex})"
          style="background:${p.hex}; border: 1.8px solid ${isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.25)'};"></button>
      `;
    }).join('');

    card.innerHTML = `
      <div class="item-card-header" style="align-items: center;">
        <div class="item-badge-title" style="display:flex; align-items:center; gap:7px; flex:1; min-width:0;">
          <span class="route-drag-handle" title="Drag to reorder sequence" draggable="false">⠿</span>
          <span class="seq-order-badge" title="Sequence Position #${rIdx + 1}">#${rIdx + 1}</span>
          <span class="route-header-color-dot" style="display:inline-block; width:11px; height:11px; border-radius:50%; background:${curRouteColor}; border:1.5px solid #FFFFFF; flex-shrink:0;"></span>
          <span class="route-header-color-icon" style="color:${curRouteColor}; font-size:0.82rem;">━━▶</span>
          <span class="item-card-title">${route.title || `Route Corridor ${rIdx + 1}`}</span>
        </div>
        <div class="item-card-actions">
          <div class="btn-reorder-group">
            <button class="btn-reorder-dir btn-move-up" title="Move earlier in presentation sequence" ${rIdx === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-reorder-dir btn-move-down" title="Move later in presentation sequence" ${rIdx === appState.routes.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
          <button class="icon-btn-subtle delete" title="Delete route">✕</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:6px;">
        <input type="text" class="form-input edit-route-title" value="${route.title || `Route Corridor ${rIdx + 1}`}">
      </div>

      <!-- Dedicated Route Color Control inside the Routes Tab -->
      <div class="route-color-control-box">
        <div class="route-color-control-header">
          <span class="route-color-control-title">🎨 Route Color</span>
          <div class="route-color-picker-group">
            <input type="color" class="route-native-color-picker" value="${curRouteColor}" title="Click to choose custom route color">
            <span class="route-color-hex-tag">${curRouteColor.toUpperCase()}</span>
          </div>
        </div>
        <div class="route-color-presets-row">
          ${colorSwatchesHtml}
        </div>
      </div>

      <div style="display:flex; gap:6px; margin-top:8px; align-items:center;">
        <span style="font-size:0.72rem; color:#94A3B8;">Arrow:</span>
        <select class="form-select select-route-arrow form-select-xs" style="flex:1;">
          <option value="end" ${isEnd ? 'selected' : ''}>→ End Arrow</option>
          <option value="both" ${isBoth ? 'selected' : ''}>↔ Both Ends</option>
          <option value="start" ${isStart ? 'selected' : ''}>← Start Arrow</option>
          <option value="none" ${isNone ? 'selected' : ''}>― No Arrow</option>
        </select>
        <select class="form-select select-route-arrow-size form-select-xs" style="width:75px;">
          <option value="standard" ${route.arrowSize !== 'large' ? 'selected' : ''}>Normal</option>
          <option value="large" ${route.arrowSize === 'large' ? 'selected' : ''}>Large</option>
        </select>
      </div>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button class="mini-btn btn-split-route" style="flex:1; background:#1E293B; border-color:#475569;" title="Split this corridor into two segments at midpoint">✂ Split Path</button>
        <button class="mini-btn btn-branch-route" style="flex:1; background:#1E293B; border-color:#475569;" title="Start a new branch fork from this corridor">⑂ Branch Path</button>
      </div>
      <div class="item-card-footer" style="margin-top:8px;">
        <span>Points: <strong>${route.points ? route.points.length : 0}</strong></span>
        <span>Duration: <input type="number" class="form-input edit-route-duration" style="width:50px; display:inline-block; padding:1px 4px; font-size:0.75rem;" step="0.5" min="1" max="10" value="${route.duration || 3}">s</span>
      </div>
    `;

  function handleRouteReordered(movedRouteId) {
    animationEngine.pause();
    updatePlayPauseIcon(false);

    animationEngine.compileSteps();
    renderTimelinePills();
    renderRoutesSvg();
    updateSidebarLists();

    // Immediately jump camera and active playback step to this reordered route so it is framed & ready to animate
    const targetIdx = animationEngine.steps.findIndex(
      s => s.type === 'route' && s.activeRouteId === movedRouteId
    );
    if (targetIdx !== -1) {
      animationEngine.goToStep(targetIdx, true);
    } else {
      animationEngine.goToStep(0, false);
    }
  }

  // Up and Down reorder button clicks
  card.querySelector('.btn-move-up')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (rIdx > 0) {
      const item = appState.routes.splice(rIdx, 1)[0];
      appState.routes.splice(rIdx - 1, 0, item);
      handleRouteReordered(item.id);
    }
  });

  card.querySelector('.btn-move-down')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (rIdx < appState.routes.length - 1) {
      const item = appState.routes.splice(rIdx, 1)[0];
      appState.routes.splice(rIdx + 1, 0, item);
      handleRouteReordered(item.id);
    }
  });

  // Drag and drop event handlers
  card.addEventListener('dragstart', (e) => {
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rIdx.toString());
    setTimeout(() => card.classList.add('route-card-dragging'), 0);
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = card.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    if (relY < rect.height / 2) {
      card.classList.add('route-drop-before');
      card.classList.remove('route-drop-after');
    } else {
      card.classList.add('route-drop-after');
      card.classList.remove('route-drop-before');
    }
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('route-drop-before', 'route-drop-after');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('route-drop-before', 'route-drop-after');
    const srcIdxStr = e.dataTransfer.getData('text/plain');
    const srcIdx = parseInt(srcIdxStr, 10);
    if (isNaN(srcIdx) || srcIdx === rIdx) return;

    const rect = card.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    let targetIdx = relY < rect.height / 2 ? rIdx : rIdx + 1;
    if (srcIdx < targetIdx) {
      targetIdx--;
    }

    const moved = appState.routes.splice(srcIdx, 1)[0];
    appState.routes.splice(targetIdx, 0, moved);
    handleRouteReordered(moved.id);
  });

  card.addEventListener('dragend', () => {
    document.querySelectorAll('.route-card').forEach(c => {
      c.classList.remove('route-card-dragging', 'route-drop-before', 'route-drop-after');
    });
  });

  card.addEventListener('click', (e) => {
    if (e.target.closest('.delete') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
    const stepIdx = animationEngine.steps.findIndex(s => s.type === 'route' && s.activeRouteId === route.id);
    if (stepIdx !== -1) {
      animationEngine.goToStep(stepIdx, true);
    } else if (route.points && route.points.length >= 2) {
      canvasEngine.fitBounds(route.points, 80, 500);
    }
  });

    card.querySelector('.edit-route-title').addEventListener('input', (e) => {
      route.title = e.target.value;
      card.querySelector('.item-card-title').textContent = route.title;
      animationEngine.compileSteps();
      renderTimelinePills();
    });

    card.querySelectorAll('.route-color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const col = btn.getAttribute('data-color');
        setRouteColor(route, col);
      });
    });

    const nativeColorPicker = card.querySelector('.route-native-color-picker');
    nativeColorPicker?.addEventListener('input', (e) => {
      e.stopPropagation();
      setRouteColor(route, e.target.value);
    });
    nativeColorPicker?.addEventListener('change', (e) => {
      e.stopPropagation();
      setRouteColor(route, e.target.value);
    });

    card.querySelector('.select-route-arrow').addEventListener('change', (e) => {
      const val = e.target.value;
      route.arrowStyle = val;
      route.arrowEnd = (val === 'end' || val === 'both');
      route.arrowStart = (val === 'start' || val === 'both');
      renderRoutesSvg();
    });

    card.querySelector('.select-route-arrow-size').addEventListener('change', (e) => {
      route.arrowSize = e.target.value;
      renderRoutesSvg();
    });

    card.querySelector('.btn-split-route').addEventListener('click', (e) => {
      e.stopPropagation();
      drawingTools.splitRoute(route.id);
    });

    card.querySelector('.btn-branch-route').addEventListener('click', (e) => {
      e.stopPropagation();
      drawingTools.branchRoute(route.id);
    });

    const durInput = card.querySelector('.edit-route-duration');
    const handleDurationChange = (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        route.duration = Math.max(0.5, Math.min(30, val));
        animationEngine.compileSteps();
        renderTimelinePills();
      }
    };
    durInput?.addEventListener('input', handleDurationChange);
    durInput?.addEventListener('change', handleDurationChange);

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
  appState.zones.forEach((zone, zIdx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-zone-card-id', zone.id);

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-badge-title">
          <span style="color:${zone.color || '#16A34A'}">⬡</span>
          <span class="item-card-title">${zone.title || `Boundary Zone ${zIdx + 1}`}</span>
        </div>
        <div class="item-card-actions">
          <button class="icon-btn-subtle delete" title="Delete zone">✕</button>
        </div>
      </div>
      <div class="form-group" style="margin-top:6px;">
        <input type="text" class="form-input edit-zone-title" value="${zone.title || `Boundary Zone ${zIdx + 1}`}">
      </div>
      <div class="item-card-footer">
        <span>Perimeter Points: ${zone.points ? zone.points.length : 0}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete') || e.target.closest('input')) return;
      if (zone.points && zone.points.length >= 3) {
        canvasEngine.fitBounds(zone.points, 80, 500);
      }
    });

    card.querySelector('.edit-zone-title').addEventListener('input', (e) => {
      zone.title = e.target.value;
      card.querySelector('.item-card-title').textContent = zone.title;
    });

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

  // 5. Saved routes list
  renderSavedRoutesList();
}

// -------------------------------------------------------------
// State Reference Synchronization
// -------------------------------------------------------------
function syncAppStateReferences() {
  if (drawingTools) drawingTools.state = appState;
  if (animationEngine) animationEngine.state = appState;
  if (presentationMode) presentationMode.state = appState;
  if (exportService) exportService.state = appState;
}

// -------------------------------------------------------------
// Global Toast Notifications
// -------------------------------------------------------------
let toastTimeout = null;
export function showToast(message, icon = '✔') {
  const toast = document.getElementById('globalToast');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;

  toast.classList.remove('hidden');
  toast.style.opacity = '1';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 4000);
}

// -------------------------------------------------------------
// URL Hash Route Loading (Shareable Direct Links)
// -------------------------------------------------------------
function checkUrlHashForRoutes() {
  if (!savedRoutesService) return;
  const parsed = savedRoutesService.parseFromHash();
  if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
    appState.routes = JSON.parse(JSON.stringify(parsed.routes));
    if (Array.isArray(parsed.stops) && parsed.stops.length > 0) {
      appState.stops = JSON.parse(JSON.stringify(parsed.stops));
    }
    if (parsed.name) {
      appState.title = parsed.name;
      const titleInput = document.getElementById('projectTitle');
      if (titleInput) titleInput.value = parsed.name;
    }

    syncAppStateReferences();
    renderAllLayers();
    updateSidebarLists();
    animationEngine.compileSteps();
    renderTimelinePills();
    animationEngine.showAllRoutes();

    showToast(`Loaded "${parsed.name || 'Saved Route Set'}" (${parsed.routes.length} corridors) from link!`, '🔗');

    // Switch to Saved tab
    setTimeout(() => {
      const savedTab = document.querySelector('.tab-btn[data-tab="saved"]');
      if (savedTab) savedTab.click();
    }, 200);
  }
}

// -------------------------------------------------------------
// Save Route Modal Actions
// -------------------------------------------------------------
function openSaveRouteModal() {
  const modal = document.getElementById('modalSaveRoute');
  const titleInput = document.getElementById('saveRouteTitle');
  const descInput = document.getElementById('saveRouteDesc');
  const summaryCount = document.getElementById('saveRouteSummaryCount');
  const summaryPoints = document.getElementById('saveRouteSummaryPoints');
  const summaryDur = document.getElementById('saveRouteSummaryDur');
  const linkInput = document.getElementById('shareableLinkInput');

  if (!modal) return;

  const routes = appState.routes || [];
  if (routes.length === 0) {
    showToast('Please create or load at least one route before saving.', '⚠️');
    return;
  }

  const totalPoints = routes.reduce((acc, r) => acc + (r.points ? r.points.length : 0), 0);
  const totalDuration = routes.reduce((acc, r) => acc + (r.duration || 3.0), 0);

  if (titleInput) {
    titleInput.value = appState.title ? `${appState.title} - Corridors` : `Campus Route Plan (${new Date().toLocaleDateString()})`;
  }
  if (descInput) {
    descInput.value = `Master plan corridor set with ${routes.length} sequential routes and ${totalPoints} waypoints.`;
  }
  if (summaryCount) summaryCount.textContent = `${routes.length} Corridor${routes.length === 1 ? '' : 's'} mapped`;
  if (summaryPoints) summaryPoints.textContent = `${totalPoints} Waypoints`;
  if (summaryDur) summaryDur.textContent = `${totalDuration.toFixed(1)}s estimated tour`;

  const refreshLink = () => {
    const dummy = {
      name: titleInput ? titleInput.value : 'Campus Routes',
      desc: descInput ? descInput.value : '',
      routes: appState.routes,
      stops: appState.stops
    };
    if (linkInput) linkInput.value = savedRoutesService.generateShareableLink(dummy);
  };

  refreshLink();
  titleInput.oninput = refreshLink;
  descInput.oninput = refreshLink;

  modal.classList.remove('hidden');
}

function closeSaveRouteModal() {
  const modal = document.getElementById('modalSaveRoute');
  if (modal) modal.classList.add('hidden');
}

function handleConfirmSaveRoute() {
  const titleInput = document.getElementById('saveRouteTitle');
  const descInput = document.getElementById('saveRouteDesc');
  const name = titleInput ? titleInput.value : '';
  const desc = descInput ? descInput.value : '';

  try {
    const newPreset = savedRoutesService.saveRouteSet(name, desc, appState.routes, appState.stops);
    closeSaveRouteModal();
    renderAllLayers();
    renderSavedRoutesList();
    showToast(`Saved "${newPreset.name}" to your sidebar library!`, '💾');

    // Switch to Saved tab
    const savedTabBtn = document.querySelector('.sidebar-tabs .tab-btn[data-tab="saved"]');
    if (savedTabBtn) savedTabBtn.click();
  } catch (err) {
    alert(err.message);
  }
}

function handleCopyModalLink() {
  const linkInput = document.getElementById('shareableLinkInput');
  if (!linkInput || !linkInput.value) return;

  navigator.clipboard.writeText(linkInput.value).then(() => {
    showToast('Direct shareable route link copied to clipboard!', '🔗');
  }).catch(() => {
    prompt('Copy this route link:', linkInput.value);
  });
}

// -------------------------------------------------------------
// Loading & Merging Route Presets
// -------------------------------------------------------------
function loadRoutePreset(preset, isMerge = false) {
  if (!preset || !preset.routes) return;

  if (isMerge) {
    const cloned = JSON.parse(JSON.stringify(preset.routes)).map((r, i) => ({
      ...r,
      id: `route-merged-${Date.now()}-${i}`
    }));
    appState.routes.push(...cloned);
    showToast(`Merged ${cloned.length} corridors into active map!`, '✔');
  } else {
    appState.routes = JSON.parse(JSON.stringify(preset.routes));
    showToast(`Loaded "${preset.name}" (${preset.routes.length} corridors)`, '✔');
  }

  // Merge any stops from the preset that don't already exist
  if (preset.stops && preset.stops.length > 0) {
    const existingIds = new Set(appState.stops.map(s => s.id));
    preset.stops.forEach(s => {
      if (!existingIds.has(s.id)) {
        appState.stops.push(JSON.parse(JSON.stringify(s)));
      }
    });
  }

  syncAppStateReferences();
  renderAllLayers();
  updateSidebarLists();
  animationEngine.compileSteps();
  renderTimelinePills();
  animationEngine.showAllRoutes();

  // Focus on the first route
  if (appState.routes.length > 0 && appState.routes[0].points && appState.routes[0].points.length > 0) {
    const p = appState.routes[0].points[0];
    canvasEngine.panTo(p.x, p.y, 1.25, 400);
  }
}

// -------------------------------------------------------------
// Render Saved Routes List in Sidebar
// -------------------------------------------------------------
function renderSavedRoutesList(searchFilter = '') {
  const container = document.getElementById('savedRoutesList');
  if (!container || !savedRoutesService) return;

  const allPresets = savedRoutesService.getAll();
  const filter = (searchFilter || '').toLowerCase().trim();
  const presets = filter
    ? allPresets.filter(p => p.name.toLowerCase().includes(filter) || (p.desc && p.desc.toLowerCase().includes(filter)))
    : allPresets;

  const countBadge = document.getElementById('badgeSavedCount');
  if (countBadge) countBadge.textContent = allPresets.length;
  const tabCounter = document.getElementById('routesTabSavedCounter');
  if (tabCounter) tabCounter.textContent = allPresets.length;

  if (presets.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: #94A3B8; background: #0B1120; border: 1px dashed #334155; border-radius: 6px;">
        <p style="font-size: 0.85rem; font-weight: 600; color: #CBD5E1; margin-bottom: 4px;">No saved route sets found</p>
        <p style="font-size: 0.74rem; color: #64748B; margin-bottom: 12px;">Save active routes from the canvas or try another search term.</p>
        <button id="btnEmptySaveActive" class="mini-btn" style="background: #2563EB;">+ Save Active Routes Now</button>
      </div>
    `;
    container.querySelector('#btnEmptySaveActive')?.addEventListener('click', () => {
      openSaveRouteModal();
    });
    return;
  }

  container.innerHTML = '';
  presets.forEach((preset) => {
    const card = document.createElement('div');
    card.className = 'saved-route-card';

    const routeCount = (preset.routes || []).length;
    const totalPoints = (preset.routes || []).reduce((acc, r) => acc + (r.points ? r.points.length : 0), 0);
    const totalDuration = (preset.routes || []).reduce((acc, r) => acc + (r.duration || 3.0), 0);

    const swatchesHtml = (preset.routes || []).slice(0, 5).map(r => 
      `<span class="saved-route-swatch" style="background: ${r.color || '#DC2626'};" title="${r.title || 'Corridor'}"></span>`
    ).join('');

    const formattedDate = new Date(preset.createdAt || Date.now()).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });

    card.innerHTML = `
      <div class="saved-route-card-header">
        <span class="saved-route-card-title">${preset.name}</span>
        <span class="${preset.isDefault ? 'saved-route-tag-default' : 'saved-route-tag-user'}">
          ${preset.isDefault ? 'Preset' : 'Saved'}
        </span>
      </div>
      <p class="saved-route-card-desc">${preset.desc || 'No description provided.'}</p>
      
      <div class="saved-route-stats-bar">
        <div class="saved-route-color-swatches">
          ${swatchesHtml}
          <span style="margin-left: 4px; font-weight: 600;">${routeCount} corridor${routeCount === 1 ? '' : 's'}</span>
        </div>
        <span>${totalPoints} pts • ${totalDuration.toFixed(1)}s</span>
        <span style="color: #64748B;">${formattedDate}</span>
      </div>

      <div class="saved-route-actions-grid">
        <button class="saved-route-btn-action primary-load btn-load-preset" title="Replace canvas routes with this saved route plan">
          <span>▶ Load</span>
        </button>
        <button class="saved-route-btn-action share-link btn-copy-preset-link" title="Copy direct link to load this route plan anywhere">
          <span>🔗 Link</span>
        </button>
        <button class="saved-route-btn-action btn-append-preset" title="Merge this route set into existing canvas routes">
          <span>+ Merge</span>
        </button>
        <button class="saved-route-btn-action danger-delete btn-delete-preset" title="Remove preset from library" ${preset.isDefault ? 'style="opacity: 0.4;"' : ''}>
          <span>✕ Delete</span>
        </button>
      </div>
    `;

    card.querySelector('.btn-load-preset').addEventListener('click', () => {
      loadRoutePreset(preset, false);
      document.querySelectorAll('.saved-route-card').forEach(c => c.classList.remove('is-active-preset'));
      card.classList.add('is-active-preset');
    });

    card.querySelector('.btn-append-preset').addEventListener('click', () => {
      loadRoutePreset(preset, true);
    });

    card.querySelector('.btn-copy-preset-link').addEventListener('click', () => {
      const shareUrl = savedRoutesService.generateShareableLink(preset);
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast(`Copied direct link for "${preset.name}"!`, '🔗');
      }).catch(() => {
        prompt('Copy this route link:', shareUrl);
      });
    });

    card.querySelector('.btn-delete-preset').addEventListener('click', () => {
      if (confirm(`Delete saved route set "${preset.name}"?`)) {
        savedRoutesService.deleteRouteSet(preset.id);
        renderSavedRoutesList(document.getElementById('savedRoutesSearch')?.value || '');
        renderAllLayers();
        showToast(`Deleted "${preset.name}"`, '🗑');
      }
    });

    container.appendChild(card);
  });
}

initApp();
