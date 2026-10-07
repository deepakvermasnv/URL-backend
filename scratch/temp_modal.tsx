'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  Send, 
  Paperclip, 
  Copy, 
  Check, 
  Download, 
  Scissors, 
  Type, 
  Wand2, 
  FileDown, 
  Minimize2, 
  LayoutGrid, 
  FileCode, 
  FileText, 
  Chrome, 
  Bot, 
  User, 
  Loader2, 
  ExternalLink,
  Trash2,
  HelpCircle,
  FileCheck,
  RefreshCcw,
  CheckCircle2
} from 'lucide-react';
import { REGISTERED_TOOLS } from '@/lib/ai/tool-registry';
import { 
  executeUrlTrimmer, 
  executeWordCounter, 
  executeTextToImage, 
  executeImageConverter, 
  executeImageCompressor, 
  executePdfConverter, 
  executeSitemapGenerator, 
  executeLlmsTxtGenerator,
  ExecutionResult 
} from '@/lib/ai/workflow-executor';

export interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachments?: { name: string; size: string; file: File }[];
  steps?: { toolId: string; title: string; status: 'running' | 'completed' | 'failed' }[];
  result?: ExecutionResult;
  clarificationOptions?: string[];
  openToolHref?: string;
}

const STARTER_PROMPTS = [
  { label: 'Clean my URLs', prompt: 'Clean tracking parameters and remove duplicate URLs', icon: Scissors, color: 'text-blue-500' },
  { label: 'Count this text', prompt: 'Count the words, characters, and sentences in this paragraph', icon: Type, color: 'text-purple-500' },
  { label: 'Compress an image', prompt: 'Compress this image to reduce size', icon: Minimize2, color: 'text-emerald-500' },
  { label: 'Convert image format', prompt: 'Convert this image to WebP format', icon: LayoutGrid, color: 'text-amber-500' },
  { label: 'Make PDF from files', prompt: 'Convert my uploaded images into a PDF document', icon: FileDown, color: 'text-red-500' },
  { label: 'Generate a Sitemap', prompt: 'Generate a sitemap for https://example.com', icon: FileCode, color: 'text-indigo-500' },
  { label: 'Generate llms.txt', prompt: 'Generate an llms.txt for https://example.com', icon: FileText, color: 'text-cyan-500' },
  { label: 'Create an AI image', prompt: 'Create an image of a majestic lion in a futuristic neon city', icon: Wand2, color: 'text-pink-500' },
  { label: 'Chrome Extension', prompt: 'Tell me about the URLTrim Chrome Extension', icon: Chrome, color: 'text-yellow-500' },
];

