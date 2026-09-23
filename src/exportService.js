// Export Service: PPTX Generation, Video Recording, and Standalone HTML with Permanent Labels and Callouts
import pptxgen from 'pptxgenjs';

// Universal mobile & browser download helper
export function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);

  // Trigger standard browser download
  try {
    a.click();
  } catch (err) {
    console.warn('Auto click failed, using direct anchor fallback', err);
  }

  // Keep DOM element and object URL alive for 90 seconds so mobile browsers complete download
  setTimeout(() => {
    try {
      if (a.parentNode) a.parentNode.removeChild(a);
    } catch (_) {}
  }, 2000);

  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 90000);

  // Update UI download notice if present in DOM (for direct tap on mobile / blocked popups)
  const notice = document.getElementById('exportDownloadNotice');
  const directLink = document.getElementById('btnDirectDownloadFile');
  const title = document.getElementById('exportNoticeTitle');
  const subtitle = document.getElementById('exportNoticeSubtitle');
  const shareBtn = document.getElementById('btnShareFileMobile');

  if (notice && directLink) {
    directLink.href = url;
    directLink.download = filename;
    directLink.textContent = `⬇ Tap to Save ${filename}`;
    if (title) title.textContent = `File Ready: ${filename}`;
    if (subtitle) {
      subtitle.textContent = `Download initiated. On mobile phones or tablets, tap the button below to save directly to Files or iCloud:`;
    }
    notice.classList.remove('hidden');

    if (shareBtn) {
      try {
        const fileObj = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
          shareBtn.classList.remove('hidden');
          shareBtn.onclick = async (e) => {
            e.preventDefault();
            try {
              await navigator.share({
                title: filename,
                files: [fileObj]
              });
            } catch (shareErr) {
              console.log('Share canceled or error', shareErr);
            }
          };
        } else {
          shareBtn.classList.add('hidden');
        }
      } catch (_) {
        shareBtn.classList.add('hidden');
      }
    }
  }

  return url;
}

export class ExportService {
  constructor(appState, canvasEngine, animEngine) {
    this.state = appState;
    this.engine = canvasEngine;
    this.animEngine = animEngine;
  }

  // -------------------------------------------------------------
  // Camera Math Helpers for Framing Steps
  // -------------------------------------------------------------
  getBaseFit(width, height) {
    const mapImg = this.engine.bgImage;
    if (!mapImg || !mapImg.complete || mapImg.naturalWidth <= 0) {
      return { scale: 1, offsetX: 0, offsetY: 0, imgW: 1000, imgH: 800 };
    }
    const padding = 16;
    const fitW = width - padding * 2;
    const fitH = height - padding * 2;
    const scale = Math.min(fitW / mapImg.naturalWidth, fitH / mapImg.naturalHeight);
    const renderW = mapImg.naturalWidth * scale;
    const renderH = mapImg.naturalHeight * scale;
    const offsetX = (width - renderW) / 2;
    const offsetY = (height - renderH) / 2;
    return { scale, offsetX, offsetY, imgW: mapImg.naturalWidth, imgH: mapImg.naturalHeight };
  }

  // Calculate target camera view { zoom, centerX, centerY } for a given step
  getStepCamera(step) {
    if (!step) {
      return { zoom: 1.0, centerX: null, centerY: null };
    }

    if (step.focusPoint) {
      return {
        zoom: step.focusPoint.zoom || 1.35,
        centerX: step.focusPoint.x,
        centerY: step.focusPoint.y
      };
    }

    if (step.focusBounds && step.focusBounds.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      step.focusBounds.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const boxW = Math.max(maxX - minX, 120);
      const boxH = Math.max(maxY - minY, 120);

      const mapImg = this.engine.bgImage;
      const imgW = (mapImg && mapImg.naturalWidth > 0) ? mapImg.naturalWidth : 1000;
      const imgH = (mapImg && mapImg.naturalHeight > 0) ? mapImg.naturalHeight : 800;

      const scaleW = (imgW * 0.7) / boxW;
      const scaleH = (imgH * 0.7) / boxH;
      const targetZoom = Math.min(Math.max(Math.min(scaleW, scaleH), 1.05), 2.2);

      return {
        zoom: targetZoom,
        centerX,
        centerY
      };
    }

    // Default overview / summary: centered at base zoom (1.0)
    const mapImg = this.engine.bgImage;
    const imgW = (mapImg && mapImg.naturalWidth > 0) ? mapImg.naturalWidth : 1000;
    const imgH = (mapImg && mapImg.naturalHeight > 0) ? mapImg.naturalHeight : 800;
    return {
      zoom: 1.0,
      centerX: imgW / 2,
      centerY: imgH / 2
    };
  }

