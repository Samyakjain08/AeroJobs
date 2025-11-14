import React, { useState } from 'react'
import Navbar from './shared/Navbar'
import { Avatar, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Contact, Mail, Pen } from 'lucide-react'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import AppliedJobTable from './AppliedJobTable'
import UpdateProfileDialog from './UpdateProfileDialog'
import { useSelector } from 'react-redux'
import axios from 'axios'
import { toast } from 'sonner'
import useGetAppliedJobs from '@/hooks/useGetAppliedJobs'

function Profile() {

        useGetAppliedJobs();
        const [open, setOpen]= useState(false);
        const [atsLoading, setAtsLoading] = useState(false);
        const [atsResult, setAtsResult] = useState(null);
        const {user} = useSelector(store => store.auth);

        const resumeUrl = user?.profile?.resume;
        const resumeDisplayName = user?.profile?.resumeOriginalName || "View Resume PDF";

        // helper: try to extract reply string and parsed object from many possible shapes
        const extractReplyAndParsed = (resData) => {
            if (!resData) return { reply: '', parsed: null, raw: resData };
            // prefer explicit parsed field
            if (resData.parsed) return { reply: resData.reply ?? '', parsed: resData.parsed, raw: resData.raw ?? resData };
            // if reply present and looks like JSON, parse it
            const replyCandidate = (typeof resData === 'string') ? resData : (resData.reply ?? resData.outputText ?? resData.text ?? '');
            let parsed = null;
            if (replyCandidate && typeof replyCandidate === 'string') {
                try { parsed = JSON.parse(replyCandidate); } catch(e){
                    const m = replyCandidate.match(/\{[\s\S]*\}/);
                    if (m) {
                        try { parsed = JSON.parse(m[0]); } catch{}
                    }
                }
            }
            // try to locate JSON inside nested raw payload shapes
            const raw = resData.raw ?? resData;
            // common Gemini shape: candidates -> content -> parts -> text
            const tryExtractTextFromRaw = (d) => {
                try {
                    if (!d) return '';
                    if (d?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text) return d.candidates[0].content[0].parts[0].text;
                    if (d?.candidates?.[0]?.content?.parts) {
                        // avoid flatMap on non-array shapes
                        const contentArr = Array.isArray(d.candidates[0].content) ? d.candidates[0].content : [d.candidates[0].content];
                        for (const c of contentArr) {
                            if (!c) continue;
                            const parts = Array.isArray(c.parts) ? c.parts : [];
                            for (const p of parts) if (p?.text) return p.text;
                        }
                    }
                    if (d?.outputs?.[0]?.content?.[0]?.text) return d.outputs[0].content[0].text;
                    if (d?.choices?.[0]?.message?.content) return d.choices[0].message.content;
                    if (d?.choices?.[0]?.text) return d.choices[0].text;
                    if (d?.reply) return d.reply;
                    if (d?.outputText) return d.outputText;
                    if (typeof d === 'string') return d;
                    return '';
                } catch { return ''; }
            };
            const textFromRaw = parsed ? '' : tryExtractTextFromRaw(raw);
            if (!parsed && textFromRaw) {
                try { parsed = JSON.parse(textFromRaw); } catch(e){
                    const m = textFromRaw.match(/\{[\s\S]*\}/);
                    if (m) {
                        try { parsed = JSON.parse(m[0]); } catch{}
                    }
                }
            }
            const reply = replyCandidate || textFromRaw || '';
            return { reply, parsed, raw };
        };

        // helper: extract score integer from parsed object or free text
        const extractScoreValue = ({ parsed, reply, raw }) => {
            // priority: parsed.score
            if (parsed && (parsed.score !== undefined && parsed.score !== null)) {
                const s = Number(parsed.score);
                if (!Number.isNaN(s)) return s;
            }
            // try to find "score": number in reply or raw.stringify
            const searchSpaces = (str) => {
                if (!str) return null;
                const m1 = str.match(/"score"\s*[:]\s*(\d{1,3})/i) || str.match(/score\s*[:=]\s*(\d{1,3})/i) || str.match(/\bscore\s+is\s+(\d{1,3})\b/i);
                if (m1) return Number(m1[1]);
                return null;
            }
            const v1 = searchSpaces(reply);
            if (v1 !== null) return v1;
            const rawText = (() => {
                try { return JSON.stringify(raw); } catch { return String(raw || '') }
            })();
            const v2 = searchSpaces(rawText);
            if (v2 !== null) return v2;
            return null;
        };

    return (
        <div>
            <Navbar />
            <div className='max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl my-5 p-8'>
                <div className='flex justify-between'>
                    <div className='flex items-center gap-4'>
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={user?.profile?.profilePhoto} alt="profile" />
                        </Avatar>
                        <div>
                            <h1 className='font-medium text-xl'> {user?.fullname} </h1>
                            <p>Hi, It is {user?.fullname} and aviation industry excites me.</p>
                        </div>
                    </div>
                    <Button onClick={()=>setOpen(true)} className="text-right" variant="outline"><Pen /></Button>
                </div>

                <div className='my-5'>
                    <div className='flex items-center gap-3 my-2'>
                        <Mail />
                        <span> {user?.email}</span>
                    </div>
                    <div className='flex items-center gap-3 my-2'>
                        <Contact />
                        <span> {user?.phoneNumber}</span>
                    </div>
                </div>

                <div className='my-5'>
                    <h1> Skills </h1>
                    <div className='flex items-center gap-1'>
                        {
                            user?.profile?.skills && user.profile.skills.length !== 0 ?
                                user.profile.skills.map((item, index) => <Badge key={index}>{item}</Badge>) :
                                <Badge variant="outline" className="text-gray-500">No Skills Listed</Badge>
                        }
                    </div>
                </div>

                <div className='grid w-full max-w-sm items-center gap-1.5'>
                    <Label className="text-md font-bold"> Resume </Label>
                    {
                        resumeUrl ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4">
                                    <a
                                        href={resumeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        {resumeDisplayName || 'View Resume'}
                                    </a>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            window.open(resumeUrl, '_blank');
                                        }}
                                    >
                                        Open in New Tab
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm text-gray-500">Can't open the PDF? Try:</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(resumeUrl);
                                            toast.success('Resume URL copied to clipboard');
                                        }}
                                        className="text-sm text-blue-500 hover:underline"
                                    >
                                        Copy Direct Link
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    <Button variant="ghost" size="sm" onClick={async ()=>{
                                            setAtsLoading(true);
                                            try{
                                                toast('Computing ATS score...')
                                                const res = await axios.get('/api/v1/user/ats-score-ai', { withCredentials: true })
                                                console.log('ATS API response:', { status: res.status, data: res.data, headers: res.headers })

                                                // normalize response
                                                const normalized = extractReplyAndParsed(res.data);
                                                const score = extractScoreValue(normalized);

                                                // prefer API explicit score / recommendations, fallback to extracted values
                                                const apiScore = (res?.data?.score ?? null);
                                                const apiRecs = (res?.data?.recommendations ?? null);
                                                const finalScore = apiScore !== null ? apiScore : score;
                                                const recsCandidate =
                                                    apiRecs ??
                                                    normalized.parsed?.recommendations ??
                                                    (Array.isArray(normalized.raw?.recommendations) ? normalized.raw.recommendations : null);

                                                const recommendations = Array.isArray(recsCandidate)
                                                    ? recsCandidate
                                                    : (recsCandidate ? [String(recsCandidate)] : []);

                                                setAtsResult({
                                                    parsed: normalized.parsed,
                                                    raw: normalized.raw,
                                                    reply: normalized.reply,
                                                    score: finalScore,
                                                    recommendations
                                                });

                                                if (finalScore !== null && finalScore !== undefined) {
                                                  toast.success(`ATS Score: ${finalScore}`);
                                                } else if (res?.data?.success) {
                                                  toast.success('ATS computed — see result below');
                                                } else {
                                                  const msg = res?.data?.message || 'Failed to compute ATS';
                                                  toast.error(msg);
                                                }
                                            }catch(err){
                                                console.error('ATS AI error', err);
                                                setAtsResult({ error: err?.response?.data?.message || err?.message || 'Error', raw: err?.response?.data || err });
                                                const msg = err?.response?.data?.message || err?.message || 'Network or server error while computing ATS';
                                                toast.error(msg)
                                            } finally{
                                                setAtsLoading(false);
                                            }
                                        }} disabled={atsLoading}>{atsLoading ? 'Computing...' : 'Get ATS (AI)'}</Button>
                                </div>

                                {/* show recommendations (if any) */}
                                {atsResult?.recommendations && atsResult.recommendations.length > 0 && (
                                    <div className="mt-3 p-3 bg-white border rounded">
                                        <div className="text-sm font-semibold mb-2">Resume improvement suggestions</div>
                                        <ul className="list-disc list-inside space-y-1">
                                            {atsResult.recommendations.map((rec, idx) => (
                                                <li key={idx} className="text-sm text-gray-700">{rec}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* show score */}
                                {atsResult?.score !== null && atsResult?.score !== undefined && (
                                    <div className="mt-3 p-3 bg-green-50 border rounded">
                                        <div className="text-lg font-semibold">ATS Score: {atsResult.score}</div>
                                        {atsResult.parsed?.summary && <div className="mt-2">{atsResult.parsed.summary}</div>}
                                    </div>
                                )}

                                {/* show errors or notices only (no raw AI payload) */}
                                {atsResult?.error && (
                                    <div className="mt-3 p-3 bg-red-50 border rounded">
                                        <div className="text-red-600"><strong>Error:</strong> {atsResult.error}</div>
                                    </div>
                                )}
                                {atsResult?.notice && (
                                    <div className="mt-3 p-3 bg-yellow-50 border rounded">
                                        <div className="text-yellow-800">{atsResult.notice}</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="text-gray-500">Resume not uploaded</span>
                        )
                    }
                </div>
            </div>

            <div>
                <div className='max-w-4xl mx-auto bg-white rounded-2xl'>
                    <h1 className='font-bold text-lg my-5'>Applied Jobs</h1>
                    <AppliedJobTable/>
                </div>
            </div>
            <UpdateProfileDialog open={open} setOpen={setOpen} />
        </div>
    )
}

export default Profile;