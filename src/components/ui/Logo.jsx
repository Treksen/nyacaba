export default function Logo({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Nyacaba"
    >
      {/* Outer Emerald Ring */}
      <circle cx="32" cy="32" r="30" fill="#0F4A3C" />
      <circle
        cx="32"
        cy="32"
        r="26.5"
        fill="none"
        stroke="#D4A24E"
        strokeWidth="1"
        opacity="0.75"
      />

      {/* Menorah Stem */}
      <path
        d="M32 18V42"
        stroke="#D4A24E"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Left Branches */}
      <path
        d="M32 28C28 28 24 24 24 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 34C25 34 19 28 19 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 40C22 40 14 31 14 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Right Branches */}
      <path
        d="M32 28C36 28 40 24 40 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 34C39 34 45 28 45 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 40C42 40 50 31 50 18"
        stroke="#D4A24E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Candle Cups */}
      <rect x="12.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="17.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="22.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="30.5" y="12" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="38.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="43.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />
      <rect x="48.5" y="16" width="3" height="2" rx="0.6" fill="#D4A24E" />

      {/* Flames */}
      <path
        d="M14 12C15 13.5 15.2 14.5 14 15.5C12.8 14.5 13 13.5 14 12Z"
        fill="#F6C76A"
      />
      <path
        d="M19 12C20 13.5 20.2 14.5 19 15.5C17.8 14.5 18 13.5 19 12Z"
        fill="#F6C76A"
      />
      <path
        d="M24 12C25 13.5 25.2 14.5 24 15.5C22.8 14.5 23 13.5 24 12Z"
        fill="#F6C76A"
      />
      <path
        d="M32 8C33.2 10 33.5 11.2 32 12.5C30.5 11.2 30.8 10 32 8Z"
        fill="#F6C76A"
      />
      <path
        d="M40 12C41 13.5 41.2 14.5 40 15.5C38.8 14.5 39 13.5 40 12Z"
        fill="#F6C76A"
      />
      <path
        d="M45 12C46 13.5 46.2 14.5 45 15.5C43.8 14.5 44 13.5 45 12Z"
        fill="#F6C76A"
      />
      <path
        d="M50 12C51 13.5 51.2 14.5 50 15.5C48.8 14.5 49 13.5 50 12Z"
        fill="#F6C76A"
      />

      {/* Base */}
      <path
        d="M24 46H40"
        stroke="#D4A24E"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Bottom Decorative Dots */}
      <circle cx="20" cy="50" r="1.6" fill="#D4A24E" />
      <circle cx="32" cy="52" r="1.6" fill="#D4A24E" />
      <circle cx="44" cy="50" r="1.6" fill="#D4A24E" />
    </svg>
  );
}
