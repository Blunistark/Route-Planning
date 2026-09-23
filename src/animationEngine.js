// Formal Animation Engine for Step-by-Step PPT Transitions and Callout Dialog Positioning

export class AnimationEngine {
  constructor(canvasEngine, appState, domElements, onStepCallback) {
    this.engine = canvasEngine;
    this.state = appState;
    this.dom = domElements;
    this.onStepChange = onStepCallback;

    this.currentStep = 0;
    this.isPlaying = false;
    this.speedFactor = 1.0;

    this.activeAnimId = null;
    this.steps = [];
    this.compileSteps();

    // Callout dialog DOM element
    this.calloutDialog = document.getElementById('formalCalloutDialog');
    this.calloutTitle = document.getElementById('calloutTitle');
    this.calloutBadgeNum = document.getElementById('calloutBadgeNum');
    this.calloutDesc = document.getElementById('calloutDesc');
    this.calloutTag1 = document.getElementById('calloutTag1');
    this.calloutTag2 = document.getElementById('calloutTag2');

    const btnCloseCallout = document.getElementById('btnCloseCallout');
    if (btnCloseCallout) {
      btnCloseCallout.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideCalloutDialog();
      });
    }
  }

  setSpeed(factor) {
    this.speedFactor = factor;
  }

  compileSteps() {
    this.steps = [];

    // Step 0: Site Overview
    this.steps.push({
      index: 0,
      type: 'overview',
      title: this.state.title || 'Campus Master Plan Overview',
      subtitle: 'Complete Master Plan Layout',
      desc: 'Overall architectural perspective of the campus layout, permanent landmark references, and planned connectivity axes.',
      notes: 'Welcome audience. Today we present the master plan layout highlighting key facilities and direct routes.',
      metric: 'Site Overview',
      focusBounds: null,
      activeStopId: null,
      activeRouteId: null,
      activeZoneId: null
    });

    const { stops = [], routes = [], zones = [] } = this.state;
    const visitedStops = new Set();

    if (routes && routes.length > 0) {
      // Sequence follows the exact user-defined ordering of routes!
      routes.forEach((route, rIdx) => {
        if (!route.points || route.points.length < 2) return;

        // Determine starting stop
        let fromStop = stops.find(s => s.id === route.fromStopId);
        if (!fromStop && route.points.length > 0) {
          const startP = route.points[0];
          fromStop = stops.find(s => Math.hypot(s.x - startP.x, s.y - startP.y) < 110);
        }

        // Determine destination stop
        let toStop = stops.find(s => s.id === route.toStopId);
        if (!toStop && route.points.length > 0) {
          const endP = route.points[route.points.length - 1];
          toStop = stops.find(s => s.id !== fromStop?.id && Math.hypot(s.x - endP.x, s.y - endP.y) < 110);
        }

        // 1. Reveal fromStop if not yet visited
        if (fromStop && !visitedStops.has(fromStop.id)) {
          visitedStops.add(fromStop.id);
          this.steps.push({
            index: this.steps.length,
            type: 'stop',
            title: fromStop.title,
            badge: fromStop.badge,
            subtitle: `Stop ${fromStop.badge || visitedStops.size}`,
            desc: fromStop.desc,
            notes: fromStop.notes || `Overview of ${fromStop.title}.`,
            metric: fromStop.metric || 'Key Campus Hub',
            tag: fromStop.tag || 'Campus Facility',
            focusPoint: { x: fromStop.x, y: fromStop.y, zoom: 1.35 },
            activeStopId: fromStop.id,
            activeStopData: fromStop,
            activeRouteId: null,
            activeZoneId: null
          });
        }

        // 2. Animate route corridor in this exact ordered position
        const matchingZone = zones.find(z => z.points && toStop && z.points.some(p => Math.hypot(p.x - toStop.x, p.y - toStop.y) < 200));

        this.steps.push({
          index: this.steps.length,
          type: 'route',
          title: route.title || `Route Corridor ${rIdx + 1}`,
          subtitle: fromStop && toStop
            ? `Leg: ${fromStop.badge || fromStop.title} → ${toStop.badge || toStop.title}`
            : `Corridor ${rIdx + 1}`,
          desc: toStop ? `Connecting path towards ${toStop.title}.` : `Planned circulation corridor.`,
          notes: `Trace corridor "${route.title || `Corridor ${rIdx + 1}`}". Duration: ${route.duration || 3}s. Sequence position #${rIdx + 1}.`,
          metric: route.duration ? `${Math.round(route.duration * 40)}m • Route #${rIdx + 1}` : `Route #${rIdx + 1}`,
          focusBounds: route.points,
          activeStopId: toStop ? toStop.id : (fromStop ? fromStop.id : null),
          activeStopData: toStop || fromStop || null,
          activeRouteId: route.id,
          activeZoneId: matchingZone ? matchingZone.id : null,
          routeData: route
        });

        // 3. Reveal destination stop if not yet visited
        if (toStop && !visitedStops.has(toStop.id)) {
          visitedStops.add(toStop.id);
          this.steps.push({
            index: this.steps.length,
            type: 'stop',
            title: toStop.title,
            badge: toStop.badge,
            subtitle: `Stop ${toStop.badge || visitedStops.size}`,
            desc: toStop.desc,
            notes: toStop.notes || `Arrival at ${toStop.title}.`,
            metric: toStop.metric || 'Campus Hub',
            tag: toStop.tag || 'Campus Facility',
            focusPoint: { x: toStop.x, y: toStop.y, zoom: 1.35 },
            activeStopId: toStop.id,
            activeStopData: toStop,
            activeRouteId: route.id,
            activeZoneId: matchingZone ? matchingZone.id : null
          });
        }
      });

      // Include any remaining stops that were not connected to routes
      stops.forEach(stop => {
        if (!visitedStops.has(stop.id)) {
          visitedStops.add(stop.id);
          this.steps.push({
            index: this.steps.length,
            type: 'stop',
            title: stop.title,
            badge: stop.badge,
            subtitle: `Stop ${stop.badge || visitedStops.size}`,
            desc: stop.desc,
            notes: stop.notes || `Overview of ${stop.title}.`,
            metric: stop.metric || 'Key Campus Hub',
            tag: stop.tag || 'Campus Facility',
            focusPoint: { x: stop.x, y: stop.y, zoom: 1.35 },
            activeStopId: stop.id,
            activeStopData: stop,
            activeRouteId: null,
            activeZoneId: null
          });
        }
      });
    } else {
      // Fallback if no routes defined: sequence through stops
      stops.forEach(stop => {
        this.steps.push({
          index: this.steps.length,
          type: 'stop',
          title: stop.title,
          badge: stop.badge,
          subtitle: `Stop ${stop.badge}`,
          desc: stop.desc,
          notes: stop.notes || `Overview of ${stop.title}.`,
          metric: stop.metric || 'Key Campus Hub',
          tag: stop.tag || 'Campus Facility',
          focusPoint: { x: stop.x, y: stop.y, zoom: 1.35 },
          activeStopId: stop.id,
          activeStopData: stop,
          activeRouteId: null,
          activeZoneId: null
        });
      });
    }

    // Summary step
    if (this.steps.length > 2) {
      this.steps.push({
        index: this.steps.length,
        type: 'summary',
        title: 'Master Plan Tour Complete',
        subtitle: 'All Routes Active',
        desc: 'Comprehensive route network successfully mapped with all pedestrian and transit legs connected in sequence.',
        notes: 'Summarize key takeaways, address questions from the presentation audience.',
        metric: 'Full Campus Network',
        focusBounds: null,
        activeStopId: null,
        activeRouteId: null,
        activeZoneId: null
      });
    }
  }

  goToStep(stepIndex, triggerAnimation = true) {
    if (stepIndex < 0) stepIndex = 0;
    if (stepIndex >= this.steps.length) stepIndex = this.steps.length - 1;

    this.currentStep = stepIndex;
    const step = this.steps[this.currentStep];

    if (this.activeAnimId) {
      cancelAnimationFrame(this.activeAnimId);
      this.activeAnimId = null;
    }
    this.dom.travelerLayer.innerHTML = '';

    // Adjust camera framing
    if (step.focusPoint) {
      this.engine.panTo(step.focusPoint.x, step.focusPoint.y, step.focusPoint.zoom, 550);
    } else if (step.focusBounds && step.focusBounds.length > 0) {
      this.engine.fitBounds(step.focusBounds, 70, 550);
    } else if (step.type === 'overview' || step.type === 'summary') {
      this.engine.fitToScreen(40);
    }

    // Callout dialog management
    if (step.type === 'stop' && step.activeStopData && this.state.showDialogOnFocus !== false) {
      this.showCalloutDialog(step.activeStopData);
    } else {
      this.hideCalloutDialog();
    }

    // Apply visual highlights
    this.updateVisualsForStep(step, triggerAnimation);

    if (this.onStepChange) {
      this.onStepChange(this.currentStep, step, this.steps.length);
    }
  }

  showCalloutDialog(stop) {
    if (!this.calloutDialog) return;
    this.calloutDialog.style.left = `${stop.x}px`;
    this.calloutDialog.style.top = `${stop.y}px`;
    this.calloutTitle.textContent = stop.title;
    this.calloutBadgeNum.textContent = stop.badge || '●';
    this.calloutBadgeNum.style.background = stop.color || '#DC2626';
    this.calloutDesc.textContent = stop.desc || '';
    this.calloutTag1.textContent = stop.metric || 'Campus Hub';
    this.calloutTag2.textContent = stop.tag || 'Formal Facility';

    this.calloutDialog.classList.remove('hidden');
  }

  hideCalloutDialog() {
    if (this.calloutDialog) {
      this.calloutDialog.classList.add('hidden');
    }
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.goToStep(this.currentStep + 1, true);
    } else if (this.isPlaying) {
      this.pause();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.goToStep(this.currentStep - 1, false);
    }
  }

  play() {
    this.isPlaying = true;
    this.runAutoPlay();
  }

  pause() {
    this.isPlaying = false;
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.currentStep >= this.steps.length - 1) {
        this.goToStep(0, true);
      }
      this.play();
    }
    return this.isPlaying;
  }

  runAutoPlay() {
    if (!this.isPlaying) return;

    if (this.currentStep < this.steps.length - 1) {
      this.nextStep();
      const currentStepObj = this.steps[this.currentStep];
      let delay = 3200;
      if (currentStepObj.type === 'route' && currentStepObj.routeData) {
        delay = (currentStepObj.routeData.duration || 2.5) * 1000 + 1000;
      }
      delay = Math.max(delay / this.speedFactor, 1600);

      this.autoPlayTimer = setTimeout(() => {
        this.runAutoPlay();
      }, delay);
    } else {
      this.pause();
    }
  }

  updateVisualsForStep(step, animate = true) {
    // 1. Highlight Pins
    const pinEls = document.querySelectorAll('.map-pin');
    pinEls.forEach(el => {
      const stopId = el.getAttribute('data-stop-id');
      if (step.activeStopId === stopId) {
        el.classList.add('active-highlight');
      } else {
        el.classList.remove('active-highlight');
      }
    });

    // 2. Highlight Zones
    const zoneEls = document.querySelectorAll('.zone-polygon');
    zoneEls.forEach(el => {
      const zoneId = el.getAttribute('data-zone-id');
      if (step.activeZoneId === zoneId) {
        el.setAttribute('stroke-width', '3');
        el.setAttribute('fill-opacity', '0.35');
      } else {
        el.setAttribute('stroke-width', '2');
        el.setAttribute('fill-opacity', '0.16');
      }
    });

    // 3. Route animation
    if (step.type === 'route' && step.routeData && animate) {
      this.animateRouteTrace(step.routeData);
    } else {
      this.dom.travelerLayer.innerHTML = '';
    }
  }

  animateRouteTrace(route) {
    const pathEl = document.querySelector(`.route-path[data-route-id="${route.id}"]`);
    if (!pathEl) return;

    const totalLength = pathEl.getTotalLength();
    if (!totalLength || totalLength <= 0) return;

    pathEl.style.strokeDasharray = `${totalLength}`;
    pathEl.style.strokeDashoffset = `${totalLength}`;

    const travelerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    travelerGroup.setAttribute('class', 'traveler-token');
    this.dom.travelerLayer.innerHTML = '';
    this.dom.travelerLayer.appendChild(travelerGroup);

    const color = route.color || '#DC2626';
    // Formal moving marker dot
    travelerGroup.innerHTML = `
      <circle cx="0" cy="0" r="10" fill="${color}" fill-opacity="0.3" />
      <circle cx="0" cy="0" r="5" fill="#FFFFFF" stroke="${color}" stroke-width="2" />
    `;

    const duration = ((route.duration || 2.8) * 1000) / this.speedFactor;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentDistance = ease * totalLength;
      pathEl.style.strokeDashoffset = `${totalLength - currentDistance}`;

      if (currentDistance >= 0 && currentDistance <= totalLength) {
        const point = pathEl.getPointAtLength(currentDistance);
        travelerGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);
      }

      if (progress < 1.0) {
        this.activeAnimId = requestAnimationFrame(animate);
      } else {
        pathEl.style.strokeDashoffset = '0';
        this.activeAnimId = null;
      }
    };

    this.activeAnimId = requestAnimationFrame(animate);
  }
}
