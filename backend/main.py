from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import os
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://proposal-writer-ai.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

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
async def upload_document(file: UploadFile = File(...), authorization: str = Header(None)):
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
                content += page.extract_text() + "\n"
        else:
            # Read as plain text
            content = await file.read()
            content = content.decode('utf-8')
        
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
        print(f"Upload error: {e}")
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
        print(f"Error fetching documents: {e}")
        doc_context = "No documents available"

    # Generate proposal with Claude
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

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

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    proposal_text = message.content[0].text

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
        print(f"Database error: {e}")
        pass
    logger.info(f"Proposal generated successfully. ID: {proposal_id}")
    return {
        "proposal": proposal_text,
        "proposal_id": proposal_id,
    }
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
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.units import inch
        import io

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
                story.append(Paragraph(line, styles['Normal']))
            else:
                story.append(Spacer(1, 0.1*inch))

        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("Generated by ProposalWriterAI", styles['Normal']))

        # Build PDF
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
