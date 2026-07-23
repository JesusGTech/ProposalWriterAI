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
  const [fieldErrors, setFieldErrors] = useState({})
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
  const [streaming, setStreaming] = useState(false)
  const [lastForm, setLastForm] = useState(null)
  const [proposals, setProposals] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [usage, setUsage] = useState(null)
  const [upgrading, setUpgrading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // Password reset flow
  const [resetEmail, setResetEmail] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    // Supabase password-recovery links land here with a URL hash like
    // #access_token=...&type=recovery — route those straight to the reset screen.
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(hash)
    if (hashParams.get("type") === "recovery") {
      const recoveryToken = hashParams.get("access_token")
      if (recoveryToken) {
        setToken(recoveryToken)
        setAuthState("reset")
        setShowLanding(false)
        return
      }
    }

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
    if (token && authState === "app") {
      fetchProposals()
      fetchDocuments()
      fetchUsage()
    }
  }, [token, authState])

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

  async function handleForgotPassword() {
    setAuthError("")
    if (!resetEmail.trim()) {
      setAuthError("Please enter your email")
      return
    }
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Could not send reset link")
      }
      setResetSent(true)
      toast.success("Reset link sent!")
    } catch (e) {
      setAuthError(e.message || "Could not send reset link")
    }
  }

  async function handleResetPassword() {
    setAuthError("")
    if (!newPassword.trim()) {
      setAuthError("Please enter a new password")
      return
    }
    if (newPassword.length < 6) {
      setAuthError("Password must be at least 6 characters")
      return
    }
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, new_password: newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Could not update password")
      }
      setResetSuccess(true)
      toast.success("Password updated!")
      setTimeout(() => {
        // Clear the recovery hash and return to a clean login screen.
        window.history.replaceState(null, "", window.location.pathname + window.location.search)
        setToken("")
        setNewPassword("")
        setResetSuccess(false)
        setAuthState("login")
      }, 2000)
    } catch (e) {
      setAuthError(e.message || "Could not update password")
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

  async function fetchUsage() {
    try {
      const res = await fetch(`${API}/usage`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsage(data)
    } catch (e) {}
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
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validateForm() {
    const errors = {}
    if (!form.your_name.trim()) errors.your_name = "Please enter your name"
    if (!form.your_company.trim()) errors.your_company = "Please enter your company"
    if (!form.client_name.trim()) errors.client_name = "Please enter the client name"
    if (!form.price.trim()) errors.price = "Please enter a price"
    if (!form.client_problem.trim()) errors.client_problem = "Describe the client's problem"
    if (!form.your_solution.trim()) errors.your_solution = "Describe your solution"
    return errors
  }

  const atFreeLimit = usage && !usage.subscribed && (usage.remaining ?? 0) <= 0
  const wonCount = proposals.filter(p => p.status === "won").length
  const lostCount = proposals.filter(p => p.status === "lost").length

  async function handleSubmit() {
    const errors = validateForm()
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      toast.error("Please fill in the highlighted fields")
      return
    }
    setFieldErrors({})
    if (atFreeLimit) {
      toast.error("You've used all your free proposals. Upgrade to Pro to continue.")
      return
    }
    await runGeneration({ ...form })
  }

  function handleRegenerate() {
    if (lastForm) runGeneration(lastForm)
  }

  // Streams the proposal token-by-token from the backend SSE endpoint.
  async function runGeneration(formData) {
    setEditing(false)
    setLoading(true)
    setStreaming(false)
    setProposal("")
    setProposalId("")
    setLastForm(formData)
    try {
      const res = await fetch(`${API}/generate-proposal-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      })
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 402) {
          toast.error(errData.detail || "Free plan limit reached")
          await fetchUsage()
          return
        }
        throw new Error(errData.detail || "Failed to generate proposal")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let acc = ""
      setStreaming(true)

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sep).trim()
          buffer = buffer.slice(sep + 2)
          if (!rawEvent.startsWith("data:")) continue
          let evt
          try { evt = JSON.parse(rawEvent.slice(5).trim()) } catch { continue }
          if (evt.type === "delta") {
            acc += evt.text
            setProposal(acc)
          } else if (evt.type === "done") {
            setProposalId(evt.proposal_id)
            await fetchProposals()
            await fetchUsage()
            toast.success("Proposal generated!")
          } else if (evt.type === "error") {
            throw new Error(evt.detail || "Generation failed")
          }
        }
      }
    } catch (e) {
      toast.error(e.message || "Failed to generate proposal")
      setProposal(prev => prev || (e.message || "Something went wrong. Please try again."))
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const res = await fetch(`${API}/create-checkout-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.detail || "Could not start checkout")
      }
    } catch (e) {
      toast.error("Could not start checkout — is the server reachable?")
    }
    setUpgrading(false)
  }

  function startEdit() {
    setEditText(proposal)
    setEditing(true)
  }

  async function saveEdit() {
    if (!proposalId) return
    setSavingEdit(true)
    try {
      const res = await fetch(`${API}/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proposal_text: editText }),
      })
      if (!res.ok) throw new Error("Save failed")
      setProposal(editText)
      setEditing(false)
      await fetchProposals()
      toast.success("Changes saved")
    } catch (e) {
      toast.error("Could not save changes")
    }
    setSavingEdit(false)
  }

  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch (e) {
      toast.error("Copy failed")
    }
  }

  async function handleSetStatus(propId, status) {
    try {
      const res = await fetch(`${API}/proposals/${propId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Update failed")
      }
      await fetchProposals()
      toast.success(status === "won" ? "Marked as won 🎉" : status === "lost" ? "Marked as lost" : "Reset to pending")
    } catch (e) {
      toast.error(e.message || "Could not update status")
    }
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
    setUsage(null)
    setProposal("")
    setProposalId("")
    setEditing(false)
    setLastForm(null)
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
            <span className="brand-wordmark auth-brand-logo">ProposalWriter<span className="wm-ai">AI</span></span>
          </div>

          {authState === "forgot" ? (
            <>
              <h2 className="auth-title">Reset password</h2>
              <p className="auth-sub">Enter your email and we'll send you a reset link</p>

              {resetSent ? (
                <div className="auth-success">
                  Check your email — we sent a reset link to {resetEmail}
                </div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="reset-email">Email</label>
                    <input id="reset-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@company.com" className="input" />
                  </div>

                  {authError && <div className="auth-error">{authError}</div>}

                  <button className="btn-primary" style={{ width: "100%", marginBottom: "12px" }} onClick={handleForgotPassword}>
                    Send reset link
                  </button>
                </>
              )}

              <button className="btn-ghost" onClick={() => { setAuthState("login"); setAuthError(""); setResetSent(false) }}>
                ← Back to sign in
              </button>
            </>
          ) : authState === "reset" ? (
            <>
              <h2 className="auth-title">Set new password</h2>
              <p className="auth-sub">Choose a strong password for your account</p>

              {resetSuccess ? (
                <div className="auth-success">
                  Password updated! Redirecting you to sign in…
                </div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="new-password">New password</label>
                    <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="input" />
                  </div>

                  {authError && <div className="auth-error">{authError}</div>}

                  <button className="btn-primary" style={{ width: "100%" }} onClick={handleResetPassword}>
                    Update password
                  </button>
                </>
              )}
            </>
          ) : (
            <>
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
              {authState === "login" && (
                <button className="btn-ghost" onClick={() => { setAuthState("forgot"); setAuthError(""); setResetSent(false); setResetEmail("") }}>
                  Forgot password?
                </button>
              )}
              <button className="btn-ghost" onClick={() => { setAuthState(authState === "login" ? "signup" : "login"); setAuthError("") }}>
                {authState === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
              <button className="btn-ghost" style={{ marginTop: "8px" }} onClick={() => setShowLanding(true)}>
                ← Back to home
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Main app
  return (
    <div className="app-wrap">
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#FFFFFF', color: '#0A0A0A', border: '1px solid #0A0A0A', borderRadius: 0, fontSize: '13px', fontWeight: 500 },
        success: { iconTheme: { primary: '#0A0A0A', secondary: '#FFFFFF' } },
        error: { iconTheme: { primary: '#E5311E', secondary: '#FFFFFF' } },
      }} />

      <nav className="navbar">
        <div className="nav-left">
          <span className="brand-wordmark nav-brand-logo">ProposalWriter<span className="wm-ai">AI</span></span>
        </div>
        <div className="nav-tabs">
          {["new", "history", "docs"].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab === "new" ? "New Proposal" : tab === "history" ? "History" : "Documents"}
            </button>
          ))}
        </div>
        <div className="nav-right">
          {usage && (usage.subscribed ? (
            <span className="plan-pill plan-pro">★ Pro</span>
          ) : (
            <button className="plan-pill plan-free" onClick={handleUpgrade} disabled={upgrading} title="Upgrade to Pro">
              {Math.max(0, usage.remaining ?? 0)} / {usage.limit} free left · Upgrade
            </button>
          ))}
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
                  { label: "Your Name", name: "your_name", placeholder: "Jane Smith" },
                  { label: "Your Company", name: "your_company", placeholder: "Acme Inc." },
                  { label: "Client Name", name: "client_name", placeholder: "Globex Corp" },
                  { label: "Price / Investment", name: "price", placeholder: "$5,000 one-time or $1,200/mo" },
                ].map(f => (
                  <div className="field" key={f.name}>
                    <label htmlFor={f.name}>{f.label}</label>
                    <input id={f.name} name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} className={`input ${fieldErrors[f.name] ? "input-error" : ""}`} />
                    {fieldErrors[f.name] && <span className="field-error">{fieldErrors[f.name]}</span>}
                  </div>
                ))}
              </div>

              {[
                { label: "Client's Problem", name: "client_problem", placeholder: "Describe the pain point they're experiencing..." },
                { label: "Your Solution", name: "your_solution", placeholder: "Describe how you solve it..." },
              ].map(f => (
                <div className="field" key={f.name}>
                  <label htmlFor={f.name}>{f.label}</label>
                  <textarea id={f.name} name={f.name} value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} className={`input textarea ${fieldErrors[f.name] ? "input-error" : ""}`} rows={4} />
                  {fieldErrors[f.name] && <span className="field-error">{fieldErrors[f.name]}</span>}
                </div>
              ))}

              {documents.length > 0 && (
                <div className="doc-notice">
                  <span className="doc-dot" />
                  {documents.length} document{documents.length > 1 ? "s" : ""} loaded — Claude will use your company context
                </div>
              )}

              {wonCount > 0 && (
                <div className="doc-notice notice-won">
                  <span className="doc-dot" />
                  {wonCount} winning proposal{wonCount > 1 ? "s" : ""} loaded — Claude will mirror what works
                  {lostCount > 0 ? ` and avoid ${lostCount} that lost` : ""}
                </div>
              )}

              {atFreeLimit ? (
                <div className="upgrade-banner">
                  <div className="upgrade-banner-text">
                    <strong>You've used all {usage?.limit} free proposals.</strong>
                    <span>Upgrade to Pro for unlimited proposals.</span>
                  </div>
                  <button className="btn-primary-sm" onClick={handleUpgrade} disabled={upgrading}>
                    {upgrading ? "Redirecting…" : "Upgrade to Pro"}
                  </button>
                </div>
              ) : (
                <button className="btn-primary full" onClick={handleSubmit} disabled={loading}>
                  {loading ? <span className="loading-dots">Generating<span>.</span><span>.</span><span>.</span></span> : "Generate Proposal →"}
                </button>
              )}
            </div>

            {proposal && (
              <div className="card proposal-output">
                <div className="proposal-header">
                  <h3>{streaming ? "Writing your proposal…" : "Generated Proposal"}</h3>
                  <div className="proposal-actions">
                    {editing ? (
                      <>
                        <button className="btn-outline-sm" onClick={() => setEditing(false)} disabled={savingEdit}>Cancel</button>
                        <button className="btn-primary-sm" onClick={saveEdit} disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save changes"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-outline-sm" onClick={handleRegenerate} disabled={loading || !lastForm}>↻ Regenerate</button>
                        <button className="btn-outline-sm" onClick={() => handleCopy(proposal)} disabled={loading}>Copy</button>
                        <button className="btn-outline-sm" onClick={startEdit} disabled={loading || !proposalId}>Edit</button>
                        <button className="btn-primary-sm" onClick={() => handleDownloadPDF(proposalId)} disabled={loading || downloadingId === proposalId || !proposalId}>
                          {downloadingId === proposalId ? "Downloading..." : "Download PDF"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editing ? (
                  <textarea
                    className="input textarea proposal-edit"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={20}
                  />
                ) : (
                  <div className="proposal-body">
                    {renderProposal(proposal)}
                    {streaming && <span className="stream-cursor" />}
                  </div>
                )}
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
                        <div className="proposal-card-title">
                          {p.client_name}
                          {p.status === "won" && <span className="status-badge sb-won">Won</span>}
                          {p.status === "lost" && <span className="status-badge sb-lost">Lost</span>}
                        </div>
                        <div className="proposal-card-meta">{p.your_company} · {new Date(p.created_at).toLocaleDateString()} · {p.price}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <div className="status-control" onClick={e => e.stopPropagation()}>
                          {["won", "lost", "pending"].map(s => (
                            <button
                              key={s}
                              className={`status-btn ${(p.status || "pending") === s ? `active sb-${s}` : ""}`}
                              onClick={e => { e.stopPropagation(); handleSetStatus(p.id, s) }}
                            >
                              {s === "won" ? "Won" : s === "lost" ? "Lost" : "Pending"}
                            </button>
                          ))}
                        </div>
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

