import { useState, useEffect } from "react"
import posthog from 'posthog-js'

// Initialize PostHog
posthog.init('YOUR_POSTHOG_API_KEY', {
  api_host: 'https://app.posthog.com',
})

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
      
      console.log("Signup response:", data)
      
      if (data.session && data.session.access_token) {
        setUser(data.user)
        setToken(data.session.access_token)
        setAuthState("app")
      } else if (data.user) {
        setAuthError("Signup successful! Please check your email to confirm your account.")
        posthog.capture('user_signup')
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
        posthog.capture('user_login')
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        await fetchDocuments()
        e.target.value = "" // Reset file input
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Failed to upload document")
    }
    setUploading(false)
    posthog.capture('document_uploaded', {
       filename: file.filename,
})
  }

  async function handleDeleteDocument(docId) {
    try {
      await fetch(`https://proposalwriterai-api.onrender.com/documents/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    posthog.capture('proposal_generated', {
    client_name: form.client_name,
    has_documents: documents.length > 0,
})

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
      console.log("Generate proposal response:", data)
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
      setProposal("Something went wrong. Make sure your backend is running.")
    }

    setLoading(false)
  }

  async function handleDownloadPDF(propId) {
    setDownloadingId(propId)
    try {
      const response = await fetch(`https://proposalwriterai-api.onrender.com/proposals/${propId}/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      
      // Convert hex string back to binary
      const hexString = data.pdf_data
      const bytes = new Uint8Array(hexString.length / 2)
      for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
      }

      // Create blob and download
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

  // Login/Signup screen
  if (authState !== "app") {
    return (
      <div style={{ maxWidth: "400px", margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "32px" }}>
          ProposalWriterAI
        </h1>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "500", marginBottom: "6px" }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "15px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontWeight: "500", marginBottom: "6px" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "15px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {authError && (
          <div style={{ color: "#d32f2f", marginBottom: "16px", fontSize: "14px" }}>
            {authError}
          </div>
        )}

        <button
          onClick={authState === "login" ? handleLogin : handleSignup}
          style={{
            width: "100%",
            padding: "12px",
            background: "#6c47ff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          {authState === "login" ? "Login" : "Sign Up"}
        </button>

        <button
          onClick={() => {
            setAuthState(authState === "login" ? "signup" : "login")
            setAuthError("")
          }}
          style={{
            width: "100%",
            padding: "12px",
            background: "#f0f0f0",
            color: "#333",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          {authState === "login" ? "Create account" : "Back to login"}
        </button>
      </div>
    )
  }

  // Main app screen (after login)
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>
          ProposalWriterAI
        </h1>
        <div>
          <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => {
              setShowHistory(false)
              setShowDocuments(false)
            }}
            style={{
              padding: "8px 16px",
              background: !showHistory && !showDocuments ? "#6c47ff" : "#f0f0f0",
              color: !showHistory && !showDocuments ? "white" : "#333",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            New Proposal
          </button>
          <button
            onClick={() => {
              setShowHistory(false)
              setShowDocuments(!showDocuments)
            }}
            style={{
              padding: "8px 16px",
              background: showDocuments ? "#6c47ff" : "#f0f0f0",
              color: showDocuments ? "white" : "#333",
              border: "none",
              borderRadius: "8px",
              marginRight: "12px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Documents
          </button>
          <button
            onClick={() => {
              setShowHistory(!showHistory)
              setShowDocuments(false)
            }}
            style={{
              padding: "8px 16px",
              background: showHistory ? "#6c47ff" : "#f0f0f0",
              color: showHistory ? "white" : "#333",
              border: "none",
              borderRadius: "8px",
              marginRight: "12px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            History
          </button>
        </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Logout
          </button>
        </div>
      </div>
      {showDocuments ? (
        <div>
          <h2 style={{ marginBottom: "16px" }}>Your Documents</h2>
          <p style={{ color: "#666", marginBottom: "16px" }}>
            Upload company info, pricing, or case studies. Claude will use these when generating proposals.
          </p>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontWeight: "500", marginBottom: "8px" }}>
              Upload Document (PDF or TXT)
            </label>
            <input
              type="file"
              onChange={handleUploadDocument}
              disabled={uploading}
              accept=".pdf,.txt"
              style={{
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "15px",
                cursor: uploading ? "not-allowed" : "pointer",
              }}
            />
            {uploading && <p style={{ color: "#666", fontSize: "14px", marginTop: "8px" }}>Uploading...</p>}
          </div>

          {documents.length === 0 ? (
            <p style={{ color: "#666" }}>No documents yet. Upload one to get started!</p>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: "16px",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                    background: "#f9f9f9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                      {doc.filename}
                    </h3>
                    <p style={{ margin: 0, color: "#999", fontSize: "13px" }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    style={{
                      padding: "8px 16px",
                      background: "#ff6b6b",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
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
          <h2 style={{ marginBottom: "16px" }}>Your Proposals</h2>
          {proposals.length === 0 ? (
            <p style={{ color: "#666" }}>No proposals yet. Create one!</p>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {proposals.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "16px",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                    background: "#f9f9f9",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                      {p.client_name}
                    </h3>
                    <p style={{ margin: "0 0 8px 0", color: "#666", fontSize: "14px" }}>
                      {p.your_company} • {new Date(p.created_at).toLocaleDateString()}
                    </p>
                    <p style={{ margin: 0, color: "#999", fontSize: "13px" }}>
                      {p.price}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadPDF(p.id)}
                    disabled={downloadingId === p.id}
                    style={{
                      padding: "8px 16px",
                      background: downloadingId === p.id ? "#999" : "#6c47ff",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: downloadingId === p.id ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {downloadingId === p.id ? "Downloading..." : "Download PDF"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: "#666", marginBottom: "32px" }}>
            Fill in the details below and get a professional proposal in seconds.
          </p>

          {[
            { label: "Your name", name: "your_name", placeholder: "Fulano Detal" },
            { label: "Your company", name: "your_company", placeholder: "Company Inc" },
            { label: "Client name", name: "client_name", placeholder: "TheClient Corp" },
            { label: "Price / investment", name: "price", placeholder: "$299 | $$69.99/ Month" },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "6px" }}>
                {field.label}
              </label>
              <input
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "15px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          {[
            { label: "What problem does the client have?", name: "client_problem", placeholder: "They spend 5 hours writing proposals manually..." },
            { label: "What is your solution?", name: "your_solution", placeholder: "An AI tool that generates polished proposals..." },
          ].map((field) => (
            <div key={field.name} style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "6px" }}>
                {field.label}
              </label>
              <textarea
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "15px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#999" : "#6c47ff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "32px",
            }}
          >
            {loading ? "Generating proposal..." : "Generate proposal"}
          </button>

          {proposal && (
            <div>
              <div style={{
                background: "#f9f9f9",
                border: "1px solid #eee",
                borderRadius: "8px",
                padding: "24px",
                whiteSpace: "pre-wrap",
                lineHeight: "1.7",
                fontSize: "15px",
                marginBottom: "16px",
              }}>
                {proposal}
              </div>
              <button
                onClick={() => handleDownloadPDF(proposalId)}
                disabled={downloadingId === proposalId}
                style={{
                  padding: "12px 24px",
                  background: downloadingId === proposalId ? "#999" : "#6c47ff",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: downloadingId === proposalId ? "not-allowed" : "pointer",
                }}
              >
                {downloadingId === proposalId ? "Downloading..." : "Download as PDF"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}