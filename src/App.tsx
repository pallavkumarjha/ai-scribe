// src/App.tsx
import { ThemeProvider } from "./components/theme-provider"
import ScribeAI from "./screens/scribeAI" // Move your main component to a separate file

export default function App() {
  return (
    <ThemeProvider>
      <ScribeAI />
    </ThemeProvider>
  )
}