// Export Service: PPTX Generation, Video Recording, and Standalone HTML with Permanent Labels and Callouts
import pptxgen from 'pptxgenjs';

export class ExportService {
  constructor(appState, canvasEngine, animEngine) {
    this.state = appState;
    this.engine = canvasEngine;
    this.animEngine = animEngine;
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

      // Render step snapshot with permanent labels and callouts
      const dataUrl = await this.renderStepToImage(step, i);

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
    await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
  }

  // -------------------------------------------------------------
  // 2. Video Capture
  // -------------------------------------------------------------
  async recordVideo(onProgress) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(60);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
      videoBitsPerSecond: 4000000
    });

    const recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.start();

    this.animEngine.compileSteps();
    const steps = this.animEngine.steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (onProgress) onProgress(i + 1, steps.length, step.title);

      const frames = 40;
      for (let f = 0; f < frames; f++) {
        await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, i, f / frames);
        await new Promise(r => setTimeout(r, 16));
      }
      for (let h = 0; h < 25; h++) {
        await new Promise(r => setTimeout(r, 16));
      }
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
        a.download = `${safeTitle}_animation.webm`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      };
      mediaRecorder.stop();
    });
  }

  // -------------------------------------------------------------
  // Render Step Snapshot to Canvas
  // -------------------------------------------------------------
  async renderStepToImage(step, stepIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    await this.drawFrameToCanvas(ctx, canvas.width, canvas.height, step, stepIndex, 1.0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  async drawFrameToCanvas(ctx, width, height, step, stepIndex, progress = 1.0) {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const mapImg = this.engine.bgImage;
    if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      const padding = 16;
      const fitW = width - padding * 2;
      const fitH = height - padding * 2;
      const scale = Math.min(fitW / mapImg.naturalWidth, fitH / mapImg.naturalHeight);

      const renderW = mapImg.naturalWidth * scale;
      const renderH = mapImg.naturalHeight * scale;
      const offsetX = (width - renderW) / 2;
      const offsetY = (height - renderH) / 2;

      ctx.save();
      ctx.drawImage(mapImg, offsetX, offsetY, renderW, renderH);

      const toScreen = (pt) => ({
        x: offsetX + pt.x * scale,
        y: offsetY + pt.y * scale
      });

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

        ctx.fillStyle = isFocus ? 'rgba(22, 163, 74, 0.3)' : 'rgba(22, 163, 74, 0.15)';
        ctx.fill();
        ctx.strokeStyle = isFocus ? '#16A34A' : 'rgba(22, 163, 74, 0.6)';
        ctx.lineWidth = isFocus ? 3 : 1.5;
        ctx.stroke();
      });

      // 2. Draw Routes
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
        ctx.lineWidth = (route.strokeWidth || 4) * scale * 1.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });

      // 3. Draw Permanent Labels
      if (this.state.permanentLabels && this.state.showPermanentLabels !== false) {
        this.state.permanentLabels.forEach(lbl => {
          const pt = toScreen({ x: lbl.x, y: lbl.y });
          ctx.font = 'bold 11px Segoe UI, sans-serif';
          const textW = ctx.measureText(lbl.text).width;
          const boxH = 18;
          const boxW = textW + 12;

          ctx.save();
          if (lbl.style === 'road-style') {
            ctx.fillStyle = '#FEF3C7';
            ctx.strokeStyle = '#B45309';
          } else if (lbl.style === 'dark-style') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.strokeStyle = '#64748B';
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = '#334155';
          }

          ctx.fillRect(pt.x - boxW / 2, pt.y - boxH / 2, boxW, boxH);
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x - boxW / 2, pt.y - boxH / 2, boxW, boxH);

          ctx.fillStyle = (lbl.style === 'dark-style') ? '#FFFFFF' : ((lbl.style === 'road-style') ? '#78350F' : '#0F172A');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(lbl.text, pt.x, pt.y);
          ctx.restore();
        });
      }

      // 4. Draw Stops / Pins
      this.state.stops.forEach((stop, idx) => {
        const pt = toScreen({ x: stop.x, y: stop.y });
        const isActive = step.activeStopId === stop.id;

        // Badge circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isActive ? 15 : 12, 0, Math.PI * 2);
        ctx.fillStyle = stop.color || '#DC2626';
        ctx.fill();
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Badge Number text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${isActive ? 12 : 10}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stop.badge || `${idx + 1}`, pt.x, pt.y);

        // 5. Draw Callout Dialog Box on Active Stop
        if (isActive && step.type === 'stop' && this.state.showDialogOnFocus !== false) {
          const dialogW = 210;
          const dialogH = 75;
          const dialogX = pt.x - dialogW / 2;
          const dialogY = pt.y - 30 - dialogH;

          ctx.save();
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.5;
          ctx.fillRect(dialogX, dialogY, dialogW, dialogH);
          ctx.strokeRect(dialogX, dialogY, dialogW, dialogH);

          // Arrow tip
          ctx.beginPath();
          ctx.moveTo(pt.x - 7, dialogY + dialogH);
          ctx.lineTo(pt.x + 7, dialogY + dialogH);
          ctx.lineTo(pt.x, dialogY + dialogH + 8);
          ctx.closePath();
          ctx.fillStyle = '#1E293B';
          ctx.fill();
          ctx.stroke();

          // Header
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px Segoe UI, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(stop.title, dialogX + 8, dialogY + 16);

          // Description (multiline truncated)
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '9px Segoe UI, sans-serif';
          const desc = stop.desc || '';
          ctx.fillText(desc.substring(0, 36), dialogX + 8, dialogY + 34);
          if (desc.length > 36) {
            ctx.fillText(desc.substring(36, 72) + '...', dialogX + 8, dialogY + 48);
          }

          // Tag
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 8px Segoe UI, sans-serif';
          ctx.fillText(stop.metric || 'Key Hub', dialogX + 8, dialogY + 64);
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
    <img src="${this.state.imageSrc || './image.png'}" alt="Master Plan">
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

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
    a.download = `${safeTitle}_presentation.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJson() {
    const jsonStr = JSON.stringify(this.state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (this.state.title || 'Campus_Plan').replace(/[^a-z0-9_-]/gi, '_');
    a.download = `${safeTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
