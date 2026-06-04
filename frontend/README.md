# ProposalWriterAI

An AI-powered SaaS platform that helps B2B sales teams create professional business proposals in minutes using Claude AI and company-specific knowledge management.

**Live Demo:** https://proposal-writer-ai.vercel.app

---

## Overview

ProposalWriterAI solves a real pain point: sales teams spend hours writing proposals manually. This platform uses AI to generate customized, professional proposals in seconds—grounded in your company's actual services, pricing, and case studies.

### Key Features

- **AI Proposal Generation** — Generate complete business proposals in seconds using Claude
- **Retrieval-Augmented Generation (RAG)** — Upload your company docs; Claude uses them to write company-specific proposals
- **PDF Export** — Download beautifully formatted proposals ready to send to clients
- **User Authentication** — Secure signup/login with Supabase Auth
- **Proposal History** — Track, manage, and download all generated proposals
- **Document Management** — Upload, organize, and delete company documents
- **Multi-tenant Architecture** — Each user's data is completely private and isolated

---

## Tech Stack

### Frontend
- **React 18** + Vite
- **Tailwind CSS** (inline styles for simplicity)
- **Vercel** (deployment)

### Backend
- **FastAPI** (Python web framework)
- **Supabase** (PostgreSQL database + authentication)
- **Claude AI API** (proposal generation)
- **ReportLab** (PDF generation)
- **PyPDF2** (document parsing)

### Database
- **Supabase PostgreSQL** with Row Level Security (RLS)
- **pgvector** extension for future vector embeddings

---

## How It Works

1. **Sign up** with email and password
2. **Upload documents** (optional) — company info, pricing, case studies, service descriptions
3. **Fill proposal form** — client name, problem, your solution, price
4. **Generate proposal** — Claude AI creates a custom proposal using your documents as context
5. **Download PDF** — Export as a professional, branded PDF to send to clients

### RAG Pipeline

When you generate a proposal:
1. Backend retrieves your uploaded documents from Supabase
2. Documents are injected into the Claude prompt as context
3. Claude generates a proposal grounded in your actual business info
4. Proposal is stored in database for future reference

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git
- Supabase account (free tier works)
- Anthropic API key (Claude access)

### Local Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/ProposalWriterAI
cd ProposalWriterAI
```

**2. Set up backend**
```bash
cd backend
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

**3. Create backend environment variables**
Create `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx
```

**4. Set up frontend**
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

Open http://localhost:5173 and start using the app.

---

## API Endpoints

### Authentication
- `POST /auth/signup` — Create a new user account
- `POST /auth/login` — Log in with email and password

### Proposals
- `POST /generate-proposal` — Generate a new proposal (requires auth)
- `GET /proposals` — Get all proposals for logged-in user
- `POST /proposals/{id}/download` — Download proposal as PDF

### Documents (RAG)
- `POST /documents/upload` — Upload a document (PDF or TXT)
- `GET /documents` — Get all uploaded documents for user
- `DELETE /documents/{id}` — Delete a document

### Health
- `GET /` — Check API status

---

## Project Structure

```
proposalwriterai/
├── backend/
│   ├── main.py                 # FastAPI application & endpoints
│   ├── requirements.txt         # Python dependencies
│   ├── runtime.txt             # Python version for Render
│   └── .env.example            # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main React component
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect repo to Vercel
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Vercel auto-deploys on every push

### Backend (Render)

1. Connect GitHub repo to Render
2. Create web service with:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0`
   - **Root Directory:** `backend`
3. Add environment variables in Render dashboard:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Render auto-deploys on push to main

---

## Key Implementation Details

### Authentication Flow
- Supabase Auth handles signup/login
- JWT tokens stored in frontend state
- Tokens sent in `Authorization: Bearer` header for API requests
- Backend validates tokens against Supabase

### RAG Implementation
- User uploads documents (PDF or TXT)
- Backend parses documents and stores in Supabase
- When generating proposals, backend queries documents
- Documents injected into Claude prompt as context
- Claude generates proposal grounded in real company info

### PDF Generation
- Backend uses ReportLab to generate PDFs
- PDF binary converted to hex string for JSON transfer
- Frontend converts hex back to binary and downloads

### Security
- Row Level Security (RLS) on all database tables
- Users can only see their own data
- Authenticated endpoints verify user tokens
- Environment variables kept secret (not in repo)

---

## Learning Outcomes

Building this project taught me:

- **Full-stack development** — frontend, backend, database all working together
- **Authentication** — implementing secure user signup/login with tokens
- **RAG (Retrieval-Augmented Generation)** — grounding AI models with custom data
- **AI integration** — using Claude API effectively in production
- **Database design** — schema planning, security, multi-tenancy
- **Deployment** — getting a real app live on Vercel and Render
- **API design** — RESTful endpoints, error handling, CORS
- **Document processing** — parsing PDFs, storing structured data

---

## Future Enhancements

- [ ] Vector embeddings (pgvector) for semantic search of documents
- [ ] Stripe integration for monetization ($19-29/month pricing)
- [ ] Analytics dashboard (PostHog) to track user behavior
- [ ] Team collaboration — invite team members to accounts
- [ ] Custom proposal templates by industry
- [ ] CRM integrations (Salesforce, HubSpot)
- [ ] Email integration — send proposals directly to clients
- [ ] Proposal versioning — track edits and iterations
- [ ] Acceptance tracking — see when clients open proposals

---

## Performance Notes

### Current Limitations
- Render free tier spins down after 15 min of inactivity (50s startup delay)
- Claude API calls take 2-5 seconds per proposal
- PDF generation takes 1-2 seconds

### Optimization Ideas
- Cache frequently used documents
- Implement proposal templates to reduce API calls
- Use Claude smaller models for drafts, larger for finals
- Add background job queue for batch proposal generation

---

## Security Considerations

- ✅ Environment variables never committed to repo
- ✅ Row Level Security on all database tables
- ✅ Auth tokens required for all user endpoints
- ✅ CORS configured to allow only frontend domain
- ✅ User data isolated per account
- ✅ No hardcoded credentials

**To improve:** Add rate limiting, request logging, and audit trails for production.

---

## License

MIT

---

## Questions?

This was built as a portfolio project to demonstrate full-stack development, AI integration, and SaaS architecture. For questions or feedback, feel free to reach out!

**My Background:** Built this while learning full-stack development with a focus on AI-powered applications. Previously worked on AI education research with Claude models.