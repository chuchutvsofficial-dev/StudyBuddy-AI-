import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client
// The API key is securely retrieved from the environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Converts a File object to a Base64 string suitable for the Gemini API.
 */
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Sends a homework query to the Gemini model.
 * Can include an image and text context.
 */
export const solveHomework = async (
  prompt: string,
  imageBase64: string | undefined,
  mimeType: string | undefined,
  language: string = 'English'
): Promise<string> => {
  try {
    const parts: any[] = [];

    // Add image if present
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      });
    }

    // Construct a robust system instruction within the user prompt for best results with Flash model
    const systemInstruction = `
      You are "StudyBuddy", an expert academic tutor and homework solver.
      
      Current Language Setting: ${language}
      
      Your Goal: Help the student understand the problem, not just give the answer.
      
      Guidelines:
      1. Analyze the input (text or image) carefully.
      2. Identify the subject (Math, Physics, History, etc.).
      3. Provide the solution in a clear, step-by-step format.
      4. If it is a math problem, show the working out clearly. Keep mathematical terms (like sin, cos, theta, integral) in standard notation even if explaining in Hindi.
      5. Use bold text for key terms and headers.
      6. Be encouraging and educational.
      7. If the image is unclear, ask the user to upload a clearer photo.
      8. **IMPORTANT**: You MUST provide the entire explanation in ${language}. If the user asks in a different language, still default your main explanation to ${language} but acknowledge their language.
      
      Student Question/Context:
      ${prompt || "Please solve the problem in the image."}
    `;

    parts.push({ text: systemInstruction });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        temperature: 0.4, // Lower temperature for more accurate factual responses
      }
    });

    return response.text || "I couldn't generate a solution. Please try again.";

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to connect to the tutor.");
  }
};