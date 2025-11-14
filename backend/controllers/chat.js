import express from 'express';

// Gemini-backed chatbot controller with a small rule-based fallback.
export const chatHandler = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'No message provided' });

        // 1. Check for the Gemini API Key
        const apiKey = process.env.GEMINI_API_KEY;
        
        // 2. System prompt to guide the assistant
        const systemPrompt = `You are AeroJobs assistant. You are an expert in the aviation recruitment industry. Help users with resume uploads, ATS scoring, profile tips and job search guidance. When appropriate, point them to the Profile → Get ATS Score feature. Be concise, friendly, and ask clarifying questions if the user's request is ambiguous.`;

        if (!apiKey) {
            // 3. Fallback: limited rule-based responses when no API key is provided.
            const text = String(message).toLowerCase();
            if (text.includes('hello') || text.includes('hi')) {
                return res.status(200).json({ success: true, reply: 'Hello! I can help with resumes, ATS scores, and job search tips. (AI key not configured on server.)' });
            }
            if (text.includes('resume') && text.includes('score')) {
                return res.status(200).json({ success: true, reply: 'You can get an ATS score on your Profile page using the "Get ATS Score" button.' });
            }
            if (text.includes('upload')) {
                return res.status(200).json({ success: true, reply: 'To upload your resume, go to Profile → Edit → Resume and select your PDF.' });
            }
            return res.status(200).json({ success: true, reply: `I heard: "${message}". (Server GEMINI_API_KEY not configured; set it to enable AI responses.)` });
        }

        // 4. Construct the Gemini API URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 5. Construct the Gemini API Payload
        const payload = {
            contents: [
                {
                    parts: [{ text: String(message) }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 500
            } 
        };

        // 6. Call Gemini API via fetch
        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('Gemini API error', resp.status, errText);
            return res.status(502).json({ success: false, message: 'AI service error' });
        }

        const data = await resp.json();
        
        // 7. Parse the Gemini response
        // Use optional chaining for safety
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a reply.';
        
        return res.status(200).json({ success: true, reply: reply.trim() });
    } catch (error) {
        console.error('Chat handler error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

export default chatHandler;