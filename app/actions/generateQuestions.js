'use server'

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export async function uploadAndGenerateFromFormData(formData) {
  try {
    const file = formData.get('file');
    if (!file) throw new Error("No file uploaded");

    console.log("1. Received file on server:", file.name);

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("2. Starting parallel Supabase Upload & Gemini Analysis...");

    // Run both Supabase Store Upload and Gemini generation IN PARALLEL
    const uploadPromise = uploadToSupabaseStorage(file.name, file.type, buffer);
    const generatePromise = generateQuestionsFromBuffer(buffer);

    // Wait for both to finish
    const [driveData, questions] = await Promise.all([uploadPromise, generatePromise]);

    console.log("3. Success! Generated", questions.length, "questions and uploaded to Supabase.");

    return {
      success: true,
      data: questions,
      driveFileId: driveData.id,
      driveWebViewLink: driveData.webViewLink
    };

  } catch (error) {
    console.error("Action Error:", error);
    return { success: false, error: String(error) };
  }
}

async function uploadToSupabaseStorage(fileName, mimeType, buffer) {
  const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const safeFileName = uniquePrefix + '-' + fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  const { data, error } = await supabase.storage
    .from('materials')
    .upload(safeFileName, buffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    throw new Error('Supabase Upload Error: ' + error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from('materials')
    .getPublicUrl(safeFileName);

  return {
    id: safeFileName,
    webViewLink: publicUrlData.publicUrl
  };
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

Output Format: JSON.`
  ]);

  const responseText = result.response.text();
  return JSON.parse(responseText);
}
