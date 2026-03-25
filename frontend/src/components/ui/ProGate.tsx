interface ProGateProps {
  children: React.ReactNode;
  featureName?: string;
  className?: string;
}

// Gating is currently disabled — all authenticated users have full access.
// To re-enable tier-based gating, restore the blur overlay and check:
//   const isPro = useAuthStore((s) => s.isPro());
export default function ProGate({ children, className }: ProGateProps) {
  return <div className={className}>{children}</div>;
}
