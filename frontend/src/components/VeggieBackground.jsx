// Decorative, hand-drawn (original, license-free) flat-style vegetable and
// fruit icons scattered behind the login form. Purely decorative - marked
// aria-hidden and non-interactive so it never gets in the way of the form.

function Carrot({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M50 30 L38 92 Q50 100 62 92 Z" fill="#f97316" />
      <path d="M46 32 L40 12 M50 30 L50 8 M54 32 L60 12" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function Tomato({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="58" r="34" fill="#ef4444" />
      <path
        d="M50 24 L44 14 L52 18 L58 10 L60 20 L70 16 L64 26"
        fill="#16a34a"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Broccoli({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="44" y="60" width="12" height="30" rx="4" fill="#a3e635" />
      <circle cx="50" cy="42" r="26" fill="#16a34a" />
      <circle cx="30" cy="52" r="16" fill="#22c55e" />
      <circle cx="70" cy="52" r="16" fill="#22c55e" />
    </svg>
  );
}

function Apple({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M50 34 C30 30 18 46 20 64 C22 82 36 92 50 88 C64 92 78 82 80 64 C82 46 70 30 50 34 Z"
        fill="#ef4444"
      />
      <path d="M50 34 L48 18" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 22 Q60 14 68 20" fill="#22c55e" />
    </svg>
  );
}

function LeafyGreen({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M50 90 C20 80 14 44 40 16 C46 40 42 56 52 66 C62 76 78 74 84 60 C82 82 66 92 50 90 Z"
        fill="#22c55e"
      />
    </svg>
  );
}

function OrangeSlice({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="#fb923c" />
      <circle cx="50" cy="50" r="30" fill="#fed7aa" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="50"
          x2={50 + 30 * Math.cos((deg * Math.PI) / 180)}
          y2={50 + 30 * Math.sin((deg * Math.PI) / 180)}
          stroke="#fb923c"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

const ITEMS = [
  { Icon: Carrot, style: { top: '6%', left: '4%', width: 70, transform: 'rotate(-18deg)' } },
  { Icon: Tomato, style: { top: '68%', left: '6%', width: 60, transform: 'rotate(10deg)' } },
  { Icon: Broccoli, style: { top: '10%', right: '6%', width: 70, transform: 'rotate(12deg)' } },
  { Icon: Apple, style: { top: '66%', right: '5%', width: 65, transform: 'rotate(-8deg)' } },
  { Icon: LeafyGreen, style: { bottom: '4%', left: '42%', width: 60, transform: 'rotate(6deg)' } },
  { Icon: OrangeSlice, style: { top: '38%', left: '2%', width: 44, transform: 'rotate(-4deg)' } },
  { Icon: OrangeSlice, style: { top: '40%', right: '3%', width: 44, transform: 'rotate(10deg)' } },
];

export default function VeggieBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      {ITEMS.map(({ Icon, style }, i) => (
        <Icon key={i} className="absolute opacity-20" style={style} />
      ))}
    </div>
  );
}
