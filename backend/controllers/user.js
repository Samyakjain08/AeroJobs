import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

export const register = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, password, role } = req.body;
         
        if (!fullname || !email || !phoneNumber || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        const file = req.file;
        const fileUri = getDataUri(file);
        const cloudResponse = await cloudinary.uploader.upload(fileUri.content);

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                message: 'User already exist with this email.',
                success: false,
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            fullname,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile:{
                profilePhoto: cloudResponse.secure_url,
            }
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true
        });
    } catch (error) {
        console.log(error);
    }
}
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        };
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            })
        };

        const tokenData = {
            userId: user._id
        }
        const token = await jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        // Set cookie with correct options: httpOnly (not httpsOnly), sameSite lax for dev, and secure only in production
        const cookieOptions = {
            maxAge: 1 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        };

        return res.status(200).cookie("token", token, cookieOptions).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const logout = async (req, res) => {
    try {
        // Clear the token cookie using same options as when it was set
        const cookieOptions = {
            maxAge: 0,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        };
        return res.status(200).cookie("token", "", cookieOptions).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}


export const updateProfile = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;
        const file = req.file;

        let cloudResponse = null;

        // Upload file only if provided
        if (file) {
            try {
                console.log('Starting file upload process...');
                
                // Basic file validation
                if (!file.buffer || !file.originalname) {
                    console.error('File validation failed:', { buffer: !!file.buffer, originalname: !!file.originalname });
                    throw new Error('Invalid file data');
                }

                // Log file details
                console.log('File details:', {
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    buffer: file.buffer.length
                });

                // Basic file validation
                if (!file.originalname.toLowerCase().endsWith('.pdf')) {
                    console.error('Invalid file type:', file.originalname);
                    throw new Error('Only PDF files are allowed');
                }

                // Generate a simple filename
                const timestamp = Date.now();
                const sanitizedName = file.originalname
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/\.pdf$/, '');
                const simpleName = `resume_${timestamp}_${sanitizedName}`;
                console.log('Generated filename:', simpleName);

                // Get data URI
                console.log('Converting file to Data URI...');
                const fileUri = getDataUri(file);
                if (!fileUri?.content) {
                    console.error('Data URI conversion failed');
                    throw new Error('Failed to process file');
                }
                console.log('Data URI conversion successful');

                // Upload to Cloudinary
                console.log('Starting Cloudinary upload...');
                cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                    resource_type: 'raw',
                    folder: 'resumes',
                    public_id: simpleName,
                    format: 'pdf',
                    type: 'upload',
                    use_filename: false,
                    unique_filename: true
                });

                // Log the full Cloudinary response for debugging
                console.log('Full Cloudinary response:', JSON.stringify(cloudResponse, null, 2));

                // Determine the best direct URL to the uploaded file
                const cloudUrl = cloudResponse?.secure_url || cloudResponse?.url || null;
                if (!cloudUrl && cloudResponse?.public_id) {
                    // Construct a direct URL as a fallback
                    const cName = process.env.CLOUD_NAME || '';
                    const resourceType = cloudResponse.resource_type || 'raw';
                    const format = cloudResponse.format || 'pdf';
                    if (cName) {
                        // e.g. https://res.cloudinary.com/<cloud_name>/raw/upload/<public_id>.<format>
                        const constructed = `https://res.cloudinary.com/${cName}/${resourceType}/upload/${cloudResponse.public_id}.${format}`;
                        console.log('Constructed Cloudinary URL fallback:', constructed);
                        cloudResponse._direct_url = constructed;
                    }
                } else if (cloudUrl) {
                    cloudResponse._direct_url = cloudUrl;
                }

            } catch (error) {
                console.error('Error in file upload:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });

                // Check for specific error types
                if (error.http_code) {
                    console.error('Cloudinary error:', error);
                }

                return res.status(400).json({
                    message: "Error uploading file: " + error.message,
                    error: error.name,
                    success: false
                });
            }
        }

        let skillsArray = skills?.length > 0 ? skills.split(",") : [];

        const userId = req.id; // Middleware authentication should set this
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found.",
                success: false
            });
        }

        // Update user fields only if provided
        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (bio) user.profile.bio = bio;
        if (skillsArray.length > 0) user.profile.skills = skillsArray;

        // Upload resume only if cloudinary upload was successful
        if (cloudResponse) {
            // Prefer direct URL stored on cloudResponse._direct_url (we set this above), fall back to secure_url
            user.profile.resume = cloudResponse._direct_url || cloudResponse.secure_url || cloudResponse.url || null;
            user.profile.resumeOriginalName = file.originalname;
            console.log('Saving resume URL to user profile:', user.profile.resume);
        }

        await user.save();

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: {
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile
            },
            success: true
        });

    } catch (error) {
        console.error("Error in updateProfile:", error);
        return res.status(500).json({
            message: "Server Error",
            success: false,
            error: error.message
        });
    }
}

