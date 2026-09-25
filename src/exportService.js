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
    const ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    const pacing = options.pacing || 'slow';
    const targetFps = parseInt(options.fps, 10) || 60;

    let paceFactor = 1.35; // Calm, deliberate, cinematic presentation pacing
    if (pacing === 'standard') {
      paceFactor = 1.0;
    } else if (pacing === 'brisk') {
      paceFactor = 0.75;
    }

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    const chosenMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    const stream = canvas.captureStream(targetFps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: chosenMime,
      videoBitsPerSecond: targetFps >= 60 ? 8000000 : 5000000
    });

    const recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    this.animEngine.compileSteps();
    const steps = this.animEngine.steps;
    if (!steps || steps.length === 0) {
      throw new Error('No presentation steps found to record.');
    }

    // Pre-render the starting frame before starting recording so initial frame is crisp
    const firstCamera = this.getStepCamera(steps[0]);
    this.drawFrameToCanvas(ctx, canvas.width, canvas.height, steps[0], 0, 0.0, firstCamera);

    mediaRecorder.start();

    // Small warm-up buffer for recorder encoder
    await new Promise(r => setTimeout(r, 60));

    // RequestAnimationFrame-synchronized phase animator based on high-resolution performance.now()
    const animatePhase = (durationMs, onFrame) => {
      if (durationMs <= 0) {
        onFrame(1.0);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let startTime = null;
        const tick = (now) => {
          if (startTime === null) startTime = now;
          const elapsed = now - startTime;
          const t = Math.min(1.0, elapsed / durationMs);
          onFrame(t);
          if (t < 1.0) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    };

    let previousCamera = firstCamera;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const targetCamera = this.getStepCamera(step);

      if (onProgress) {
        onProgress(i + 1, steps.length, step.title);
      }

      if (step.type === 'route') {
        // Generous deliberate corridor drawing duration matching the browser experience
        const baseDuration = (step.routeData?.duration || 3.0) * 1000;
        const totalRouteDuration = Math.max(3800, baseDuration * 1.3 * paceFactor);

        // Phase 1: Smooth camera pan/zoom into corridor framing (first 850ms)
        // Corridor starts drawing its initial 12% simultaneously so motion is fluid
        const panDuration = i > 0 ? Math.min(850, totalRouteDuration * 0.25) : 0;
        if (panDuration > 0) {
          await animatePhase(panDuration, (t) => {
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const interpolatedCamera = {
              zoom: previousCamera.zoom + (targetCamera.zoom - previousCamera.zoom) * ease,
              centerX: previousCamera.centerX + (targetCamera.centerX - previousCamera.centerX) * ease,
              centerY: previousCamera.centerY + (targetCamera.centerY - previousCamera.centerY) * ease
            };
            // Trace the first 12% of route smoothly while camera glides
            const initialProgress = t * 0.12;
            this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, initialProgress, interpolatedCamera);
          });
        }

        // Phase 2: Full deliberate corridor drawing (from 12% to 100%)
        const remainingDuration = totalRouteDuration - panDuration;
        await animatePhase(remainingDuration, (t) => {
          const overallProgress = 0.12 + t * 0.88;
          this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, overallProgress, targetCamera);
        });

        // Phase 3: Hold step snapshot so audience can clearly see the completed corridor
        const holdDuration = 1800 * paceFactor;
        await animatePhase(holdDuration, () => {
          this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, 1.0, targetCamera);
        });
      } else {
        // Non-route step (Stops, Overview, Summary)
        if (i > 0) {
          const panDuration = 1150 * paceFactor;
          await animatePhase(panDuration, (t) => {
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const interpolatedCamera = {
              zoom: previousCamera.zoom + (targetCamera.zoom - previousCamera.zoom) * ease,
              centerX: previousCamera.centerX + (targetCamera.centerX - previousCamera.centerX) * ease,
              centerY: previousCamera.centerY + (targetCamera.centerY - previousCamera.centerY) * ease
            };
            this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, 0.0, interpolatedCamera);
          });
        }

        const drawDuration = 700 * paceFactor;
        await animatePhase(drawDuration, (progress) => {
          this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, progress, targetCamera);
        });

        const holdDuration = (
          step.type === 'stop'
            ? 2400
            : (step.type === 'overview' || step.type === 'summary' ? 2800 : 1600)
        ) * paceFactor;

        await animatePhase(holdDuration, () => {
          this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, 1.0, targetCamera);
        });
      }

      previousCamera = targetCamera;
    }

    // Final hold buffer for clean ending
    await new Promise(r => setTimeout(r, 400));

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const ext = chosenMime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunks, { type: chosenMime });
        const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
        const fileName = `${safeTitle}_animation.${ext}`;
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
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    const camera = cameraOverride || this.getStepCamera(step);
    this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, stepIndex, 1.0, camera);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  drawFrameToCanvas(ctx, width, height, step, stepIndex, progress = 1.0, camera = null) {
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
      // Clip to inner canvas viewport
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

      // 2. Draw Routes (Continuous sub-pixel polyline interpolation & progressive visibility)
      const isSummary = step.type === 'summary';

      this.state.routes.forEach((route) => {
        const points = route.points;
        if (!points || points.length < 2) return;

        // Determine step index where this route is introduced
        const routeStepIdx = this.animEngine.steps.findIndex(s => s.type === 'route' && s.activeRouteId === route.id);

        // In progressive tour presentation, keep future routes strictly hidden before their turn
        if (!isSummary) {
          if (routeStepIdx === -1 || step.index < routeStepIdx) {
            return;
          }
        }

        const isCurrentRoute = step.type === 'route' && step.activeRouteId === route.id;

        // Precompute cumulative lengths of segments for continuous sub-pixel interpolation
        let totalLength = 0;
        const segLengths = [];
        for (let j = 0; j < points.length - 1; j++) {
          const dx = points[j + 1].x - points[j].x;
          const dy = points[j + 1].y - points[j].y;
          const dist = Math.hypot(dx, dy);
          segLengths.push(dist);
          totalLength += dist;
        }

        if (totalLength <= 0) return;

        // Smooth acceleration and deceleration for route drawing (matches SVG animation)
        const smoothProgress = isCurrentRoute
          ? (progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2)
          : 1.0;

        const targetDist = Math.max(0, Math.min(totalLength, totalLength * smoothProgress));
        if (targetDist <= 0) return;

        ctx.beginPath();
        const start = toScreen(points[0]);
        ctx.moveTo(start.x, start.y);

        let accumulated = 0;
        let tipPt = points[0];
        let tipAngle = 0;

        for (let j = 0; j < segLengths.length; j++) {
          const segLen = segLengths[j];
          const pA = points[j];
          const pB = points[j + 1];
          const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);

          if (accumulated + segLen <= targetDist) {
            const screenPt = toScreen(pB);
            ctx.lineTo(screenPt.x, screenPt.y);
            accumulated += segLen;
            tipPt = pB;
            tipAngle = angle;
          } else {
            // Continuous sub-pixel fractional interpolation within the partial segment
            const remaining = targetDist - accumulated;
            const frac = segLen > 0 ? remaining / segLen : 0;
            tipPt = {
              x: pA.x + (pB.x - pA.x) * frac,
              y: pA.y + (pB.y - pA.y) * frac
            };
            tipAngle = angle;
            const screenTip = toScreen(tipPt);
            ctx.lineTo(screenTip.x, screenTip.y);
            break;
          }
        }

        ctx.strokeStyle = route.color || '#DC2626';
        ctx.lineWidth = (route.strokeWidth || 4) * effScale * 1.35;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Animated luminous traveler token indicator smoothly gliding with the advancing route tip
        if (isCurrentRoute && targetDist > 3 && progress < 0.98) {
          const screenTip = toScreen(tipPt);
          const tokenScale = Math.max(0.9, Math.min(2.0, effScale * 1.4));
          const pulse = 1.0 + 0.15 * Math.sin(progress * Math.PI * 8);

          ctx.save();
          // Outer aura ring
          ctx.beginPath();
          ctx.arc(screenTip.x, screenTip.y, 13 * tokenScale * pulse, 0, Math.PI * 2);
          ctx.fillStyle = route.color || '#DC2626';
          ctx.globalAlpha = 0.38;
          ctx.fill();

          // Mid glow core
          ctx.beginPath();
          ctx.arc(screenTip.x, screenTip.y, 7.5 * tokenScale, 0, Math.PI * 2);
          ctx.fillStyle = route.color || '#DC2626';
          ctx.globalAlpha = 0.75;
          ctx.fill();

          // Inner solid crisp dot
          ctx.beginPath();
          ctx.arc(screenTip.x, screenTip.y, 4.5 * tokenScale, 0, Math.PI * 2);
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = route.color || '#DC2626';
          ctx.stroke();
          ctx.restore();
        }

        // Destination Terminal Arrowhead (displayed once route is fully drawn or completed, matching SVG marker-end)
        const showEndArrow = route.arrowEnd !== false && (!isCurrentRoute || progress >= 0.95);
        if (showEndArrow && points.length >= 2) {
          const lastA = points[points.length - 2];
          const lastB = points[points.length - 1];
          const lastAngle = Math.atan2(lastB.y - lastA.y, lastB.x - lastA.x);
          const screenLast = toScreen(lastB);

          const arrowLen = Math.max(11, 13 * effScale * 1.35);
          const arrowWid = Math.max(7, 8.5 * effScale * 1.35);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(screenLast.x, screenLast.y);
          ctx.lineTo(
            screenLast.x - arrowLen * Math.cos(lastAngle) + arrowWid * Math.sin(lastAngle),
            screenLast.y - arrowLen * Math.sin(lastAngle) - arrowWid * Math.cos(lastAngle)
          );
          ctx.lineTo(
            screenLast.x - arrowLen * Math.cos(lastAngle) - arrowWid * Math.sin(lastAngle),
            screenLast.y - arrowLen * Math.sin(lastAngle) + arrowWid * Math.cos(lastAngle)
          );
          ctx.closePath();
          ctx.fillStyle = route.color || '#DC2626';
          ctx.fill();
          ctx.restore();
        }

        // Waypoint Note Flags on Nodes
        points.forEach((p, pIdx) => {
          if (p && p.note) {
            const screenP = toScreen(p);
            ctx.save();
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.arc(screenP.x, screenP.y - 12, 6 * effScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
          }
        });

        // 2b. Draw Node Note Callout when animation starts or traces this route
        if (isCurrentRoute && points && points.length > 0) {
          points.forEach((p, pIdx) => {
            if (p && p.note) {
              const shouldShow = (pIdx === 0)
                ? (progress >= 0.04 && progress <= 0.88)
                : (p.showOnStart ? (progress >= 0.04 && progress <= 0.88) : false);

              if (shouldShow) {
                const screenP = toScreen(p);
                const rawNote = String(p.note || '').trim();
                if (!rawNote) return;

                // Configure typography for user's pure text note (no node # or corridor title)
                ctx.font = '500 13px "Plus Jakarta Sans", Segoe UI, sans-serif';
                const words = rawNote.split(/\s+/);
                const maxTextWidth = 270;
                const lines = [];
                let currentLine = '';
                for (let w = 0; w < words.length; w++) {
                  const testLine = currentLine ? currentLine + ' ' + words[w] : words[w];
                  if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = words[w];
                    if (lines.length >= 3) break;
                  } else {
                    currentLine = testLine;
                  }
                }
                if (currentLine && lines.length < 3) {
                  lines.push(currentLine);
                } else if (lines.length >= 3 && currentLine) {
                  lines[2] = lines[2].replace(/(\s+[^\s]+)$/, '...');
                }

                const lineSpacing = 18;
                const padX = 14;
                const padY = 10;
                let maxMeasuredW = 0;
                lines.forEach(l => {
                  const w = ctx.measureText(l).width;
                  if (w > maxMeasuredW) maxMeasuredW = w;
                });

                const noteBoxW = Math.min(320, Math.max(140, Math.round(maxMeasuredW + padX * 2)));
                const noteBoxH = Math.max(38, Math.round(lines.length * lineSpacing + padY * 2));

                let noteX = Math.round(screenP.x - noteBoxW / 2);
                noteX = Math.max(16, Math.min(width - noteBoxW - 16, noteX));
                let noteY = Math.round(screenP.y - 18 - noteBoxH);
                let placeAbove = true;
                if (noteY < 24) {
                  noteY = Math.round(screenP.y + 22);
                  placeAbove = false;
                }

                const noteAlpha = Math.min(1.0, Math.max(0.0, (progress - 0.04) / 0.12));

                ctx.save();
                ctx.globalAlpha = noteAlpha;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
                ctx.shadowBlur = 16;
                ctx.shadowOffsetY = 5;

                // Box background
                ctx.fillStyle = '#0F172A';
                if (ctx.roundRect) {
                  ctx.beginPath();
                  ctx.roundRect(noteX, noteY, noteBoxW, noteBoxH, 6);
                  ctx.fill();
                } else {
                  ctx.fillRect(noteX, noteY, noteBoxW, noteBoxH);
                }

                ctx.shadowColor = 'transparent';
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 1.8;
                if (ctx.roundRect) {
                  ctx.beginPath();
                  ctx.roundRect(noteX, noteY, noteBoxW, noteBoxH, 6);
                  ctx.stroke();
                } else {
                  ctx.strokeRect(noteX, noteY, noteBoxW, noteBoxH);
                }

                // Render note text - only what the user gave, no node or route numbers
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '500 13px "Plus Jakarta Sans", Segoe UI, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                lines.forEach((l, lIdx) => {
                  ctx.fillText(l, noteX + padX, noteY + padY + lIdx * lineSpacing);
                });

                // Pointer arrow
                const arrowX = Math.max(noteX + 16, Math.min(noteX + noteBoxW - 16, screenP.x));
                ctx.beginPath();
                if (placeAbove) {
                  ctx.moveTo(arrowX - 8, noteY + noteBoxH);
                  ctx.lineTo(arrowX + 8, noteY + noteBoxH);
                  ctx.lineTo(arrowX, noteY + noteBoxH + 10);
                } else {
                  ctx.moveTo(arrowX - 8, noteY);
                  ctx.lineTo(arrowX + 8, noteY);
                  ctx.lineTo(arrowX, noteY - 10);
                }
                ctx.closePath();
                ctx.fillStyle = '#0F172A';
                ctx.fill();
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 1.8;
                ctx.stroke();

                ctx.restore();
              }
            }
          });
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

        // Active Stop Subtle Smooth Halo Ring
        if (isActive) {
          ctx.save();
          ctx.beginPath();
          const haloSize = pinRadius + 5 + 3 * Math.sin(progress * Math.PI);
          ctx.arc(pt.x, pt.y, haloSize, 0, Math.PI * 2);
          ctx.fillStyle = stop.color || '#DC2626';
          ctx.globalAlpha = 0.28;
          ctx.fill();
          ctx.restore();
        }

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

        // 5. Draw Callout Dialog Box on Active Stop with smooth opacity fade-in
        if (isActive && step.type === 'stop' && this.state.showDialogOnFocus !== false) {
          // Generous executive callout dimensions for high legibility in video & presentation
          const dialogW = 380;
          const dialogH = 98;

          // Safe positioning with boundary clamping
          let dialogX = Math.round(pt.x - dialogW / 2);
          if (dialogX < 24) dialogX = 24;
          if (dialogX + dialogW > width - 24) dialogX = width - dialogW - 24;

          let placeAbove = true;
          let dialogY = Math.round(pt.y - pinRadius - 18 - dialogH);
          if (dialogY < 24) {
            dialogY = Math.round(pt.y + pinRadius + 20);
            placeAbove = false;
          }

          // Arrow anchor point aligned to pin, clamped within box
          const arrowX = Math.max(dialogX + 24, Math.min(dialogX + dialogW - 24, pt.x));

          // Smooth fade-in during active focus phase (hidden during camera pan glide)
          const dialogAlpha = Math.min(1.0, Math.max(0.0, (progress - 0.12) / 0.45));
          if (dialogAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = dialogAlpha;

            // Rounded rectangle helper
            const roundRect = (x, y, w, h, r) => {
              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + w - r, y);
              ctx.quadraticCurveTo(x + w, y, x + w, y + r);
              ctx.lineTo(x + w, y + h - r);
              ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
              ctx.lineTo(x + r, y + h);
              ctx.quadraticCurveTo(x, y + h, x, y + h - r);
              ctx.lineTo(x, y + r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.closePath();
            };

            // Soft executive shadow for high contrast over light & dark campus maps
            ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
            ctx.shadowBlur = 22;
            ctx.shadowOffsetY = 8;

            // Card background body
            roundRect(dialogX, dialogY, dialogW, dialogH, 10);
            ctx.fillStyle = '#1E293B';
            ctx.fill();

            // Clear shadow for crisp inner elements
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Header Bar (#0F172A) with rounded top corners
            ctx.save();
            ctx.beginPath();
            if (placeAbove) {
              ctx.moveTo(dialogX + 10, dialogY);
              ctx.lineTo(dialogX + dialogW - 10, dialogY);
              ctx.quadraticCurveTo(dialogX + dialogW, dialogY, dialogX + dialogW, dialogY + 10);
              ctx.lineTo(dialogX + dialogW, dialogY + 42);
              ctx.lineTo(dialogX, dialogY + 42);
              ctx.lineTo(dialogX, dialogY + 10);
              ctx.quadraticCurveTo(dialogX, dialogY, dialogX + 10, dialogY);
            } else {
              ctx.rect(dialogX, dialogY, dialogW, 42);
            }
            ctx.closePath();
            ctx.fillStyle = '#0F172A';
            ctx.fill();
            ctx.restore();

            // Header divider line
            ctx.beginPath();
            ctx.moveTo(dialogX, dialogY + 42);
            ctx.lineTo(dialogX + dialogW, dialogY + 42);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Card border
            roundRect(dialogX, dialogY, dialogW, dialogH, 10);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Arrow Tip pointing to Stop Pin
            ctx.beginPath();
            if (placeAbove) {
              ctx.moveTo(arrowX - 11, dialogY + dialogH);
              ctx.lineTo(arrowX + 11, dialogY + dialogH);
              ctx.lineTo(arrowX, dialogY + dialogH + 13);
            } else {
              ctx.moveTo(arrowX - 11, dialogY);
              ctx.lineTo(arrowX + 11, dialogY);
              ctx.lineTo(arrowX, dialogY - 13);
            }
            ctx.closePath();
            ctx.fillStyle = '#1E293B';
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Badge circle in header
            const badgeRadius = 12;
            const badgeCenterY = dialogY + 21;
            ctx.beginPath();
            ctx.arc(dialogX + 24, badgeCenterY, badgeRadius, 0, Math.PI * 2);
            ctx.fillStyle = stop.color || '#DC2626';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();

            // Badge text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px "Plus Jakarta Sans", Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stop.badge || `${idx + 1}`, dialogX + 24, badgeCenterY);

            // Stop Title in header (bold 16px)
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px "Plus Jakarta Sans", Segoe UI, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const maxTitleWidth = dialogW - 64;
            let displayTitle = stop.title || `Stop ${idx + 1}`;
            while (ctx.measureText(displayTitle).width > maxTitleWidth && displayTitle.length > 5) {
              displayTitle = displayTitle.substring(0, displayTitle.length - 4) + '...';
            }
            ctx.fillText(displayTitle, dialogX + 44, badgeCenterY);

            // Multiline Word-Wrapped Description
            ctx.fillStyle = '#E2E8F0';
            ctx.font = '13.5px "Plus Jakarta Sans", Segoe UI, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            const descText = stop.desc || 'Active master plan focal destination.';
            const words = descText.split(' ');
            const lines = [];
            let currentLine = '';
            const maxTextWidth = dialogW - 32;

            for (let w = 0; w < words.length; w++) {
              const testLine = currentLine ? currentLine + ' ' + words[w] : words[w];
              if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
                lines.push(currentLine);
                currentLine = words[w];
                if (lines.length >= 2) break; // Limit to 2 lines to leave room for badges
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine && lines.length < 2) {
              lines.push(currentLine);
            } else if (lines.length >= 2 && currentLine) {
              // Add ellipsis if truncated
              lines[1] = lines[1].replace(/(\s+[^\s]+)$/, '...');
            }

            const lineSpacing = 19;
            lines.forEach((l, lIdx) => {
              ctx.fillText(l, dialogX + 16, dialogY + 65 + lIdx * lineSpacing);
            });

            ctx.restore();
          }
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
