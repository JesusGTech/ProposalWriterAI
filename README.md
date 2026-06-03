# ProposalWriterAI

An AI-powered SaaS platform that helps B2B sales teams create professional business proposals in minutes.

## Features

- **AI Proposal Generation** — Generate complete proposals in seconds using Claude AI
- **Document Upload** — Upload your company info, pricing, case studies. Claude uses them to write company-specific proposals
- **PDF Export** — Download beautifully formatted proposals as PDFs
- **User Authentication** — Secure signup and login with Supabase Auth
- **Proposal History** — Track and manage all your generated proposals
- **Multi-tenant** — Each user's data is completely private and isolated

## Tech Stack

### Frontend
- React + Vite
- Tailwind CSS (inline styles for simplicity)

### Backend
- FastAPI (Python)
- Supabase (Auth + Database)
- Claude AI API
- ReportLab (PDF generation)

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: Supabase

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Setup

**1. Clone the repo**
```bash
git clone <your-repo-url>
cd proposalwriterai
```

**2. Backend setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

**3. Environment variables**
Create `backend/.env`:
ANTHROPIC_API_KEY=your_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

**4. Frontend setup**
```bash
cd ../frontend
npm install
```

**5. Run locally**

Terminal 1 (backend):
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`

## How It Works

1. **Sign up** with email and password
2. **Upload documents** (optional) — company info, pricing, case studies
3. **Fill proposal form** — client name, problem, your solution, price
4. **Generate proposal** — Claude creates a custom proposal using your docs
5. **Download PDF** — Export as a professional PDF to send to clients

## API Endpoints

- `POST /auth/signup` — Create account
- `POST /auth/login` — Log in
- `POST /generate-proposal` — Generate a proposal
- `POST /proposals/{id}/download` — Download proposal as PDF
- `GET /proposals` — Get user's proposals
- `POST /documents/upload` — Upload company document
- `GET /documents` — Get user's documents
- `DELETE /documents/{id}` — Delete document

## Deployment

### Frontend (Vercel)
```bash
git push origin main
```
Vercel auto-deploys on every push.

### Backend (Render)
Set environment variables in Render dashboard, then push code. Auto-deploys.

## Future Enhancements

- [ ] RAG with vector embeddings for smarter context
- [ ] Stripe integration for monetization
- [ ] Analytics dashboard
- [ ] Team collaboration features
- [ ] CRM integrations (Salesforce, HubSpot)
- [ ] Custom proposal templates

