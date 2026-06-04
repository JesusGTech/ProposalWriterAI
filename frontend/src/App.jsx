import { useState, useEffect } from "react"

const API = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:8000"
  : "https://proposalwriterai-api.onrender.com"

export default function App() {
  const [authState, setAuthState] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [user, setUser] = useState(null)
  const [token, setToken] = useState("")
  const [activeTab, setActiveTab] = useState("new")

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
      } else {
        setAuthError("Invalid email or password")
      }
    } catch (e) {
      setAuthError("Connection failed")
    }
  }

  async function fetchProposals() {
    try {
      const res = await fetch(`${API}/proposals`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setProposals(data.proposals || [])
    } catch (e) {}
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API}/documents`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (e) {}
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
      if (res.ok) { await fetchDocuments(); e.target.value = "" }
    } catch (e) {}
    setUploading(false)
  }

  async function handleDeleteDocument(docId) {
    try {
      await fetch(`${API}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      await fetchDocuments()
    } catch (e) {}
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    setLoading(true)
    setProposal("")
    setProposalId("")
    try {
      const res = await fetch(`${API}/generate-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setProposal(data.proposal)
      setProposalId(data.proposal_id)
      setForm({ client_name: "", client_problem: "", your_solution: "", price: "", your_name: "", your_company: "" })
      await fetchProposals()
    } catch (e) {
      setProposal("Something went wrong. Please try again.")
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
    } catch (e) {}
    setDownloadingId(null)
  }

  function handleLogout() {
    localStorage.removeItem("pw_token")
    localStorage.removeItem("pw_user")
    setUser(null); setToken(""); setAuthState("login"); setEmail(""); setPassword("")
  }

  if (authState !== "app") {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="logo-icon">✦</span>
            <span className="logo-text">ProposalWriterAI</span>
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

          <button className="btn-primary" onClick={authState === "login" ? handleLogin : handleSignup}>
            {authState === "login" ? "Sign in" : "Create account"}
          </button>
          <button className="btn-ghost" onClick={() => { setAuthState(authState === "login" ? "signup" : "login"); setAuthError("") }}>
            {authState === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-wrap">
      <nav className="navbar">
        <div className="nav-left">
          <span className="logo-icon">✦</span>
          <span className="logo-text">ProposalWriterAI</span>
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
                  { label: "Your Name", name: "your_name", placeholder: "Alex Johnson" },
                  { label: "Your Company", name: "your_company", placeholder: "Acme Inc." },
                  { label: "Client Name", name: "client_name", placeholder: "TechStartup Corp" },
                  { label: "Price / Investment", name: "price", placeholder: "$299/month" },
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
                <div className="proposal-body">{proposal}</div>
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

            {proposals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No proposals yet</h3>
                <p>Generate your first proposal to see it here</p>
                <button className="btn-primary" onClick={() => setActiveTab("new")}>Create Proposal →</button>
              </div>
            ) : (
              <div className="proposal-list">
                {proposals.map(p => (
                  <div className="proposal-card" key={p.id}>
                    <div className="proposal-card-info">
                      <div className="proposal-card-title">{p.client_name}</div>
                      <div className="proposal-card-meta">{p.your_company} · {new Date(p.created_at).toLocaleDateString()} · {p.price}</div>
                    </div>
                    <button className="btn-outline-sm" onClick={() => handleDownloadPDF(p.id)} disabled={downloadingId === p.id}>
                      {downloadingId === p.id ? "..." : "Download PDF"}
                    </button>
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

            {documents.length === 0 ? (
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