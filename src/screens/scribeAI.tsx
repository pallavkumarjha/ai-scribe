import { useState, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { 
  FileText, 
  X, 
  Sun, 
  Moon,
  Upload,
  Sparkles,
  BookOpen
} from 'lucide-react'
import { motion } from 'framer-motion'
import OpenAI from 'openai'

interface ImageData {
  id: string;
  src: string;
  notes: string;
}

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

const ImagePreview = ({ image, onDelete }: { image: ImageData; onDelete: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group"
    >
      <div className="w-[200px] h-[200px] relative overflow-hidden rounded-xl shadow-lg transition-transform duration-300 transform hover:scale-105">
        <img 
          src={image.src} 
          alt="Uploaded handwritten text" 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300" />
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={onDelete}
        aria-label="Delete image"
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

export default function ScribeAI() {
  const [images, setImages] = useState<ImageData[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [, setShowIntro] = useState(true)

  useEffect(() => {
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onload = (e) => {
          setImages(prev => [...prev, { 
            id: Date.now().toString(), 
            src: e.target?.result as string, 
            notes: '' 
          }])
        }
        reader.readAsDataURL(file)
      })
    }
    setShowIntro(false)
  }

  const handleDeleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  const handleAINotes = async (text: string) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert in text analysis. Please convert the following handwritten text into a structured and concise format, highlighting key points and organizing the information logically:\n\n"${text}"\n\nProvide the structured notes below:`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      })
      if (response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
        return response.choices[0].message.content.trim()
      } else {
        console.error('OpenAI API Error: Response is invalid or missing content')
        return 'Error generating notes. Please try again.'
      }
    } catch (error) {
      console.error('OpenAI API Error:', error)
      return 'Error generating notes. Please try again.'
    }
  }

  const handleGenerateNotes = async () => {
    if (images.length === 0) return

    setIsProcessing(true)

    const worker = await createWorker()

    const updatedImages = await Promise.all(images.map(async (image) => {
      try {
        const { data: { text } } = await worker.recognize(image.src)
        const aiNotes = await handleAINotes(text)
        return { ...image, notes: aiNotes }
      } catch (error) {
        console.error('OCR Error:', error)
        return { ...image, notes: 'Error processing image. Please try again.' }
      }
    }))

    await worker.terminate()

    console.log('updatedImages', updatedImages)

    setImages(updatedImages)
    setIsProcessing(false)
  }


  return (
    <div className={`min-h-screen bg-background transition-colors duration-300`}>
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6" />
            <span className="text-xl font-bold">ScribeAI</span>
          </div>
          <Button
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className="rounded-full"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Transform Handwriting to Text ✨</h1>
          <p className="text-muted-foreground">
            Upload your handwritten notes and let AI convert them into editable text
          </p>
        </motion.div>

        <div className="grid gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="image-upload">Images of handwritten text</Label>
                  <Input 
                    id="image-upload" 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="cursor-pointer"
                    multiple
                  />
                </div>
                {images.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Button 
                      onClick={handleGenerateNotes} 
                      disabled={isProcessing}
                      className="w-full sm:w-auto"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {isProcessing ? 'Processing...' : 'Generate Notes'}
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div 
                  className="space-y-6"
                  layout
                >
                  {images.map((image) => (
                    <motion.div 
                      key={image.id} 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        <ImagePreview image={image} onDelete={() => handleDeleteImage(image.id)} />
                        <div className="flex-grow">
                          <Label htmlFor={`notes-${image.id}`} className="text-sm font-medium mb-2 block">
                            Transcribed Text
                          </Label>
                          <Textarea 
                            id={`notes-${image.id}`}
                            value={image.notes}
                            readOnly
                            className="min-h-[150px] font-mono text-sm"
                            placeholder="Notes will appear here after processing..."
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Made with 💜 by ScribeAI
        </div>
      </footer>
    </div>
  )
}
