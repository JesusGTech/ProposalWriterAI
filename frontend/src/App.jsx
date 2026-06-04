import { useState, useEffect } from "react"

const COLORS = {
  bg: "#e0e5ec",
  bgDark: "#d1d9e6",
  text: "#2d3436",
  textLight: "#5f6368",
  primary: "#6c47ff",
  primaryLight: "#8b68ff",
  white: "#f0f3f7",
  success: "#00b894",
  error: "#d63031",
}

const neumorphicInput = {
  padding: "14px 18px",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  boxSizing: "border-box",
  background: COLORS.white,
  color: COLORS.text,
  boxShadow: `
    -3px -3px 7px rgba(255, 255, 255, 0.5),
    3px 3px 5px rgba(0, 0, 0, 0.12)
  `,
  outline: "none",
  transition: "all 0.3s ease",
  fontFamily: "inherit",
}

const neumorphicButton = {
  padding: "12px 28px",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.3s ease",
  boxShadow: `
    -3px -3px 7px rgba(255, 255, 255, 0.5),
    3px 3px 5px rgba(0, 0, 0, 0.12)
  `,
  background: COLORS.white,
  color: COLORS.text,
}

const neumorphicPrimaryButton = {
  ...neumorphicButton,
  background: COLORS.primary,
  color: "white",
  boxShadow: `
    -3px -3px 7px rgba(255, 255, 255, 0.5),
    3px 3px 5px rgba(108, 71, 255, 0.3)
  `,
}

