import React from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight } from "lucide-react";
import { Customer } from "./components/Customer";
import { Operations } from "./components/Operations";
import { CaseStudy } from "./components/CaseStudy";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-serif-display/latin-400.css";
import "@fontsource/dm-serif-display/latin-400-italic.css";
import "./styles.css";
const page = location.pathname;
function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="project-bar">
        <a href="/case-study" className="project-name">
          SERVICEPILOT <span>/ an implementation study</span>
        </a>
        <a href="/case-study">
          Mirza Z. Hussain <ArrowUpRight size={13} />
        </a>
      </div>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Varde Motorverksted home">
          <span className="brand-mark">V</span>
          <span>
            VARDE<small>MOTORVERKSTED</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className={page === "/" ? "active" : ""} href="/">
            Service desk
          </a>
          <a
            className={page === "/operations" ? "active" : ""}
            href="/operations"
          >
            Operations
          </a>
          <a
            className={page === "/case-study" ? "active" : ""}
            href="/case-study"
          >
            The case study <ArrowUpRight size={14} />
          </a>
        </nav>
        <span className="demo-label">
          <span /> Fictional workshop
        </span>
      </header>
      {page === "/operations" ? (
        <Operations />
      ) : page === "/case-study" ? (
        <CaseStudy />
      ) : (
        <Customer />
      )}
      <footer>
        <span>Varde Motorverksted · Fictional demonstration environment</span>
        <span>Built around the work. Tested at the boundaries.</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
