import React, { useState, useEffect } from 'react';
import { Role, Lesson, LessonStatus, QuizState, GradeResult, Syllabus } from './types';
import { generateLessonContent, transcribeHandwriting, gradeAnswer } from './services/geminiService';
import { FocusGuard } from './components/FocusGuard';
import { CameraCapture } from './components/CameraCapture';
import { VoiceAssistant, VoiceCommand } from './components/VoiceAssistant';

// --- Icons ---
const LockIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const UnlockIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>;
const MagicIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const UploadIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;

export default function App() {
  // State
  const [role, setRole] = useState<Role>(Role.PARENT);
  const [lessonStatus, setLessonStatus] = useState<LessonStatus>(LessonStatus.IDLE);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  
  // Lesson Creation Inputs
  const [topicInput, setTopicInput] = useState('');
  const [ageInput, setAgeInput] = useState(12);
  const [syllabusInput, setSyllabusInput] = useState<Syllabus>(Syllabus.GENERAL);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // Student Mode State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>({ currentQuestionIndex: 0, answers: [] });
  
  // Camera & Voice State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTrigger, setCameraTrigger] = useState(0); // Increment to trigger capture
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentGrade, setCurrentGrade] = useState<GradeResult | null>(null);
  
  // Focus Guard
  const [focusWarnings, setFocusWarnings] = useState(0);

  // --- Init ---
  useEffect(() => {
    // Check for API Key selection if available in the environment (e.g. AI Studio Preview)
    const checkKey = async () => {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey && (window as any).aistudio.openSelectKey) {
                 await (window as any).aistudio.openSelectKey();
            }
        }
    };
    checkKey();
  }, []);

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setUploadedImages(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCreateLesson = async () => {
    if (!topicInput && uploadedImages.length === 0) {
      alert("Please enter a topic or upload content.");
      return;
    }
    setLessonStatus(LessonStatus.GENERATING);
    try {
      const content = await generateLessonContent(topicInput || "Uploaded Material", ageInput, syllabusInput, uploadedImages);
      const newLesson: Lesson = {
        id: Date.now().toString(),
        topic: topicInput || "Study Material",
        syllabus: syllabusInput,
        targetAge: ageInput,
        slides: content.slides,
        questions: content.questions
      };
      setCurrentLesson(newLesson);
      setLessonStatus(LessonStatus.READY);
      localStorage.setItem('currentLesson', JSON.stringify(newLesson));
    } catch (e: any) {
      console.error(e);
      alert(`Failed to create lesson: ${e.message}. Please ensure you have a valid API Key selected.`);
      
      // If error suggests missing key, try to prompt
      if (e.message?.includes("key") || e.message?.includes("403") || e.message?.includes("401")) {
         if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
             (window as any).aistudio.openSelectKey();
         }
      }
      setLessonStatus(LessonStatus.IDLE);
    }
  };

  const startStudentMode = () => {
    if (!currentLesson) return;
    setRole(Role.STUDENT);
    document.documentElement.requestFullscreen().catch((e) => console.log("Fullscreen blocked", e));
  };

  const handleCapture = async (imageData: string) => {
    setIsCameraOpen(false);
    setCapturedImage(imageData);
    setTranscribedText("Reading your handwriting...");
    setIsProcessing(true);
    
    // AI Transcription
    try {
        const text = await transcribeHandwriting(imageData);
        setTranscribedText(text);
    } catch (e) {
        setTranscribedText("Error reading text.");
    }
    setIsProcessing(false);
  };

  const submitAnswer = async () => {
    if (!currentLesson) return;
    const currentQuestion = currentLesson.questions[quizState.currentQuestionIndex];
    setIsProcessing(true);
    
    const grade = await gradeAnswer(currentQuestion.questionText, transcribedText, currentQuestion.correctAnswerSummary);
    setCurrentGrade(grade);
    setIsProcessing(false);

    const newAnswers = [...quizState.answers];
    newAnswers[quizState.currentQuestionIndex] = {
      questionId: currentQuestion.id,
      transcription: transcribedText,
      grade
    };
    setQuizState({ ...quizState, answers: newAnswers });
  };

  const nextSlideOrQuestion = () => {
    if (!currentLesson) return;

    if (lessonStatus === LessonStatus.READY) {
        if (currentSlideIndex < currentLesson.slides.length - 1) {
            setCurrentSlideIndex(currentSlideIndex + 1);
        } else {
            setLessonStatus(LessonStatus.IN_PROGRESS); // Start Quiz
        }
    } else if (lessonStatus === LessonStatus.IN_PROGRESS) {
        // Only go next if current question is graded or user forces it?
        // For simplicity, allow next if current is done
        if (currentGrade) {
            if (quizState.currentQuestionIndex < currentLesson.questions.length - 1) {
                setQuizState({ ...quizState, currentQuestionIndex: quizState.currentQuestionIndex + 1 });
                setCapturedImage(null);
                setTranscribedText('');
                setCurrentGrade(null);
            } else {
                setLessonStatus(LessonStatus.COMPLETED);
            }
        } else {
            // Maybe just submit if text exists?
        }
    }
  };

  // --- Voice Command Handler ---
  const handleVoiceCommand = (cmd: VoiceCommand) => {
    console.log("Processing Voice Command:", cmd);
    switch (cmd) {
        case 'OPEN_CAMERA':
            if (role === Role.STUDENT && lessonStatus === LessonStatus.IN_PROGRESS) {
                setIsCameraOpen(true);
            }
            break;
        case 'CLOSE_CAMERA':
            setIsCameraOpen(false);
            break;
        case 'TAKE_PHOTO':
            if (isCameraOpen) {
                setCameraTrigger(prev => prev + 1);
            }
            break;
        case 'NEXT':
            nextSlideOrQuestion();
            break;
        case 'READ':
            // Logic handled by VoiceAssistant reading internal context, 
            // but we can trigger specific reads if needed.
            break;
    }
  };

  // --- Dynamic Context for AI ---
  const getAIContext = (): string => {
      if (!currentLesson) return "We are in the main menu.";
      if (lessonStatus === LessonStatus.READY) {
          const slide = currentLesson.slides[currentSlideIndex];
          return `Current Slide: ${slide.title}. ${slide.content}. Bullet points: ${slide.bulletPoints.join(', ')}.`;
      }
      if (lessonStatus === LessonStatus.IN_PROGRESS) {
          const q = currentLesson.questions[quizState.currentQuestionIndex];
          return `Current Quiz Question: ${q.questionText}.`;
      }
      return "Lesson completed.";
  };

  const handleFocusBreach = () => {
    if (role === Role.STUDENT) {
       setFocusWarnings(prev => prev + 1);
    }
  };

  const generateKioskScript = () => {
    const script = `
# Windows PowerShell Kiosk Setup Script (Run as Admin)
# 1. Create a user account named 'Student'
# 2. Run this script to assign Edge as the only allowed app.

$user = "Student"
$app = "Microsoft.MicrosoftEdge_8wekyb3d8bbwe!MicrosoftEdge"
try {
    Set-AssignedAccess -UserName $user -AppName $app
    Write-Host "Kiosk mode enabled for $user" -ForegroundColor Green
} catch {
    Write-Host "Error: Ensure user '$user' exists and you are Admin." -ForegroundColor Red
}
    `;
    navigator.clipboard.writeText(script);
    alert("PowerShell script copied to clipboard! Run this as Administrator on your Windows PC to enforce Kiosk Mode.");
  };

  // --- Render Sections ---

  const renderAdminDashboard = () => (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-indigo-900 flex items-center gap-2">
            <span className="bg-indigo-100 p-2 rounded-lg">🛡️</span> StudyGuardian
            </h1>
            <p className="text-indigo-600 ml-12">LMS & Control Center</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg shadow-sm border overflow-hidden">
            <button 
                onClick={() => setRole(Role.PARENT)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${role === Role.PARENT ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Parent
            </button>
            <button 
                onClick={() => setRole(Role.TEACHER)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${role === Role.TEACHER ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Teacher
            </button>
            <button 
                onClick={() => setRole(Role.STUDENT)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${role === Role.STUDENT ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Student
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Panel */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-indigo-50">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold text-gray-800">Plan a Lesson</h2>
             {uploadedImages.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{uploadedImages.length} images attached</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Target Syllabus</label>
              <select 
                value={syllabusInput} 
                onChange={(e) => setSyllabusInput(e.target.value as Syllabus)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none bg-white text-gray-900"
              >
                 {Object.values(Syllabus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Student Age</label>
              <input 
                type="number" 
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none bg-white text-gray-900 placeholder-gray-400"
                value={ageInput}
                onChange={(e) => setAgeInput(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Topic or Concept</label>
            <input 
                type="text" 
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition bg-white text-gray-900 placeholder-gray-400"
                placeholder="e.g. Photosynthesis, Quadratic Equations..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">Source Material (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer relative bg-white">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                <div className="flex flex-col items-center gap-2 text-gray-500">
                    <UploadIcon />
                    <span className="text-sm">Upload Textbook Page / Notes / PDF Image</span>
                </div>
            </div>
          </div>
            
          <button 
              onClick={handleCreateLesson}
              disabled={lessonStatus === LessonStatus.GENERATING}
              className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition ${
                lessonStatus === LessonStatus.GENERATING 
                ? 'bg-gray-100 text-gray-400 cursor-wait' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200'
              }`}
            >
              {lessonStatus === LessonStatus.GENERATING ? 'AI is preparing the lesson...' : <><MagicIcon /> Generate Lesson Plan</>}
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
            {/* Active Lesson Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-100">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Ready to Teach</h2>
                {currentLesson ? (
                    <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                        <h3 className="font-bold text-green-900">{currentLesson.topic}</h3>
                        <p className="text-xs text-green-700 uppercase font-bold mt-1">{currentLesson.syllabus}</p>
                        <p className="text-sm text-green-700 mt-2">{currentLesson.slides.length} Slides • {currentLesson.questions.length} Questions</p>
                    </div>
                    <button 
                        onClick={startStudentMode}
                        className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 shadow-lg hover:shadow-green-200 transition flex items-center justify-center gap-2"
                    >
                        <LockIcon /> Launch Student Mode
                    </button>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl text-sm">
                    No active lesson
                    </div>
                )}
            </div>

            {/* System Tools */}
            <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">⚙️ System Lock</h2>
                <p className="text-xs text-gray-400 mb-4">
                    AI cannot directly lock the OS. Use our script generator to enforce Windows Kiosk Mode.
                </p>
                <button 
                    onClick={generateKioskScript}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-mono border border-gray-600 transition"
                >
                    &gt; Generate PowerShell Script
                </button>
            </div>
        </div>
      </div>
    </div>
  );

  const renderSlides = () => {
    if (!currentLesson) return null;
    const slide = currentLesson.slides[currentSlideIndex];

    return (
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 h-full justify-center relative">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[60vh] flex flex-col border border-gray-100">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 flex justify-between items-center">
            <h2 className="text-3xl font-black text-white drop-shadow-md">{slide.title}</h2>
            <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-white font-bold border border-white/30">
              {currentSlideIndex + 1} / {currentLesson.slides.length}
            </span>
          </div>
          <div className="p-10 flex-1 bg-gradient-to-b from-yellow-50 to-white overflow-y-auto">
            <p className="text-2xl text-gray-800 leading-relaxed mb-8 font-medium">{slide.content}</p>
            <ul className="space-y-4">
              {slide.bulletPoints.map((bp, i) => (
                <li key={i} className="flex items-start gap-4 text-xl text-gray-700 bg-white p-4 rounded-xl shadow-sm border border-yellow-100">
                  <span className="mt-1.5 min-w-[12px] h-[12px] bg-orange-500 rounded-full" />
                  {bp}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 bg-white border-t flex justify-between">
            <button 
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 disabled:opacity-30 hover:bg-gray-100"
            >
              Previous
            </button>
            <button 
              onClick={nextSlideOrQuestion}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition"
            >
              {currentSlideIndex === currentLesson.slides.length - 1 ? 'Start Quiz!' : 'Next Slide'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!currentLesson) return null;
    const question = currentLesson.questions[quizState.currentQuestionIndex];

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full relative">
        
        {/* Progress Bar */}
        <div className="w-full h-4 bg-gray-200 rounded-full mb-8 overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500" 
            style={{ width: `${((quizState.currentQuestionIndex) / currentLesson.questions.length) * 100}%` }} 
          />
        </div>

        <div className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-100">
          <div className="bg-indigo-600 p-8 text-white">
            <h2 className="text-2xl font-bold mb-2 opacity-90">Question {quizState.currentQuestionIndex + 1}</h2>
            <p className="text-3xl font-black leading-tight">{question.questionText}</p>
          </div>

          <div className="p-8 bg-gray-50 min-h-[400px] flex flex-col items-center justify-center">
            
            {!capturedImage ? (
              <div className="text-center space-y-6">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto shadow-inner mb-4">
                  <span className="text-6xl">📝</span>
                </div>
                <p className="text-xl text-gray-600 max-w-md mx-auto">
                  Write your answer on paper, then show it to the camera!
                </p>
                <div className="flex flex-col gap-4">
                    <button 
                    onClick={() => setIsCameraOpen(true)}
                    className="px-8 py-4 bg-indigo-600 text-white text-xl font-bold rounded-2xl hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-300 transform hover:-translate-y-1"
                    >
                    📸 Scan My Answer
                    </button>
                    <p className="text-sm text-gray-400">or say "Look at my notes"</p>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-6">
                {/* Result/Correction Interface */}
                <div className="relative rounded-xl overflow-hidden border-2 border-gray-300 bg-black aspect-video max-h-[300px]">
                   <img src={capturedImage} alt="Captured" className="w-full h-full object-contain opacity-70" />
                   
                   {/* Overlay for Transcription */}
                   <div className="absolute inset-0 flex items-center justify-center p-8">
                     <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl w-full max-w-lg">
                        <label className="block text-xs uppercase font-bold text-gray-400 mb-1">AI Read:</label>
                        {currentGrade ? (
                          <div className={`text-2xl font-bold ${currentGrade.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                             {transcribedText}
                          </div>
                        ) : (
                          <textarea 
                            value={transcribedText}
                            onChange={(e) => setTranscribedText(e.target.value)}
                            className="w-full bg-transparent text-2xl font-bold text-gray-800 border-b-2 border-blue-300 focus:border-blue-600 outline-none resize-none text-center"
                            rows={2}
                          />
                        )}
                        {!currentGrade && (
                           <p className="text-xs text-gray-500 mt-2 text-center">Tap text to fix if AI is wrong</p>
                        )}
                     </div>
                   </div>
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-4">
                  {!currentGrade ? (
                    <>
                      <button onClick={() => setCapturedImage(null)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200">Retake</button>
                      <button 
                        onClick={submitAnswer}
                        disabled={isProcessing}
                        className="px-8 py-3 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 shadow-lg flex items-center gap-2"
                      >
                         {isProcessing ? 'Checking...' : '✅ Check Answer'}
                      </button>
                    </>
                  ) : (
                    <div className="w-full text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className={`p-4 rounded-xl mb-4 ${currentGrade.isCorrect ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-900'}`}>
                         <p className="text-lg font-bold">{currentGrade.feedback}</p>
                         {!currentGrade.isCorrect && currentGrade.correction && (
                            <p className="text-sm mt-2 opacity-80">Correct answer: {currentGrade.correction}</p>
                         )}
                         <div className="mt-2 font-black text-3xl">{currentGrade.score}/100</div>
                      </div>
                      <button 
                        onClick={nextSlideOrQuestion}
                        className="px-10 py-4 bg-blue-600 text-white text-xl font-bold rounded-2xl hover:bg-blue-700 shadow-xl"
                      >
                        Next Challenge ➡️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStudentMode = () => (
    <div className="fixed inset-0 bg-blue-50 z-40 overflow-auto flex flex-col">
       <FocusGuard isActive={role === Role.STUDENT} onUnlockAttempt={handleFocusBreach} />
       
       {/* Voice Assistant Overlay */}
       <VoiceAssistant 
            contextText={getAIContext()} 
            onCommand={handleVoiceCommand} 
       />

       {/* Top Bar for Student */}
       <div className="bg-white/80 backdrop-blur border-b p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2">
             <span className="text-2xl">🎓</span>
             <div className="flex flex-col">
                <span className="font-bold text-gray-700 leading-none">{currentLesson ? currentLesson.topic : 'Student Portal'}</span>
                <span className="text-xs text-gray-500">{currentLesson?.syllabus}</span>
             </div>
          </div>
          <div className="flex gap-4 items-center">
            {focusWarnings > 0 && (
                <span className="text-red-500 text-xs font-bold animate-pulse">⚠️ Keep Focus!</span>
            )}
            <button 
                onClick={() => {
                    const pin = prompt("Parent PIN to Unlock (enter 1234):");
                    if (pin === '1234') {
                        document.exitFullscreen().catch(() => {});
                        setRole(Role.PARENT);
                        setLessonStatus(LessonStatus.IDLE);
                    }
                }}
                className="p-2 text-gray-400 hover:text-red-500 transition"
            >
                <UnlockIcon />
            </button>
          </div>
       </div>

       {lessonStatus === LessonStatus.IDLE && (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-70">
             <div className="text-6xl mb-4">⏳</div>
             <h2 className="text-2xl font-bold text-gray-600">Waiting for a lesson...</h2>
             <p className="text-gray-500">Ask your teacher or parent to start a lesson!</p>
         </div>
       )}

       {lessonStatus === LessonStatus.READY && renderSlides()}
       {lessonStatus === LessonStatus.IN_PROGRESS && renderQuiz()}
       {lessonStatus === LessonStatus.COMPLETED && (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
             <div className="text-9xl mb-4">🏆</div>
             <h1 className="text-5xl font-black text-blue-900 mb-4">Great Job!</h1>
             <p className="text-xl text-gray-600 mb-8">You finished the lesson on {currentLesson?.topic}.</p>
             <button 
                onClick={() => setRole(Role.PARENT)}
                className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-xl shadow-lg"
             >
                Finish & Unlock
             </button>
         </div>
       )}

       {isCameraOpen && (
         <CameraCapture 
            onCapture={handleCapture}
            onCancel={() => setIsCameraOpen(false)}
            trigger={cameraTrigger}
         />
       )}
    </div>
  );

  return (
    <div className="min-h-screen">
      {(role === Role.PARENT || role === Role.TEACHER) && renderAdminDashboard()}
      {role === Role.STUDENT && renderStudentMode()}
    </div>
  );
}