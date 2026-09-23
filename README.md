# RouteCraft Studio

A professional route planning and presentation tool for campus master plans, architectural blueprints, and executive presentations with on-click PPT transitions and direct PowerPoint (.pptx) export.

---

## Deploy to Vercel

### Method 1: Deploy with Git (Recommended)

1. Push this repository to your **GitHub**, **GitLab**, or **Bitbucket** account:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your repository.
4. Vercel automatically detects the configuration from `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. Your site will be live on a `*.vercel.app` URL within seconds!

---

### Method 2: Deploy with Vercel CLI

You can also deploy directly from your local terminal:
```bash
# 1. Install or run Vercel CLI
npx vercel

# 2. Deploy to production
npx vercel --prod
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Features
- **Formal Presentation Design System**: Clean architectural slate & navy corporate styling.
- **Permanent Map Labels**: Continuous landmark labels across the campus master plan.
- **Anchored Callout Dialog Box**: Focus dialog box automatically positioned on active milestone stops.
- **Fullscreen PPT Presentation Mode**: Step through animation on click or with Space/Right Arrow.
- **Direct PowerPoint Export (.pptx)**: Generates progressive reveal slide decks with speaker notes.
- **60FPS Video Export**: Records animations for inserting into PowerPoint slides with native "Play on Click".
