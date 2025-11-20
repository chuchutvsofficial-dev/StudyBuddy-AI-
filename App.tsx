import React, { useState, useRef, useEffect } from 'react';
import { fileToGenerativePart, solveHomework } from './services/gemini';
import { Message, Role, LoadingState } from './types';
import { ChatBubble } from './components/ChatBubble';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';

// Helper for unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to center crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const App: React.FC = () => {
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: Role.MODEL,
      text: "Hi! I'm StudyBuddy. 👋\n\n**Select your language** above, then **snap a photo** 📷 of your homework problem.\n\nI can explain solutions in **Hindi** or **English**!",
      timestamp: Date.now(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string, mimeType: string, preview: string } | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');

  // --- Cropping State ---
  const [isCropping, setIsCropping] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingState]);

  // --- Image Handling & Cropping ---

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropImageSrc(reader.result?.toString() || null);
        setIsCropping(true);
        // Reset crop state
        setCrop(undefined); 
      });
      reader.readAsDataURL(e.target.files[0]);
      
      // Clear input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Set an initial centered crop
    const initialCrop = centerAspectCrop(width, height, 16 / 9);
    // Remove aspect requirement for free cropping
    const freeCrop = { ...initialCrop, aspect: undefined }; 
    setCrop(freeCrop);
  };

  const getCroppedImg = async () => {
    if (!imgRef.current || !completedCrop || !cropImageSrc) {
      // If no crop, just use original image
      if (cropImageSrc) {
          // Basic conversion if they didn't touch crop
          const response = await fetch(cropImageSrc);
          const blob = await response.blob();
          const file = new File([blob], "image.jpg", { type: "image/jpeg" });
          await processFinalImage(file);
          setIsCropping(false);
      }
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Handle high DPI
    const pixelRatio = window.devicePixelRatio;
    canvas.width = completedCrop.width * scaleX * pixelRatio;
    canvas.height = completedCrop.height * scaleY * pixelRatio;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
    );

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
      await processFinalImage(file);
      setIsCropping(false);
      setCropImageSrc(null);
    }, 'image/jpeg');
  };

  const processFinalImage = async (file: File) => {
    try {
      const result = await fileToGenerativePart(file);
      setSelectedImage({
        base64: result.inlineData.data,
        mimeType: result.inlineData.mimeType,
        preview: URL.createObjectURL(file)
      });
    } catch (error) {
      console.error("Error processing image", error);
      alert("Failed to process image.");
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
  };

  const cancelCrop = () => {
    setIsCropping(false);
    setCropImageSrc(null);
  };

  // --- Chat Logic ---

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || loadingState !== 'idle') return;

    const userMessageId = generateId();
    const currentText = inputText;
    const currentImage = selectedImage;

    // 1. Add User Message
    const newUserMessage: Message = {
      id: userMessageId,
      role: Role.USER,
      text: currentText,
      image: currentImage?.base64, 
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    clearImage();
    setLoadingState('thinking');

    try {
      // 2. Call API with Language
      const responseText = await solveHomework(currentText, currentImage?.base64, currentImage?.mimeType, language);

      // 3. Add Model Response
      const newModelMessage: Message = {
        id: generateId(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newModelMessage]);

    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        role: Role.MODEL,
        text: "Sorry, I encountered an error. Please check your connection.",
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingState('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'StudyBuddy AI',
          text: 'Check out this AI Homework Helper!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* --- Image Cropping Modal --- */}
      {isCropping && cropImageSrc && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
          <div className="flex justify-between items-center p-4 bg-black/80 text-white backdrop-blur-sm absolute top-0 left-0 right-0 z-10">
            <button 
              onClick={cancelCrop} 
              className="text-sm font-medium text-gray-300 hover:text-white px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <h2 className="font-semibold text-lg">Crop Question</h2>
            <button 
              onClick={getCroppedImg} 
              className="text-sm font-bold text-indigo-400 hover:text-indigo-300 px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
            >
              Done
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-black">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-[80vh]"
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={cropImageSrc}
                onLoad={onImageLoad}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </ReactCrop>
          </div>
          
          <div className="p-6 bg-black text-center">
            <p className="text-gray-400 text-sm">
              Drag the corners to select only the question you want to solve.
            </p>
          </div>
        </div>
      )}

      {/* --- Header --- */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.221 69.78 69.78 0 00-2.669.813m-4.278 7.48a9.016 9.016 0 01-4.5 0m4.5 0a9.016 9.016 0 01-1.5 12.75m15-9.75a9.016 9.016 0 01-4.5 0m-15 0a9.016 9.016 0 014.5 0" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">StudyBuddy</h1>
            <p className="text-xs text-gray-500">AI Homework Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
                <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'English' | 'Hindi')}
                    className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer hover:bg-gray-100 transition-colors"
                >
                    <option value="English">🇺🇸 English</option>
                    <option value="Hindi">🇮🇳 Hindi</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>

            {/* Share Button */}
            <button 
                onClick={handleShare}
                className="text-indigo-600 hover:bg-indigo-50 transition-colors p-2 rounded-full"
                title="Share App"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
            </button>

            {/* Clear Button */}
            <button 
                onClick={() => setMessages(prev => [prev[0]])}
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Clear Chat"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
        </div>
      </header>

      {/* --- Chat Area --- */}
      <main className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-slate-50">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          
          {loadingState === 'thinking' && (
            <div className="flex justify-start mb-6 animate-pulse">
               <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">
                    {language === 'Hindi' ? 'समस्या का विश्लेषण कर रहा हूँ...' : 'Analyzing problem...'}
                  </span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* --- Input Area --- */}
      <footer className="bg-white border-t border-gray-200 p-3 sm:p-4 sticky bottom-0 z-20">
        <div className="max-w-3xl mx-auto">
          {/* Image Preview */}
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img 
                src={selectedImage.preview} 
                alt="Preview" 
                className="h-24 w-auto rounded-lg border border-gray-200 shadow-sm object-cover"
              />
              <button 
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-gray-50 p-2 rounded-3xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all shadow-sm">
            
            {/* Action Buttons Group */}
            <div className="flex gap-1 mb-1">
                {/* Camera Button (Direct Mobile Camera) */}
                <div>
                    <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={onSelectFile}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="camera-upload"
                    />
                    <label 
                        htmlFor="camera-upload"
                        className="cursor-pointer w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors flex items-center justify-center"
                        title="Take Photo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                    </label>
                </div>

                {/* Gallery Button */}
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onSelectFile}
                        accept="image/*"
                        className="hidden"
                        id="gallery-upload"
                    />
                    <label 
                        htmlFor="gallery-upload"
                        className="cursor-pointer w-10 h-10 rounded-full hover:bg-gray-200 text-gray-500 hover:text-indigo-600 transition-colors flex items-center justify-center"
                        title="Upload from Gallery"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                    </label>
                </div>
            </div>

            {/* Text Input */}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedImage ? (language === 'Hindi' ? "इस तस्वीर के बारे में पूछें..." : "Ask about this image...") : (language === 'Hindi' ? "अपना सवाल यहाँ टाइप करें..." : "Type your question here...")}
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-gray-700 placeholder-gray-400 max-h-32 min-h-[44px]"
              rows={1}
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={(!inputText.trim() && !selectedImage) || loadingState !== 'idle'}
              className={`
                flex-shrink-0 mb-1 p-2 rounded-full transition-all duration-200
                ${(!inputText.trim() && !selectedImage) || loadingState !== 'idle'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95'}
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 transform rotate-45 translate-x-[-2px] translate-y-[1px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className="text-center mt-2">
             <p className="text-[10px] text-gray-400">StudyBuddy helps you learn. Verify results for accuracy.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;