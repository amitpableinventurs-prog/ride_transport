import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import { dashboardNavItem, navGroups, type NavAccent, type NavItem } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'

const COLLAPSED_KEY = 'rideflow-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

// Full class strings so Tailwind can see them at build time.
const accentStyles: Record<NavAccent, { tile: string; text: string; ring: string }> = {
  orange: { tile: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-400/30' },
  sky: { tile: 'bg-sky-500/15', text: 'text-sky-400', ring: 'ring-sky-400/30' },
  emerald: { tile: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-400/30' },
  amber: { tile: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-400/30' },
  violet: { tile: 'bg-violet-500/15', text: 'text-violet-400', ring: 'ring-violet-400/30' },
  pink: { tile: 'bg-pink-500/15', text: 'text-pink-400', ring: 'ring-pink-400/30' },
  cyan: { tile: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-400/30' },
  indigo: { tile: 'bg-indigo-500/15', text: 'text-indigo-400', ring: 'ring-indigo-400/30' },
  slate: { tile: 'bg-slate-400/15', text: 'text-slate-300', ring: 'ring-slate-300/30' },
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
  accent,
  nested = false,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate: () => void
  accent?: NavAccent
  nested?: boolean
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center px-2' : nested ? 'py-1.5 pl-3 pr-2.5' : 'px-2.5',
          isActive
            ? 'bg-gradient-to-r from-brand-orange/20 via-brand-orange/10 to-transparent text-white'
            : 'text-navy-200 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-orange shadow-[0_0_12px_2px] shadow-brand-orange/60" />
          )}
          <span
            className={clsx(
              'flex shrink-0 items-center justify-center rounded-lg transition-all duration-200',
              nested && !collapsed ? 'h-7 w-7' : 'h-8 w-8',
              isActive
                ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30'
                : clsx(
                    'bg-white/5 group-hover:bg-white/10 group-hover:text-white',
                    accent ? accentStyles[accent].text : 'text-navy-300',
                  ),
            )}
          >
            <Icon size={nested && !collapsed ? 15 : 16} strokeWidth={2} />
          </span>
          {!collapsed && <span className="truncate transition-transform duration-200 group-hover:translate-x-0.5">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [query, setQuery] = useState('')
  // Explicit open/closed choices; groups the user hasn't touched follow the current page.
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({})

  // Icon-only mode is a desktop feature; the mobile drawer always shows full labels.
  const mini = collapsed && !open

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (!item.permission || hasPermission(item.permission)) &&
            (!q || item.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [hasPermission, query])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1')
      } catch {
        // Storage unavailable; the preference just won't persist.
      }
      return !prev
    })
  }

  function toggleGroup(label: string, currentlyExpanded: boolean) {
    setToggledGroups((prev) => ({ ...prev, [label]: !currentlyExpanded }))
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const showDashboard =
    (!dashboardNavItem.permission || hasPermission(dashboardNavItem.permission)) &&
    (!query.trim() || dashboardNavItem.label.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy-900/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col overflow-hidden border-r border-white/5 bg-navy-800 shadow-2xl shadow-navy-900/40',
          'transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          mini ? 'w-72 lg:w-20' : 'w-72',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-navy-400/20 blur-3xl" />

        {/* Sticky top: brand + search */}
        <div className="relative z-10 shrink-0 border-b border-white/5 bg-navy-800/80 backdrop-blur-md">
          <div className={clsx('flex items-center py-5', mini ? 'justify-center px-3' : 'justify-between px-5')}>
            <div className="flex items-center gap-3">
              <img
                src="/brand/anz-icon-blue.png"
                alt="AnZ Cabs"
                className="h-10 w-10 shrink-0 rounded-xl bg-black object-cover shadow-lg shadow-black/40 ring-1 ring-white/20"
              />
              {!mini && (
                <div>
                  <p className="text-[15px] font-bold tracking-tight text-white">AnZ Cabs</p>
                  <p className="text-[11px] font-medium text-navy-300">Admin Panel</p>
                </div>
              )}
            </div>
            {!mini && (
              <>
                <button
                  className="hidden rounded-lg p-1.5 text-navy-300 transition-colors hover:bg-white/10 hover:text-white lg:block"
                  onClick={toggleCollapsed}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={18} />
                </button>
                <button
                  className="rounded-lg p-1.5 text-navy-300 hover:bg-white/10 hover:text-white lg:hidden"
                  onClick={onClose}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </>
            )}
          </div>

          {mini ? (
            <div className="flex justify-center pb-4">
              <button
                className="rounded-lg p-2 text-navy-300 transition-colors hover:bg-white/10 hover:text-white"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            </div>
          ) : (
            <div className="px-4 pb-4">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-navy-300 transition-colors focus-within:border-brand-orange/50 focus-within:bg-white/10">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search menu..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-navy-400 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Clear search" className="hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Scrollable nav with sticky group headings */}
        <nav className="sidebar-scroll relative z-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-3">
          {showDashboard && (
            <div className="mb-3">
              <SidebarLink item={dashboardNavItem} collapsed={mini} onNavigate={onClose} />
            </div>
          )}

          {visibleGroups.map((group) => {
            const hasActive = group.items.some((item) => pathname.startsWith(item.path))
            const expanded = mini || query.trim() !== '' || (toggledGroups[group.label] ?? hasActive)
            const GroupIcon = group.icon
            const accent = accentStyles[group.accent]
            return (
              <div key={group.label} className="mb-1">
                {mini ? (
                  <div className="mx-auto my-3 h-px w-8 bg-white/10" />
                ) : (
                  <div className="sticky top-0 z-10 -mx-3 bg-navy-800/90 px-3 py-0.5 backdrop-blur-md">
                    <button
                      onClick={() => toggleGroup(group.label, expanded)}
                      className={clsx(
                        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200',
                        expanded ? 'bg-white/[0.04]' : 'hover:bg-white/5',
                      )}
                      aria-expanded={expanded}
                    >
                      <span
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-105',
                          accent.tile,
                          accent.text,
                          accent.ring,
                        )}
                      >
                        <GroupIcon size={16} strokeWidth={2.2} />
                      </span>
                      <span
                        className={clsx(
                          'flex-1 truncate text-sm font-semibold transition-colors',
                          hasActive ? 'text-white' : 'text-navy-200 group-hover:text-white',
                        )}
                      >
                        {group.label}
                      </span>
                      {hasActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_1px] shadow-brand-orange/70" />
                      )}
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-navy-300">
                        {group.items.length}
                      </span>
                      <ChevronDown
                        size={15}
                        className={clsx(
                          'text-navy-400 transition-transform duration-300 group-hover:text-white',
                          expanded ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                    </button>
                  </div>
                )}
                <div
                  className={clsx(
                    'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                    expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div
                      className={clsx('space-y-0.5 pb-2 pt-1', !mini && 'ml-[26px] border-l border-white/10 pl-2')}
                    >
                      {group.items.map((item) => (
                        <SidebarLink
                          key={item.path}
                          item={item}
                          collapsed={mini}
                          onNavigate={onClose}
                          accent={group.accent}
                          nested
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {visibleGroups.length === 0 && !showDashboard && (
            <p className="px-3 py-8 text-center text-sm text-navy-400">No menu items match "{query}"</p>
          )}
        </nav>

        {/* Sticky bottom: user card */}
        {user && (
          <div className="relative z-10 shrink-0 border-t border-white/5 bg-navy-800/80 p-3 backdrop-blur-md">
            <div
              className={clsx(
                'flex items-center rounded-xl bg-white/5 ring-1 ring-white/5',
                mini ? 'flex-col gap-2 p-2' : 'gap-3 p-2.5',
              )}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-400 to-navy-500 text-xs font-semibold text-white ring-2 ring-brand-orange/40"
                title={mini ? user.name : undefined}
              >
                {initials}
              </div>
              {!mini && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                  <p className="truncate text-[11px] text-navy-300">{user.roleName}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-navy-300 transition-colors hover:bg-brand-red/15 hover:text-red-400"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
