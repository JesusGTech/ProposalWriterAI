# ProposalWriterAI Frontend

This is the Vite/React frontend for ProposalWriterAI. It includes the public landing page, auth screens, authenticated proposal dashboard, document upload UI, proposal history, and PDF download flow.

For full project setup, backend details, API endpoints, and deployment notes, see the root [README.md](../README.md).

## Stack

- React 19
- Vite 8
- Plain CSS in `src/index.css` and `src/App.css`
- `react-hot-toast` for user notifications

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

When the app runs on `localhost`, API requests go to `http://localhost:8000`. In deployed environments, requests go to `https://proposalwriterai-api.onrender.com`.

## Scripts

```bash
npm run dev      # Start local Vite dev server
npm run build    # Build production assets
npm run lint     # Run ESLint
npm run preview  # Preview the production build
```

## Key Files

- `src/App.jsx` - Auth flow, dashboard tabs, proposal generation, history, document upload, PDF download.
- `src/Landing.jsx` - Landing page, pricing section, FAQ, legal/security modal content.
- `src/index.css` - Main application and landing page styling.
- `src/assets/` - Logo and image assets.
