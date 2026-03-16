'use server'

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// Step 1: ONLY scan the PDF with Gemini AI — no storage upload yet
export async function uploadAndGenerateFromFormData(formData) {
  try {
    const file = formData.get('file');
    if (!file) throw new Error("No file uploaded");

    console.log("1. Received file on server:", file.name);

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("2. Starting Gemini Analysis (no storage upload yet)...");

    // Only run AI generation — storage upload deferred to publish time
    const questions = await generateQuestionsFromBuffer(buffer);

    console.log("3. Generated", questions.length, "questions from AI.");

    return {
      success: true,
      data: questions,
    };

  } catch (error) {
    console.error("Action Error:", error);
    return { success: false, error: String(error) };
  }
}

// Step 2: Upload file to Supabase Storage — called at PUBLISH time only
export async function uploadMaterialToStorage(formData) {
  try {
    const file = formData.get('file');
    if (!file) throw new Error("No file to upload");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeFileName = uniquePrefix + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    const { data, error } = await supabase.storage
      .from('materials')
      .upload(safeFileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Supabase Upload Error:', error.message);
      // Non-critical: return empty link if storage fails
      return { success: true, fileId: null, webViewLink: null };
    }

    const { data: publicUrlData } = supabase.storage
      .from('materials')
      .getPublicUrl(safeFileName);

    return {
      success: true,
      fileId: safeFileName,
      webViewLink: publicUrlData.publicUrl
    };
  } catch (error) {
    console.error("Storage Upload Error:", error);
    // Non-critical: don't block publish if storage fails
    return { success: true, fileId: null, webViewLink: null };
  }
}

async function generateQuestionsFromBuffer(buffer) {
  // Convert buffer to Base64 (Format required by Gemini)
  const base64Data = buffer.toString('base64');

  // Configure the Model (Gemini 2.5 Flash)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json", // Force structured JSON
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question_text: { type: SchemaType.STRING },
            choices: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            correct_answer: { type: SchemaType.STRING },
            bloom_level: { type: SchemaType.STRING }
          },
          required: ["question_text", "choices", "correct_answer", "bloom_level"]
        }
      }
    }
  });

  // Send the Prompt
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    },
    `Generate 20 multiple-choice questions based on this document.

CRITICAL CONSTRAINTS:

Brevity: The question stem must be under 20 words. The options must be under 5 words.

Speed: The question must be readable and answerable within 10 seconds.

Bloom's Taxonomy: Create a mix of levels, BUT convert higher-order scenarios into concise formats.

Bad: 'John is a manager who notices X, Y, and Z... [long paragraph]... what should he do?'

Good: 'Given condition X and Y, which management style is appropriate?'

Answer Position: RANDOMIZE the position of the correct answer across all questions. The correct answer must NOT always be the first choice. Distribute the correct answer evenly across all positions (A, B, C, D).

Output Format: JSON.`
  ]);

  const responseText = result.response.text();
  return JSON.parse(responseText);
}
