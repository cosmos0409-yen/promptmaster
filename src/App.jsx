import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import {
  Wand2, Save, Search, RefreshCw, Copy,
  CheckCircle2, History, Settings, Edit3,
  ShieldCheck, Lock, Smartphone, X, Zap, Lightbulb,
  Pin, PinOff, Sparkles, Loader2, Image as ImageIcon, Type,
  LayoutTemplate, Palette, MonitorPlay, Camera, FileText,
  MousePointerClick, HelpCircle, Info, ExternalLink, Filter,
  AlertTriangle, MessageSquarePlus, Maximize2, Tag, XCircle
} from 'lucide-react';

/**
 * FIREBASE CONFIGURATION
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Check if keys are loaded
if (!firebaseConfig.apiKey) {
  console.warn('Firebase API Key is missing! Check your .env file.');
}

const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

// --- Utility: Robust JSON Extractor ---
const extractJSON = (text) => {
  if (!text) return null;
  try {
    const startIndex = text.indexOf('{');
    if (startIndex === -1) return null;
    let braceCount = 0;
    let inString = false;
    let escape = false;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (!escape && char === '"') inString = !inString;
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
      }
      if (char === '\\' && !escape) escape = true;
      else escape = false;
      if (braceCount === 0) {
        const jsonStr = text.substring(startIndex, i + 1);
        return JSON.parse(jsonStr);
      }
    }
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch (err) { return null; } }
  }
  return null;
};

// --- Utility: Robust Copy Function ---
const copyToClipboard = (text, onSuccess) => {
  if (!text) return;
  const fallbackCopy = (txt) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = txt;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful && onSuccess) onSuccess();
    } catch (err) { console.error('Fallback copy failed', err); }
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => { if (onSuccess) onSuccess(); }).catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
};

// --- Helper: Get Color based on Model ---
const getModelColor = (modelName) => {
  if (!modelName) return 'border-stone-200 bg-white';
  const name = modelName.toLowerCase();
  if (name.includes('gpt')) return 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300';
  if (name.includes('claude')) return 'border-purple-200 bg-purple-50/30 hover:border-purple-300';
  if (name.includes('gemini')) return 'border-blue-200 bg-blue-50/30 hover:border-blue-300';
  if (name.includes('midjourney') || name.includes('dall') || name.includes('flux') || name.includes('imagine')) return 'border-orange-200 bg-orange-50/30 hover:border-orange-300';
  if (name.includes('llama')) return 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-300';
  return 'border-stone-200 bg-white hover:border-stone-300';
};

const getModelBadgeColor = (modelName) => {
  if (!modelName) return 'bg-stone-100 text-stone-600';
  const name = modelName.toLowerCase();
  if (name.includes('gpt')) return 'bg-emerald-100 text-emerald-700';
  if (name.includes('claude')) return 'bg-purple-100 text-purple-700';
  if (name.includes('gemini')) return 'bg-blue-100 text-blue-700';
  if (name.includes('midjourney') || name.includes('dall') || name.includes('flux')) return 'bg-orange-100 text-orange-700';
  return 'bg-stone-100 text-stone-600';
};

// --- 2026 Configs ---

const FRAMEWORKS = {
  'general': { label: '通用架構 (General)', desc: '✅ 適用於：日常對話、簡單問答。\n👉 特點：結構自由，直覺輸入。', toast: '通用架構就像跟朋友聊天一樣，直覺把需求說出來就好，適合簡單的任務！' },
  'costar': { label: 'CO-STAR 架構', desc: '✅ 適用於：商業郵件、行銷文案、專業報告。\n👉 特點：強調 Context (背景) 與 Audience (受眾)，產出內容最為精準得體。', toast: 'CO-STAR 是商務首選！它會特別注意「寫給誰看」以及「背景脈絡」，讓產出非常專業。' },
  'rtf': { label: 'RTF 架構', desc: '✅ 適用於：翻譯、重點摘要、格式轉換。\n👉 特點：Role (角色) + Task (任務) + Format (格式)，簡單暴力，適合工具型任務。', toast: 'RTF 是效率神器！只要告訴 AI「你是誰」、「做什麼」、「給什麼格式」，乾淨俐落。' },
  'tag': { label: 'TAG 架構', desc: '✅ 適用於：程式開發、邏輯推理、步驟教學。\n👉 特點：Task (任務) + Action (行動) + Goal (目標)，強調執行步驟與最終成果。', toast: 'TAG 架構強調「行動」與「目標」，如果你需要 AI 幫你寫程式或執行步驟，選這個準沒錯！' }
};

const ASPECT_RATIOS = ['--ar 16:9 (電影感)', '--ar 9:16 (IG Reels)', '--ar 1:1 (正方形)', '--ar 4:3 (傳統攝影)', '--ar 2.39:1 (Anamorphic)'];

const FIELD_CONFIG = [
  { id: 'usageType', label: '生命週期 (Lifecycle)', icon: <History size={20} />, desc: '單次任務 or 長期專案？', placeholder: '例如：System Prompt...', options: ['單次性任務', '長期專案協作 (System Prompt)', '建立自訂 AI 機器人 (Gems/GPTs)', 'API 系統層級指令'], colSpan: 2, mode: 'all', isMulti: false },
  { id: 'model', label: '目標模型 (Target Model)', icon: <Zap size={20} />, desc: '選擇 2026 最新模型', placeholder: '選擇模型...', options: ['GPT-5 (OpenAI)', 'Claude 4.6 Opus (Anthropic)', 'Gemini 3 Pro (Google)', 'Llama 4 (Meta)', 'Gemini 2.5 Flash (Fast)'], imageOptions: ['Gemini Imagine 3 (Google)', 'Midjourney v7 (Midjourney)', 'DALL-E 4 (OpenAI)', 'Flux Pro 2 (Black Forest Labs)'], colSpan: 1, mode: 'all', isMulti: false },
  { id: 'framework', label: '提示詞架構 (Framework)', icon: <LayoutTemplate size={20} />, desc: '選擇結構模型', placeholder: '選擇架構...', options: Object.values(FRAMEWORKS).map(f => f.label), colSpan: 1, mode: 'text', isMulti: false },
  { id: 'aspectRatio', label: '長寬比 (Ratio)', icon: <MonitorPlay size={20} />, desc: '圖片的比例尺寸', placeholder: '選擇比例...', options: ASPECT_RATIOS, colSpan: 1, mode: 'image', isMulti: false },
  { id: 'role', label: '角色定位 (Role)', icon: <Wand2 size={20} />, desc: 'AI 扮演的角色', placeholder: '輸入關鍵字試試（如：Python 工程師）...', options: ['資深全端工程師', '社群行銷經理', '學術論文編輯', '創意寫作教練', 'UX 設計師'], colSpan: 1, mode: 'text', isMulti: false },
  { id: 'goal', label: '任務目標 (Task)', icon: <CheckCircle2 size={20} />, desc: '具體要完成什麼？', placeholder: '列出具體目標...', options: ['產出高品質程式碼', '條列式重點摘要', '將複雜概念簡化', '翻譯並潤飾文字'], colSpan: 1, mode: 'text', isMulti: false },
  { id: 'imageSubject', label: '畫面主體 (Subject)', icon: <ImageIcon size={20} />, desc: '圖像中的核心內容', placeholder: '例如：一隻在太空漂浮的賽博龐克貓...', options: ['未來城市景觀', '極簡主義人像', '奇幻森林生物', '產品商業攝影'], colSpan: 2, mode: 'image', isMulti: false },
  { id: 'scenario', label: '背景情境 (Context)', icon: <Smartphone size={20} />, desc: '任務發生的背景', placeholder: '敘述當前情境...', options: ['撰寫技術文件', '開發新功能模組', '規劃 IG 社群貼文', '分析銷售數據'], colSpan: 2, mode: 'text', isMulti: true },
  { id: 'artStyle', label: '藝術風格 (Art Style)', icon: <Palette size={20} />, desc: '圖像的視覺風格', placeholder: '例如：Cyberpunk, Ukiyo-e...', options: ['Photorealistic (寫實)', 'Cyberpunk (賽博龐克)', 'Anime/Manga (日系動漫)', 'Oil Painting (油畫)', '3D Render (3D 渲染)'], colSpan: 1, mode: 'image', isMulti: false },
  { id: 'lighting', label: '光影與相機 (Lighting)', icon: <Camera size={20} />, desc: '光線氛圍與鏡頭語言', placeholder: '例如：Cinematic lighting...', options: ['Cinematic Lighting', 'Natural Light', 'Neon Lights', 'Macro Photography', 'Wide Angle'], colSpan: 1, mode: 'image', isMulti: false },
  { id: 'details', label: '細節與受眾 (Details)', icon: <Edit3 size={20} />, desc: '補充資訊、受眾或變數', placeholder: '提供更多上下文...', options: ['需包含詳細註解', '輸入資料為 CSV 格式', '受眾為小學生', '需引用可靠來源'], colSpan: 2, mode: 'text', isMulti: true },
  { id: 'tone', label: '語氣風格 (Tone)', icon: <Type size={20} />, desc: '口吻與氛圍', placeholder: '例如：專業且權威...', options: ['專業權威', '幽默風趣', '簡單易懂', '學術嚴謹', '熱情活潑'], colSpan: 2, mode: 'text', isMulti: true },
  { id: 'constraints', label: '禁止事項 (Negative)', icon: <X size={20} />, desc: '文字：禁止做的事 / 圖像：負面提示', placeholder: '設定邊界...', options: ['不要使用過於艱澀的術語', '禁止虛構事實', 'Low quality', 'Blurry', 'Text, Watermark'], colSpan: 2, mode: 'all', isMulti: true },
  { id: 'outputSyntax', label: '輸出格式 (Format)', icon: <Settings size={20} />, desc: '產出的格式', placeholder: '選擇格式...', options: ['Markdown', 'XML (Claude)', 'JSON', 'HTML Table'], colSpan: 2, mode: 'all', isMulti: false }
];

const callGeminiAPI = async (apiKey, prompt) => {
  const modelName = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
};

// --- Components ---

const Toast = ({ message, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-stone-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-orange-500 p-1 rounded-full shrink-0 mt-0.5"><Lightbulb size={16} fill="currentColor" className="text-white" /></div>
      <div className="flex-1 text-sm leading-relaxed">{message}</div>
      <button onClick={onClose} className="text-stone-400 hover:text-white shrink-0"><X size={16} /></button>
    </div>
  );
};

const FrameworkHelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        <div className="bg-stone-900 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold flex items-center gap-2"><LayoutTemplate size={18} /> 提示詞架構指南</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto"><div className="grid gap-6">{Object.entries(FRAMEWORKS).map(([key, info]) => (<div key={key} className="bg-stone-50 p-4 rounded-xl border border-stone-100 hover:border-orange-200 transition-colors"><h4 className="font-bold text-orange-600 mb-2 text-lg">{info.label}</h4><p className="text-stone-600 whitespace-pre-wrap text-sm leading-relaxed">{info.desc}</p></div>))}</div></div>
      </div>
    </div>
  );
};

const OptimizeModal = ({ isOpen, onClose, onSubmit, isOptimizing }) => {
  const [request, setRequest] = useState('');
  if (!isOpen) return null;
  return (
    // UPDATED: z-[110] to ensure it appears above PromptDetailModal (z-[100])
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-stone-900 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} /> AI 深度優化</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-bold text-stone-700 mb-3">請問您希望如何優化此 Prompt？</label>
          <div className="space-y-3">
            <textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="例如：語氣更專業一點、縮短篇幅、加入更多 Emoji..." className="w-full h-32 p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none text-stone-700" autoFocus />
            <div className="flex flex-wrap gap-2">{['語氣更專業', '更簡潔有力', '加入具體範例', '條列式呈現'].map(tag => (<button key={tag} onClick={() => setRequest(tag)} className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full border border-orange-100 hover:bg-orange-100">{tag}</button>))}</div>
          </div>
          <button onClick={() => onSubmit(request)} disabled={isOptimizing || !request.trim()} className="mt-6 w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-70 flex justify-center items-center gap-2">
            {isOptimizing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} fill="currentColor" />} {isOptimizing ? 'AI 正在思考...' : '開始優化'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PromptDetailModal = ({ prompt, onClose, onOptimize }) => {
  const [copied, setCopied] = useState(false);
  if (!prompt) return null;
  const handleCopy = () => { copyToClipboard(prompt.content, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className={`p-4 text-white flex justify-between items-center shrink-0 ${getModelBadgeColor(prompt.model).includes('emerald') ? 'bg-emerald-900' : 'bg-stone-900'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <h3 className="font-bold text-lg truncate flex-1">{prompt.title || 'Prompt Detail'}</h3>
            <span className={`text-xs px-2 py-1 rounded font-mono hidden md:inline-block ${getModelBadgeColor(prompt.model)} bg-white/20 text-white`}>{prompt.model}</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {prompt.tags?.map((tag, i) => (
                  <span key={i} className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${tag.includes('Gen') ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'}`}>
                    {i === 0 && <Tag size={10} />} {tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOptimize(prompt)} className="flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-white bg-orange-50 hover:bg-orange-500 border border-orange-200 hover:border-orange-500 px-3 py-1.5 rounded-lg transition-colors">
                  <Sparkles size={16} /> AI 深度優化
                </button>
                <button onClick={handleCopy} className="flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors">
                  {copied ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />} {copied ? '已複製' : '複製內容'}
                </button>
              </div>
            </div>
            <pre className="font-mono text-sm whitespace-pre-wrap text-stone-800 leading-relaxed p-4 bg-stone-50 rounded-lg border border-stone-100">{prompt.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, apiKey, setApiKey }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-stone-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Settings size={18} /> 設定</h3><button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button></div>
        <div className="p-6">
          <label className="block text-sm font-bold text-stone-700 mb-2">Gemini API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="輸入您的 API Key" className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
          <div className="mt-4 bg-orange-50 border border-orange-100 p-4 rounded-xl text-xs text-orange-800 flex items-start gap-2"><ShieldCheck size={32} className="shrink-0 text-orange-600" /><div><p className="font-bold mb-1">BYOK 安全模式</p><p>Key 僅存於您的 <strong>localStorage</strong>，直接對接 Google。</p></div></div>
          <button onClick={onClose} className="mt-6 w-full bg-stone-800 text-white font-bold py-3 rounded-xl hover:bg-stone-900 transition-colors">儲存設定</button>
        </div>
      </div>
    </div>
  );
};

const FieldCard = ({ config, value, onChange, error, customOptions, aiSuggestions, isImageMode, onShowFrameworkHelp }) => {
  const [isFocused, setIsFocused] = useState(false);
  const dynamicOptions = useMemo(() => {
    const aiOpts = (aiSuggestions || []).filter(i => typeof i === 'string' || typeof i === 'number');
    let defaultOpts = config.options || [];
    if (config.id === 'model' && isImageMode && config.imageOptions) defaultOpts = config.imageOptions;
    const historyOpts = (customOptions || []).filter(i => typeof i === 'string' || typeof i === 'number');
    return Array.from(new Set([...aiOpts, ...defaultOpts, ...historyOpts]));
  }, [config, customOptions, aiSuggestions, isImageMode]);

  const handleOptionClick = (opt) => {
    if (!value) onChange(opt);
    else {
      if (config.isMulti) { const separator = config.id.includes('constraints') || config.id === 'imageSubject' ? ', ' : '\n'; onChange(value + separator + opt); }
      else onChange(opt);
    }
  };

  const hasAiSuggestions = aiSuggestions && aiSuggestions.length > 0;
  const isSyntaxCard = config.id === 'outputSyntax';

  return (
    <div id={`card-${config.id}`} className={`relative bg-white rounded-xl border transition-all duration-300 overflow-hidden group h-full flex flex-col ${error ? 'border-red-300 ring-4 ring-red-50' : isFocused ? 'border-orange-400 ring-4 ring-orange-50' : 'border-stone-200 shadow-sm hover:shadow-md'} ${isSyntaxCard ? 'bg-gradient-to-br from-white to-stone-50 border-stone-300' : ''}`}>
      <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3 relative">
          <label className="flex items-center gap-3 text-stone-800 font-bold text-lg leading-tight w-full">
            <span className={`text-xl w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border relative ${isSyntaxCard ? 'bg-stone-800 text-white border-stone-600' : 'bg-orange-100 text-orange-600 border-orange-200'}`}>{config.icon}{hasAiSuggestions && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}</span>
            <div className="flex-1"><div className="flex items-center gap-2">{config.label}{config.id === 'framework' && (<button onClick={(e) => { e.preventDefault(); onShowFrameworkHelp(); }} className="text-stone-400 hover:text-orange-500 hover:bg-orange-50 p-1 rounded-full transition-colors"><HelpCircle size={16} /></button>)}</div><p className="text-xs text-stone-400 font-normal mt-0.5">{config.desc}</p></div>
          </label>
        </div>
        <div className="relative flex-1"><textarea value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} placeholder={config.placeholder} className={`w-full h-full min-h-[80px] border rounded-lg p-3 text-stone-700 placeholder:text-stone-400 focus:outline-none transition-all resize-none text-base leading-relaxed ${isSyntaxCard ? 'bg-white border-stone-300 focus:border-stone-500 font-mono text-sm' : 'bg-[#FAFAFA] border-stone-200 focus:bg-white focus:border-orange-300'}`} /></div>
        <div className="mt-4 flex flex-wrap gap-2">{dynamicOptions.slice(0, 6).map((opt, idx) => { const isAi = aiSuggestions?.includes(opt); return (<button key={idx} onClick={() => handleOptionClick(opt)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all active:scale-95 text-left flex items-center gap-1 ${isSyntaxCard ? 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200' : isAi ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:border-orange-300' : 'bg-white text-stone-500 border-stone-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50'}`}>{isAi && <Sparkles size={10} className="text-orange-500" />} {config.isMulti ? '+ ' : ''}{opt}</button>); })}</div>
        {error && (<div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2 animate-pulse"><div className="mt-0.5"><Sparkles size={14} /></div><div><span className="font-bold">AI 建議：</span> {error}</div></div>)}
      </div>
    </div>
  );
};

const PromptResult = ({ prompt, onOptimize, onSave, onEdit, isImageMode }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { copyToClipboard(prompt, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-stone-900 text-white p-4 flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2 text-lg"><CheckCircle2 className="text-green-400" /> Prompt 已生成 <span className="text-xs bg-stone-700 px-2 py-0.5 rounded text-stone-300 font-mono ml-2">{isImageMode ? 'IMAGE GEN' : 'TEXT GEN'}</span></h3>
        <button onClick={onEdit} className="text-stone-300 hover:text-white px-3 py-1 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-1"><Edit3 size={14} /> 返回修改</button>
      </div>
      <div className="p-4 md:p-6">
        <div className="relative group"><pre className="w-full h-[60vh] md:h-[500px] p-4 bg-[#FAFAFA] rounded-xl border border-stone-200 text-stone-800 font-mono text-sm whitespace-pre-wrap overflow-y-auto shadow-inner">{prompt}</pre><button onClick={handleCopy} className="absolute top-4 right-4 bg-white shadow-md border border-stone-200 p-2 rounded-lg hover:bg-stone-50 text-stone-600 transition-all active:scale-95">{copied ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}</button></div>
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <button onClick={onSave} className="flex-1 bg-stone-800 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-stone-900 transition-all flex justify-center items-center gap-2 shadow-lg shadow-stone-200"><Save size={20} /> 儲存至資料庫</button>
          <button onClick={onOptimize} className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"><Zap size={20} fill="currentColor" /> AI 深度優化</button>
        </div>
      </div>
    </div>
  );
};

// --- App ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('generator');
  const [formData, setFormData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [customHistory, setCustomHistory] = useState({});
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState('input');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [optimizationLoading, setOptimizationLoading] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [generationMode, setGenerationMode] = useState('text');
  const [isFrameworkHelpOpen, setIsFrameworkHelpOpen] = useState(false);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [optimizationTarget, setOptimizationTarget] = useState('generator');

  useEffect(() => {
    try { const savedHistory = localStorage.getItem('prompt_history'); if (savedHistory) setCustomHistory(JSON.parse(savedHistory)); } catch (e) { localStorage.removeItem('prompt_history'); }
    const savedKey = localStorage.getItem('gemini_api_key'); if (savedKey) setApiKey(savedKey);
    if (!auth) return;
    const initAuth = async () => { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } else { await signInAnonymously(auth); } };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => { if (apiKey) localStorage.setItem('gemini_api_key', apiKey); }, [apiKey]);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'prompts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => { setSavedPrompts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); });
  }, [user]);

  // Derived: All unique tags from saved prompts
  const allTags = useMemo(() => {
    const tags = new Set();
    // Pre-populate with common tags to ensure order
    ['Text Gen', 'Image Gen', '單次', '長期'].forEach(t => tags.add(t));
    savedPrompts.forEach(p => p.tags?.forEach(t => {
      if (typeof t === 'string' && t !== 'Prompt') tags.add(t);
    }));
    return Array.from(tags);
  }, [savedPrompts]);

  const toggleFilter = (tag) => {
    setActiveFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const fetchAiSuggestions = useCallback(async (keyword) => {
    if (!apiKey || !keyword) return;
    setIsSuggesting(true);
    let prompt;
    if (generationMode === 'image') { prompt = `Subject: ${keyword}. Generate 4 concise options in Traditional Chinese for: artStyle, lighting, constraints. Return JSON: {"artStyle": [], "lighting": [], "constraints": []}. Do not use Markdown code blocks.`; }
    else { prompt = `Role/Topic: ${keyword}. Generate 4 concise options in Traditional Chinese for: scenario, goal, details, constraints. Return JSON: {"scenario": [], "goal": [], "details": [], "constraints": []}. Do not use Markdown code blocks.`; }

    try {
      const result = await callGeminiAPI(apiKey, prompt);
      const extracted = extractJSON(result);
      if (extracted) {
        const safeParsed = {};
        Object.keys(extracted).forEach(key => { if (Array.isArray(extracted[key])) safeParsed[key] = extracted[key].filter(item => typeof item === 'string' || typeof item === 'number'); });
        setAiSuggestions(prev => ({ ...prev, ...safeParsed }));
      }
    } catch (e) { console.error("AI Suggestions Failed:", e); }
    finally { setIsSuggesting(false); }
  }, [apiKey, generationMode]);

  useEffect(() => {
    const triggerText = generationMode === 'image' ? formData.imageSubject : formData.role;
    if (!triggerText || triggerText.length < 2) return;
    const timer = setTimeout(() => { if (apiKey) fetchAiSuggestions(triggerText); }, 1500);
    return () => clearTimeout(timer);
  }, [formData.role, formData.imageSubject, apiKey, fetchAiSuggestions, generationMode]);

  const saveToLocalHistory = (fieldId, value) => {
    const field = FIELD_CONFIG.find(f => f.id === fieldId);
    if (!field || !value) return;
    const lines = value.split(/[,\n]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      const opts = field.options || [];
      if (trimmed && !opts.includes(trimmed)) {
        setCustomHistory(prev => {
          const currentList = prev[fieldId] || [];
          if (currentList.includes(trimmed)) return prev;
          return { ...prev, [fieldId]: [trimmed, ...currentList].slice(0, 5) };
        });
      }
    });
    localStorage.setItem('prompt_history', JSON.stringify(customHistory));
  };

  const constructPromptRaw = (data) => {
    if (generationMode === 'image') {
      const parts = [];
      if (data.imageSubject) parts.push(data.imageSubject);
      if (data.artStyle) parts.push(`Style: ${data.artStyle}`);
      if (data.lighting) parts.push(`Lighting/Camera: ${data.lighting}`);
      let prompt = parts.join(', ');
      if (data.aspectRatio) prompt += ` ${data.aspectRatio}`;
      if (data.constraints) prompt += ` --no ${data.constraints}`;
      if (data.model?.includes('Midjourney')) return `/imagine prompt: ${prompt}`;
      return prompt;
    }
    const framework = data.framework || 'general';
    if (framework.includes('CO-STAR')) return `# CO-STAR Prompt\n**C (Context):** ${data.scenario || 'N/A'}\n**O (Objective):** ${data.goal || 'N/A'}\n**S (Style):** ${data.tone || 'Professional'}\n**T (Tone):** ${data.tone || 'Professional'}\n**A (Audience):** ${data.details || 'General Audience'}\n**R (Response):** ${data.outputSyntax || 'Markdown'}`.trim();
    if (framework.includes('RTF')) return `# RTF Prompt\n**R (Role):** ${data.role || 'Assistant'}\n**T (Task):** ${data.goal || 'Task'}\n**F (Format):** ${data.outputSyntax || 'Markdown'}`.trim();
    if (framework.includes('TAG')) return `# TAG Prompt\n**T (Task):** ${data.goal || 'Task'}\n**A (Action):** ${data.scenario || 'Action'}\n**G (Goal):** ${data.details || 'Goal'}`.trim();
    return `# Role\n${data.role || 'General Assistant'}\n\n# Context\n${data.scenario || 'N/A'}\n\n# Task\n${data.goal || 'N/A'}\n\n# Details\n${data.details || 'N/A'}\n\n# Constraints\n${data.constraints || 'N/A'}\n\n# Output\n${data.outputSyntax || 'Markdown'}`.trim();
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (validationErrors[fieldId]) { const newErrs = { ...validationErrors }; delete newErrs[fieldId]; setValidationErrors(newErrs); }
    if (fieldId === 'framework') { const key = Object.keys(FRAMEWORKS).find(k => FRAMEWORKS[k].label === value); if (key && FRAMEWORKS[key].toast) setToast(FRAMEWORKS[key].toast); }
  };

  const handleCheckAndGenerate = async () => {
    setIsGenerating(true);
    setValidationErrors({});
    Object.keys(formData).forEach(key => saveToLocalHistory(key, formData[key]));
    const rawPrompt = constructPromptRaw(formData);

    if (apiKey) {
      try {
        const genPrompt = `Act as an expert Prompt Engineer. REWRITE and OPTIMIZE draft into a high-quality professional prompt. Framework: ${formData.framework || 'General'}. Model: ${formData.model}. Raw Input: ${rawPrompt}. Maintain constraints. Enrich details. OUTPUT MUST BE IN TRADITIONAL CHINESE. Output ONLY final prompt.`;
        const optimizedResult = await callGeminiAPI(apiKey, genPrompt);
        setGeneratedPrompt(optimizedResult);
        setStep('result');
      } catch (e) {
        console.error("Smart Generation Failed", e);
        setGeneratedPrompt(rawPrompt);
        setStep('result');
      }
    } else {
      setGeneratedPrompt(rawPrompt);
      setStep('result');
    }
    setIsGenerating(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOptimizationSubmit = async (userRequest) => {
    setOptimizationLoading(true);
    const isLibrary = optimizationTarget !== 'generator';
    const sourceContent = isLibrary ? selectedPrompt?.content : generatedPrompt;

    if (apiKey && sourceContent) {
      try {
        const prompt = `You are an expert Prompt Engineer. OPTIMIZE following prompt based on request: "${userRequest}". Original: ${sourceContent}. Keep core logic. OUTPUT MUST BE IN TRADITIONAL CHINESE. Output ONLY optimized prompt.`;
        const result = await callGeminiAPI(apiKey, prompt);

        if (isLibrary) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'prompts', optimizationTarget), { content: result });
          setSelectedPrompt(prev => ({ ...prev, content: result }));
        } else {
          setGeneratedPrompt(result);
        }
        setIsOptimizeModalOpen(false);
      } catch (e) { alert("API Error: " + e.message); }
    }
    setOptimizationLoading(false);
  };

  const handleSaveToFirebase = async () => {
    if (!user) {
      alert('尚未登入，無法儲存。請確認 Firebase API Key 是否正確設定，且已開啟 Anonymous Auth。');
      return;
    }
    if (!db) {
      alert('資料庫尚未連結。請檢查 .env 設定。');
      return;
    }



    try {
      const tags = ['Prompt'];
      if (generationMode === 'image') tags.push('Image Gen'); else tags.push('Text Gen');
      if (formData.model) tags.push(formData.model.split(' ')[0]);
      if (formData.usageType) tags.push(formData.usageType.includes('單次') ? '單次' : '長期');

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'prompts'), {
        content: generatedPrompt,
        title: generationMode === 'image' ? `${formData.imageSubject || 'Image'}` : `${formData.role || 'Assistant'} - ${formData.goal || 'Task'}`,
        tags,
        model: formData.model || '',
        isPinned: false,
        createdAt: serverTimestamp()
      });
      alert('已儲存！');
      setView('library');
    } catch (e) { console.error(e); }
  };

  const togglePin = async (e, promptId, currentStatus) => {
    e.stopPropagation(); if (!user || !db) return;
    try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'prompts', promptId), { isPinned: !currentStatus }); } catch (e) { console.error(e); }
  };

  const sortedPrompts = useMemo(() => {
    let filtered = [...savedPrompts];
    if (searchTerm) filtered = filtered.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));

    // AND Logic Filtering
    if (activeFilters.length > 0) {
      filtered = filtered.filter(p => activeFilters.every(filter => p.tags?.includes(filter)));
    }

    return filtered.sort((a, b) => {
      if (a.isPinned === b.isPinned) return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      return a.isPinned ? -1 : 1;
    });
  }, [savedPrompts, searchTerm, activeFilters]);

  const openLibraryOptimize = (prompt) => {
    setOptimizationTarget(prompt.id);
    setSelectedPrompt(prompt);
    setIsOptimizeModalOpen(true);
  };

  const openGeneratorOptimize = () => {
    setOptimizationTarget('generator');
    setIsOptimizeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 font-sans pb-20 md:pb-0">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <FrameworkHelpModal isOpen={isFrameworkHelpOpen} onClose={() => setIsFrameworkHelpOpen(false)} />
      <OptimizeModal
        isOpen={isOptimizeModalOpen}
        onClose={() => setIsOptimizeModalOpen(false)}
        onSubmit={handleOptimizationSubmit}
        isOptimizing={optimizationLoading}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} apiKey={apiKey} setApiKey={setApiKey} />

      <PromptDetailModal
        prompt={selectedPrompt}
        onClose={() => setSelectedPrompt(null)}
        onOptimize={() => openLibraryOptimize(selectedPrompt)}
      />

      <header className="bg-white/90 backdrop-blur border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('generator')}>
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-rose-500 rounded-lg flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform"><Wand2 size={20} /></div>
            <div><h1 className="text-lg font-bold text-stone-800 tracking-tight leading-tight">提示詞大師</h1><p className="text-[10px] text-stone-500">Prompt Master 2026</p></div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://prompts.chat" target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800 transition-all border border-stone-200 mr-1"><ExternalLink size={14} /> 參考資源</a>
            <nav className="hidden md:flex bg-stone-100 p-1 rounded-lg">
              <button onClick={() => setView('generator')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'generator' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>生成器</button>
              <button onClick={() => setView('library')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'library' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>資料庫</button>
            </nav>
            <button onClick={() => setIsSettingsOpen(true)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${apiKey ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}><Settings size={14} /> {apiKey ? 'API 已啟用' : '設定 Key'}</button>
          </div>
        </div>
      </header>

      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 z-50 flex justify-around py-3 pb-safe">
        <button onClick={() => setView('generator')} className={`flex flex-col items-center text-xs ${view === 'generator' ? 'text-orange-600 font-bold' : 'text-stone-400'}`}><Wand2 size={20} className="mb-1" /> 生成</button>
        <button onClick={() => setView('library')} className={`flex flex-col items-center text-xs ${view === 'library' ? 'text-orange-600 font-bold' : 'text-stone-400'}`}><History size={20} className="mb-1" /> 資料庫</button>
      </div>

      <main className="pt-6 px-4">
        {view === 'generator' ? (
          <div className="max-w-5xl mx-auto pb-24">
            {step === 'input' && (
              <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="bg-stone-100 p-1 rounded-xl flex shadow-inner">
                  <button onClick={() => setGenerationMode('text')} className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${generationMode === 'text' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><FileText size={16} /> 文字 Prompt</button>
                  <button onClick={() => setGenerationMode('image')} className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${generationMode === 'image' ? 'bg-white text-purple-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><ImageIcon size={16} /> 圖像 Prompt</button>
                </div>
                <div className="inline-flex bg-white/90 border border-stone-200 shadow-sm p-1 rounded-full"><button onClick={() => setStep('input')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${step === 'input' ? 'bg-stone-800 text-white' : 'text-stone-400'}`}>編輯</button><button disabled={step === 'input'} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${step === 'result' ? 'bg-orange-500 text-white' : 'text-stone-300'}`}>結果</button></div>
              </div>
            )}
            {step === 'input' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!apiKey && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl flex gap-3 text-emerald-800 text-sm items-start cursor-pointer hover:shadow-md transition-all" onClick={() => setIsSettingsOpen(true)}>
                    <div className="bg-white p-2 rounded-full shadow-sm text-emerald-500 shrink-0"><Lightbulb size={18} /></div>
                    <div className="flex-1 mt-1"><p className="font-bold text-base mb-1">啟用 AI 2.5 智能助手</p><p className="opacity-80">使用最新的 Gemini 2.5 Flash 來輔助您撰寫 Prompt。點擊輸入 API Key。</p></div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {FIELD_CONFIG.filter(f => f.mode === 'all' || f.mode === generationMode).map((field) => (
                    <div key={field.id} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                      <FieldCard config={field} value={formData[field.id] || ''} onChange={(val) => handleFieldChange(field.id, val)} error={validationErrors[field.id]} customOptions={customHistory[field.id]} aiSuggestions={aiSuggestions[field.id]} isImageMode={generationMode === 'image'} onShowFrameworkHelp={() => setIsFrameworkHelpOpen(true)} />
                    </div>
                  ))}
                </div>
                {isSuggesting && (<div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-white border border-orange-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-2 text-orange-600 text-sm font-bold animate-in fade-in slide-in-from-bottom-4 z-50"><Loader2 size={16} className="animate-spin" /> AI 正在聯想{generationMode === 'image' ? '圖像風格' : '相關情境'}...</div>)}
                <div className="flex justify-center pt-10 pb-10">
                  <button onClick={handleCheckAndGenerate} disabled={isGenerating} className="w-full md:w-auto min-w-[200px] group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white text-lg transition-all duration-200 bg-gradient-to-r from-stone-800 to-stone-700 rounded-2xl hover:shadow-xl hover:shadow-stone-500/20 hover:-translate-y-1 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed">
                    {isGenerating ? (<><RefreshCw className="animate-spin mr-2" size={20} /> {apiKey ? 'AI 正在撰寫 Prompt...' : '正在組合 Prompt...'}</>) : (<><Wand2 className="mr-2 group-hover:rotate-12 transition-transform text-orange-400" size={24} /> 產出 Prompt</>)}
                  </button>
                </div>
              </div>
            )}
            {step === 'result' && (
              <PromptResult prompt={generatedPrompt} onEdit={() => setStep('input')} onSave={handleSaveToFirebase} onOptimize={openGeneratorOptimize} isImageMode={generationMode === 'image'} />
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto pb-24">
            <div className="mb-8 sticky top-[70px] z-30 md:static space-y-4">
              <div className="relative shadow-sm rounded-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} /><input type="text" placeholder="搜尋 Prompt 或標籤..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 text-stone-700 text-lg" /></div>

              {/* Dynamic Tag Filter Cloud */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {allTags.length === 0 ? (
                  <div className="text-xs text-stone-400 italic px-2">尚未建立標籤...</div>
                ) : (
                  allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleFilter(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1 ${activeFilters.includes(tag)
                        ? 'bg-stone-800 text-white border-stone-800 shadow-md transform scale-105'
                        : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                        }`}
                    >
                      {activeFilters.includes(tag) && <CheckCircle2 size={12} />}
                      {tag}
                    </button>
                  ))
                )}
                {activeFilters.length > 0 && (
                  <button onClick={() => setActiveFilters([])} className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1">
                    <XCircle size={14} /> 清除
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPrompts.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase())).map(prompt => (
                <div key={prompt.id} onClick={() => setSelectedPrompt(prompt)} className={`bg-white rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group overflow-hidden cursor-pointer ${getModelColor(prompt.model)}`}>
                  <div className="p-5 flex-1 relative">
                    <button onClick={(e) => togglePin(e, prompt.id, prompt.isPinned)} className={`absolute top-4 right-4 p-1.5 rounded-full transition-all ${prompt.isPinned ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}>{prompt.isPinned ? <Pin size={18} fill="currentColor" /> : <PinOff size={18} />}</button>
                    <div className="flex flex-wrap gap-1.5 mb-3 pr-8">{prompt.tags?.map((tag, i) => (<span key={i} className="text-[10px] uppercase font-bold tracking-wider bg-white/70 text-stone-600 px-2 py-1 rounded-md border border-stone-100">{tag}</span>))}</div>
                    <h3 className="font-bold text-lg text-stone-800 mb-2 line-clamp-1 group-hover:text-orange-600 transition-colors pr-8">{prompt.title}</h3>
                    <div className="text-stone-500 text-sm line-clamp-4 mb-4 bg-white/50 p-3 rounded-lg border border-stone-100 font-mono">{prompt.content}</div>
                  </div>
                  <div className="p-4 border-t border-stone-100 bg-white/50 flex justify-between items-center text-stone-400 text-sm"><span className="flex items-center gap-1"><Smartphone size={14} /> Mobile Ready</span><div className="flex gap-1 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs items-center">點擊查看完整內容 <Maximize2 size={12} className="ml-1" /></div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} apiKey={apiKey} setApiKey={setApiKey} />
    </div>
  );
}