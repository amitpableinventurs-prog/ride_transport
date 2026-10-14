import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { DrivePage } from '@/pages/DrivePage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PolicyPage } from '@/pages/PolicyPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="drive" element={<DrivePage />} />
        <Route path="policy/:slug" element={<PolicyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
