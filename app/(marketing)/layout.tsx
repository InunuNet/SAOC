// Breadcrumb component available from @/components/chrome for interior pages

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Breadcrumb injected by individual page layouts in M4+ */}
      {children}
    </>
  );
}
