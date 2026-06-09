import { useEffect, useState } from "react"

export default function Landing({ onGetStarted, logo }) {
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    const elements = document.querySelectorAll(".scroll-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="landing">
      {/* Decorative Glow Elements for Parallax */}
      <div className="landing-glow landing-glow-1"></div>
      <div className="landing-glow landing-glow-2"></div>

      <nav className="landing-nav">
        <div className="nav-left">
          <img src={logo} alt="ProposalWriterAI" className="brand-logo landing-brand-logo" />
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-right">
          <button className="btn-primary" onClick={onGetStarted}>
            Get Started Free
          </button>
        </div>
      </nav>

      <div className="landing-hero">
        <div className="hero-badge">✦ Powered by Claude AI</div>
        <h1 className="hero-title">
          Write winning proposals<br />in seconds, not hours
        </h1>
        <p className="hero-sub">
          ProposalWriterAI uses AI grounded in your company's actual services,
          pricing, and case studies to generate polished, persuasive proposals instantly.
        </p>
        <button className="btn-hero" onClick={onGetStarted}>
          Start for free →
        </button>
        <p className="hero-note">No credit card required · 3 free proposals</p>
      </div>

      {/* Product Mockup Preview */}
      <div className="landing-mockup scroll-reveal">
        <div className="mockup-window">
          <div className="mockup-header">
            <div className="mockup-dots">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
            </div>
            <div className="mockup-url">proposalwriterai.com/dashboard</div>
          </div>
          <div className="mockup-body">
            {/* Sidebar */}
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-logo">✦ ProposalWriterAI</div>
              <div className="mockup-nav-item active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/></svg>
                New Proposal
              </div>
              <div className="mockup-nav-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Documents
              </div>
              <div className="mockup-nav-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                History
              </div>
            </div>
            {/* Main Editor Preview */}
            <div className="mockup-main">
              <div className="mockup-editor-form">
                <div className="mockup-field">
                  <div className="mockup-label">Client Name</div>
                  <div className="mockup-input-val">TechStartup Corp</div>
                </div>
                <div className="mockup-field">
                  <div className="mockup-label">Your Solution</div>
                  <div className="mockup-input-val solution-text">Custom AI integrations & grounding models</div>
                </div>
                <div className="mockup-field">
                  <div className="mockup-label">Investment / Pricing</div>
                  <div className="mockup-input-val">$15,000 / month</div>
                </div>
                <div className="mockup-btn">Generate with Claude ✦</div>
              </div>
              <div className="mockup-output-pane">
                <div className="mockup-pane-header">
                  <span>output.pdf</span>
                  <div className="mockup-download-btn">Download PDF</div>
                </div>
                <div className="mockup-pane-content">
                  <div className="typing-text">
                    <p className="p-title">PROPOSAL FOR TECHSTARTUP CORP</p>
                    <p className="p-section">1. EXECUTIVE SUMMARY</p>
                    <p className="p-body">ProposalWriterAI is pleased to submit this proposal to integrate custom Claude-powered grounding models into TechStartup Corp's current knowledge base. Our solution will reduce manual proposal operations by 70%...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      <div className="landing-features" id="features">
        {[
          {
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            ),
            title: "Generate in seconds",
            desc: "Fill in a few fields and Claude writes a complete, professional proposal grounded in your business context."
          },
          {
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            ),
            title: "Upload your docs",
            desc: "Upload your services, pricing, and case studies. Your proposals reference real details, not generic fluff."
          },
          {
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            ),
            title: "Download as PDF",
            desc: "Export beautifully formatted PDFs ready to send to clients. Professional quality every time."
          },
        ].map((f, i) => (
          <div className="feature-card scroll-reveal" key={i}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="landing-stats">
        {[
          { number: "2 min", label: "Average proposal time" },
          { number: "70%", label: "Time saved vs manual" },
        ].map(s => (
          <div className="stat-item scroll-reveal" key={s.label}>
            <div className="stat-number">{s.number}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ABOUT SECTION */}
      <div className="landing-about" id="about">
        <div className="section-label scroll-reveal">About</div>
        <h2 className="section-title scroll-reveal">Built for teams that move fast</h2>
        <p className="section-sub scroll-reveal">
          ProposalWriterAI was built to solve a real problem — sales teams spending hours
          writing proposals instead of closing deals. By combining Claude AI with your
          company's actual knowledge base, every proposal feels handcrafted, not generic.
        </p>
        <div className="about-grid">
          {[
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3.001 3.001 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"/>
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3.001 3.001 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/>
                </svg>
              ),
              title: "Company-aware AI",
              desc: "Upload your docs once. Every proposal references your real services, pricing, and case studies."
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
              title: "Fast by design",
              desc: "From blank form to polished PDF in under 2 minutes. Respond to RFPs before your competitors."
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ),
              title: "Private and secure",
              desc: "Your documents and proposals are private to your account. No data is shared between users."
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ),
              title: "Built for B2B",
              desc: "Designed specifically for sales teams, consultants, agencies, and professional services firms."
            },
          ].map((item, i) => (
            <div className="about-card scroll-reveal" key={i}>
              <div className="about-icon">{item.icon}</div>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING SECTION */}
      <div className="landing-pricing" id="pricing">
        <div className="section-label scroll-reveal">Pricing</div>
        <h2 className="section-title scroll-reveal">Simple, transparent pricing</h2>
        <p className="section-sub scroll-reveal">Start free. Upgrade when you're ready.</p>

        <div className="pricing-grid">
          <div className="pricing-card scroll-reveal">
            <div className="pricing-plan">Free</div>
            <div className="pricing-price">$0<span>/month</span></div>
            <p className="pricing-desc">Perfect for trying it out</p>
            <ul className="pricing-features">
              <li>✓ 3 proposals total</li>
              <li>✓ PDF export</li>
              <li>✓ Document upload</li>
              <li>✓ Proposal history</li>
            </ul>
            <button className="btn-outline-pricing" onClick={onGetStarted}>
              Get started free
            </button>
          </div>

          <div className="pricing-card pricing-card-featured scroll-reveal">
            <div className="pricing-badge">Most Popular</div>
            <div className="pricing-plan">Pro</div>
            <div className="pricing-price">$29<span>/month</span></div>
            <p className="pricing-desc">For teams closing deals</p>
            <ul className="pricing-features">
              <li>✓ Unlimited proposals</li>
              <li>✓ PDF export</li>
              <li>✓ Document upload</li>
              <li>✓ Proposal history</li>
              <li>✓ Priority support</li>
              <li>✓ Early access to new features</li>
            </ul>
            <button className="btn-hero" onClick={onGetStarted}>
              Start free trial
            </button>
          </div>

          <div className="pricing-card scroll-reveal">
            <div className="pricing-plan">Enterprise</div>
            <div className="pricing-price">Custom</div>
            <p className="pricing-desc">For larger organizations</p>
            <ul className="pricing-features">
              <li>✓ Everything in Pro</li>
              <li>✓ Team accounts</li>
              <li>✓ CRM integrations</li>
              <li>✓ Custom templates</li>
              <li>✓ Dedicated support</li>
              <li>✓ SSO & security</li>
            </ul>
            <button className="btn-outline-pricing" onClick={() => window.location.href = 'mailto:jesusgtech0@gmail.com'}>
              Contact sales
            </button>
          </div>
        </div>
      </div>

      {/* FAQ SECTION */}
      <div className="landing-faq scroll-reveal" id="faq">
        <div className="section-label">FAQ</div>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-sub">Have questions? We have answers.</p>

        <div className="faq-grid">
          {[
            {
              q: "How does ProposalWriterAI generate grounded proposals?",
              a: "ProposalWriterAI connects with your uploaded documents (such as services details, case studies, or pricing guides). When generating, Claude AI references these documents to pull in real details, rather than creating generic data."
            },
            {
              q: "Is my company data kept secure and private?",
              a: "Absolutely. Your documents and proposals are private to your account. No data is shared with other accounts, and we do not use your proprietary documents to train general public models."
            },
            {
              q: "Can I download proposals as PDFs?",
              a: "Yes! Every proposal generated can be instantly downloaded as a beautifully formatted, client-ready PDF directly from the dashboard."
            },
            {
              q: "Is there a limit to how many documents I can upload?",
              a: "Free accounts can upload up to 3 documents. Pro users have unlimited storage for services, case studies, and corporate knowledge base documents."
            }
          ].map((faq, index) => (
            <div 
              className={`faq-item ${expandedFaq === index ? "expanded" : ""}`} 
              key={index}
              onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
            >
              <div className="faq-question">
                <span>{faq.q}</span>
                <span className="faq-toggle">{expandedFaq === index ? "−" : "+"}</span>
              </div>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="landing-cta scroll-reveal">
        <h2>Ready to close more deals?</h2>
        <p>Join teams already using ProposalWriterAI to respond faster and win more business.</p>
        <button className="btn-hero" onClick={onGetStarted}>
          Get started free →
        </button>
      </div>

      <footer className="landing-footer scroll-reveal">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-brand-logo">✦ ProposalWriterAI</span>
            <p>Generate grounded, custom proposals in minutes using advanced Claude AI models.</p>
          </div>
          <div className="footer-column">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-column">
            <h4>Company</h4>
            <a href="#about">About Us</a>
            <a href="mailto:jesusgtech0@gmail.com">Contact Sales</a>
            <a href="mailto:jesusgtech0@gmail.com">Support</a>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <a href="#privacy" onClick={(e) => { e.preventDefault(); setActiveModal('privacy'); }}>Privacy Policy</a>
            <a href="#terms" onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }}>Terms of Service</a>
            <a href="#security" onClick={(e) => { e.preventDefault(); setActiveModal('security'); }}>Security</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ProposalWriterAI · Built with Claude AI</span>
          <span className="footer-spark">✦</span>
        </div>
      </footer>

      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setActiveModal(null)}>×</button>
            <div className="modal-content">
              {activeModal === 'privacy' && (
                <>
                  <h2>Privacy Policy</h2>
                  <p className="modal-date">Last updated: June 9, 2026</p>
                  <p>Welcome to ProposalWriterAI. We care about protecting your personal and business data. This Privacy Policy explains what we collect, how we use it, and the safeguards built into the service.</p>
                  
                  <h3>1. Information We Collect</h3>
                  <p>To ground proposal generation in your company's actual context, we collect and store:</p>
                  <ul>
                    <li>Account credentials (such as email) provided during Supabase registration.</li>
                    <li>Company knowledge base documents (pricing sheets, services descriptions, case studies) you upload.</li>
                    <li>Metadata and text content of generated proposals.</li>
                  </ul>

                  <h3>2. Processing and AI Integration</h3>
                  <p>Your uploaded documents are stored in Supabase. When you submit a request to generate a proposal, portions of those documents may be sent to Anthropic's Claude API so the generated text can reference your company context. We do not sell your uploaded documents or generated proposals.</p>

                  <h3>3. Data Security</h3>
                  <p>The app is designed to separate user data by authenticated account, and database access should be protected with Supabase Row-Level Security (RLS) policies in production. We also restrict authenticated API requests to the requesting user's records.</p>

                  <h3>4. Contact Us</h3>
                  <p>For questions regarding this policy, please contact our privacy desk at <a href="mailto:jesusgtech0@gmail.com">jesusgtech0@gmail.com</a>.</p>
                </>
              )}
              {activeModal === 'terms' && (
                <>
                  <h2>Terms of Service</h2>
                  <p className="modal-date">Last updated: June 9, 2026</p>
                  <p>By registering or using ProposalWriterAI, you agree to these Terms of Service.</p>

                  <h3>1. Account Registration</h3>
                  <p>You must create an account using a valid email to access proposal generation features. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities on your account.</p>

                  <h3>2. Intellectual Property & Output Rights</h3>
                  <p>We claim no ownership over the text documents you upload or the proposals generated by the platform. You retain full copyright and intellectual property rights in the generated output.</p>

                  <h3>3. Pricing & Subscription Plans</h3>
                  <p>Plan availability, proposal limits, and billing features may change as the product evolves. Any paid subscription terms will be shown during checkout before purchase.</p>

                  <h3>4. Limitation of Liability</h3>
                  <p>ProposalWriterAI is provided "as is". AI-generated proposals can contain mistakes, omissions, or unsupported claims. You are responsible for reviewing all proposals before sending them to clients.</p>
                </>
              )}
              {activeModal === 'security' && (
                <>
                  <h2>Security Information</h2>
                  <p className="modal-date">Last updated: June 9, 2026</p>
                  <p>ProposalWriterAI is designed to keep account data separated and to avoid exposing server-side credentials to the browser.</p>

                  <h3>1. Row-Level Data Isolation</h3>
                  <p>The backend scopes document, proposal, and subscription queries to the authenticated Supabase user ID. Production deployments should keep Supabase Row-Level Security (RLS) enabled with policies that restrict each user to their own records.</p>

                  <h3>2. Encryption in Transit & Rest</h3>
                  <p>Production traffic should run over HTTPS between the browser, the FastAPI backend, Supabase, Stripe, and Anthropic. Server-side API keys are stored as environment variables and are not bundled into the frontend.</p>

                  <h3>3. Secure LLM APIs</h3>
                  <p>FastAPI proxies communication with Anthropic's Claude models so Anthropic API keys are not exposed to the client. Uploaded document excerpts may be included in model prompts when needed to generate grounded proposals.</p>

                  <h3>4. Incident Response</h3>
                  <p>For security vulnerability disclosures or inquiries, contact us at <a href="mailto:jesusgtech0@gmail.com">jesusgtech0@gmail.com</a>.</p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setActiveModal(null)}>I Understand</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
