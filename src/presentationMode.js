// Presentation Mode: Fullscreen Interactive Theatre with On-Click Step Progression

export class PresentationMode {
  constructor(canvasEngine, animationEngine, appState) {
    this.canvasEngine = canvasEngine;
    this.animEngine = animationEngine;
    this.state = appState;
    this.isActive = false;

    // DOM Elements
    this.overlay = document.getElementById('presentationOverlay');
    this.clickCatcher = document.getElementById('presentationClickCatcher');
    this.btnExit = document.getElementById('btnPresExit');
    this.btnNext = document.getElementById('btnPresNext');
    this.btnPrev = document.getElementById('btnPresPrev');
    this.btnToggleNotes = document.getElementById('btnPresToggleNotes');
    this.speakerNotes = document.getElementById('presSpeakerNotes');

    // Milestone Card Elements
    this.presTitle = document.getElementById('presProjectTitle');
    this.stepCounter = document.getElementById('presStepCounter');
    this.progressFill = document.getElementById('presProgressFill');
    this.badgeNum = document.getElementById('presBadgeNum');
    this.stepType = document.getElementById('presStepType');
    this.metricTag = document.getElementById('presMetricTag');
    this.milestoneTitle = document.getElementById('presMilestoneTitle');
    this.milestoneDesc = document.getElementById('presMilestoneDesc');
    this.notesContent = document.getElementById('presNotesContent');

    this.initEvents();
  }

  initEvents() {
    // Click anywhere on backdrop to advance
    this.clickCatcher.addEventListener('click', (e) => {
      if (this.isActive) {
        this.animEngine.nextStep();
      }
    });

    this.btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      this.animEngine.nextStep();
    });

    this.btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      this.animEngine.prevStep();
    });

    this.btnExit.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exit();
    });

    this.btnToggleNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      this.speakerNotes.classList.toggle('hidden');
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // F5 to enter presentation
      if (e.key === 'F5') {
        e.preventDefault();
        this.toggle();
        return;
      }

      if (!this.isActive) return;

      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        this.animEngine.nextStep();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault();
        this.animEngine.prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.exit();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.speakerNotes.classList.toggle('hidden');
      }
    });
  }

  enter() {
    this.isActive = true;
    document.body.classList.add('presentation-active');
    this.overlay.classList.remove('hidden');

    // Request browser fullscreen if available
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}

    // Re-compile steps in case stops were modified
    this.animEngine.compileSteps();
    // Start from step 1 (or 0)
    this.animEngine.goToStep(this.animEngine.currentStep || 0, true);
  }

  exit() {
    this.isActive = false;
    document.body.classList.remove('presentation-active');
    this.overlay.classList.add('hidden');

    if (document.fullscreenElement) {
      try { document.exitFullscreen().catch(() => {}); } catch (_) {}
    }

    // Reset view fit
    this.canvasEngine.fitToScreen(40);
  }

  toggle() {
    if (this.isActive) {
      this.exit();
    } else {
      this.enter();
    }
  }

  updateStep(stepIndex, stepData, totalSteps) {
    if (!stepData) return;

    this.presTitle.textContent = this.state.title || 'Campus Master Plan Tour';
    this.stepCounter.textContent = `Slide ${stepIndex + 1} / ${totalSteps}`;

    const progressPct = ((stepIndex + 1) / totalSteps) * 100;
    this.progressFill.style.width = `${progressPct}%`;

    this.milestoneTitle.textContent = stepData.title || '';
    this.milestoneDesc.textContent = stepData.desc || '';
    this.notesContent.textContent = stepData.notes || 'No speaker notes for this step.';

    if (stepData.badge) {
      this.badgeNum.textContent = stepData.badge;
      this.badgeNum.classList.remove('hidden');
    } else {
      this.badgeNum.textContent = '★';
    }

    this.stepType.textContent = (stepData.type || 'STEP').toUpperCase();
    this.metricTag.textContent = stepData.metric || 'Presentation Point';
  }
}
