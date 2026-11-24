export function StickyNoteBannerSvg({ type }: { type?: string }) {
  if (type === 'banner-screenshot') {
    return (
      <svg
        viewBox="0 0 340 132"
        className="w-full h-[126px] object-cover block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="snBgGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dbc9eb" />
            <stop offset="50%" stopColor="#c9c4e8" />
            <stop offset="100%" stopColor="#b9bce3" />
          </linearGradient>
          <linearGradient id="snFrameTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f7c948" />
            <stop offset="100%" stopColor="#ffd966" />
          </linearGradient>
          <linearGradient id="snFrameBot" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9b6ef3" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="snPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <rect width="340" height="132" fill="url(#snBgGrad1)" />
        <g opacity="0.52" fill="#ffffff">
          <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
          <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
          <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" strokeWidth="2" />
          <path
            d="M46 58 Q54 53 60 60 T74 62"
            fill="none"
            stroke="#d896c8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon points="16,92 60,86 72,126 10,126" />
          <circle cx="52" cy="98" r="2.4" fill="#8b7aa8" />
          <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
          <rect
            x="258"
            y="51"
            width="46"
            height="5"
            rx="2.5"
            transform="rotate(-12 280 53)"
            fill="#b8a8d8"
          />
          <rect
            x="242"
            y="68"
            width="16"
            height="16"
            rx="3"
            transform="rotate(22 250 76)"
            fill="none"
            stroke="#b8a8d8"
            strokeWidth="3"
          />
          <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
          <polygon points="292,115 304,117 306,125 288,122" fill="#b8a8d8" />
          <circle cx="304" cy="85" r="2.2" fill="#8b7aa8" />
        </g>
        <g>
          <rect
            x="145"
            y="54"
            width="48"
            height="48"
            rx="8"
            transform="rotate(45 169 78)"
            fill="#f4f1f8"
          />
          <path
            d="M126 42 V28 Q126 22 132 22 H148"
            fill="none"
            stroke="url(#snFrameTop)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M190 22 H206 Q212 22 212 28 V42"
            fill="none"
            stroke="url(#snFrameTop)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M126 84 V98 Q126 104 132 104 H148"
            fill="none"
            stroke="url(#snFrameBot)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M190 104 H206 Q212 104 212 98 V84"
            fill="none"
            stroke="url(#snFrameBot)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <polygon
            points="169,28 202,55 169,82 136,55"
            fill="none"
            stroke="#9d8ec7"
            strokeWidth="1.4"
          />
          <circle cx="169" cy="28" r="2.5" fill="#10b981" />
          <circle cx="202" cy="55" r="2.5" fill="#10b981" />
          <circle cx="169" cy="82" r="2.5" fill="#10b981" />
          <circle cx="136" cy="55" r="2.5" fill="#10b981" />
          <circle cx="169" cy="40" r="3.5" fill="#f59e0b" />
          <polygon points="163,46 180,55 163,64" fill="url(#snPlayGrad)" />
          <polygon points="168,51 182,58 168,65" fill="#3b82f6" opacity="0.85" />
        </g>
      </svg>
    );
  }

  if (type === 'banner-source') {
    return (
      <svg
        viewBox="0 0 340 132"
        className="w-full h-[126px] object-cover block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="snBgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d7c2ea" />
            <stop offset="50%" stopColor="#c5bee6" />
            <stop offset="100%" stopColor="#b7bce2" />
          </linearGradient>
          <linearGradient id="snLinkTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="snLinkMid" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="snLinkBot" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="340" height="132" fill="url(#snBgGrad2)" />
        <g opacity="0.52" fill="#ffffff">
          <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
          <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
          <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" strokeWidth="2" />
          <path
            d="M46 58 Q54 53 60 60 T74 62"
            fill="none"
            stroke="#d896c8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon points="16,92 60,86 72,126 10,126" />
          <circle cx="52" cy="98" r="2.4" fill="#8b7aa8" />
          <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
          <rect
            x="258"
            y="51"
            width="46"
            height="5"
            rx="2.5"
            transform="rotate(-12 280 53)"
            fill="#b8a8d8"
          />
          <rect
            x="242"
            y="68"
            width="16"
            height="16"
            rx="3"
            transform="rotate(22 250 76)"
            fill="none"
            stroke="#b8a8d8"
            strokeWidth="3"
          />
          <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
          <polygon points="292,115 304,117 306,125 288,122" fill="#b8a8d8" />
          <circle cx="304" cy="85" r="2.2" fill="#8b7aa8" />
        </g>
        <g transform="translate(170, 66) rotate(-42)">
          <rect
            x="4"
            y="-17"
            width="52"
            height="34"
            rx="17"
            fill="none"
            stroke="url(#snLinkTop)"
            strokeWidth="11"
          />
          <rect
            x="-56"
            y="-17"
            width="52"
            height="34"
            rx="17"
            fill="none"
            stroke="url(#snLinkBot)"
            strokeWidth="11"
          />
          <rect x="-24" y="-7" width="48" height="14" rx="7" fill="url(#snLinkMid)" />
          <circle cx="14" cy="-14" r="6.5" fill="#ffffff" />
          <circle cx="-14" cy="14" r="6.5" fill="#ffffff" />
        </g>
      </svg>
    );
  }

  if (type === 'banner-shortcut') {
    return (
      <div className="relative w-full h-[126px] overflow-hidden select-none">
        <svg
          viewBox="0 0 340 132"
          className="w-full h-full object-cover block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="snBgGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d8c3eb" />
              <stop offset="50%" stopColor="#c6bfe6" />
              <stop offset="100%" stopColor="#b8bde3" />
            </linearGradient>
            <linearGradient id="snCenterNote" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe259" />
              <stop offset="100%" stopColor="#ffa751" />
            </linearGradient>
          </defs>
          <rect width="340" height="132" fill="url(#snBgGrad3)" />
          <g opacity="0.52" fill="#ffffff">
            <rect x="18" y="8" width="44" height="68" rx="8" transform="rotate(14 40 42)" />
            <circle cx="44" cy="18" r="2.8" fill="#8b7aa8" />
            <circle cx="46" cy="34" r="6.5" fill="none" stroke="#8b7aa8" strokeWidth="2" />
            <polygon points="16,92 60,86 72,126 10,126" />
            <rect x="262" y="26" width="36" height="24" rx="4" transform="rotate(-12 280 38)" />
            <rect
              x="258"
              y="51"
              width="46"
              height="5"
              rx="2.5"
              transform="rotate(-12 280 53)"
              fill="#b8a8d8"
            />
            <rect x="275" y="76" width="52" height="38" rx="6" transform="rotate(12 301 95)" />
          </g>
          <circle cx="170" cy="66" r="42" fill="#ffffff" fillOpacity="0.32" />
          <g transform="translate(148, 44)">
            <path
              d="M0 7C0 3.13401 3.13401 0 7 0H37C40.866 0 44 3.13401 44 7V28L28 44H7C3.13401 44 0 40.866 0 37V7Z"
              fill="url(#snCenterNote)"
            />
            <path d="M28 44L44 28H33C30.2386 28 28 30.2386 28 33V44Z" fill="#7e22ce" />
            <rect x="19" y="31" width="27" height="14" rx="3" fill="#22d3ee" />
            <text
              x="32.5"
              y="41"
              fontFamily="Segoe UI, Inter, sans-serif"
              fontSize="9.5"
              fontWeight="800"
              fill="#0f172a"
              textAnchor="middle"
            >
              PRE
            </text>
          </g>
        </svg>
        <div className="absolute bottom-2 right-2.5 flex items-center gap-1.5">
          <span className="bg-white/90 text-[#2d2638] shadow px-2 py-0.5 rounded-[5px] text-[10.5px] font-semibold tracking-tight">
            Alt
          </span>
          <span className="bg-white/90 text-[#2d2638] shadow px-2 py-0.5 rounded-[5px] text-[10.5px] font-semibold tracking-tight">
            S
          </span>
        </div>
      </div>
    );
  }

  if (type === 'banner-snapshot') {
    return (
      <svg
        viewBox="0 0 340 120"
        className="w-full h-[116px] object-cover block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="snSnapBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="340" height="120" fill="url(#snSnapBg)" />
        <rect
          x="24"
          y="16"
          width="292"
          height="88"
          rx="8"
          fill="#273449"
          stroke="#3b4d6b"
          strokeWidth="1.5"
        />
        <circle cx="38" cy="28" r="3.5" fill="#f87171" />
        <circle cx="50" cy="28" r="3.5" fill="#fbbf24" />
        <circle cx="62" cy="28" r="3.5" fill="#34d399" />
        <rect x="38" y="42" width="110" height="10" rx="3" fill="#60a5fa" opacity="0.7" />
        <rect x="38" y="58" width="180" height="7" rx="3" fill="#94a3b8" opacity="0.4" />
        <rect x="38" y="71" width="145" height="7" rx="3" fill="#94a3b8" opacity="0.4" />
        <rect
          x="234"
          y="42"
          width="66"
          height="46"
          rx="6"
          fill="#c58af9"
          opacity="0.25"
          stroke="#c58af9"
          strokeDasharray="3 2"
        />
        <text
          x="267"
          y="68"
          fontFamily="Segoe UI, sans-serif"
          fontSize="10"
          fill="#e9d5ff"
          textAnchor="middle"
        >
          Snip Saved
        </text>
      </svg>
    );
  }

  return null;
}
