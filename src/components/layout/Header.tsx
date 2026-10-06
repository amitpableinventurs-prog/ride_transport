import { useState } from 'react'
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

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

  return (
    <header className="flex h-16 items-center justify-between border-b border-navy-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button className="text-navy-500 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div>
          <p className="text-sm font-semibold text-navy-800">Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <p className="text-xs text-navy-300">{user?.roleName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-full p-2 text-navy-400 hover:bg-navy-50" aria-label="Notifications">
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-orange" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-500 text-xs font-semibold text-white">
              {initials}
            </div>
            <ChevronDown size={16} className="text-navy-300" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-navy-100 bg-white p-2 shadow-lg">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-navy-800">{user?.name}</p>
                  <p className="text-xs text-navy-300">{user?.email}</p>
                </div>
                <div className="my-1 h-px bg-navy-100" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-red hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
