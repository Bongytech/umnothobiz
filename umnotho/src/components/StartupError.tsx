import { AlertTriangle, ExternalLink, ServerCog } from 'lucide-react';

interface StartupErrorProps {
  title?: string;
  message?: string;
  details?: string[];
  missing?: { key: string; label: string }[];
}

export default function StartupError({
  title = 'The app could not start',
  message = 'Something went wrong before Umnotho could render.',
  details = [],
  missing = [],
}: StartupErrorProps) {
  return (
    <div className="min-h-screen bg-dark-950 text-gray-300 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-red-500/20 bg-dark-900 p-8 shadow-2xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">{title}</h1>
            <p className="text-gray-400 leading-relaxed">{message}</p>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Missing environment variables
            </h2>
            <ul className="space-y-2">
              {missing.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-dark-950 border border-white/5 px-4 py-3"
                >
                  <code className="text-umnotho text-sm">{key}</code>
                  <span className="text-xs text-gray-500">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {details.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Details
            </h2>
            <pre className="max-h-48 overflow-auto rounded-xl bg-dark-950 border border-white/5 p-4 text-xs text-red-300 whitespace-pre-wrap">
              {details.join('\n\n')}
            </pre>
          </div>
        )}

        <div className="rounded-2xl border border-umnotho/20 bg-umnotho/5 p-5">
          <div className="flex items-center gap-2 text-umnotho font-semibold mb-3">
            <ServerCog className="w-5 h-5" /> How to fix it
          </div>
          <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
            <li>
              Run <code className="text-umnotho">npm run setup:env</code> to pull the public
              Firebase web config from the live demo.
            </li>
            <li>
              Or copy <code className="text-umnotho">.env.example</code> to{' '}
              <code className="text-umnotho">.env.local</code> and paste the values from Firebase
              console → Project settings → Your apps → Web app.
            </li>
            <li>
              Restart the dev server with <code className="text-umnotho">npm run dev</code>.
            </li>
          </ol>
          <p className="mt-4 text-xs text-gray-500">
            The Firebase web config is public (it ships in every deployed build); no private
            server key is needed to run the frontend. Access is enforced by Firebase
            Authentication and Firestore rules.
          </p>
        </div>

        <a
          href="https://github.com/Bongytech/umnothobiz#getting-started"
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-umnotho hover:text-umnotho-hover"
        >
          Open the setup guide
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
