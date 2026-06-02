from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
import uuid

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

@app.post("/generate-proposal")
def generate_proposal(request: ProposalRequest, authorization: str = Header(None)):
    # Get the user ID from the auth header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = authorization.split(" ")[1]
    
    try:
        user = supabase.auth.get_user(token)
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Generate proposal with Claude
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""
    You are a professional business proposal writer.
    Write a polished, persuasive business proposal using the details below.

    Client name: {request.client_name}
    Problem they are facing: {request.client_problem}
    Proposed solution: {request.your_solution}
    Investment (price): {request.price}
    Submitted by: {request.your_name} from {request.your_company}

    Structure the proposal with these sections:
    1. Executive Summary
    2. The Problem
    3. Our Solution
    4. Investment
    5. Next Steps

    Write in a professional but warm tone. Be specific and persuasive.
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
        # Still return the proposal even if saving failed
        pass

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

    # Create HTML for the PDF
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                color: #333;
                line-height: 1.6;
                margin: 40px;
            }}
            h1 {{
                color: #6c47ff;
                border-bottom: 2px solid #6c47ff;
                padding-bottom: 10px;
            }}
            h2 {{
                color: #6c47ff;
                margin-top: 30px;
            }}
            .header {{
                margin-bottom: 40px;
            }}
            .section {{
                margin-bottom: 30px;
            }}
            .footer {{
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Business Proposal</h1>
            <p><strong>Client:</strong> {proposal['client_name']}</p>
            <p><strong>Submitted by:</strong> {proposal['your_name']}, {proposal['your_company']}</p>
            <p><strong>Date:</strong> {proposal['created_at'][:10]}</p>
        </div>

        <div class="section">
            {proposal['proposal_text'].replace(chr(10), '<br>')}
        </div>

        <div class="footer">
            <p>Generated by ProposalWriterAI</p>
        </div>
    </body>
    </html>
    """

    # Convert HTML to PDF
    try:
        from weasyprint import HTML
        import io
        
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return {
            "pdf_data": pdf_bytes.hex(),  # Convert bytes to hex string for JSON
            "filename": f"{proposal['client_name'].replace(' ', '_')}_proposal.pdf"
        }
    except Exception as e:
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