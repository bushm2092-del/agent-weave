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
    children: [
      {
        index: true,
        lazy: async () => {
          const { HomePage } = await import('@/pages/home/home-page')

          return { Component: HomePage }
        },
      },
      {
        path: 'canvas/:canvasId',
        lazy: async () => {
          const { CanvasPage } = await import('@/pages/canvas/canvas-page')

          return { Component: CanvasPage }
        },
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