export default function AiAssistantModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: string; file: File }[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your URLTrim AI Assistant. How can I help you process URLs, count text, generate images, convert PDFs, compress images, or build sitemaps today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newAttachments = files.map(f => ({
      name: f.name,
      size: `${Math.round(f.size / 1024)} KB`,
      file: f
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const processUserCommand = async (userPrompt: string) => {
    if (!userPrompt.trim() && attachments.length === 0) return;
    const promptText = userPrompt.trim();
    const currentAttachments = [...attachments];

    // Clear input & attachments
    setInput('');
    setAttachments([]);

    // Add user message
    const userMsgId = `user-${Date.now()}`;
    const newMsg: MessageItem = {
      id: userMsgId,
      sender: 'user',
      text: promptText || (currentAttachments.length > 0 ? `Uploaded ${currentAttachments.length} file(s)` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments
    };

    setMessages(prev => [...prev, newMsg]);
    setIsProcessing(true);

    try {
      // Step 1: Query server-side AI Intent Planner API
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          hasFiles: currentAttachments.length > 0
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not interpret command.');
      }

      const plan = data.plan;

      // Handle Ambiguous Intent
      if (plan.isAmbiguous && plan.clarificationMessage) {
        setMessages(prev => [
          ...prev,
          {
            id: `assist-${Date.now()}`,
            sender: 'assistant',
            text: plan.clarificationMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            clarificationOptions: plan.options
          }
        ]);
        setIsProcessing(false);
        return;
      }

      // Handle Informational / Chrome Extension
      if (plan.intent === 'chrome_extension' || plan.steps?.[0]?.toolId === 'chrome_extension') {
        setMessages(prev => [
          ...prev,
          {
            id: `assist-${Date.now()}`,
            sender: 'assistant',
            text: 'The URLTrim Chrome Extension lets you clean URLs and analyze word counts directly in your browser toolbar without leaving your current tab!',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            openToolHref: '/tools/chrome-extension'
          }
        ]);
        setIsProcessing(false);
        return;
      }

      // Handle Tool Execution Steps
      const steps = plan.steps || [];
      if (steps.length === 0) {
        setMessages(prev => [
          ...prev,
          {
            id: `assist-${Date.now()}`,
            sender: 'assistant',
            text: 'Please specify what you would like me to process (e.g., URLs, text, image, or sitemap).',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsProcessing(false);
        return;
      }

      // Initial execution status message
      const assistMsgId = `assist-${Date.now()}`;
      let activeSteps = steps.map((s: any) => ({
        toolId: s.toolId,
        title: s.actionName || REGISTERED_TOOLS[s.toolId]?.name || 'Executing Tool...',
        status: 'running' as const
      }));

      setMessages(prev => [
        ...prev,
        {
          id: assistMsgId,
          sender: 'assistant',
          text: `Executing ${steps.length} tool operation(s)...`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          steps: activeSteps
        }
      ]);

      // Execute Workflow Pipeline
      let currentInputText = promptText;
      let lastExecutionResult: ExecutionResult | null = null;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const toolId = step.toolId;

        // Tool 1: URL Trimmer
        if (toolId === 'url_trimmer') {
          const mode = step.params?.mode || 'trim';
          const trimRes = executeUrlTrimmer(currentInputText, mode);
          currentInputText = trimRes.urls.join('\n');
          lastExecutionResult = {
            success: true,
            toolId: 'url_trimmer',
            summary: trimRes.summary,
            resultType: 'urls',
            data: { urls: trimRes.urls, raw: currentInputText }
          };
        }
        // Tool 2: Word Counter
        else if (toolId === 'word_counter') {
          const stats = executeWordCounter(currentInputText);
          lastExecutionResult = {
            success: true,
            toolId: 'word_counter',
            summary: stats.summary,
            resultType: 'stats',
            data: stats
          };
        }
        // Tool 3: AI Text-to-Image
        else if (toolId === 'ai_text_to_image') {
          const aspectRatio = step.params?.aspectRatio || '1:1';
          lastExecutionResult = await executeTextToImage(promptText, aspectRatio);
        }
        // Tool 4: Image Converter
        else if (toolId === 'image_converter') {
          const file = currentAttachments[0]?.file;
          if (file) {
            const targetFormat = step.params?.targetFormat || 'image/png';
            lastExecutionResult = await executeImageConverter(file, targetFormat);
          } else {
            lastExecutionResult = {
              success: false,
              toolId: 'image_converter',
              summary: 'Please attach an image file to convert.',
              resultType: 'text',
              data: { error: 'No image attached.' }
            };
          }
        }
        // Tool 5: Image Compressor
        else if (toolId === 'image_compressor') {
          const file = currentAttachments[0]?.file;
          if (file) {
            lastExecutionResult = await executeImageCompressor(file, 0.7);
          } else {
            lastExecutionResult = {
              success: false,
              toolId: 'image_compressor',
              summary: 'Please attach an image file to compress.',
              resultType: 'text',
              data: { error: 'No image attached.' }
            };
          }
        }
        // Tool 6: PDF Converter
        else if (toolId === 'pdf_converter') {
          const files = currentAttachments.map(a => a.file);
          lastExecutionResult = await executePdfConverter(files.length > 0 ? files : undefined, promptText);
        }
        // Tool 7: Sitemap Generator
        else if (toolId === 'sitemap_generator') {
          const urlMatch = promptText.match(/https?:\/\/[^\s]+/i);
          const websiteUrl = step.params?.websiteUrl || (urlMatch ? urlMatch[0] : '');
          if (websiteUrl) {
            lastExecutionResult = await executeSitemapGenerator(websiteUrl);
          } else {
            lastExecutionResult = {
              success: false,
              toolId: 'sitemap_generator',
              summary: 'Please provide a valid website URL for sitemap generation.',
              resultType: 'text',
              data: { error: 'Missing website URL.' }
            };
          }
        }
        // Tool 8: LLMs.txt Generator
        else if (toolId === 'llms_txt_generator') {
          const urlMatch = promptText.match(/https?:\/\/[^\s]+/i);
          const websiteUrl = step.params?.websiteUrl || (urlMatch ? urlMatch[0] : '');
          if (websiteUrl) {
            lastExecutionResult = await executeLlmsTxtGenerator(websiteUrl);
          } else {
            lastExecutionResult = {
              success: false,
              toolId: 'llms_txt_generator',
              summary: 'Please provide a valid website URL for llms.txt generation.',
              resultType: 'text',
              data: { error: 'Missing website URL.' }
            };
          }
        }

        // Mark step as completed
        activeSteps = activeSteps.map((s, idx) => idx === i ? { ...s, status: 'completed' as const } : s);
      }

      // Update final message
      setMessages(prev =>
        prev.map(m =>
          m.id === assistMsgId
            ? {
                ...m,
                text: lastExecutionResult?.summary || 'Task completed successfully!',
                steps: activeSteps,
                result: lastExecutionResult || undefined,
                openToolHref: REGISTERED_TOOLS[lastExecutionResult?.toolId || '']?.href
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `assist-err-${Date.now()}`,
          sender: 'assistant',
          text: `An error occurred while executing the tool: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-sm shadow-xl shadow-blue-500/25 border border-white/20 backdrop-blur-md cursor-pointer group hover:shadow-2xl transition-all"
        aria-label="Open URLTrim AI Assistant"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
        </div>
        <span>URLTrim AI</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </motion.button>

      {/* AI Assistant Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              className="w-full sm:max-w-2xl h-[92vh] sm:h-[680px] bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-amber-300 shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                      URLTrim AI Assistant
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">v2.0 Tools</span>
                    </h3>
                    <p className="text-xs text-slate-400">Intelligent automation for all 9 URLTrim tools</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-900/30 scrollbar-thin">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-1 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] space-y-3 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      {/* Message Text Bubble */}
                      <div
                        className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-[#1a2332] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-none'
                        }`}
                      >
                        <p>{msg.text}</p>

                        {/* Attached Files Badge */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1">
                            {msg.attachments.map((att, i) => (
                              <div key={i} className="text-[11px] opacity-90 flex items-center gap-1.5 font-mono">
                                <Paperclip className="w-3 h-3" />
                                <span>{att.name} ({att.size})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Execution Steps Tracker */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                          {msg.steps.map((st, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-2 truncate">
                                {st.status === 'running' ? (
                                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                )}
                                <span className="truncate">{st.title}</span>
                              </div>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${st.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-blue-100 dark:bg-blue-950 text-blue-600'}`}>
                                {st.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Clarification Options */}
                      {msg.clarificationOptions && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {msg.clarificationOptions.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => processUserCommand(opt)}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Result Rendering Card */}
                      {msg.result && (
                        <div className="bg-white dark:bg-[#1a2332] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
                          {/* URL Results */}
                          {msg.result.resultType === 'urls' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cleaned URLs ({msg.result.data?.urls?.length || 0})</span>
                                <button
                                  onClick={() => handleCopy(msg.result?.data?.urls?.join('\n') || '', msg.id)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedId === msg.id ? 'Copied' : 'Copy All'}</span>
                                </button>
                              </div>
                              <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs max-h-36 overflow-y-auto scrollbar-thin">
                                {msg.result.data?.urls?.map((u: string, i: number) => (
                                  <div key={i} className="truncate">{u}</div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Word Counter Stats Card */}
                          {msg.result.resultType === 'stats' && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900">
                                <div className="text-base font-black text-blue-600 dark:text-blue-400">{msg.result.data?.words}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">Words</div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900">
                                <div className="text-base font-black text-purple-600 dark:text-purple-400">{msg.result.data?.characters}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">Chars</div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900">
                                <div className="text-base font-black text-indigo-600 dark:text-indigo-400">{msg.result.data?.sentences}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">Sentences</div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900">
                                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{msg.result.data?.readingTime} min</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">Read Time</div>
                              </div>
                            </div>
                          )}

                          {/* AI Image Result */}
                          {msg.result.resultType === 'image' && msg.result.data?.url && (
                            <div className="space-y-3">
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-video">
                                <img src={msg.result.data.url} alt="AI Generated" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 truncate max-w-[200px]">{msg.result.data.prompt}</span>
                                <a
                                  href={msg.result.data.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download="ai-generated-image.png"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          )}

                          {/* File Output (PDF / Compressed Image) */}
                          {msg.result.resultType === 'file' && msg.result.data?.url && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{msg.result.data.fileName}</div>
                                  {msg.result.data.percent && (
                                    <div className="text-[10px] text-emerald-600 font-semibold">Saved {msg.result.data.percent}% size</div>
                                  )}
                                </div>
                              </div>
                              <a
                                href={msg.result.data.url}
                                download={msg.result.data.fileName}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </a>
                            </div>
                          )}

                          {/* Sitemap XML Result */}
                          {msg.result.resultType === 'sitemap' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase text-slate-400">XML Sitemap Preview</span>
                                <button
                                  onClick={() => handleCopy(msg.result?.data?.xml || '', msg.id)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedId === msg.id ? 'Copied' : 'Copy XML'}</span>
                                </button>
                              </div>
                              <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs max-h-36 overflow-y-auto scrollbar-thin whitespace-pre">
                                {msg.result.data?.xml}
                              </pre>
                            </div>
                          )}

                          {/* LLMs.txt Result */}
                          {msg.result.resultType === 'llms_txt' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase text-slate-400">llms.txt Markdown Preview</span>
                                <button
                                  onClick={() => handleCopy(msg.result?.data?.content || '', msg.id)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedId === msg.id ? 'Copied' : 'Copy Markdown'}</span>
                                </button>
                              </div>
                              <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs max-h-36 overflow-y-auto scrollbar-thin whitespace-pre">
                                {msg.result.data?.content}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Open Full Tool Link Action */}
                      {msg.openToolHref && (
                        <div>
                          <Link
                            href={msg.openToolHref}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                          >
                            <span>Open full tool page</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Starter Prompts Carousel */}
              {messages.length <= 2 && (
                <div className="px-4 py-3 bg-white dark:bg-[#141c2b] border-t border-slate-200/80 dark:border-slate-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Try standard commands:</div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {STARTER_PROMPTS.map((sp, idx) => (
                      <button
                        key={idx}
                        onClick={() => processUserCommand(sp.prompt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
                      >
                        <sp.icon className={`w-3.5 h-3.5 ${sp.color}`} />
                        <span>{sp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <div className="p-3 sm:p-4 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800">
                {/* Attached files list */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono">
                        <span>{att.name}</span>
                        <button onClick={() => removeAttachment(i)} className="text-blue-400 hover:text-blue-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    processUserCommand(input);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Attach file (images, docx, pptx)"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask AI to process URLs, count words, create images..."
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />

                  <button
                    type="submit"
                    disabled={isProcessing || (!input.trim() && attachments.length === 0)}
                    className="p-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
