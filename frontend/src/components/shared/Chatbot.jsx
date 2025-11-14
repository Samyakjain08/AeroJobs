import React, {useState, useRef, useEffect} from 'react'
import axios from 'axios'
import { USER_API_END_POINT } from '../../utils/constant'

const Chatbot = () => {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'})
  },[messages, open])

  const sendMessage = async () => {
    const text = input.trim()
    if(!text) return
    const userMsg = {from: 'user', text}
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try{
  // Use relative API path so Vite dev server can proxy /api to the backend (configured in vite.config.js)
  const res = await axios.post('/api/v1/chat', {message: text}) 
      if(res?.data?.success){
        setMessages(m => [...m, {from:'bot', text: res.data.reply}])
      } else {
        setMessages(m => [...m, {from:'bot', text: 'Sorry, I could not get a reply right now.'}])
      }
    }catch(err){
      console.error('Chat error', err)
      setMessages(m => [...m, {from:'bot', text: 'Network error. Try again later.'}])
    } finally{
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if(e.key === 'Enter') sendMessage()
  }

  return (
    <div>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {open && (
          <div className="w-80 h-96 bg-white shadow-lg rounded-lg flex flex-col overflow-hidden">
            <div className="p-3 bg-indigo-600 text-white font-semibold">Assistant</div>
            <div className="flex-1 p-2 overflow-auto text-sm">
              {messages.length === 0 && <div className="text-gray-500">Hi — ask me about resumes, ATS score, or jobs.</div>}
              {messages.map((m, i)=> (
                <div key={i} className={`mb-2 ${m.from==='user' ? 'text-right' : 'text-left'}`}>
                  <div className={`${m.from==='user' ? 'inline-block bg-indigo-100 text-indigo-900' : 'inline-block bg-gray-100 text-gray-900'} px-3 py-1 rounded-md`}>{m.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t">
              <div className="flex items-center gap-2">
                <input value={input} onKeyDown={onKeyDown} onChange={e=>setInput(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Type a message..." />
                <button onClick={sendMessage} className="bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50" disabled={loading}>{loading ? '...' : 'Send'}</button>
              </div>
            </div>
          </div>
        )}

        <button onClick={()=>setOpen(o=>!o)} className="w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center">
          {open ? '×' : '💬'}
        </button>
      </div>
    </div>
  )
}

export default Chatbot