  // -------------------------------------------------------------
  // 1. Formal PowerPoint (.pptx) Export
  // -------------------------------------------------------------
  async exportToPptx() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = this.state.title || 'Campus Master Plan Presentation';

    this.animEngine.compileSteps();
    const steps = this.animEngine.steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const slide = pptx.addSlide();
      slide.bkgd = '0F172A'; // Formal Executive Slate

      // Render step snapshot with focused camera zoom and callouts
      const camera = this.getStepCamera(step);
      const dataUrl = await this.renderStepToImage(step, i, camera);

      // Add Map Snapshot (left/center widescreen)
      slide.addImage({
        data: dataUrl,
        x: 0.5,
        y: 0.5,
        w: 8.6,
        h: 6.4
      });

      // Right Info Panel (Formal Card)
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 9.3,
        y: 0.5,
        w: 3.5,
        h: 6.4,
        fill: { color: '1E293B' },
        line: { color: '475569', width: 1 },
        rectRadius: 0.05
      });

      // Badge / Slide Tag
      const badgeText = step.badge ? `STOP ${step.badge}` : `SLIDE ${i + 1}`;
      slide.addText(badgeText, {
        x: 9.6,
        y: 0.8,
        w: 2.9,
        h: 0.35,
        fontSize: 11,
        fontFace: 'Segoe UI',
        color: 'FFFFFF',
        bold: true,
        fill: { color: 'DC2626' },
        align: 'center'
      });

      // Title
      slide.addText(step.title, {
        x: 9.6,
        y: 1.3,
        w: 2.9,
        h: 1.0,
        fontSize: 16,
        fontFace: 'Segoe UI',
        color: 'FFFFFF',
        bold: true,
        valign: 'top'
      });

      // Metric / Tag
      if (step.metric) {
        slide.addText(step.metric, {
          x: 9.6,
          y: 2.4,
          w: 2.9,
          h: 0.3,
          fontSize: 10,
          fontFace: 'Segoe UI',
          color: '94A3B8',
          bold: true
        });
      }

      // Description
      slide.addText(step.desc || '', {
        x: 9.6,
        y: 2.8,
        w: 2.9,
        h: 2.8,
        fontSize: 11,
        fontFace: 'Segoe UI',
        color: 'CBD5E1',
        valign: 'top',
        lineSpacing: 16
      });

      // Formal Footer
      slide.addText('Campus Master Plan • Formal Presentation', {
        x: 9.6,
        y: 6.4,
        w: 2.9,
        h: 0.3,
        fontSize: 8,
        fontFace: 'Segoe UI',
        color: '64748B'
      });

      // Speaker Notes
      if (step.notes) {
        slide.addNotes(step.notes);
      }
    }

    const safeTitle = (this.state.title || 'Campus_Master_Plan').replace(/[^a-z0-9_-]/gi, '_');
    const fileName = `${safeTitle}.pptx`;
    try {
      const blob = await pptx.write({ outputType: 'blob' });
      triggerBrowserDownload(blob, fileName);
    } catch (writeErr) {
      console.warn('Direct blob pptx write failed, using writeFile fallback', writeErr);
      await pptx.writeFile({ fileName });
    }
  }

  // -------------------------------------------------------------
  // 2. Video Capture with Camera Zoom and Pan Transitions
  // -------------------------------------------------------------
  async recordVideo(onProgress, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const pacing = options.pacing || 'slow';
    // Multipliers for frames per phase
    // 'slow': calm, executive pacing where viewers can comfortably observe camera motion and read callout boxes
    // 'standard': medium pacing
    // 'brisk': faster
    let paceMultiplier = 2.4; // default calm/deliberate
    if (pacing === 'standard') {
      paceMultiplier = 1.6;
    } else if (pacing === 'brisk') {
      paceMultiplier = 1.0;
    }

    const stream = canvas.captureStream(60);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
      videoBitsPerSecond: 4500000
    });

    const recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.start();

    this.animEngine.compileSteps();
    const steps = this.animEngine.steps;

    let previousCamera = this.getStepCamera(steps[0]);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const targetCamera = this.getStepCamera(step);

      if (onProgress) onProgress(i + 1, steps.length, step.title);

      // Phase 1: Smooth Camera Zoom/Pan Transition to New Slide (~1.0s to 1.5s glide)
      if (i > 0) {
        const panFrames = Math.round(55 * paceMultiplier);
        for (let p = 0; p < panFrames; p++) {
          const t = p / panFrames;
          // Smooth easeInOutCubic for cinema-like camera motion
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          const interpolatedCamera = {
            zoom: previousCamera.zoom + (targetCamera.zoom - previousCamera.zoom) * ease,
            centerX: previousCamera.centerX + (targetCamera.centerX - previousCamera.centerX) * ease,
            centerY: previousCamera.centerY + (targetCamera.centerY - previousCamera.centerY) * ease
          };

          await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, 0.0, interpolatedCamera);
          await new Promise(r => setTimeout(r, 16));
        }
      }

      // Phase 2: Active Step Drawing & Route Progression (~1.5s to 2.5s)
      const baseDraw = step.type === 'route' ? 50 : 25;
      const drawFrames = Math.round(baseDraw * paceMultiplier);
      for (let f = 0; f < drawFrames; f++) {
        const progress = f / Math.max(1, drawFrames - 1);
        await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, progress, targetCamera);
        await new Promise(r => setTimeout(r, 16));
      }

      // Phase 3: Hold step snapshot so audience can read callout dialog, badge, and metrics (~1.8s to 2.8s)
      const baseHold = step.type === 'stop' ? 55 : (step.type === 'overview' ? 65 : 45);
      const holdFrames = Math.round(baseHold * paceMultiplier);
      for (let h = 0; h < holdFrames; h++) {
        await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, 1.0, targetCamera);
        await new Promise(r => setTimeout(r, 16));
      }

      previousCamera = targetCamera;
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
        const fileName = `${safeTitle}_animation.webm`;
        triggerBrowserDownload(blob, fileName);
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  // -------------------------------------------------------------
  // Render Step Snapshot to Canvas with Zoom & Framing
  // -------------------------------------------------------------
  async renderStepToImage(step, stepIndex, cameraOverride = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    const camera = cameraOverride || this.getStepCamera(step);
    await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, stepIndex, 1.0, camera);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  async drawFrameToCanvas(ctx, width, height, step, stepIndex, progress = 1.0, camera = null) {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const mapImg = this.engine.bgImage;
    if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      const base = this.getBaseFit(width, height);
      const cam = camera || this.getStepCamera(step);
      const camZoom = cam.zoom || 1.0;

      // Effective scale
      const effScale = base.scale * camZoom;

      // Center of viewport in map coordinate space
      const centerMapX = cam.centerX !== null && cam.centerX !== undefined ? cam.centerX : base.imgW / 2;
      const centerMapY = cam.centerY !== null && cam.centerY !== undefined ? cam.centerY : base.imgH / 2;

      // Screen transform: Map point (centerMapX, centerMapY) maps to (width / 2, height / 2)
      const toScreen = (pt) => ({
        x: (width / 2) + (pt.x - centerMapX) * effScale,
        y: (height / 2) + (pt.y - centerMapY) * effScale
      });

      ctx.save();
      // Clip to inner canvas viewport with neat rounded borders
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();

      // Draw map image transformed according to camera center and zoom
      const imgTopLeft = toScreen({ x: 0, y: 0 });
      ctx.drawImage(mapImg, imgTopLeft.x, imgTopLeft.y, base.imgW * effScale, base.imgH * effScale);

      // 1. Draw Zones
      this.state.zones.forEach(zone => {
        if (!zone.points || zone.points.length < 3) return;
        const isFocus = step.activeZoneId === zone.id;
        ctx.beginPath();
        const start = toScreen(zone.points[0]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < zone.points.length; i++) {
          const pt = toScreen(zone.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        ctx.fillStyle = isFocus ? 'rgba(22, 163, 74, 0.32)' : 'rgba(22, 163, 74, 0.15)';
        ctx.fill();
        ctx.strokeStyle = isFocus ? '#16A34A' : 'rgba(22, 163, 74, 0.6)';
        ctx.lineWidth = isFocus ? Math.max(2, 3 * camZoom * 0.8) : Math.max(1, 1.5 * camZoom * 0.8);
        ctx.stroke();
      });

      // 2. Draw Routes (draw prior routes completed, and active route progressively)
      this.state.routes.forEach(route => {
        if (!route.points || route.points.length < 2) return;
        const isCurrentRoute = step.activeRouteId === route.id;

        ctx.beginPath();
        const start = toScreen(route.points[0]);
        ctx.moveTo(start.x, start.y);

        const maxIndex = isCurrentRoute
          ? Math.max(1, Math.floor(route.points.length * progress))
          : route.points.length;

        for (let i = 1; i < maxIndex; i++) {
          const pt = toScreen(route.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }

        ctx.strokeStyle = route.color || '#DC2626';
        ctx.lineWidth = (route.strokeWidth || 4) * effScale * 1.35;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw Arrowhead at End
        if (route.arrowEnd !== false && maxIndex >= 2) {
          const pEnd = toScreen(route.points[maxIndex - 1]);
          const pPrev = toScreen(route.points[maxIndex - 2]);
          const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
          const arrowLen = Math.max(10, 11 * effScale * 1.35);
          const arrowWid = Math.max(6, 7 * effScale * 1.35);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pEnd.x, pEnd.y);
          ctx.lineTo(
            pEnd.x - arrowLen * Math.cos(angle) + arrowWid * Math.sin(angle),
            pEnd.y - arrowLen * Math.sin(angle) - arrowWid * Math.cos(angle)
          );
          ctx.lineTo(
            pEnd.x - arrowLen * Math.cos(angle) - arrowWid * Math.sin(angle),
            pEnd.y - arrowLen * Math.sin(angle) + arrowWid * Math.cos(angle)
          );
          ctx.closePath();
          ctx.fillStyle = route.color || '#DC2626';
          ctx.fill();
          ctx.restore();
        }

        // Animated traveler token indicator on active route during video
        if (isCurrentRoute && progress > 0.05 && progress < 0.98) {
          const curPtIndex = Math.min(maxIndex - 1, route.points.length - 1);
          const curPt = toScreen(route.points[curPtIndex]);
          ctx.save();
          ctx.beginPath();
          ctx.arc(curPt.x, curPt.y, 11 * effScale, 0, Math.PI * 2);
          ctx.fillStyle = route.color || '#DC2626';
          ctx.globalAlpha = 0.35;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(curPt.x, curPt.y, 6 * effScale, 0, Math.PI * 2);
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = route.color || '#DC2626';
          ctx.stroke();
          ctx.restore();
        }
      });

      // 3. Draw Permanent Labels
      if (this.state.permanentLabels && this.state.showPermanentLabels !== false) {
        this.state.permanentLabels.forEach(lbl => {
          const pt = toScreen({ x: lbl.x, y: lbl.y });
          const fontName = lbl.fontFamily || 'Plus Jakarta Sans';
          const fontSize = Math.max(10, Math.round((lbl.fontSize || 11) * effScale * 1.15));
          ctx.font = `bold ${fontSize}px ${fontName}, sans-serif`;

          const lines = String(lbl.text || '').split('\n');
          let maxLineW = 0;
          lines.forEach(l => {
            const w = ctx.measureText(l).width;
            if (w > maxLineW) maxLineW = w;
          });

          const lineH = fontSize * 1.35;
          const boxH = lines.length * lineH + 8;
          const boxW = maxLineW + 14;

          ctx.save();
          if (lbl.style === 'road-style') {
            ctx.fillStyle = '#FEF3C7';
            ctx.strokeStyle = '#B45309';
          } else if (lbl.style === 'dark-style') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = '#64748B';
          } else if (lbl.style === 'blueprint-style') {
            ctx.fillStyle = '#0C2340';
            ctx.strokeStyle = '#0284C7';
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = '#334155';
          }

          ctx.fillRect(pt.x - boxW / 2, pt.y - boxH / 2, boxW, boxH);
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x - boxW / 2, pt.y - boxH / 2, boxW, boxH);

          if (lbl.style === 'dark-style') ctx.fillStyle = '#FFFFFF';
          else if (lbl.style === 'road-style') ctx.fillStyle = '#78350F';
          else if (lbl.style === 'blueprint-style') ctx.fillStyle = '#38BDF8';
          else ctx.fillStyle = '#0F172A';

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const startY = pt.y - ((lines.length - 1) * lineH) / 2;
          lines.forEach((lineText, lIdx) => {
            ctx.fillText(lineText, pt.x, startY + lIdx * lineH);
          });

          ctx.restore();
        });
      }

      // 4. Draw Stops / Pins
      this.state.stops.forEach((stop, idx) => {
        const pt = toScreen({ x: stop.x, y: stop.y });
        const isActive = step.activeStopId === stop.id;

        const pinRadius = isActive ? Math.max(14, 16 * camZoom * 0.9) : Math.max(10, 12 * camZoom * 0.9);

        // Badge circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = stop.color || '#DC2626';
        ctx.fill();
        ctx.lineWidth = isActive ? 3.5 : 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Badge Number text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.round(pinRadius * 0.9)}px 'Plus Jakarta Sans', Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stop.badge || `${idx + 1}`, pt.x, pt.y);

        // 5. Draw Callout Dialog Box on Active Stop
        if (isActive && step.type === 'stop' && this.state.showDialogOnFocus !== false) {
          const dialogW = 220;
          const dialogH = 80;
          const dialogX = pt.x - dialogW / 2;
          const dialogY = pt.y - pinRadius - 16 - dialogH;

          ctx.save();
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1.5;
          ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
          ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);

          // Arrow tip
          ctx.beginPath();
          ctx.moveTo(pt.x - 8, dialogY + dialogH);
          ctx.lineTo(pt.x + 8, dialogY + dialogH);
          ctx.lineTo(pt.x, dialogY + dialogH + 10);
          ctx.closePath();
          ctx.fillStyle = '#1E293B';
          ctx.fill();
          ctx.stroke();

          // Header
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px "Plus Jakarta Sans", Segoe UI, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(stop.title, dialogX + 10, dialogY + 18);

          // Description (multiline truncated)
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '10px "Plus Jakarta Sans", Segoe UI, sans-serif';
          const desc = stop.desc || '';
          ctx.fillText(desc.substring(0, 36), dialogX + 10, dialogY + 38);
          if (desc.length > 36) {
            ctx.fillText(desc.substring(36, 72) + '...', dialogX + 10, dialogY + 52);
          }

          // Tag
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 9px "Plus Jakarta Sans", Segoe UI, sans-serif';
          ctx.fillText(stop.metric || 'Key Hub', dialogX + 10, dialogY + 68);
          ctx.restore();
        }
      });

      ctx.restore();
    }
  }

  exportStandaloneHtml() {
    const dataJson = JSON.stringify(this.state);
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.state.title || 'Campus Master Plan Presentation'}</title>
  <style>
    body { margin: 0; background: #0F172A; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
    #view { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; }
    img { max-height: 88vh; max-width: 88vw; object-fit: contain; }
    #card { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1E293B; padding: 16px 24px; border-radius: 6px; border: 1px solid #475569; width: 560px; max-width: 90vw; }
    h2 { margin: 0 0 6px 0; font-size: 18px; color: #FFFFFF; }
    p { margin: 0; color: #CBD5E1; font-size: 13px; line-height: 1.45; }
    .hint { margin-top: 8px; font-size: 11px; color: #94A3B8; border-top: 1px solid #334155; padding-top: 6px; }
  </style>
</head>
<body>
  <div id="view">
    <img src="${this.state.imageSrc || '/image.png'}" alt="Master Plan">
    <div id="card">
      <h2 id="cardTitle"></h2>
      <p id="cardDesc"></p>
      <div class="hint">Click anywhere or press Space / Right Arrow to advance</div>
    </div>
  </div>
  <script>
    const data = ${dataJson};
    let step = 0;
    const stops = data.stops || [];
    function update() {
      const s = stops[step % stops.length];
      document.getElementById('cardTitle').textContent = s.title;
      document.getElementById('cardDesc').textContent = s.desc;
    }
    window.addEventListener('click', () => { step++; update(); });
    window.addEventListener('keydown', (e) => { if(e.key === ' ' || e.key === 'ArrowRight') { step++; update(); } });
    update();
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
    triggerBrowserDownload(blob, `${safeTitle}_presentation.html`);
  }

  exportJson() {
    const jsonStr = JSON.stringify(this.state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
    triggerBrowserDownload(blob, `${safeTitle}.json`);
  }
}
