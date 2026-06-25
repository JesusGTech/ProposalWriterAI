from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic
import os
import re
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
import uuid
from PyPDF2 import PdfReader
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import inch
import logging
import stripe

# Load environment variables
load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000", "https://proposal-writer-ai.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Initialize Supabase
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Initialize Anthropic client globally
anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def get_auth(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.postgrest.auth(token)
    
    return client, user


# Free plan allowance (enforced server-side)
FREE_PROPOSAL_LIMIT = 3

# Data models
class ProposalRequest(BaseModel):
    client_name: str
    client_problem: str
    your_solution: str
    price: str
    your_name: str
    your_company: str

class ProposalUpdate(BaseModel):
    proposal_text: str | None = None
    status: str | None = None  # "won" | "lost" | "pending"

class SignupRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# Endpoints
@app.get("/")
def read_root():
    return {"message": "ProposalWriterAI API is running!"}

@app.post("/auth/signup")
def signup(request: SignupRequest):
    try:
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })
        return {
            "user": response.user.dict() if response.user else None,
            "session": response.session.dict() if response.session else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
def login(request: LoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        return {
            "user": response.user.dict() if response.user else None,
            "session": response.session.dict() if response.session else None,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
@app.post("/documents/upload")
def upload_document(file: UploadFile = File(...), auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id

    # Read file content
    try:
        if file.filename.endswith('.pdf'):
            # Parse PDF
            pdf_reader = PdfReader(file.file)
            content = ""
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    content += text + "\n"
        else:
            # Read as plain text
            file_bytes = file.file.read()
            content = file_bytes.decode('utf-8')
        
        # Save to database
        db_client.table("documents").insert({
            "user_id": user_id,
            "filename": file.filename,
            "content": content,
        }).execute()

        return {
            "message": "Document uploaded successfully",
            "filename": file.filename,
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/documents")
def get_documents(auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id
    try:
        response = db_client.table("documents").select("id, filename, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        return {"documents": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{document_id}")
def delete_document(document_id: str, auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id
    try:
        db_client.table("documents").delete().eq("id", document_id).eq("user_id", user_id).execute()
        return {"message": "Document deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _is_subscribed(db_client, user_id) -> bool:
    """Return True if the user has an active Pro subscription."""
    try:
        res = db_client.table("subscriptions").select("status").eq("user_id", user_id).execute()
        return bool(res.data) and res.data[0].get("status") == "active"
    except Exception as e:
        logger.error(f"Error checking subscription: {e}")
        return False

def _proposal_count(db_client, user_id) -> int:
    """Return how many proposals the user has generated."""
    try:
        res = db_client.table("proposals").select("id", count="exact").eq("user_id", user_id).execute()
        if res.count is not None:
            return res.count
        return len(res.data or [])
    except Exception as e:
        logger.error(f"Error counting proposals: {e}")
        return 0

def _enforce_free_limit(db_client, user_id):
    """Raise 402 if a free user has exhausted their proposal allowance."""
    if not _is_subscribed(db_client, user_id) and _proposal_count(db_client, user_id) >= FREE_PROPOSAL_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"You've used all {FREE_PROPOSAL_LIMIT} free proposals. Upgrade to Pro for unlimited proposals.",
        )

def _fetch_doc_context(db_client, user_id) -> str:
    """Build the company knowledge-base context block from uploaded documents."""
    try:
        docs_response = db_client.table("documents").select("content").eq("user_id", user_id).execute()
        user_docs = docs_response.data
        return "\n\n".join([f"Document: {doc['content'][:500]}..." for doc in user_docs]) if user_docs else "No documents uploaded"
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        return "No documents available"

# How many past outcomes to feed back into each new proposal, and how much
# of each to include (chars) so the prompt stays bounded in tokens/cost.
WON_EXAMPLES_LIMIT = 3
LOST_EXAMPLES_LIMIT = 2
OUTCOME_EXCERPT_CHARS = 1200

def _fetch_outcome_context(db_client, user_id) -> str:
    """Build a context block from the user's past won/lost proposals.

    Winning proposals are presented as positive examples to mirror; losing ones
    as patterns to avoid. Returns "" when the user has no graded outcomes yet.
    """
    def _recent(status, limit):
        try:
            res = (
                db_client.table("proposals")
                .select("proposal_text")
                .eq("user_id", user_id)
                .eq("status", status)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return [r["proposal_text"][:OUTCOME_EXCERPT_CHARS] for r in (res.data or []) if r.get("proposal_text")]
        except Exception as e:
            logger.error(f"Error fetching {status} proposals: {e}")
            return []

    won = _recent("won", WON_EXAMPLES_LIMIT)
    lost = _recent("lost", LOST_EXAMPLES_LIMIT)

    blocks = []
    if won:
        examples = "\n\n---\n\n".join(won)
        blocks.append(
            "PROVEN WINNING PROPOSALS — these closed real deals. Study and mirror their "
            "tone, structure, framing, and persuasive moves. Do NOT copy their "
            "client-specific facts; adapt the approach to the new client below:\n\n"
            f"{examples}"
        )
    if lost:
        examples = "\n\n---\n\n".join(lost)
        blocks.append(
            "PROPOSALS THAT LOST — avoid the framing, weaknesses, or patterns in these:\n\n"
            f"{examples}"
        )
    return "\n\n".join(blocks)

def _build_prompt(request: ProposalRequest, doc_context: str, outcome_context: str = "") -> str:
    outcome_section = f"\n{outcome_context}\n" if outcome_context else ""
    return f"""
You are a senior business development consultant who has spent 15 years writing proposals that close deals.
You write the way experienced professionals actually communicate — clear, direct, confident, and warm.
Not corporate fluff. Not AI-speak. Real sentences that a human would write to another human.

CONTEXT:
- You are writing on behalf of: {request.your_name} at {request.your_company}
- The client is: {request.client_name}
- Their core problem: {request.client_problem}
- The proposed solution: {request.your_solution}
- Investment: {request.price}

COMPANY KNOWLEDGE BASE:
{doc_context}
{outcome_section}
WRITING RULES — follow these strictly:
1. Never use hollow filler phrases like "In today's fast-paced world", "leverage", "utilize", "synergy", "cutting-edge", "robust", "seamlessly", "game-changer", or "revolutionary"
2. Never start a section by restating the section title as a sentence
3. Never use passive voice when active voice works
4. Write short paragraphs — 2 to 4 sentences max
5. Use specific details, numbers, and real examples from the company knowledge base
6. Sound like a trusted advisor writing to a peer, not a salesperson pitching a stranger
7. Vary sentence length — mix short punchy sentences with longer explanatory ones
8. Never bullet-point everything — use prose for storytelling, bullets only for lists of 3 or more concrete items

STRUCTURE — use these exact section headers:
## Executive Summary
One strong paragraph. What the client needs, what you're proposing, and why it works. No fluff. Make them want to keep reading.

## The Problem
Show you deeply understand their situation. Be specific. Reference their actual problem. Make them feel heard, not sold to.

## Our Solution
Explain what you're doing and why it works for them specifically. Reference your actual services and capabilities from the knowledge base if available. Be concrete, not vague.

## Investment
State the price clearly: {request.price}
Briefly frame the value — what they get, why it's worth it. Keep it short and confident. Don't oversell.

## Next Steps
3 to 4 clear, specific action items. Tell them exactly what happens next. Make it easy to say yes.

TONE: Think of the best proposal you've ever read — the one that felt like it was written specifically for you by someone who truly got your problem. Write like that.

If the company knowledge base has real details (services, pricing, case studies, results), weave them naturally into the narrative. Don't list them — use them as evidence.
"""

def _save_proposal(db_client, user_id, request: ProposalRequest, proposal_text: str) -> str:
    """Persist a generated proposal and return its id."""
    proposal_id = str(uuid.uuid4())
    db_client.table("proposals").insert({
        "id": proposal_id,
        "user_id": user_id,
        "client_name": request.client_name,
        "client_problem": request.client_problem,
        "your_solution": request.your_solution,
        "price": request.price,
        "your_name": request.your_name,
        "your_company": request.your_company,
        "proposal_text": proposal_text,
        "created_at": datetime.now().isoformat(),
    }).execute()
    return proposal_id

@app.post("/generate-proposal")
def generate_proposal(request: ProposalRequest, auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id
    logger.info(f"Proposal generation requested for client: {request.client_name}")

    _enforce_free_limit(db_client, user_id)
    doc_context = _fetch_doc_context(db_client, user_id)
    outcome_context = _fetch_outcome_context(db_client, user_id)
    prompt = _build_prompt(request, doc_context, outcome_context)

    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        proposal_text = message.content[0].text
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to generate proposal from AI: {str(e)}")

    try:
        proposal_id = _save_proposal(db_client, user_id, request, proposal_text)
    except Exception as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save generated proposal to database: {str(e)}")

    logger.info(f"Proposal generated successfully. ID: {proposal_id}")
    return {
        "proposal": proposal_text,
        "proposal_id": proposal_id,
    }

@app.post("/generate-proposal-stream")
def generate_proposal_stream(request: ProposalRequest, auth = Depends(get_auth)):
    """Stream the proposal token-by-token via Server-Sent Events, then persist it."""
    db_client, user = auth
    user_id = user.user.id
    logger.info(f"Streaming proposal requested for client: {request.client_name}")

    _enforce_free_limit(db_client, user_id)
    doc_context = _fetch_doc_context(db_client, user_id)
    outcome_context = _fetch_outcome_context(db_client, user_id)
    prompt = _build_prompt(request, doc_context, outcome_context)

    def event_stream():
        full_text = ""
        try:
            with anthropic_client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    full_text += text
                    yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"
        except Exception as e:
            logger.error(f"Claude streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Failed to generate proposal from AI'})}\n\n"
            return

        try:
            proposal_id = _save_proposal(db_client, user_id, request, full_text)
        except Exception as e:
            logger.error(f"Database error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Failed to save the generated proposal'})}\n\n"
            return

        logger.info(f"Streamed proposal generated successfully. ID: {proposal_id}")
        yield f"data: {json.dumps({'type': 'done', 'proposal_id': proposal_id})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering so chunks flush immediately
        },
    )

def parse_markdown_to_paragraph(line: str, styles) -> Paragraph:
    line = line.strip()
    
    # Replace markdown bold (**text**) with HTML bold (<b>text</b>)
    line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
    # Replace markdown italic (*text*) with HTML italic (<i>text</i>)
    line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line)
    
    if line.startswith("### "):
        text = line[4:]
        style = ParagraphStyle(
            'Heading3_Custom',
            parent=styles['Heading3'],
            textColor='#6c47ff',
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True
        )
        return Paragraph(text, style)
    elif line.startswith("## "):
        text = line[3:]
        style = ParagraphStyle(
            'Heading2_Custom',
            parent=styles['Heading2'],
            textColor='#6c47ff',
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True
        )
        return Paragraph(text, style)
    elif line.startswith("# "):
        text = line[2:]
        style = ParagraphStyle(
            'Heading1_Custom',
            parent=styles['Heading1'],
            textColor='#6c47ff',
            spaceBefore=18,
            spaceAfter=10,
            keepWithNext=True
        )
        return Paragraph(text, style)
    elif line.startswith("- ") or line.startswith("* "):
        text = line[2:]
        return Paragraph(f"&bull; {text}", styles['Normal'])
    else:
        return Paragraph(line, styles['Normal'])

@app.post("/proposals/{proposal_id}/download")
def download_proposal(proposal_id: str, auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id
    # Get the proposal from database
    try:
        response = db_client.table("proposals").select("*").eq("id", proposal_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Proposal not found")
        proposal = response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Generate PDF with ReportLab
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor
        import io
        import re

        pdf_buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            rightMargin=0.85*inch,
            leftMargin=0.85*inch,
            topMargin=1*inch,
            bottomMargin=1*inch,
        )

        # Color palette
        COLOR_PRIMARY   = HexColor("#1a1a2e")
        COLOR_ACCENT    = HexColor("#6055ff")
        COLOR_TEXT      = HexColor("#2c2c3e")
        COLOR_MUTED     = HexColor("#6b6b80")
        COLOR_BORDER    = HexColor("#e0e0ee")

        # Styles
        styles = getSampleStyleSheet()

        style_h1 = ParagraphStyle(
            "H1", parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22, leading=28,
            textColor=COLOR_PRIMARY,
            spaceAfter=6,
        )
        style_h2 = ParagraphStyle(
            "H2", parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14, leading=20,
            textColor=COLOR_ACCENT,
            spaceBefore=18, spaceAfter=6,
        )
        style_h3 = ParagraphStyle(
            "H3", parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12, leading=16,
            textColor=COLOR_PRIMARY,
            spaceBefore=12, spaceAfter=4,
        )
        style_body = ParagraphStyle(
            "Body", parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10.5, leading=17,
            textColor=COLOR_TEXT,
            spaceAfter=8,
        )
        style_meta = ParagraphStyle(
            "Meta", parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5, leading=14,
            textColor=COLOR_MUTED,
            spaceAfter=4,
        )
        style_bullet = ParagraphStyle(
            "Bullet", parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10.5, leading=17,
            textColor=COLOR_TEXT,
            leftIndent=16,
            spaceAfter=4,
        )

        def clean_inline(text):
            """Convert markdown inline formatting to ReportLab XML."""
            # Bold: **text** or __text__
            text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'__(.+?)__',     r'<b>\1</b>', text)
            # Italic: *text* or _text_
            text = re.sub(r'\*(.+?)\*',     r'<i>\1</i>', text)
            text = re.sub(r'_(.+?)_',       r'<i>\1</i>', text)
            # Escape bare ampersands not part of XML entities
            text = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;)', '&amp;', text)
            return text

        story = []

        # ── HEADER BLOCK ──────────────────────────────
        story.append(Paragraph("Business Proposal", style_h1))
        story.append(HRFlowable(
            width="100%", thickness=2,
            color=COLOR_ACCENT, spaceAfter=10,
        ))
        story.append(Paragraph(f"<b>Client:</b> {proposal['client_name']}", style_meta))
        story.append(Paragraph(f"<b>Prepared by:</b> {proposal['your_name']}, {proposal['your_company']}", style_meta))
        story.append(Paragraph(f"<b>Date:</b> {proposal['created_at'][:10]}", style_meta))
        story.append(Spacer(1, 0.3*inch))

        # ── PROPOSAL BODY ─────────────────────────────
        lines = proposal['proposal_text'].split('\n')

        for line in lines:
            stripped = line.strip()

            if not stripped:
                story.append(Spacer(1, 0.08*inch))
                continue

            # H1: # Title
            if stripped.startswith('# '):
                text = clean_inline(stripped[2:].strip())
                story.append(Paragraph(text, style_h1))
                story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_ACCENT, spaceAfter=8))

            # H2: ## Title
            elif stripped.startswith('## '):
                text = clean_inline(stripped[3:].strip())
                story.append(Paragraph(text, style_h2))

            # H3: ### Title
            elif stripped.startswith('### '):
                text = clean_inline(stripped[4:].strip())
                story.append(Paragraph(text, style_h3))

            # Bullet: - item or * item
            elif re.match(r'^[-*]\s+', stripped):
                text = clean_inline(re.sub(r'^[-*]\s+', '', stripped))
                story.append(Paragraph(f"• &nbsp; {text}", style_bullet))

            # Numbered list: 1. item
            elif re.match(r'^\d+\.\s+', stripped):
                text = clean_inline(re.sub(r'^\d+\.\s+', '', stripped))
                num  = re.match(r'^(\d+)\.', stripped).group(1)
                story.append(Paragraph(f"{num}.&nbsp; {text}", style_bullet))

            # Horizontal rule: --- or ***
            elif re.match(r'^[-*]{3,}$', stripped):
                story.append(Spacer(1, 0.1*inch))
                story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER))
                story.append(Spacer(1, 0.1*inch))

            # Normal paragraph
            else:
                text = clean_inline(stripped)
                story.append(Paragraph(text, style_body))

        # ── FOOTER ────────────────────────────────────
        story.append(Spacer(1, 0.4*inch))
        story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=8))
        story.append(Paragraph("Generated by ProposalWriterAI · proposalwriterai.com", style_meta))

        doc.build(story)
        pdf_bytes = pdf_buffer.getvalue()

        return {
            "pdf_data": pdf_bytes.hex(),
            "filename": f"{proposal['client_name'].replace(' ', '_')}_proposal.pdf"
        }

    except Exception as e:
        print(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
@app.get("/proposals")
def get_proposals(auth = Depends(get_auth)):
    db_client, user = auth
    user_id = user.user.id
    try:
        response = db_client.table("proposals").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return {"proposals": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/proposals/{proposal_id}")
def update_proposal(proposal_id: str, update: ProposalUpdate, auth = Depends(get_auth)):
    """Edit a proposal's text and/or its win/loss status.

    Used by the in-app editor (proposal_text) and the History outcome control (status).
    """
    db_client, user = auth
    user_id = user.user.id

    updates = {}
    if update.proposal_text is not None:
        updates["proposal_text"] = update.proposal_text
    if update.status is not None:
        if update.status not in ("won", "lost", "pending"):
            raise HTTPException(status_code=400, detail="status must be 'won', 'lost', or 'pending'")
        updates["status"] = update.status
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    try:
        response = (
            db_client.table("proposals")
            .update(updates)
            .eq("id", proposal_id)
            .eq("user_id", user_id)
            .execute()
        )
        # Note: a 0-row result here usually means the proposals table is missing an
        # UPDATE row-level-security policy (SELECT/INSERT exist but UPDATE is blocked).
        if not response.data:
            raise HTTPException(status_code=404, detail="Proposal not found (or no UPDATE policy on the proposals table)")
        return {"message": "Proposal updated", "proposal": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/usage")
def get_usage(auth = Depends(get_auth)):
    """Report the user's plan and how many of their free proposals remain."""
    db_client, user = auth
    user_id = user.user.id
    subscribed = _is_subscribed(db_client, user_id)
    count = _proposal_count(db_client, user_id)
    return {
        "count": count,
        "limit": FREE_PROPOSAL_LIMIT,
        "subscribed": subscribed,
        "plan": "pro" if subscribed else "free",
        "remaining": None if subscribed else max(0, FREE_PROPOSAL_LIMIT - count),
    }

@app.post("/create-checkout-session")
def create_checkout_session(auth = Depends(get_auth)):
    """Create a Stripe checkout session for Pro plan"""
    db_client, user = auth
    user_id = user.user.id
    customer_email = user.user.email
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': 'ProposalWriterAI Pro',
                            'description': 'Unlimited proposals, advanced features',
                        },
                        'unit_amount': 2900,  # $29.00
                        'recurring': {
                            'interval': 'month',
                            'interval_count': 1,
                        }
                    },
                    'quantity': 1,
                }
            ],
            mode='subscription',
            success_url='https://proposal-writer-ai.vercel.app?session_id={CHECKOUT_SESSION_ID}',
            cancel_url='https://proposal-writer-ai.vercel.app',
            customer_email=user.user.email,
            metadata={'user_id': user_id},
            subscription_data={
                'metadata': {'user_id': user_id}
            }
        )
        
        return {"sessionId": checkout_session.id, "url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event['type']
    logger.info(f"Received Stripe event: {event_type}")

    if event_type == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('metadata', {}).get('user_id')
        if user_id:
            try:
                res = supabase.table("subscriptions").select("id").eq("user_id", user_id).execute()
                if res.data and len(res.data) > 0:
                    supabase.table("subscriptions").update({"status": "active"}).eq("user_id", user_id).execute()
                else:
                    supabase.table("subscriptions").insert({"user_id": user_id, "status": "active"}).execute()
                logger.info(f"Subscription set to active for user: {user_id}")
            except Exception as e:
                logger.error(f"Error activating subscription in DB: {e}")
                raise HTTPException(status_code=500, detail=f"Database sync failed: {str(e)}")

    elif event_type == 'customer.subscription.deleted':
        subscription = event['data']['object']
        user_id = subscription.get('metadata', {}).get('user_id')
        if user_id:
            try:
                supabase.table("subscriptions").update({"status": "inactive"}).eq("user_id", user_id).execute()
                logger.info(f"Subscription set to inactive for user: {user_id}")
            except Exception as e:
                logger.error(f"Error deactivating subscription in DB: {e}")
                raise HTTPException(status_code=500, detail=f"Database sync failed: {str(e)}")

    return {"status": "success"}

@app.get("/check-subscription")
def check_subscription(auth = Depends(get_auth)):
    """Check if user has active subscription"""
    db_client, user = auth
    user_id = user.user.id

    try:
        # Check if user has subscription in Supabase
        response = db_client.table("subscriptions").select("*").eq("user_id", user_id).execute()
        
        if response.data and len(response.data) > 0:
            subscription = response.data[0]
            return {
                "subscribed": subscription['status'] == 'active',
                "plan": "pro" if subscription['status'] == 'active' else "free",
            }
        
        return {"subscribed": False, "plan": "free"}
    except Exception as e:
        return {"subscribed": False, "plan": "free"}