export function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-brand-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-200 border-t-navy-500" />
        <p className="text-sm text-navy-400">Loading AnZ Cabs Admin…</p>
      </div>
    </div>
  )
}
