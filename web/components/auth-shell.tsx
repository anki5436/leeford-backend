import Link from "next/link";

export function BrandMark() {
  return (
    <div className="brand-mark" aria-label="Leeford Healthcare">
      <span className="brand-symbol" aria-hidden="true"><i /><i /></span>
      <span><strong>LEEFORD</strong><small>HEALTHCARE</small></span>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-brand-panel" aria-label="Leeford Healthcare">
        <div className="brand-content">
          <BrandMark />
          <div className="brand-message">
            <p className="eyebrow">ADMINISTRATION PORTAL</p>
            <h1>Better health begins with thoughtful care.</h1>
            <p>Secure access to the systems that support our healthcare operations and communities.</p>
          </div>
          <div className="trust-note"><span aria-hidden="true">{"\u2713"}</span> Secure enterprise access</div>
        </div>
        <div className="medical-pattern" aria-hidden="true"><span /><span /><span /></div>
      </section>
      <section className="auth-form-panel">
        <div className="mobile-brand"><Link href="/login"><BrandMark /></Link></div>
        <div className="auth-form-wrap">{children}</div>
        <p className="copyright">{"\u00A9"} Leeford Healthcare. Authorized access only.</p>
      </section>
    </main>
  );
}
