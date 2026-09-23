// Formal Campus Master Plan Data with Permanent Labels and Structured Presentation Steps
export const sampleCampusPlan = {
  id: 'campus-masterplan',
  title: 'Campus Master Plan Presentation',
  imageSrc: '/image.png',
  imageWidth: 738,
  imageHeight: 1454,
  showDialogOnFocus: true,
  showPermanentLabels: true,

  // Formal Presentation Stops (Milestones)
  stops: [
    {
      id: 'stop-1',
      badge: 1,
      title: 'Main Campus Administration (1)',
      desc: 'Primary administrative hub, executive offices, board room, and student welcome center.',
      x: 522,
      y: 1029,
      color: '#DC2626',
      metric: 'Arrival Hub • South Gate',
      tag: 'Admin & Governance',
      notes: 'Begin presentation at Main Administration 1. Highlight vehicular drop-off and proximity to the southern parking zone.'
    },
    {
      id: 'stop-2',
      badge: 18,
      title: 'Innovation & Research Pavilion (18)',
      desc: 'Collaborative research facility, incubation labs, and central campus courtyard.',
      x: 572,
      y: 820,
      color: '#2563EB',
      metric: '180m • 2.5 min transit',
      tag: 'Research & Labs',
      notes: 'Transition along the central pedestrian spine to Innovation Pavilion 18. Emphasize sheltered walkways.'
    },
    {
      id: 'stop-3',
      badge: 5,
      title: 'Academic Engineering Wing (5)',
      desc: 'Specialized departmental lecture halls, smart teaching facilities, and faculty suites.',
      x: 615,
      y: 673,
      color: '#D97706',
      metric: '140m • 2.0 min transit',
      tag: 'Academic Facility',
      notes: 'Direct connection to Engineering Wing 5. Highlight classroom capacity and internal corridor connections.'
    },
    {
      id: 'stop-4',
      badge: 7,
      title: 'Athletic Arena & Sports Complex (7)',
      desc: 'Full-size regulation football pitch, dual tennis courts, athletic pavilion, and team facilities.',
      x: 121,
      y: 773,
      color: '#16A34A',
      metric: '450m • West Campus Corridor',
      tag: 'Recreation & Sports',
      notes: 'Conclude at Sports Complex 7. Emphasize western cross-campus connector for both pedestrians and campus electric shuttles.'
    }
  ],

  // Permanent Map Labels (always visible for geographic & facility orientation)
  permanentLabels: [
    {
      id: 'label-1',
      text: 'To Rajankunte Road\nNorth Arterial Way',
      x: 660,
      y: 120,
      fontFamily: 'Space Mono',
      fontSize: 10,
      style: 'road-style'
    },
    {
      id: 'label-2',
      text: 'To Dibburu Village\nSecondary Route',
      x: 440,
      y: 345,
      fontFamily: 'Space Mono',
      fontSize: 10,
      style: 'road-style'
    },
    {
      id: 'label-3',
      text: 'Regulation Football Pitch\nFIFA Standard 105x68m',
      x: 160,
      y: 720,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 11,
      style: 'default'
    },
    {
      id: 'label-4',
      text: 'Championship Tennis Courts\nDual Surface Courts',
      x: 385,
      y: 645,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 11,
      style: 'default'
    },
    {
      id: 'label-5',
      text: 'Open Air Amphitheatre\n1,200 Seating Bowl',
      x: 630,
      y: 915,
      fontFamily: 'Playfair Display',
      fontSize: 12,
      style: 'default'
    },
    {
      id: 'label-6',
      text: 'Main Vehicular Access Spine\n4-Lane Boulevard',
      x: 685,
      y: 480,
      fontFamily: 'Oswald',
      fontSize: 11,
      style: 'dark-style'
    },
    {
      id: 'label-7',
      text: 'South Arrival & Parking\nGate 1 • 450 Bays',
      x: 680,
      y: 1395,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 11,
      style: 'blueprint-style'
    }
  ],

  // Route Corridors linking milestones
  routes: [
    {
      id: 'route-1',
      fromStopId: 'stop-1',
      toStopId: 'stop-2',
      title: 'Admin to Innovation Corridor',
      color: '#DC2626',
      strokeWidth: 4,
      style: 'formal',
      avatar: 'dot',
      duration: 2.8,
      arrowEnd: true,
      arrowStyle: 'end',
      arrowSize: 'standard',
      points: [
        { x: 522, y: 1029 },
        { x: 524, y: 960 },
        { x: 546, y: 915 },
        { x: 554, y: 865 },
        { x: 572, y: 820 }
      ]
    },
    {
      id: 'route-2',
      fromStopId: 'stop-2',
      toStopId: 'stop-3',
      title: 'Plaza to Academic Wing 5',
      color: '#2563EB',
      strokeWidth: 4,
      style: 'formal',
      avatar: 'dot',
      duration: 2.4,
      arrowEnd: true,
      arrowStyle: 'end',
      arrowSize: 'standard',
      points: [
        { x: 572, y: 820 },
        { x: 590, y: 770 },
        { x: 605, y: 715 },
        { x: 615, y: 673 }
      ]
    },
    {
      id: 'route-3',
      fromStopId: 'stop-3',
      toStopId: 'stop-4',
      title: 'Cross-Campus Connector to Sports Arena',
      color: '#16A34A',
      strokeWidth: 4.5,
      style: 'formal',
      avatar: 'dot',
      duration: 3.8,
      arrowEnd: true,
      arrowStyle: 'end',
      arrowSize: 'standard',
      points: [
        { x: 615, y: 673 },
        { x: 540, y: 695 },
        { x: 440, y: 700 },
        { x: 350, y: 710 },
        { x: 335, y: 770 },
        { x: 245, y: 772 },
        { x: 121, y: 773 }
      ]
    }
  ],

  // Formal Highlight Boundaries
  zones: [
    {
      id: 'zone-1',
      title: 'Sports Complex Zone 7',
      color: '#16A34A',
      fillOpacity: 0.18,
      strokeWidth: 2,
      points: [
        { x: 35, y: 645 },
        { x: 250, y: 645 },
        { x: 250, y: 920 },
        { x: 35, y: 920 }
      ]
    },
    {
      id: 'zone-2',
      title: 'Engineering Wing Perimeter',
      color: '#D97706',
      fillOpacity: 0.16,
      strokeWidth: 2,
      points: [
        { x: 445, y: 630 },
        { x: 655, y: 630 },
        { x: 655, y: 715 },
        { x: 445, y: 715 }
      ]
    }
  ]
};
