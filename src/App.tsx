// src/App.tsx
import { ThemeProvider } from "./components/theme-provider"
import ScribeAI from "./screens/scribeAI" // Move your main component to a separate file
import { Analytics } from "@vercel/analytics/react"

export default function App() {
  return (
    <ThemeProvider>
      <ScribeAI />
      <Analytics />
    </ThemeProvider>
  )
}