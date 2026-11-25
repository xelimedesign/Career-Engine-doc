import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCareer } from '../store/CareerContext';
import { formatFirebaseAuthError } from '../firebase';
import { CareerEngineIcon } from './CareerEngineIcon';

const WELCOME_BG_URL = '/assets/aistudio/b68c9956-71a7-427e-baf5-65fe325eb941_fe67817c.webp';

function GoogleMark() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

export function SignInGate() {
  const { authLoading, signInWithGoogle, enterGuestMode } = useCareer();
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bgFailed, setBgFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      if (msg) {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#121316] text-white flex flex-col items-center justify-center px-6 py-12">
      {/* Fixed Full-Bleed Cosmic Background Artwork + Atmospheric Scrim */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-[#0e1628] via-[#121316] to-[#121316]"
        aria-hidden="true"
      >
        {!bgFailed && (
          <img
            src={WELCOME_BG_URL}
            alt="Dark cosmic blue and gold welcome backdrop"
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="w-full h-full object-cover blur-md scale-105"
          />
        )}

        {/* Smooth #121316 gradient scrim for crisp foreground legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,19,22,0.22) 0%, rgba(18,19,22,0.54) 45%, rgba(18,19,22,0.88) 78%, #121316 98%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 54%, rgba(18,19,22,0.74) 0%, rgba(18,19,22,0.38) 44%, rgba(18,19,22,0) 76%)',
          }}
        />
      </div>

      {/* Centered Foreground Content */}
      {authLoading ? (
        <div className="relative z-10 max-w-md mx-auto text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center">
            <CareerEngineIcon size={28} className="drop-shadow-[0_2px_10px_rgba(255,255,255,0.28)]" />
          </div>
          <div className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-200">
            <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
            <span>Loading Career Doc...</span>
          </div>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-md mx-auto text-center">
          {/* Brand Document Emblem */}
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <CareerEngineIcon size={28} className="drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]" />
          </div>

          {/* Headline & Subtitle */}
          <h1 className="font-ui text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Welcome to Career Doc
          </h1>
          <p className="text-sm sm:text-base text-slate-300/90 mt-3 leading-relaxed">
            Your verified career profile, job tracker, and document builder — powered by grounded data.
          </p>

          {/* Primary & Secondary Auth Actions */}
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleGoogleSignIn()}
              className="w-full py-3.5 px-6 rounded-full bg-white text-[#121316] font-semibold text-sm shadow-[0_0_30px_rgba(255,255,255,0.22)] hover:bg-slate-100 active:scale-[0.99] transition flex items-center justify-center gap-2.5 disabled:opacity-60 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {authBusy ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#121316] shrink-0" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            <button
              type="button"
              disabled={authBusy}
              onClick={enterGuestMode}
              className="w-full py-3 px-6 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white font-semibold text-sm hover:bg-white/15 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span>Continue as Guest</span>
            </button>

            <p className="pt-1 text-xs text-slate-300">
              Already have a profile?{' '}
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleSignIn()}
                className="font-semibold text-white underline-offset-4 hover:underline disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Log in
              </button>
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mt-5 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-400/35 backdrop-blur-md text-xs font-medium text-rose-100 text-center leading-relaxed"
            >
              {authError}
            </div>
          )}

          {/* Footer Notice */}
          <p className="mt-8 text-[11px] text-slate-400/85 leading-relaxed">
            Sign in with Google to sync across devices, or continue as Guest to keep data local to this browser with no personal account required.
          </p>
        </div>
      )}
    </main>
  );
}
