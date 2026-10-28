// The theme lede takes the main variable italic (nos-theme.css), so these routes no longer wrap their children in the retired
// 300-only italic scope. check-static no-lede-scope reads this file, so it stays as a pass-through.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
