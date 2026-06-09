# ProposalWriterAI

ProposalWriterAI is a full-stack SaaS app for generating client-ready business proposals with Claude AI. Users can sign up, upload company knowledge documents, generate proposals from a short form, review prior proposals, and export proposals as formatted PDFs.

Live app: https://proposal-writer-ai.vercel.app

## Features

- **AI proposal generation** - Claude writes complete proposals from client details, your solution, pricing, and company context.
- **Company document grounding** - Users can upload PDF or TXT documents such as service descriptions, pricing sheets, and case studies.
- **Proposal history** - Generated proposals are saved per user and can be opened again later.
- **PDF export** - Proposals are converted to branded, client-ready PDF downloads with ReportLab.
- **Supabase authentication** - Email/password signup and login with bearer-token protected API routes.
- **Private user data** - Documents, proposals, and subscription records are scoped by the authenticated Supabase user.
- **Landing, pricing, and legal pages** - The frontend includes the marketing page, pricing cards, FAQ, privacy, terms, and security modal content.
- **Stripe backend support** - The API includes checkout-session, webhook, and subscription-check endpoints for a Pro subscription flow.

## Tech Stack

### Frontend

- React 19
- Vite 8
- Plain CSS in `frontend/src/index.css` and `frontend/src/App.css`
- `react-hot-toast` for notifications
- Supabase JS client dependency available in the frontend package
- Vercel deployment

### Backend

- FastAPI
- Uvicorn
- Anthropic Claude API
- Supabase Auth and PostgreSQL
- PyPDF2 for PDF text extraction
- ReportLab for PDF generation
- Stripe Python SDK for subscription endpoints
- Render deployment

## Project Structure

```text
ProposalWriterAI/
├── backend/
│   ├── main.py              # FastAPI app, auth, proposals, documents, PDFs, Stripe endpoints
│   ├── requirements.txt     # Python dependencies
│   ├── runtime.txt          # Render Python runtime
│   └── .env.example         # Backend environment variable template
├── frontend/
│   ├── public/              # Icons and static assets
│   ├── src/
│   │   ├── App.jsx          # Authenticated dashboard and proposal workflow
│   │   ├── Landing.jsx      # Landing page, pricing, FAQ, legal/security modals
│   │   ├── index.css        # Main styling
│   │   ├── App.css
│   │   └── assets/          # Logo and image assets
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project
- An Anthropic API key
- Stripe keys if you want to test subscription endpoints

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
STRIPE_SECRET_KEY=sk_test_your-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

Run the backend:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The frontend uses `http://localhost:8000` when running on `localhost`; otherwise it calls the deployed API at `https://proposalwriterai-api.onrender.com`.

## Supabase Setup

The backend expects these tables to exist:

- `documents` - uploaded document text and metadata
- `proposals` - generated proposal inputs and output text
- `subscriptions` - Stripe-backed plan status

The app code scopes queries by `user_id`. In production, keep Row Level Security enabled and add policies so users can only access rows where `user_id = auth.uid()`.

## API Endpoints

### Health

- `GET /` - API status check

### Authentication

- `POST /auth/signup` - Create a Supabase Auth user
- `POST /auth/login` - Sign in and return the Supabase session token

### Documents

- `POST /documents/upload` - Upload a PDF or TXT document
- `GET /documents` - List the authenticated user's documents
- `DELETE /documents/{document_id}` - Delete one of the authenticated user's documents

### Proposals

- `POST /generate-proposal` - Generate and save a proposal using Claude
- `GET /proposals` - List saved proposals for the authenticated user
- `POST /proposals/{proposal_id}/download` - Generate a PDF download payload for a saved proposal

### Billing

- `POST /create-checkout-session` - Create a Stripe subscription checkout session
- `POST /webhook/stripe` - Receive Stripe subscription events and update Supabase
- `GET /check-subscription` - Return the authenticated user's current plan status

## How Proposal Generation Works

1. The user logs in and optionally uploads company documents.
2. Uploaded PDFs are parsed with PyPDF2; TXT files are decoded as UTF-8.
3. Document text is stored in Supabase.
4. When the user generates a proposal, the backend retrieves that user's documents and injects document excerpts into the Claude prompt.
5. Claude returns a structured proposal with sections such as Executive Summary, The Problem, Our Solution, Investment, and Next Steps.
6. The proposal is saved to Supabase and can be downloaded as a PDF.

This is context injection over stored documents, not vector-search RAG yet.

## Deployment

### Frontend on Vercel

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

### Backend on Render

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Runtime: Python 3.11.7 from `backend/runtime.txt`

Set the same backend environment variables in Render:

- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Current Notes

- Stripe backend endpoints exist, but the frontend dashboard does not currently complete the checkout flow or enforce free/pro usage limits.
- Document grounding currently sends document excerpts directly in the Claude prompt. Vector embeddings and semantic retrieval would be a future improvement.
- The repository does not currently include Supabase migration files, so database tables and RLS policies must be created separately.

## Useful Commands

```bash
# Frontend
cd frontend
npm run dev
npm run build
npm run lint

# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

## Future Enhancements

- Add Supabase migrations and documented RLS policies
- Wire the Stripe checkout flow into the frontend
- Enforce free/pro proposal limits server-side
- Add vector embeddings for semantic document retrieval
- Add proposal templates and editing workflows
- Add CRM or email integrations
