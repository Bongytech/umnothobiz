import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-dark-950 px-6 py-8 text-sm text-gray-500">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Umnotho. Private beta.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal and support links">
          <Link to="/legal/terms" className="hover:text-white">
            Terms
          </Link>
          <Link to="/legal/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link to="/legal/refunds" className="hover:text-white">
            Refund policy
          </Link>
          <a href="mailto:bongy.tech@gmail.com" className="hover:text-white">
            Contact
          </a>
        </nav>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-xs text-gray-600">
        Umnotho is a barter marketplace, not a bank or financial adviser. Crypto payments are
        irreversible; only pay from a wallet you control.
      </p>
    </footer>
  );
}