export default function App() {
  const [authState, setAuthState] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [user, setUser] = useState(null)
  const [token, setToken] = useState("")

  const [form, setForm] = useState({
    client_name: "",
    client_problem: "",
    your_solution: "",
    price: "",
    your_name: "",
    your_company: "",
  })

  const [proposal, setProposal] = useState("")
  const [proposalId, setProposalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const [showDocuments, setShowDocuments] = useState(false)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (token) {
      fetchProposals()
      fetchDocuments()
    }
  }, [token])

  async function handleSignup() {
    setAuthError("")
    try {
      const response = await fetch("https://proposalwriterai-api.onrender.com/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      
      if (data.session && data.session.access_token) {
        setUser(data.user)
        setToken(data.session.access_token)
        setAuthState("app")
      } else if (data.user) {
        setAuthError("Signup successful! Please check your email to confirm.")
      } else {
        setAuthError("Signup failed: " + (data.detail || "Unknown error"))
      }
    } catch (error) {
      setAuthError("Signup failed: " + error.message)
    }
  }

  async function handleLogin() {
    setAuthError("")
    try {
      const response = await fetch("https://proposalwriterai-api.onrender.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (data.user) {
        setUser(data.user)
        setToken(data.session.access_token)
        setAuthState("app")
      } else {
        setAuthError("Login failed: Invalid credentials")
      }
    } catch (error) {
      setAuthError("Login failed: " + error.message)
    }
  }

  async function fetchProposals() {
    try {
      const response = await fetch("https://proposalwriterai-api.onrender.com/proposals", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setProposals(data.proposals || [])
    } catch (error) {
      console.error("Failed to fetch proposals:", error)
    }
  }

  async function fetchDocuments() {
    try {
      const response = await fetch("https://proposalwriterai-api.onrender.com/documents", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error("Failed to fetch documents:", error)
    }
  }

  async function handleUploadDocument(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("https://proposalwriterai-api.onrender.com/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (response.ok) {
        await fetchDocuments()
        e.target.value = ""
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Failed to upload document")
    }
    setUploading(false)
  }

  async function handleDeleteDocument(docId) {
    try {
      await fetch(`https://proposalwriterai-api.onrender.com/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchDocuments()
    } catch (error) {
      console.error("Delete failed:", error)
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    setLoading(true)
    setProposal("")
    setProposalId("")

    try {
      const response = await fetch("https://proposalwriterai-api.onrender.com/generate-proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      setProposal(data.proposal)
      setProposalId(data.proposal_id)
      setForm({
        client_name: "",
        client_problem: "",
        your_solution: "",
        price: "",
        your_name: "",
        your_company: "",
      })
      await fetchProposals()
    } catch (error) {
      setProposal("Something went wrong.")
    }

    setLoading(false)
  }

  async function handleDownloadPDF(propId) {
    setDownloadingId(propId)
    try {
      const response = await fetch(`https://proposalwriterai-api.onrender.com/proposals/${propId}/download`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      const hexString = data.pdf_data
      const bytes = new Uint8Array(hexString.length / 2)
      for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
      }

      const blob = new Blob([bytes], { type: "application/pdf" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download PDF:", error)
    }
    setDownloadingId(null)
  }

  function handleLogout() {
    setUser(null)
    setToken("")
    setAuthState("login")
    setEmail("")
    setPassword("")
  }

  // LOGIN/SIGNUP SCREEN
  if (authState !== "app") {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgDark} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: "20px",
      }}>
        <div style={{
          maxWidth: "400px",
          width: "100%",
          padding: "40px 30px",
          borderRadius: "20px",
          background: COLORS.white,
          boxShadow: `
            -10px -10px 20px rgba(255, 255, 255, 0.8),
            10px 10px 20px rgba(0, 0, 0, 0.1)
          `,
        }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: "700",
            marginBottom: "8px",
            color: COLORS.text,
            textAlign: "center",
          }}>
            ProposalWriterAI
          </h1>
          <p style={{
            color: COLORS.textLight,
            textAlign: "center",
            marginBottom: "32px",
            fontSize: "14px",
          }}>
            AI-powered proposals in seconds
          </p>

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
              color: COLORS.text,
              fontSize: "14px",
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                ...neumorphicInput,
                width: "100%",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              fontWeight: "600",
              marginBottom: "8px",
              color: COLORS.text,
              fontSize: "14px",
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                ...neumorphicInput,
                width: "100%",
              }}
            />
          </div>

          {authError && (
            <div style={{
              color: COLORS.error,
              marginBottom: "16px",
              fontSize: "13px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: `${COLORS.error}15`,
            }}>
              {authError}
            </div>
          )}

          <button
            onClick={authState === "login" ? handleLogin : handleSignup}
            style={{
              ...neumorphicPrimaryButton,
              width: "100%",
              marginBottom: "12px",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.boxShadow = `
                inset -3px -3px 7px rgba(255, 255, 255, 0.5),
                inset 3px 3px 5px rgba(0, 0, 0, 0.12)
              `
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.boxShadow = `
                -3px -3px 7px rgba(255, 255, 255, 0.5),
                3px 3px 5px rgba(108, 71, 255, 0.3)
              `
            }}
          >
            {authState === "login" ? "Sign In" : "Create Account"}
          </button>

          <button
            onClick={() => {
              setAuthState(authState === "login" ? "signup" : "login")
              setAuthError("")
            }}
            style={{
              ...neumorphicButton,
              width: "100%",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.boxShadow = `
                inset -3px -3px 7px rgba(255, 255, 255, 0.5),
                inset 3px 3px 5px rgba(0, 0, 0, 0.12)
              `
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.boxShadow = `
                -3px -3px 7px rgba(255, 255, 255, 0.5),
                3px 3px 5px rgba(0, 0, 0, 0.12)
              `
            }}
          >
            {authState === "login" ? "Create Account" : "Back to Sign In"}
          </button>
        </div>
      </div>
    )
  }

  // MAIN APP
  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgDark} 100%)`,
      padding: "30px 20px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
          padding: "20px 30px",
          borderRadius: "20px",
          background: COLORS.white,
          boxShadow: `
            -10px -10px 20px rgba(255, 255, 255, 0.8),
            10px 10px 20px rgba(0, 0, 0, 0.1)
          `,
        }}>
          <h1 style={{
            fontSize: "28px",
            fontWeight: "700",
            margin: 0,
            color: COLORS.text,
          }}>
            ProposalWriterAI
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => {
                setShowHistory(false)
                setShowDocuments(false)
              }}
              style={{
                ...neumorphicButton,
                background: !showHistory && !showDocuments ? COLORS.primary : COLORS.white,
                color: !showHistory && !showDocuments ? "white" : COLORS.text,
                boxShadow: !showHistory && !showDocuments 
                  ? `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(108, 71, 255, 0.3)`
                  : `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(0, 0, 0, 0.12)`,
              }}
            >
              New
            </button>
            <button
              onClick={() => {
                setShowHistory(false)
                setShowDocuments(!showDocuments)
              }}
              style={{
                ...neumorphicButton,
                background: showDocuments ? COLORS.primary : COLORS.white,
                color: showDocuments ? "white" : COLORS.text,
                boxShadow: showDocuments
                  ? `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(108, 71, 255, 0.3)`
                  : `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(0, 0, 0, 0.12)`,
              }}
            >
              Docs
            </button>
            <button
              onClick={() => {
                setShowHistory(!showHistory)
                setShowDocuments(false)
              }}
              style={{
                ...neumorphicButton,
                background: showHistory ? COLORS.primary : COLORS.white,
                color: showHistory ? "white" : COLORS.text,
                boxShadow: showHistory
                  ? `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(108, 71, 255, 0.3)`
                  : `-3px -3px 7px rgba(255, 255, 255, 0.5), 3px 3px 5px rgba(0, 0, 0, 0.12)`,
              }}
            >
              History
            </button>
            <button
              onClick={handleLogout}
              style={neumorphicButton}
            >
              Logout
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{
          padding: "30px",
          borderRadius: "20px",
          background: COLORS.white,
          boxShadow: `
            -10px -10px 20px rgba(255, 255, 255, 0.8),
            10px 10px 20px rgba(0, 0, 0, 0.1)
          `,
        }}>
          {showDocuments ? (
            <div>
              <h2 style={{ color: COLORS.text, marginTop: 0 }}>Documents</h2>
              <p style={{ color: COLORS.textLight, marginBottom: "24px" }}>
                Upload documents to ground your proposals in real company info
              </p>

              <div style={{ marginBottom: "24px" }}>
                <label style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "12px",
                  color: COLORS.text,
                }}>
                  Upload PDF or TXT
                </label>
                <input
                  type="file"
                  onChange={handleUploadDocument}
                  disabled={uploading}
                  accept=".pdf,.txt"
                  style={{
                    ...neumorphicInput,
                    cursor: uploading ? "not-allowed" : "pointer",
                  }}
                />
                {uploading && <p style={{ color: COLORS.textLight, marginTop: "8px" }}>Uploading...</p>}
              </div>

              {documents.length === 0 ? (
                <p style={{ color: COLORS.textLight }}>No documents yet</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: COLORS.bg,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: `
                          -3px -3px 7px rgba(255, 255, 255, 0.5),
                          3px 3px 5px rgba(0, 0, 0, 0.05)
                        `,
                      }}
                    >
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", color: COLORS.text, fontSize: "15px" }}>
                          {doc.filename}
                        </h3>
                        <p style={{ margin: 0, color: COLORS.textLight, fontSize: "12px" }}>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        style={{
                          padding: "8px 16px",
                          background: COLORS.error,
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : showHistory ? (
            <div>
              <h2 style={{ color: COLORS.text, marginTop: 0 }}>Proposal History</h2>
              {proposals.length === 0 ? (
                <p style={{ color: COLORS.textLight }}>No proposals yet</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {proposals.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: COLORS.bg,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: `
                          -3px -3px 7px rgba(255, 255, 255, 0.5),
                          3px 3px 5px rgba(0, 0, 0, 0.05)
                        `,
                      }}
                    >
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", color: COLORS.text, fontSize: "15px" }}>
                          {p.client_name}
                        </h3>
                        <p style={{ margin: "0 0 4px 0", color: COLORS.textLight, fontSize: "13px" }}>
                          {p.your_company} • {new Date(p.created_at).toLocaleDateString()}
                        </p>
                        <p style={{ margin: 0, color: COLORS.textLight, fontSize: "12px" }}>
                          {p.price}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadPDF(p.id)}
                        disabled={downloadingId === p.id}
                        style={{
                          ...neumorphicButton,
                          background: downloadingId === p.id ? COLORS.textLight : COLORS.primary,
                          color: "white",
                          cursor: downloadingId === p.id ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {downloadingId === p.id ? "Downloading..." : "Download"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 style={{ color: COLORS.text, marginTop: 0 }}>Generate Proposal</h2>
              <p style={{ color: COLORS.textLight, marginBottom: "24px" }}>
                Fill in the details to generate a professional proposal
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                {[
                  { label: "Your Name", name: "your_name" },
                  { label: "Your Company", name: "your_company" },
                  { label: "Client Name", name: "client_name" },
                  { label: "Price", name: "price" },
                ].map((field) => (
                  <div key={field.name}>
                    <label style={{
                      display: "block",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: COLORS.text,
                      fontSize: "14px",
                    }}>
                      {field.label}
                    </label>
                    <input
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      style={{
                        ...neumorphicInput,
                        width: "100%",
                      }}
                    />
                  </div>
                ))}
              </div>

              {[
                { label: "Client's Problem", name: "client_problem" },
                { label: "Your Solution", name: "your_solution" },
              ].map((field) => (
                <div key={field.name} style={{ marginBottom: "16px" }}>
                  <label style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "8px",
                    color: COLORS.text,
                    fontSize: "14px",
                  }}>
                    {field.label}
                  </label>
                  <textarea
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    rows={4}
                    style={{
                      ...neumorphicInput,
                      width: "100%",
                      resize: "vertical",
                    }}
                  />
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  ...neumorphicPrimaryButton,
                  width: "100%",
                  marginBottom: "24px",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Generating..." : "Generate Proposal"}
              </button>

              {proposal && (
                <div>
                  <div style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: COLORS.bg,
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.6",
                    fontSize: "14px",
                    color: COLORS.text,
                    marginBottom: "16px",
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}>
                    {proposal}
                  </div>
                  <button
                    onClick={() => handleDownloadPDF(proposalId)}
                    disabled={downloadingId === proposalId}
                    style={{
                      ...neumorphicPrimaryButton,
                      width: "100%",
                    }}
                  >
                    {downloadingId === proposalId ? "Downloading..." : "Download as PDF"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}