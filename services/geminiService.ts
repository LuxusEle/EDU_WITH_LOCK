import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Lesson, Slide, Question, GradeResult, Syllabus } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// -- Schemas --

const slideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    content: { type: Type.STRING },
    bulletPoints: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    visualPrompt: { type: Type.STRING, description: "A simple visual description for an image representing this slide" }
  },
  required: ["title", "content", "bulletPoints"]
};

const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    questionText: { type: Type.STRING },
    correctAnswerSummary: { type: Type.STRING }
  },
  required: ["id", "questionText", "correctAnswerSummary"]
};

const lessonResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    slides: {
      type: Type.ARRAY,
      items: slideSchema
    },
    questions: {
      type: Type.ARRAY,
      items: questionSchema
    }
  },
  required: ["slides", "questions"]
};

const gradeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    isCorrect: { type: Type.BOOLEAN },
    score: { type: Type.INTEGER, description: "Score from 0 to 100" },
    feedback: { type: Type.STRING, description: "Encouraging feedback for a child" },
    correction: { type: Type.STRING, description: "The correct answer if they got it wrong" }
  },
  required: ["isCorrect", "score", "feedback"]
};


// -- Service Methods --

export const generateLessonContent = async (
  topic: string, 
  age: number, 
  syllabus: Syllabus,
  sourceImages?: string[] // Array of base64 strings
): Promise<{ slides: Slide[], questions: Question[] }> => {
  try {
    let promptText = `Create a study lesson for a ${age}-year-old student.
    Syllabus/Context: ${syllabus}.
    Topic: "${topic}".
    
    Structure:
    1. 4-5 Slides: Engaging, educational, formatted for the specific syllabus style.
    2. 3 Questions: Test understanding based on the syllabus standards (e.g., if A/L, make it rigorous).
    `;

    const contents: any = [{ text: promptText }];

    // If source images (textbook pages) are provided, add them
    if (sourceImages && sourceImages.length > 0) {
      promptText += "\n\nRefer strictly to the attached textbook pages/images for content generation.";
      sourceImages.forEach(img => {
        const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        contents.push({
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png'
          }
        });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: contents }, // Correct format for mixed text/image
      config: {
        responseMimeType: 'application/json',
        responseSchema: lessonResponseSchema,
        systemInstruction: `You are an expert tutor specializing in ${syllabus}. Adjust tone and complexity accordingly.`
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No content generated");
  } catch (error) {
    console.error("Lesson generation failed", error);
    throw error;
  }
};

export const transcribeHandwriting = async (base64Image: string): Promise<string> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png'
            }
          },
          {
            text: "Transcribe the handwritten answer in this image exactly as written. Ignore any background objects. Only return the text."
          }
        ]
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Transcription failed", error);
    return "Error reading text. Please type it.";
  }
};

export const gradeAnswer = async (question: string, studentAnswer: string, correctAnswer: string): Promise<GradeResult> => {
  try {
    const prompt = `
    Question: ${question}
    Correct Answer Logic: ${correctAnswer}
    Student Answer: ${studentAnswer}
    
    Grade this answer. If the student answer is phonetically correct or conceptually close (considering their age), be lenient.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: gradeSchema
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Grading failed");
  } catch (error) {
    console.error("Grading failed", error);
    return { isCorrect: false, score: 0, feedback: "AI Error during grading." };
  }
};

export const askVoiceTutor = async (question: string, context: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context Slide Content: ${context}\n\nStudent Question: ${question}\n\nAnswer the student briefly and encouragingly in 2-3 sentences.`,
    });
    return response.text || "I'm not sure, let's look at the slide again.";
  } catch (e) {
    return "Sorry, I couldn't hear you clearly.";
  }
}