// AI-backed ATS scoring using Gemini
export const getAtsScoreAI = async (req, res) => {
    try {
        const userId = req.id;
        console.log(`getAtsScoreAI invoked; req.id=${userId}, timestamp=${new Date().toISOString()}`);
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const resumeUrl = user.profile?.resume;
        if (!resumeUrl) return res.status(400).json({ success: false, message: 'No resume uploaded' });

        const fetchRes = await fetch(resumeUrl);
        if (!fetchRes.ok) {
            const txt = await fetchRes.text().catch(() => null);
            console.error('Failed to fetch resume:', fetchRes.status, txt);
            return res.status(502).json({ success: false, message: 'Failed to download resume' });
        }
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // pdf-parse import (robust)
        let pdfParse;
        try {
            let mod;
            try { mod = await import('pdf-parse/lib/pdf-parse.js'); } catch (e) { mod = await import('pdf-parse'); }
            if (typeof mod === 'function') pdfParse = mod;
            else if (mod && typeof mod.default === 'function') pdfParse = mod.default;
            else if (mod && typeof mod.parse === 'function') pdfParse = mod.parse;
            else throw new Error('pdf-parse module has unexpected shape');
        } catch (e) {
            console.error('pdf-parse import failed:', e);
            return res.status(500).json({ success: false, message: 'Server missing or incompatible pdf-parse' });
        }

        // extract text
        let text = '';
        try {
            const parsedPdf = await pdfParse(buffer);
            text = parsedPdf?.text || parsedPdf?.content || '';
        } catch (e) {
            console.error('pdf-parse failed:', e);
            text = '';
        }

        // If no text extracted, fallback to profile metadata
        const resumeTextForPrompt = (text && text.length > 0) ? text.slice(0, 40000) : (
            `Profile fallback: Fullname: ${user.fullname}\nEmail: ${user.email}\nPhone: ${user.phoneNumber}\nSkills: ${Array.isArray(user.profile?.skills) ? user.profile.skills.join(', ') : user.profile?.skills || ''}\nBio: ${user.profile?.bio || ''}`
        );

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, message: 'AI key not configured on server' });

        // Prepare system prompt (unchanged)
        const systemPrompt = `You are an expert ATS reviewer. Given resume text, return ONLY a single JSON object (no surrounding text, no explanation) with exactly these keys:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence summary>",
  "recommendations": ["short tip 1", "short tip 2"]
}
Make "score" an integer between 0 and 100. Do not include any other keys or commentary.`;

        // Reduce the resume input size to avoid hitting output token limits.
        // Try a couple of progressively smaller chunks if the model returns empty.
        const MAX_CHUNK_CHARS = 8000; // first attempt chunk size
        const SECOND_CHUNK_CHARS = 2000; // fallback smaller chunk
        const resumeChunks = [
            (resumeTextForPrompt && resumeTextForPrompt.slice(0, MAX_CHUNK_CHARS)) || '',
            (resumeTextForPrompt && resumeTextForPrompt.slice(0, SECOND_CHUNK_CHARS)) || ''
        ];

        // generation config: increase output tokens to give model space to return JSON
        const generationConfig = { temperature: 0.0, maxOutputTokens: 800 };

        // robust extractor (tolerant to many shapes)
        const extractTextFromAI = (d) => {
            try {
                if (!d) return '';
                if (Array.isArray(d.candidates) && d.candidates.length > 0) {
                    const cand = d.candidates[0];
                    const content = cand.content;
                    if (!content) return '';
                    if (typeof content === 'string' && content.trim()) return content;
                    // content may be object or array
                    if (Array.isArray(content)) {
                        for (const entry of content) {
                            if (!entry) continue;
                            if (entry.parts && Array.isArray(entry.parts)) {
                                for (const p of entry.parts) if (p?.text) return p.text;
                            }
                            if (entry.text) return entry.text;
                        }
                    } else if (typeof content === 'object') {
                        // content can be shaped in multiple ways; inspect common locations
                        // direct parts
                        if (Array.isArray(content.parts)) {
                            for (const p of content.parts) if (p?.text) return p.text;
                        }
                        // nested keys
                        for (const key of Object.keys(content)) {
                            const val = content[key];
                            if (!val) continue;
                            if (typeof val === 'string' && val.trim()) return val;
                            if (Array.isArray(val)) {
                                for (const sub of val) {
                                    if (!sub) continue;
                                    if (sub.parts && Array.isArray(sub.parts)) {
                                        for (const p of sub.parts) if (p?.text) return p.text;
                                    }
                                    if (sub.text) return sub.text;
                                }
                            }
                        }
                    }
                }

                if (Array.isArray(d.outputs) && d.outputs.length > 0) {
                    const out = d.outputs[0];
                    if (out?.content && Array.isArray(out.content) && out.content[0]?.text) return out.content[0].text;
                }

                if (Array.isArray(d.choices) && d.choices.length > 0) {
                    const ch0 = d.choices[0];
                    if (ch0?.message?.content) return ch0.message.content;
                    if (ch0?.text) return ch0.text;
                }

                if (d?.reply) return d.reply;
                if (d?.outputText) return d.outputText;
                if (d?.text) return d.text;
                if (typeof d === 'string') return d;

                return '';
            } catch (e) {
                console.error('extractTextFromAI error', e);
                return '';
            }
        };

        // Try up to two attempts with smaller inputs if the model returns empty
        let data = null;
        let reply = '';
        for (let attempt = 0; attempt < resumeChunks.length; attempt++) {
            const chunk = resumeChunks[attempt];
            const payload = {
                contents: [{ parts: [{ text: chunk }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig
            };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
            const resp = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => null);
                console.error('Gemini API error', resp.status, errText);
                // If this was a 4xx (invalid key) let caller know
                return res.status(502).json({ success: false, message: 'AI service error' });
            }

            data = await resp.json();
            console.log(`Gemini response payload (attempt ${attempt + 1}):`, JSON.stringify(data));

            reply = (extractTextFromAI(data) || '').trim();

            // If model returned a simple placeholder role or ended with MAX_TOKENS and no text,
            // log and continue to next attempt with smaller chunk.
            const finishReason = data?.candidates?.[0]?.finishReason || data?.finishReason;
            if (reply && reply.length > 0) break;

            console.warn('No text extracted from Gemini response; finishReason=', finishReason, 'attempt=', attempt + 1);
            // small delay between attempts to avoid rate issues (optional)
            if (attempt < resumeChunks.length - 1) await new Promise(r => setTimeout(r, 250));
        }

        // If still no reply, do one short explicit follow-up request: ask for JSON-only score and include a short resume snippet.
        if (!reply || reply.trim() === '') {
            try {
                const snippet = (resumeTextForPrompt || '').slice(0, 1400);
                const followupInstruction = `Return ONLY a single JSON object with exactly this key: {"score":<integer 0-100>}. No explanatory text. Use the resume snippet provided to determine the score.`;
                const followupPayload = {
                    contents: [
                        { parts: [{ text: followupInstruction }] },
                        { parts: [{ text: snippet }] }
                    ],
                    systemInstruction: { parts: [{ text: 'You are an ATS scoring assistant. Output only the required JSON.' }] },
                    generationConfig: { temperature: 0.0, maxOutputTokens: 120 }
                };

                const apiUrl2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
                const resp2 = await fetch(apiUrl2, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(followupPayload)
                });
                if (resp2.ok) {
                    const data2 = await resp2.json();
                    console.log('Gemini followup response payload:', JSON.stringify(data2));
                    const reply2 = (extractTextFromAI(data2) || '').trim();
                    if (reply2 && reply2.length > 0) {
                        reply = reply2;
                        data = data2;
                    }
                } else {
                    const errText = await resp2.text().catch(() => null);
                    console.warn('Gemini followup non-ok:', resp2.status, errText);
                }
            } catch (e) {
                console.error('Followup AI attempt failed:', e);
            }
        }
        
        // parse JSON from reply (be resilient)
        let parsedResult = null;
        if (reply) {
            try {
                parsedResult = JSON.parse(reply);
            } catch (e) {
                const m = reply.match(/\{[\s\S]*\}/);
                if (m) {
                    try { parsedResult = JSON.parse(m[0]); } catch (e2) { parsedResult = null; }
                }
            }
        }

        // derive numeric score (unchanged)
        const deriveScore = (parsed, replyText, raw) => {
            if (parsed && parsed.score !== undefined && parsed.score !== null) {
                const n = Number(parsed.score);
                if (!Number.isNaN(n)) return Math.max(0, Math.min(100, Math.round(n)));
            }
            if (replyText) {
                const m = replyText.match(/"score"\s*:\s*(\d{1,3})/) || replyText.match(/score\s*[:=]\s*(\d{1,3})/) || replyText.match(/\bscore\s+is\s+(\d{1,3})\b/i);
                if (m) {
                    const n = Number(m[1]);
                    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, Math.round(n)));
                }
            }
            try {
                const s = JSON.stringify(raw || '');
                const m2 = s.match(/"score"\s*:\s*(\d{1,3})/);
                if (m2) {
                    const n = Number(m2[1]);
                    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, Math.round(n)));
                }
            } catch {}
            return null;
        };

        const scoreValue = deriveScore(parsedResult, reply, data);

        // Simple local heuristic fallback when AI doesn't return a numeric score
        const computeHeuristicAts = (text, userProfile) => {
            const t = (text || '').toLowerCase();
            let score = 50;
            // length bonus
            const words = (t.match(/\b\w+\b/g) || []).length;
            score += Math.min(20, Math.floor(words / 200)); // up to +20
            // presence of common sections
            if (/\b(work experience|experience|employment|professional experience)\b/.test(t)) score += 10;
            if (/\b(education|degrees|academic)\b/.test(t)) score += 8;
            if (/\b(skills?|technical skills|competencies)\b/.test(t)) score += 10;
            if (/\b(contact|email|phone|linkedin)\b/.test(t)) score += 5;
            // from stored profile skills (if available)
            if (userProfile?.skills && Array.isArray(userProfile.skills)) {
                score += Math.min(10, userProfile.skills.length);
            }
            // penalty for extremely short resumes
            if (words < 100) score -= 15;
            // clamp
            score = Math.max(10, Math.min(95, Math.round(score)));
            return score;
        };

        // Generate resume improvement suggestions when AI didn't provide recommendations
        const generateHeuristicRecommendations = (text, userProfile) => {
            const t = (text || '').toLowerCase();
            const words = (t.match(/\b\w+\b/g) || []).length;
            const rec = [];

            if (!/\b(work experience|experience|employment|professional experience)\b/.test(t)) {
                rec.push('Add a "Work Experience" section with company, role, dates and 2–4 bullet achievements per role (use metrics).');
            } else if (words < 400) {
                rec.push('Expand each role with 2–4 achievement-focused bullet points that include measurable results (%, numbers).');
            }

            if (!/\b(education|degree|university|school)\b/.test(t)) {
                rec.push('Include an Education section with degree, institution and graduation year (if recent).');
            }

            if (!/\b(skills?|technical skills|competencies)\b/.test(t) && (!userProfile?.skills || userProfile.skills.length === 0)) {
                rec.push('List relevant technical and soft skills near the top (comma-separated or short bullets).');
            }

            rec.push('Tailor the resume for the target job: add keywords from the job description to improve ATS match.');
            rec.push('Use simple formatting: plain text, bullet points, standard headings and avoid images/complex tables so ATS can parse your resume.');

            if (words < 200) rec.push('Resume is short — add more detail about responsibilities and outcomes to help ATS and recruiters.');

            // de-duplicate and return up to 6 suggestions
            return [...new Set(rec)].slice(0, 6);
        };

         // Use heuristic only if deriveScore couldn't find a numeric score
         let finalScore = scoreValue;
         let usedHeuristic = false;
         if (finalScore === null) {
             try {
                 finalScore = computeHeuristicAts(resumeTextForPrompt, user.profile);
                 usedHeuristic = true;
             } catch (e) {
                 finalScore = null;
             }
         }

        // pick recommendations: prefer AI-provided, else heuristic
        const finalRecommendations = (parsedResult && parsedResult.recommendations && Array.isArray(parsedResult.recommendations) && parsedResult.recommendations.length > 0)
            ? parsedResult.recommendations
            : generateHeuristicRecommendations(resumeTextForPrompt, user.profile);

        // Save to profile for debugging/cache (include whether heuristic was used)
        user.profile.atsAi = {
            computedAt: new Date(),
            raw: data,
            reply,
            parsed: parsedResult,
            score: finalScore,
            heuristic: usedHeuristic || false,
            recommendations: finalRecommendations
        };
        await user.save();

        if (finalScore === null) {
            return res.status(200).json({ success: true, score: null, reply, parsed: parsedResult, recommendations: finalRecommendations, notice: 'Could not extract numeric score and heuristic failed. See raw for details.', raw: data });
        }

        const notice = usedHeuristic ? 'Returned heuristic ATS score because AI did not provide numeric score.' : undefined;
        return res.status(200).json({ success: true, score: finalScore, reply, parsed: parsedResult, recommendations: finalRecommendations, notice });
    } catch (error) {
        console.error('getAtsScoreAI error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}