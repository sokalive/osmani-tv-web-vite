import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { ContentProtection } from './components/protection/ContentProtection'

function App() {
  return (
    <ContentProtection>
      <RouterProvider router={router} />
    </ContentProtection>
  )
}

export default App
