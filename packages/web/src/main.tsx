import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import '@/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    lazy: async () => {
      const { App } = await import('@/App')

      return { Component: App }
    },
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
