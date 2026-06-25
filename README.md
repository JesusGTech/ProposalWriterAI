# ProposalWriterAI

ProposalWriterAI is a full-stack SaaS app for generating client-ready business proposals with Claude AI. Users can sign up, upload company knowledge documents, generate proposals from a short form, review prior proposals, and export proposals as formatted PDFs.

Live app: https://proposal-writer-ai.vercel.app

## Features

- **AI proposal generation** - Claude writes complete proposals from client details, your solution, pricing, and company context.
- **Streaming output** - Proposals stream into the UI token-by-token over Server-Sent Events as Claude writes them.
- **Win/loss learning** - Mark past proposals as won, lost, or pending; winning proposals are fed back into new generations as positive examples and losing ones as patterns to avoid.
- **Company document grounding** - Users can upload PDF or TXT documents such as service descriptions, pricing sheets, and case studies.
- **In-app editing & regenerate** - Generated proposals can be edited in place, regenerated from the same inputs, or copied to the clipboard.
- **Proposal history** - Generated proposals are saved per user and can be opened again later.
- **PDF export** - Proposals are converted to branded, client-ready PDF downloads with ReportLab.
- **Supabase authentication** - Email/password signup and login with bearer-token protected API routes.
- **Private user data** - Documents, proposals, and subscription records are scoped by the authenticated Supabase user.
- **Free-tier limits & upgrade** - Free accounts are capped at a server-enforced proposal limit, with an in-app usage indicator and Stripe Checkout upgrade to Pro.
- **Landing, pricing, and legal pages** - The frontend includes the marketing page, pricing cards, FAQ, privacy, terms, and security modal content.
- **Stripe subscription support** - The API includes checkout-session, webhook, and subscription-check endpoints for a Pro subscription flow.

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

### Win/loss tracking column

The win/loss learning feature requires a `status` column on `proposals`. Run this once in
the Supabase SQL editor (there is no migration system in the repo, so schema changes are
applied manually):

```sql
ALTER TABLE proposals ADD COLUMN status text DEFAULT 'pending'; -- values: won | lost | pending
```

This backfills existing rows to `pending`. Until this column exists, proposal generation
still works normally (the outcome lookup fails open and simply contributes nothing), but
marking a proposal won/lost will error.

The `proposals` table also needs an **UPDATE** RLS policy (separate from SELECT/INSERT) for
both win/loss marking and in-app text editing to work. If updates return "proposal not
found" even though the proposal is visible, add:

```sql
create policy "Users can update own proposals"
on proposals for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

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

- `POST /generate-proposal` - Generate and save a proposal using Claude (non-streaming)
- `POST /generate-proposal-stream` - Generate a proposal and stream it token-by-token via Server-Sent Events, then save it
- `GET /proposals` - List saved proposals for the authenticated user
- `PATCH /proposals/{proposal_id}` - Update a proposal's text (in-app editor) and/or its win/loss `status`
- `POST /proposals/{proposal_id}/download` - Generate a PDF download payload for a saved proposal

### Billing

- `POST /create-checkout-session` - Create a Stripe subscription checkout session (returns the Checkout URL)
- `POST /webhook/stripe` - Receive Stripe subscription events and update Supabase
- `GET /check-subscription` - Return the authenticated user's current plan status
- `GET /usage` - Return the user's plan plus their proposal count and remaining free allowance

## How Proposal Generation Works

1. The user logs in and optionally uploads company documents.
2. Uploaded PDFs are parsed with PyPDF2; TXT files are decoded as UTF-8.
3. Document text is stored in Supabase.
4. When the user generates a proposal, the backend retrieves that user's documents and injects document excerpts into the Claude prompt.
5. The backend also pulls the user's most recent **won** and **lost** proposals (if any) and injects them — winners as examples to mirror, losers as patterns to avoid (excerpts are truncated to keep token cost bounded).
6. Claude streams back a structured proposal with sections such as Executive Summary, The Problem, Our Solution, Investment, and Next Steps; the frontend renders it live as it arrives.
7. The proposal is saved to Supabase and can be edited, regenerated, marked won/lost, or downloaded as a PDF.

This is context injection over stored documents and past outcomes, not vector-search RAG yet.

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

- The Stripe checkout flow is wired into the dashboard and free-tier proposal limits are enforced server-side. `STRIPE_WEBHOOK_SECRET` is still required for the webhook that flips a user to Pro after payment.
- Document and outcome grounding currently send excerpts directly in the Claude prompt. Vector embeddings and semantic retrieval would be a future improvement.
- The repository does not currently include Supabase migration files, so database tables, the `proposals.status` column, and RLS policies must be created manually (see Supabase Setup).

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
- Add vector embeddings for semantic document and outcome retrieval
- Weight outcome examples by similarity to the current client, not just recency
- Add proposal templates
- Add CRM or email integrations
