import { useState, useEffect } from "react"

export default function App() {
  const [authState, setAuthState] = useState("login") // "login", "signup", "app"
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
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Load proposals when user logs in
  useEffect(() => {
    if (token) {
      fetchProposals()
    }
  }, [token])

  async function handleSignup() {
  setAuthError("")
  try {
    const response = await fetch("http://localhost:8000/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    
    console.log("Signup response:", data) // Debug line
    
    if (data.session && data.session.access_token) {
      setUser(data.user)
      setToken(data.session.access_token)
      setAuthState("app")
    } else if (data.user) {
      setAuthError("Signup successful! Please check your email to confirm your account.")
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
      const response = await fetch("http://localhost:8000/auth/login", {
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
      const response = await fetch("http://localhost:8000/proposals", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setProposals(data.proposals || [])
    } catch (error) {
      console.error("Failed to fetch proposals:", error)
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    setLoading(true)
    setProposal("")

    try {
      const response = await fetch("http://localhost:8000/generate-proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      setProposal(data.proposal)
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
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: "8px 16px",
              background: "#f0f0f0",
              border: "none",
              borderRadius: "8px",
              marginRight: "12px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showHistory ? "New Proposal" : "History"}
          </button>
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

      {showHistory ? (
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
                  }}
                >
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
            { label: "Your name", name: "your_name", placeholder: "Alex Johnson" },
            { label: "Your company", name: "your_company", placeholder: "ProposalWriterAI Inc" },
            { label: "Client name", name: "client_name", placeholder: "Acme Corp" },
            { label: "Price / investment", name: "price", placeholder: "$299/month" },
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
            <div style={{
              background: "#f9f9f9",
              border: "1px solid #eee",
              borderRadius: "8px",
              padding: "24px",
              whiteSpace: "pre-wrap",
              lineHeight: "1.7",
              fontSize: "15px",
            }}>
              {proposal}
            </div>
          )}
        </div>
      )}
    </div>
  )
}