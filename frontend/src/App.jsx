import { useState, useEffect } from "react"
import toast, { Toaster } from 'react-hot-toast'
import logo from "./assets/ProposalWriterAILogo.png"
import Landing from "./Landing"

const API = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:8000"
  : "https://proposalwriterai-api.onrender.com"

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [authState, setAuthState] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [user, setUser] = useState(null)
  const [token, setToken] = useState("")
  const [activeTab, setActiveTab] = useState("new")
  const [formError, setFormError] = useState("")
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [docsLoading, setDocsLoading] = useState(false)

  const [form, setForm] = useState({
    client_name: "", client_problem: "",
    your_solution: "", price: "",
    your_name: "", your_company: "",
  })

  const [proposal, setProposal] = useState("")
  const [proposalId, setProposalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem("pw_token")
    const savedUser = localStorage.getItem("pw_user")
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setAuthState("app")
      setShowLanding(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchProposals()
      fetchDocuments()
    }
  }, [token])

  async function handleSignup() {
    setAuthError("")
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.session?.access_token) {
        localStorage.setItem("pw_token", data.session.access_token)
        localStorage.setItem("pw_user", JSON.stringify(data.user))
        setUser(data.user)
        setToken(data.session.access_token)
        setAuthState("app")
        setShowLanding(false)
        toast.success("Account created!")
      } else if (data.user) {
        setAuthError("Check your email to confirm your account.")
      } else {
        setAuthError(data.detail || "Signup failed")
      }
    } catch (e) {
      setAuthError("Connection failed")
    }
  }

  async function handleLogin() {
    setAuthError("")
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.user) {
        localStorage.setItem("pw_token", data.session.access_token)
        localStorage.setItem("pw_user", JSON.stringify(data.user))
        setUser(data.user)
        setToken(data.session.access_token)
        setAuthState("app")
        setShowLanding(false)
        toast.success("Welcome back!")
      } else {
        setAuthError("Invalid email or password")
      }
    } catch (e) {
      setAuthError("Connection failed")
    }
  }

  async function fetchProposals() {
    setHistoryLoading(true)
    try {
      const res = await fetch(`${API}/proposals`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setProposals(data.proposals || [])
    } catch (e) {}
    setHistoryLoading(false)
  }

  async function fetchDocuments() {
    setDocsLoading(true)
    try {
      const res = await fetch(`${API}/documents`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (e) {}
    setDocsLoading(false)
  }

  async function handleUploadDocument(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        await fetchDocuments()
        e.target.value = ""
        toast.success("Document uploaded!")
      } else {
        toast.error("Upload failed")
      }
    } catch (e) {
      toast.error("Upload failed")
    }
    setUploading(false)
  }

  async function handleDeleteDocument(docId) {
    try {
      await fetch(`${API}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      await fetchDocuments()
      toast.success("Document deleted")
    } catch (e) {
      toast.error("Failed to delete document")
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    if (!form.your_name.trim()) { setFormError("Please enter your name"); return }
    if (!form.your_company.trim()) { setFormError("Please enter your company"); return }
    if (!form.client_name.trim()) { setFormError("Please enter the client name"); return }
    if (!form.price.trim()) { setFormError("Please enter a price"); return }
    if (!form.client_problem.trim()) { setFormError("Please describe the client's problem"); return }
    if (!form.your_solution.trim()) { setFormError("Please describe your solution"); return }

    setFormError("")
    setLoading(true)
    setProposal("")
    setProposalId("")
    try {
      const res = await fetch(`${API}/generate-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to generate proposal")
      }
      const data = await res.json()
      setProposal(data.proposal)
      setProposalId(data.proposal_id)
      setForm({ client_name: "", client_problem: "", your_solution: "", price: "", your_name: "", your_company: "" })
      await fetchProposals()
      toast.success("Proposal generated!")
    } catch (e) {
      setProposal(e.message || "Something went wrong. Please try again.")
      toast.error(e.message || "Failed to generate proposal")
    }
    setLoading(false)
  }

  async function handleDownloadPDF(propId) {
    setDownloadingId(propId)
    try {
      const res = await fetch(`${API}/proposals/${propId}/download`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to download PDF")
      }
      const data = await res.json()
      const hex = data.pdf_data
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
      const blob = new Blob([bytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("PDF downloaded!")
    } catch (e) {
      toast.error(e.message || "Failed to download PDF")
    }
    setDownloadingId(null)
  }

  function handleLogout() {
    localStorage.removeItem("pw_token")
    localStorage.removeItem("pw_user")
    setUser(null)
    setToken("")
    setAuthState("login")
    setEmail("")
    setPassword("")
    setShowLanding(true)
  }

  // Show landing page
  if (showLanding && authState !== "app") {
    return <Landing onGetStarted={() => setShowLanding(false)} logo={logo} />
  }

  // Auth screen
  if (authState !== "app") {
    return (
      <div className="auth-wrap">
        <Toaster position="bottom-right" toastOptions={{
          style: { background: '#1a1a24', color: '#f0f0f8', border: '1px solid #ffffff18', fontSize: '14px' },
          success: { iconTheme: { primary: '#00e5a0', secondary: '#1a1a24' } },
          error: { iconTheme: { primary: '#ff4444', secondary: '#1a1a24' } },
        }} />
        <div className="auth-card">
          <div className="auth-logo">
            <img src={logo} alt="ProposalWriterAI" className="brand-logo auth-brand-logo" />
          </div>
          <h2 className="auth-title">
            {authState === "login" ? "Welcome back" : "Get started"}
          </h2>
          <p className="auth-sub">
            {authState === "login" ? "Sign in to your account" : "Create your free account"}
          </p>

          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="input" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input" />
          </div>

          {authError && <div className="auth-error">{authError}</div>}

          <button className="btn-primary" style={{ width: "100%", marginBottom: "12px" }} onClick={authState === "login" ? handleLogin : handleSignup}>
            {authState === "login" ? "Sign in" : "Create account"}
          </button>
          <button className="btn-ghost" onClick={() => { setAuthState(authState === "login" ? "signup" : "login"); setAuthError("") }}>
            {authState === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
          <button className="btn-ghost" style={{ marginTop: "8px" }} onClick={() => setShowLanding(true)}>
            ← Back to home
          </button>
        </div>
      </div>
    )
  }

  // Main app
  return (
    <div className="app-wrap">
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#1a1a24', color: '#f0f0f8', border: '1px solid #ffffff18', fontSize: '14px' },
        success: { iconTheme: { primary: '#00e5a0', secondary: '#1a1a24' } },
        error: { iconTheme: { primary: '#ff4444', secondary: '#1a1a24' } },
      }} />

      <nav className="navbar">
        <div className="nav-left">
          <img src={logo} alt="ProposalWriterAI" className="brand-logo nav-brand-logo" />
        </div>
        <div className="nav-tabs">
          {["new", "history", "docs"].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab === "new" ? "New Proposal" : tab === "history" ? "History" : "Documents"}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <span className="nav-email">{user?.email}</span>
          <button className="btn-outline-sm" onClick={handleLogout}>Sign out</button>
        </div>
      </nav>

      <main className="main">
        {activeTab === "new" && (
          <div className="content-wrap">
            <div className="page-header">
              <h1>Generate Proposal</h1>
              <p>Fill in the details below. Claude will write a polished, persuasive proposal grounded in your company documents.</p>
            </div>

            <div className="card">
              <div className="form-grid">
                {[
                  { label: "Your Name", name: "your_name", placeholder: "Fulano Detal" },
                  { label: "Your Company", name: "your_company", placeholder: "Company Inc." },
                  { label: "Client Name", name: "client_name", placeholder: "TheClients Corp" },
                  { label: "Price / Investment", name: "price", placeholder: "One time payment or subscription" },
                ].map(f => (
                  <div className="field" key={f.name}>
                    <label>{f.label}</label>
                    <input name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} className="input" />
                  </div>
                ))}
              </div>

              {[
                { label: "Client's Problem", name: "client_problem", placeholder: "Describe the pain point they're experiencing..." },
                { label: "Your Solution", name: "your_solution", placeholder: "Describe how you solve it..." },
              ].map(f => (
                <div className="field" key={f.name}>
                  <label>{f.label}</label>
                  <textarea name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} className="input textarea" rows={4} />
                </div>
              ))}

              {documents.length > 0 && (
                <div className="doc-notice">
                  <span className="doc-dot" />
                  {documents.length} document{documents.length > 1 ? "s" : ""} loaded — Claude will use your company context
                </div>
              )}

              {formError && <div className="form-error">{formError}</div>}

              <button className="btn-primary full" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="loading-dots">Generating<span>.</span><span>.</span><span>.</span></span> : "Generate Proposal →"}
              </button>
            </div>

            {proposal && (
              <div className="card proposal-output">
                <div className="proposal-header">
                  <h3>Generated Proposal</h3>
                  <button className="btn-primary-sm" onClick={() => handleDownloadPDF(proposalId)} disabled={downloadingId === proposalId}>
                    {downloadingId === proposalId ? "Downloading..." : "Download PDF"}
                  </button>
                </div>
                <div className="proposal-body">{renderProposal(proposal)}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="content-wrap">
            <div className="page-header">
              <h1>Proposal History</h1>
              <p>{proposals.length} proposal{proposals.length !== 1 ? "s" : ""} generated</p>
            </div>

            {historyLoading ? (
              <div className="loading-state">Loading proposals...</div>
            ) : proposals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No proposals yet</h3>
                <p>Generate your first proposal to see it here</p>
                <button className="btn-primary" onClick={() => setActiveTab("new")}>Create Proposal →</button>
              </div>
            ) : (
              <div className="proposal-list">
                {proposals.map(p => (
                  <div key={p.id}>
                    <div
                      className="proposal-card"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedProposal(selectedProposal?.id === p.id ? null : p)}
                    >
                      <div className="proposal-card-info">
                        <div className="proposal-card-title">{p.client_name}</div>
                        <div className="proposal-card-meta">{p.your_company} · {new Date(p.created_at).toLocaleDateString()} · {p.price}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                          {selectedProposal?.id === p.id ? "▲ Hide" : "▼ View"}
                        </span>
                        <button
                          className="btn-outline-sm"
                          onClick={e => { e.stopPropagation(); handleDownloadPDF(p.id) }}
                          disabled={downloadingId === p.id}
                        >
                          {downloadingId === p.id ? "..." : "Download PDF"}
                        </button>
                      </div>
                    </div>
                    {selectedProposal?.id === p.id && (
                      <div className="proposal-preview">
                        {renderProposal(p.proposal_text)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="content-wrap">
            <div className="page-header">
              <h1>Company Documents</h1>
              <p>Upload your services, pricing, and case studies. Claude will use these to write company-specific proposals.</p>
            </div>

            <div className="card">
              <label className="upload-zone">
                <input type="file" accept=".pdf,.txt" onChange={handleUploadDocument} disabled={uploading} style={{ display: "none" }} />
                <div className="upload-icon">↑</div>
                <div className="upload-text">{uploading ? "Uploading..." : "Click to upload PDF or TXT"}</div>
                <div className="upload-sub">Your documents are private and only visible to you</div>
              </label>
            </div>

            {docsLoading ? (
              <div className="loading-state">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <h3>No documents yet</h3>
                <p>Upload company info to get smarter, more specific proposals</p>
              </div>
            ) : (
              <div className="proposal-list">
                {documents.map(doc => (
                  <div className="proposal-card" key={doc.id}>
                    <div className="proposal-card-info">
                      <div className="proposal-card-title">{doc.filename}</div>
                      <div className="proposal-card-meta">Uploaded {new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                    <button className="btn-danger-sm" onClick={() => handleDeleteDocument(doc.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function renderProposal(text) {
  if (!text) return null;
  const lines = text.split("\n");
  let inList = false;
  let listItems = [];
  let inNumList = false;
  let numListItems = [];
  const rendered = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      rendered.push(
        <ul key={key} className="proposal-ul">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushNumList = (key) => {
    if (numListItems.length > 0) {
      rendered.push(
        <ol key={key} className="proposal-ol">
          {numListItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ol>
      );
      numListItems = [];
      inNumList = false;
    }
  };

  const cleanInline = (t) => {
    // Bold **text**
    t = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    t = t.replace(/\*(.*?)\*/g, "<em>$1</em>");
    return t;
  };

  lines.forEach((line, i) => {
    const stripped = line.strip ? line.strip() : line.trim();
    if (!stripped) {
      flushList(`list-${i}`);
      flushNumList(`numlist-${i}`);
      return;
    }

    if (stripped.startsWith("### ")) {
      flushList(`list-${i}`);
      flushNumList(`numlist-${i}`);
      rendered.push(<h4 key={i} className="proposal-h4" dangerouslySetInnerHTML={{ __html: cleanInline(stripped.slice(4)) }} />);
    } else if (stripped.startsWith("## ")) {
      flushList(`list-${i}`);
      flushNumList(`numlist-${i}`);
      rendered.push(<h3 key={i} className="proposal-h3" dangerouslySetInnerHTML={{ __html: cleanInline(stripped.slice(3)) }} />);
    } else if (stripped.startsWith("# ")) {
      flushList(`list-${i}`);
      flushNumList(`numlist-${i}`);
      rendered.push(<h2 key={i} className="proposal-h2" dangerouslySetInnerHTML={{ __html: cleanInline(stripped.slice(2)) }} />);
    } else if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
      flushNumList(`numlist-${i}`);
      inList = true;
      listItems.push(cleanInline(stripped.slice(2)));
    } else if (/^\d+\.\s+/.test(stripped)) {
      flushList(`list-${i}`);
      inNumList = true;
      numListItems.push(cleanInline(stripped.replace(/^\d+\.\s+/, "")));
    } else {
      flushList(`list-${i}`);
      flushNumList(`numlist-${i}`);
      rendered.push(<p key={i} className="proposal-p" dangerouslySetInnerHTML={{ __html: cleanInline(stripped) }} />);
    }
  });

  flushList("list-final");
  flushNumList("numlist-final");
  return <div className="proposal-document">{rendered}</div>;
}

