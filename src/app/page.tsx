"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './page.module.css';
import { 
  BookOpen, Copy, Download, Sparkles, Send, 
  Plus, Trash2, Menu, X, MessageSquare, 
  FileUp, FileText, CheckCircle, AlertCircle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function Home() {

  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Semplice');
  const [format, setFormat] = useState('Testo Strutturato');
  const [purpose, setPurpose] = useState('Ripasso Veloce');
  const [tone, setTone] = useState('Accademico e formale');

  const [pdfContext, setPdfContext] = useState<string>('');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const resp = await fetch('/api/chats');
      const data = await resp.json();
      if (Array.isArray(data)) {
        setChats(data);
      }
    } catch (e) {
      console.error("Failed to fetch chats from DB");
    }
  };

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, loading]);

  const currentChat = chats.find(c => c.id === currentChatId);

  const createNewChat = () => {
    setCurrentChatId(null);
    setTopic('');
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };


  const handleInitialGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    const newChatId = Date.now().toString();

    const initialUserMessageContent = `Argomento: ${topic}
Livello: ${level}
Formato richiesto: ${format}
Scopo dell'utente: ${purpose}
Tono di voce e stile: ${tone}

Basandoti su questi dati, genera il materiale di studio richiesto in modo completo.\nRispondi SEMPRE ed ESCLUSIVAMENTE in lingua Italiana.`;

    const initialMessages: Message[] = [
      { role: 'user', content: initialUserMessageContent }
    ];

    const newChat: Chat = {
      id: newChatId,
      title: topic,
      messages: [...initialMessages, { role: 'assistant', content: '' }],
      createdAt: Date.now()
    };

    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
    if (window.innerWidth <= 768) setSidebarOpen(false);

    await streamResponse(newChatId, initialMessages, pdfContext, topic);
    fetchChats(); // Refresh history
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Per favore carica solo file PDF.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setPdfContext(data.markdown);
        setPdfFileName(data.fileName);
      } else {
        alert(data.error || 'Errore durante l\'estrazione del PDF');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Errore di connessione durante l\'upload del PDF');
    } finally {
      setIsUploading(false);
    }
  };

  const removePDF = () => {
    setPdfContext('');
    setPdfFileName(null);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Sei sicuro di voler eliminare questa chat?')) return;

    try {
      const resp = await fetch('/api/chats/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });
      if (resp.ok) {
        if (currentChatId === chatId) {
          setCurrentChatId('new');
        }
        fetchChats();
      }
    } catch (e) {
      console.error("Failed to delete chat");
    }
  };

  const handleFollowUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !currentChatId || !currentChat) return;

    const userText = chatInput.trim();
    setChatInput('');

    const updatedMessages: Message[] = [
      ...currentChat.messages,
      { role: 'user', content: userText },
      { role: 'assistant', content: '' }
    ];

    setChats(prev => prev.map(c => c.id === currentChatId ? {
      ...c,
      messages: updatedMessages
    } : c));

    const messagesToSend = updatedMessages.slice(0, -1);
    await streamResponse(currentChatId, messagesToSend, pdfContext);
  };

  const streamResponse = async (chatId: string, messagesContext: Message[], context?: string, topic?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messagesContext,
          context: context, 
          chatId: chatId === 'new' ? undefined : chatId, // Use real ID if it's not a temporary one
          topic: topic // Use for identifying new chat
        }),
      });

      const provider = response.headers.get('X-LLM-Provider');
      if (provider) setLlmProvider(provider);

      if (!response.body) throw new Error('No readable body stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value);
          const lines = chunkValue.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message && parsed.message.content) {

                setChats(prev => prev.map(c => {
                  if (c.id === chatId) {
                    const newMessages = [...c.messages];
                    const lastIndex = newMessages.length - 1;
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      content: newMessages[lastIndex].content + parsed.message.content
                    };
                    return { ...c, messages: newMessages };
                  }
                  return c;
                }));
              }
            } catch (e) {

            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating notes:', error);
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          const newMessages = [...c.messages];
          newMessages[newMessages.length - 1].content = "⚠️ Si è verificato un errore. Assicurati che Ollama sia in esecuzione in locale (`ollama run llama3`).";
          return { ...c, messages: newMessages };
        }
        return c;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
          .then(() => {
            console.log('Appunti copiati negli appunti!');
            resolve(true);
          })
          .catch((err) => {
            console.error('Errore durante la copia:', err);
            reject(err);
          });
      } else {
        reject(new Error('Clipboard API non disponibile'));
      }
    });
  };

  const handleDownloadPDF = async (text: string, title: string) => {
    if (typeof window !== 'undefined') {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const tempDiv = document.createElement('div');
      tempDiv.style.padding = '20px';
      tempDiv.style.color = '#111827';
      tempDiv.style.background = '#ffffff';
      tempDiv.style.fontFamily = 'Inter, sans-serif';
      
      const { renderToString } = await import('react-dom/server');
      const staticMarkup = renderToString(
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      );
      
      const styleTag = `
        <style>
          * { box-sizing: border-box; }
          h1, h2, h3, h4, h5, h6 { font-family: 'Inter', sans-serif; color: #111827; margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 700; line-height: 1.2; }
          h1 { font-size: 2.2em; margin-top: 0; padding-bottom: 0.3em; border-bottom: 1px solid #e2e8f0; }
          h2 { font-size: 1.6em; }
          h3 { font-size: 1.3em; }
          p { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; margin-bottom: 1em; color: #334155; }
          ul, ol { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; margin-bottom: 1em; padding-left: 1.5em; color: #334155; }
          li { margin-bottom: 0.4em; }
          code { font-family: 'ui-monospace', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; background-color: #f1f5f9; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; color: #be185d; }
          pre { background-color: #f8fafc; padding: 1.2em; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; border: 1px solid #e2e8f0; }
          pre code { background-color: transparent; padding: 0; color: #1e293b; border-radius: 0; font-size: 0.85em; }
          blockquote { border-left: 4px solid #3b82f6; margin: 0 0 1em 0; padding: 0.5em 0 0.5em 1em; color: #475569; font-style: italic; background-color: #f0f9ff; border-radius: 0 4px 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1em; font-size: 14px; font-family: 'Inter', sans-serif; }
          th, td { border: 1px solid #cbd5e1; padding: 0.75em; text-align: left; color: #334155; }
          th { background-color: #f1f5f9; font-weight: 600; color: #0f172a; }
          strong, b { color: #0f172a; font-weight: 700; }
        </style>
      `;

      tempDiv.innerHTML = styleTag + staticMarkup;
      
      const opt: any = {
        margin:       [0.5, 0.5, 0.5, 0.5],
        filename:     `Appunti_${title.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, backgroundColor: '#ffffff', windowWidth: 800 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(tempDiv).save();
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={styles.appContainer}>
      <button className={styles.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
        <Menu size={20} />
      </button>

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <button className={styles.newChatBtn} onClick={createNewChat} style={{flex: 1}}>
            <Plus size={18} />
            Nuova Chat
          </button>
          <button 
            className={`${styles.actionBtn} ${styles.mobileCloseBtn || ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18}/>
          </button>
        </div>

        <div className={styles.chatHistoryList}>
          {chats.map(chat => (
            <div 
              key={chat.id}
              className={`${styles.chatHistoryItem} ${currentChatId === chat.id ? styles.active : ''}`}
              onClick={() => {
                setCurrentChatId(chat.id);
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
            >
              <MessageSquare size={16} />
              <div className={styles.chatTitle}>{chat.title || "Nuovi Appunti"}</div>
              <button 
                className={styles.deleteChatBtn}
                onClick={(e) => deleteChat(chat.id, e)}
                title="Elimina"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.mainArea}>
        
        {!currentChatId && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', padding: '2rem 1rem' }}>
            <form onSubmit={handleInitialGenerate} className={styles.setupForm}>
              <div>
                <h1 className={styles.headerTitle}>Study Notes AI</h1>
                <p className={styles.headerSubtitle}>
                  Definisci i parametri della tua sessione di studio intelligente.
                </p>
              </div>

              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Cosa voglio sapere?</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="es. Ciclo di Krebs, Storia di Roma antica..." 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Livello di difficoltà</label>
                  <select className={styles.select} value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="Principiante (Semplice, senza gergo)">Principiante (Semplice)</option>
                    <option value="Intermedio (Scuola Superiore)">Intermedio (Scuole Superiori)</option>
                    <option value="Avanzato (Universitario)">Avanzato (Universitario)</option>
                    <option value="Esperto (Professionale/Ricerca)">Esperto (Dettaglio estremo)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Formato richiesto</label>
                  <select className={styles.select} value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="Testo Strutturato">Testo Strutturato con Paragrafi</option>
                    <option value="Lista a Punti">Lista a Punti (Estrema Sintesi)</option>
                    <option value="Mappa Concettuale">Mappa Concettuale (Formato ad Albero testuale)</option>
                    <option value="Codice/Spiegazione Tecnica">Codice o Spiegazione Tecnica</option>
                    <option value="Domande e Risposte (Flashcards)">Domande e Risposte (Stile Flashcard)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Scopo principale</label>
                  <select className={styles.select} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option value="Ripasso Veloce pre-esame">Ripasso veloce prima di un esame</option>
                    <option value="Studio Approfondito da zero">Studio di base per imparare da zero</option>
                    <option value="Creare una presentazione">Creare una presentazione/slide</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Tono e Stile</label>
                  <select className={styles.select} value={tone} onChange={(e) => setTone(e.target.value)}>
                    <option value="Accademico e formale">Accademico e Formale</option>
                    <option value="Discoursivo e informale">Amichevole e Informale</option>
                    <option value="Humour / Divertente e creativo">Divertente con analogie curiose</option>
                  </select>
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Importa Materiale (PDF per RAG)</label>
                  {!pdfFileName ? (
                    <label className={styles.uploadZone}>
                      <input 
                        type="file" 
                        accept=".pdf" 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <div className={styles.uploadingOverlay}>
                          <div className={styles.spinner} style={{width: 16, height: 16, borderWidth: 2}}></div>
                          <span>Analisi PDF in corso con OpenDataLoader...</span>
                        </div>
                      ) : (
                        <>
                          <FileUp size={24} color="var(--primary)" />
                          <p>Trascina o clicca per caricare un PDF di studio</p>
                          <small style={{opacity: 0.6, fontSize: '0.75rem'}}>L'AI userà questo file come base per i tuoi appunti.</small>
                        </>
                      )}
                    </label>
                  ) : (
                    <div className={styles.filePill}>
                      <FileText size={16} />
                      <span>{pdfFileName}</span>
                      <button className={styles.filePillRemove} onClick={removePDF}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className={styles.submitBtn}
                  disabled={!topic || loading}
                >
                  <Sparkles size={20} />
                  Inizia la generazione
                </button>
              </div>
            </form>
          </div>
        )}

        {currentChat && (
          <>
            <div className={styles.chatArea} ref={chatContainerRef}>
              <div className={styles.messagesContainer}>
                {/* Active File Banner */}
                {pdfFileName && (
                  <div className={styles.activeFileBanner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <FileText size={16} />
                      <span>Utilizzando il contesto di: <strong>{pdfFileName}</strong></span>
                    </div>
                    {llmProvider && (
                      <div className={styles.providerBadge}>
                        <Sparkles size={12} />
                        <span>Powered by {llmProvider}</span>
                      </div>
                    )}
                  </div>
                )}

                {currentChat.messages.map((msg, idx) => {

                  if (idx === 0 && msg.role === 'user') {
                      return (
                          <div key={idx} className={`${styles.messageBubble} ${styles.user}`}>
                            <div className={`${styles.avatar} ${styles.user}`}>U</div>
                            <div className={styles.messageContent}>
                                <div style={{opacity: 0.7, fontSize: '0.9rem', marginBottom: '0.5rem'}}>
                                    <em>Generazione appunti iniziale in base ai parametri stabiliti...</em>
                                </div>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                      )
                  }

                  return (
                    <div key={idx} className={`${styles.messageBubble} ${styles[msg.role]}`}>
                      <div className={`${styles.avatar} ${styles[msg.role]}`}>
                        {msg.role === 'user' ? 'U' : <Sparkles size={16} />}
                      </div>
                      
                      <div className={styles.messageContent}>
                        {msg.content === '' && loading && idx === currentChat.messages.length - 1 ? (
                          <div className={styles.skeletonContainer}>
                            <div className={styles.skeletonLine} style={{width: '90%'}}></div>
                            <div className={styles.skeletonLine} style={{width: '75%'}}></div>
                            <div className={styles.skeletonLine} style={{width: '40%'}}></div>
                          </div>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>

                      {msg.role === 'assistant' && msg.content && !loading && (
                        <div className={styles.msgActions}>
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handleCopy(msg.content)} 
                            title="Copia Testo"
                          >
                            <Copy size={16} />
                          </button>
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handleDownloadPDF(msg.content, currentChat.title)} 
                            title="Scarica come PDF"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className={styles.inputArea}>
              <form 
                className={styles.chatSearchWrapper}
                onSubmit={handleFollowUp}
              >
                <textarea
                  className={styles.chatTextarea}
                  placeholder="Chiedi chiarimenti o modifica questi appunti (es. Aggiungi tabella riassuntiva)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleFollowUp();
                    }
                  }}
                  disabled={loading}
                />
                <button 
                  type="submit" 
                  className={styles.chatSendBtn}
                  disabled={!chatInput.trim() || loading}
                >
                  {loading ? <div className={styles.spinner} style={{width: 16, height: 16, borderWidth: 2}}></div> : <Send size={18} />}
                </button>
              </form>
              <div style={{textAlign: 'center', fontSize: '0.75rem', color: '#666', marginTop: '0.8rem'}}>
                L'Intelligenza Artificiale può commettere errori. Controlla le informazioni principali o chiedi spiegazioni, usando sempre il tuo giudizio.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
