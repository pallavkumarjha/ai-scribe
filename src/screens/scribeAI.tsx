import { useState, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import Lottie from 'lottie-react';
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
  BookOpen,
  CoffeeIcon,
  Download,
  HelpCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import OpenAI from 'openai'
import { jsPDF } from 'jspdf'
import heroImage from '../assets/images/hero.jpeg'
import animationData from '../assets/animations/header.json'; // Make sure to replace with the correct path
import heic2any from 'heic2any';

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
  const [showGuidelines, setShowGuidelines] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        switch (file.type) {
          case 'image/heic':
            // Convert HEIC to JPEG
            heic2any({ blob: file, toType: 'image/jpeg' })
              .then((convertedBlob) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  setImages(prev => [...prev, { 
                    id: Date.now().toString(), 
                    src: e.target?.result as string, 
                    notes: '' 
                  }]);
                };
                reader.readAsDataURL(convertedBlob as Blob);
              })
              .catch(error => {
                console.error('HEIC conversion error:', error);
              });
            break;
          case 'image/jpeg':
          case 'image/png':
          case 'image/gif':
          case 'image/bmp':
          case 'image/webp':
            // Directly read these common image types
            const reader = new FileReader();
            reader.onload = (e) => {
              setImages(prev => [...prev, { 
                id: Date.now().toString(), 
                src: e.target?.result as string, 
                notes: '' 
              }]);
            };
            reader.readAsDataURL(file);
            break;
          default:
            alert(`Unsupported file type: ${file.type}`);
            break;
        }
      });
    }
    setShowIntro(false);
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
        ]
      })

      const messageContent = response.choices[0]?.message?.content?.trim()

      if (messageContent) {
        // Format the response content
        const formattedContent = messageContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n')

        return formattedContent
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

    setImages(updatedImages)
    setIsProcessing(false)
  }

  const handleExportPDF = () => {
    const pdf = new jsPDF()
    let yOffset = 20

    images.forEach((image, index) => {
      if (index > 0) {
        pdf.addPage()
        yOffset = 20
      }

      // Add image
      pdf.addImage(image.src, 'JPEG', 20, yOffset, 80, 80)
      yOffset += 90

      // Add notes
      pdf.setFontSize(14)
      pdf.text('Generated Notes:', 20, yOffset)
      yOffset += 10
      pdf.setFontSize(12)
      const splitNotes = pdf.splitTextToSize(image.notes, 170)
      pdf.text(splitNotes, 20, yOffset)
    })

    pdf.save('image_notes_ai.pdf')
  }

  return (
    <div className={`min-h-screen bg-dark-background flex flex-col ${isDark ? 'bg-dark-background text-white bg-gray-800' : 'bg-background text-black'} transition-colors duration-300`}>
      <nav className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6" />
            <span className="text-xl font-bold">Image Notes AI</span>
          </div>
          <Lottie
            animationData={animationData} 
            loop={true} 
            style={{ width: 40, height: 40 }} 
            className="rounded-full mx-auto" 
          />
          <Button
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className="rounded-full"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      <main className={`container mx-auto px-4 py-8 flex-grow ${isDark ? 'bg-dark-background' : 'bg-background'}`}>
        <section className={`hero ${isDark ? 'bg-gray-800' : 'bg-gray-100'} py-20 mb-8`}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center text-center md:text-left gap-8">
            <div className="md:w-1/2 space-y-4">
              <h1 className="text-5xl font-bold mb-4">Transform Handwriting to Text ✨</h1>
              <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-muted-foreground'}`}>
                Our platform allows you to transform your handwritten notes into structured, editable text using advanced AI technology. Upload your images and let us do the rest!
              </p>
              <Button 
                onClick={() => window.scrollBy({ top: 500, behavior: 'smooth' })}
                className={`mt-4 ${!isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
                variant="primary"
              >
                Try it
              </Button>
            </div>
            <div className="md:w-1/2 mt-8 md:mt-0">
              <img 
                src={heroImage}
                alt="Illustration" 
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-8 max-w-6xl mx-auto">
          <Card className={isDark ? 'bg-gray-800' : 'bg-white'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Images
                <HelpCircle
                onClick={() => setShowGuidelines(true)} 
                className="ml-auto"
              />
              </CardTitle>
             
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="image-upload">Images of handwritten text</Label>
                  <Input 
                    id="image-upload" 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={`cursor-pointer ${!isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
                    multiple
                  />
                </div>
                {images.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-2"
                  >
                    <Button 
                      onClick={handleGenerateNotes} 
                      disabled={isProcessing}
                      className="w-full sm:w-auto"
                      variant="primary"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {isProcessing ? 'Processing...' : 'Generate Notes'}
                    </Button>
                    <Button 
                      onClick={handleExportPDF} 
                      disabled={images.some(img => !img.notes)}
                      className="w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export as PDF
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {images.length > 0 && (
            <Card className={isDark ? 'bg-gray-900' : 'bg-white'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div 
                  className="space-y-8"
                  layout
                >
                  {images.map((image) => (
                    <motion.div 
                      key={image.id} 
                      className="space-y-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        <div>
                          <ImagePreview image={image} onDelete={() => handleDeleteImage(image.id)} />
                          {image.notes && <Button 
                            onClick={() => navigator.clipboard.writeText(image.notes)}
                            className="mt-2"
                          >
                            Copy Text
                            </Button>}
                        </div>
                        <div className="flex-grow md:order-last">
                          <Textarea 
                            id={`notes-${image.id}`}
                            value={image.notes}
                            readOnly
                            className={`min-h-[300px] font-mono text-sm p-4 ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
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
          <p className="text-sm text-gray-500 text-center">AI can make mistakes, so please review the notes carefully.</p>
        </div>
      </main>

      <footer className={`mt-12 ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-900 text-white'}`}>
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-center text-sm">
            &copy; 2024 AI Code Converter. All rights reserved.
          </p>
          <button
            onClick={() => window.open('https://buymeacoffee.com/pallavjha', '_blank')}
            className="inline-flex items-center px-4 py-2 text-sm bg-transparent hover:bg-white hover:bg-opacity-10 rounded-md transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <CoffeeIcon style={{ marginRight: '12px' }} />
            Buy Me a Coffee
          </button>
        </div>
      </footer>

      {showGuidelines && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Guidelines</h2>
            <p className="mb-4">
              Here are some guidelines for uploading images:
              <ul className="list-disc pl-5">
                <li>Ensure the image is clear and well-lit.</li>
                <li>Supported formats: JPEG, PNG, GIF, BMP, WEBP, HEIC.</li>
                <li>Maximum file size: 5MB.</li>
              </ul>
            </p>
            <Button 
              onClick={() => setShowGuidelines(false)} 
              className="mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
