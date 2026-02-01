export enum Role {
  PARENT = 'PARENT',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export enum Syllabus {
  GENERAL = 'General Knowledge',
  SL_OL = 'Sri Lanka O/L (GCE)',
  SL_AL = 'Sri Lanka A/L (GCE)',
  CAMBRIDGE = 'Cambridge International',
  EDEXCEL = 'Pearson Edexcel',
}

export enum LessonStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface Slide {
  title: string;
  content: string;
  bulletPoints: string[];
  visualPrompt?: string; 
}

export interface Question {
  id: string;
  questionText: string;
  correctAnswerSummary: string;
}

export interface Lesson {
  id: string;
  topic: string;
  syllabus: Syllabus;
  targetAge: number;
  slides: Slide[];
  questions: Question[];
}

export interface GradeResult {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string;
  correction?: string;
}

export interface QuizState {
  currentQuestionIndex: number;
  answers: { questionId: string; transcription: string; grade?: GradeResult }[];
}