from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic
import os
import re
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
    allow_origins=["http://localhost:5174","http://localhost:3000", "https://proposal-writer-ai.vercel.app"],
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

# Data models
class ProposalRequest(BaseModel):
    client_name: str
    client_problem: str
    your_solution: str
    price: str
    your_name: str
    your_company: str

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
def upload_document(file: UploadFile = File(...), authorization: str = Header(None)):
    # Get the user ID from the auth header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

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
        supabase.table("documents").insert({
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
def get_documents(authorization: str = Header(None)):
    # Get all documents for the logged-in user
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        response = supabase.table("documents").select("id, filename, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        return {"documents": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{document_id}")
def delete_document(document_id: str, authorization: str = Header(None)):
    # Delete a document
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        supabase.table("documents").delete().eq("id", document_id).eq("user_id", user_id).execute()
        return {"message": "Document deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-proposal")
def generate_proposal(request: ProposalRequest, authorization: str = Header(None)):
    logger.info(f"Proposal generation requested for client: {request.client_name}")
    
    # Get the user ID from the auth header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get user's documents for context (RAG)
    try:
        docs_response = supabase.table("documents").select("content").eq("user_id", user_id).execute()
        user_docs = docs_response.data
        doc_context = "\n\n".join([f"Document: {doc['content'][:500]}..." for doc in user_docs]) if user_docs else "No documents uploaded"
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        doc_context = "No documents available"

    prompt = f"""
    You are a professional business proposal writer.
    Write a polished, persuasive business proposal using the details below.
    
    **IMPORTANT: Use the company information provided in the documents to ground your proposal in real details about the company.**

    Client name: {request.client_name}
    Problem they are facing: {request.client_problem}
    Proposed solution: {request.your_solution}
    Investment (price): {request.price}
    Submitted by: {request.your_name} from {request.your_company}

    Company Information (from uploaded documents):
    {doc_context}

    Structure the proposal with these sections:
    1. Executive Summary
    2. The Problem
    3. Our Solution
    4. Investment
    5. Next Steps

    Write in a professional but warm tone. Be specific and persuasive.
    If you have company information from the documents, reference specific services, pricing models, or case studies.
    """

    try:
        message = anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        proposal_text = message.content[0].text
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to generate proposal from AI: {str(e)}")

    # Save to database
    proposal_id = str(uuid.uuid4())
    
    try:
        supabase.table("proposals").insert({
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
    except Exception as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save generated proposal to database: {str(e)}")

    logger.info(f"Proposal generated successfully. ID: {proposal_id}")
    return {
        "proposal": proposal_text,
        "proposal_id": proposal_id,
    }
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
def download_proposal(proposal_id: str, authorization: str = Header(None)):
    # Get the user ID from the auth header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get the proposal from database
    try:
        response = supabase.table("proposals").select("*").eq("id", proposal_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Proposal not found")
        proposal = response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Generate PDF with ReportLab
    try:
        # Create PDF in memory
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#6c47ff',
            spaceAfter=30,
        )

        # Add content
        story.append(Paragraph("BUSINESS PROPOSAL", title_style))
        story.append(Spacer(1, 0.3*inch))

        story.append(Paragraph(f"<b>Client:</b> {proposal['client_name']}", styles['Normal']))
        story.append(Paragraph(f"<b>Submitted by:</b> {proposal['your_name']}, {proposal['your_company']}", styles['Normal']))
        story.append(Paragraph(f"<b>Date:</b> {proposal['created_at'][:10]}", styles['Normal']))
        story.append(Spacer(1, 0.5*inch))

        # Add proposal text (split by lines)
        for line in proposal['proposal_text'].split('\n'):
            if line.strip():
                story.append(parse_markdown_to_paragraph(line, styles))
            else:
                story.append(Spacer(1, 0.1*inch))

        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("Generated by ProposalWriterAI", styles['Normal']))

        # Build PDF
        doc.build(story)
        pdf_buffer.seek(0)
        
        filename = f"{proposal['client_name'].replace(' ', '_')}_proposal.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
@app.get("/proposals")
def get_proposals(authorization: str = Header(None)):
    # Get all proposals for the logged-in user
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        response = supabase.table("proposals").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return {"proposals": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-checkout-session")
def create_checkout_session(authorization: str = Header(None)):
    """Create a Stripe checkout session for Pro plan"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

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
        
        return {"sessionId": checkout_session.id}
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
def check_subscription(authorization: str = Header(None)):
    """Check if user has active subscription"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        # Check if user has subscription in Supabase
        response = supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
        
        if response.data and len(response.data) > 0:
            subscription = response.data[0]
            return {
                "subscribed": subscription['status'] == 'active',
                "plan": "pro" if subscription['status'] == 'active' else "free",
            }
        
        return {"subscribed": False, "plan": "free"}
    except Exception as e:
        return {"subscribed": False, "plan": "free"}