'use server'

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin (to download the file)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export async function generateQuestionsFromPDF(filePath) {
  try {
    console.log("1. Downloading file from Supabase:", filePath);

    // A. Download the PDF from Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('course_materials') // Ensure this matches your bucket name
      .download(filePath);

    if (error) throw new Error(`Download failed: ${error.message}`);

    // B. Convert file to Base64 (Format required by Gemini)
    const arrayBuffer = await data.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    console.log("2. Sending to Gemini...");

    // C. Configure the Model (Gemini 2.5 Flash)
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

    // D. Send the Prompt
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: "application/pdf",
        },
      },
      "Generate 20 multiple-choice questions based on this document. Ensure a mix of Bloom's Taxonomy levels."
    ]);

    // E. Parse and Return
    const responseText = result.response.text();
    const questions = JSON.parse(responseText);

    console.log("3. Success! Generated", questions.length, "questions.");
    return { success: true, data: questions };

  } catch (error) {
    console.error("AI Action Error:", error);
    return { success: false, error: error.message };
  }
}