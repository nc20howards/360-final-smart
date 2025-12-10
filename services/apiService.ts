
// This service handles all external AI API communications.
import { GoogleGenAI, Type } from "@google/genai";
import { Place, ConversationEntry, Course, University } from '../types';

// --- Client Instances ---
// FIX: Initialize Google GenAI client directly with API key from environment variables as per guidelines.
// The API key is now sourced exclusively from process.env.API_KEY.
const genAIClient = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Converts a Blob to a Base64 encoded string.
 * @param blob The Blob to convert.
 * @returns A promise that resolves to the Base64 string.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                // The result includes the data URL prefix, so we need to remove it
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error("Failed to read blob as Base64 string."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Transcribes an audio file using the Google GenAI API (a model like Gemini can handle this).
 * @param audioFile The audio file (as a Blob) to transcribe.
 * @returns A promise that resolves to the transcribed text.
 */
export const transcribeAudioWithGoogle = async (audioBlob: Blob): Promise<string> => {
    // FIX: Removed check for genAIClient as it is now initialized at module scope.
    try {
        const base64Audio = await blobToBase64(audioBlob);
        const audioPart = {
            inlineData: {
                mimeType: audioBlob.type || 'audio/webm',
                data: base64Audio,
            },
        };
        const textPart = {
            text: "Transcribe this audio recording.",
        };
        
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash', // Gemini models can handle multimodal input
            contents: { parts: [audioPart, textPart] },
        });
        
        // FIX: Access the .text property directly instead of calling a method.
        return response.text?.trim() || '';
    } catch (error) {
        console.error("Error transcribing audio with Google GenAI:", error);
        // FIX: Re-throw original error to provide more specific feedback to the caller.
        throw error;
    }
};

/**
 * Gets a streaming AI response from Google GenAI.
 * @param userQuery The user's query.
 * @param systemInstruction The system instruction for the AI.
 * @param onChunk Callback function to handle each chunk of the response.
 * @param history Optional conversation history to provide context.
 * @returns A promise that resolves to the full, concatenated AI response.
 */
export const getAIResponse = async (
    userQuery: string,
    systemInstruction: string,
    onChunk: (chunk: string) => void,
    history?: ConversationEntry[]
): Promise<string> => {
    try {
        let contents: any = [];

        if (history && history.length > 0) {
            // Map persisted history to Gemini API format
            history.forEach(entry => {
                contents.push({ role: 'user', parts: [{ text: entry.userQuery }] });
                contents.push({ role: 'model', parts: [{ text: entry.aiResponse }] });
            });
        }
        
        // Add current query
        contents.push({ role: 'user', parts: [{ text: userQuery }] });

        const responseStream = await genAIClient.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        let fullResponse = "";
        for await (const chunk of responseStream) {
            // FIX: Access the .text property directly instead of calling a method.
            const chunkText = chunk.text;
            if (chunkText) {
                fullResponse += chunkText;
                onChunk(chunkText);
            }
        }
        return fullResponse.trim();
    } catch (error) {
        console.error("Error getting AI response from Google GenAI:", error);
        throw error;
    }
};

/**
 * Extracts structured text from an image of a UNEB pass slip using Google GenAI.
 * @param base64Image The Base64 encoded image data.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to a structured object with the extracted data.
 */
export const extractTextFromImageWithGoogle = async (base64Image: string, mimeType: string) => {
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: base64Image,
            },
        };

        const textPart = {
            text: `
                Analyze the provided image of a Ugandan UNEB examination results slip.
                Extract the following information precisely as it appears on the slip. Do not infer or abbreviate.

                1.  **Slip Information**:
                    -   \`yearOfExamination\`: The year the exam was taken (e.g., "2017").
                    -   \`slipSerialNumber\`: The serial number of the slip (e.g., "UCE123456").
                    -   \`examinationType\`: The full title of the examination (e.g., "UGANDA CERTIFICATE OF EDUCATION").
                2.  **Candidate Information**:
                    -   \`candidateName\`: The student's full name.
                    -   \`schoolName\`: The name of the school or center.
                    -   \`centerNumber\`: The center number or code (e.g., "U1234").
                    -   \`indexNumber\`: The student's full index number (e.g., "U1234/567").
                    -   \`entryCode\`: The student's entry code.
                    -   \`dateOfBirth\`: The student's date of birth.
                    -   \`schoolAddress\`: The P.O. Box address of the school.
                3.  **Subjects Table**:
                    -   \`subjects\`: A list of all subjects. Each item in the list should be an object with:
                        -   \`subjectNumber\`: The code or number of the subject (e.g., "456").
                        -   \`subjectName\`: The full name of the subject (e.g., "MATHEMATICS").
                        -   \`gradeNumber\`: The numeric grade achieved (e.g., "1", "3", "9").
                        -   \`gradeWord\`: The word equivalent of the grade (e.g., "DISTINCTION", "CREDIT", "PASS").
                4.  **Performance Summary**:
                    -   \`gradeAggregate\`: The total aggregate score (e.g., "AGGREGATE 12").
                    -   \`overallResult\`: The final result summary (e.g., "FIRST GRADE").
                5.  **Footer**:
                    -   \`note\`: Any note or instruction at the bottom of the slip.

                Return this information ONLY as a JSON object matching the specified schema. Do not include any extra text, markdown, or explanations.
            `,
        };
        
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        yearOfExamination: { type: Type.STRING },
                        slipSerialNumber: { type: Type.STRING },
                        examinationType: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        schoolName: { type: Type.STRING },
                        centerNumber: { type: Type.STRING },
                        indexNumber: { type: Type.STRING },
                        entryCode: { type: Type.STRING },
                        dateOfBirth: { type: Type.STRING },
                        schoolAddress: { type: Type.STRING },
                        subjects: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    subjectNumber: { type: Type.STRING },
                                    subjectName: { type: Type.STRING },
                                    gradeNumber: { type: Type.STRING },
                                    gradeWord: { type: Type.STRING },
                                },
                                required: ['subjectNumber', 'subjectName', 'gradeNumber', 'gradeWord']
                            },
                        },
                        gradeAggregate: { type: Type.STRING },
                        overallResult: { type: Type.STRING },
                        note: { type: Type.STRING },
                    },
                     required: [
                        'yearOfExamination', 'slipSerialNumber', 'examinationType',
                        'candidateName', 'schoolName', 'centerNumber', 'indexNumber', 'entryCode', 'dateOfBirth', 'schoolAddress',
                        'subjects',
                        'gradeAggregate', 'overallResult',
                        'note'
                    ]
                },
            },
        });

        // FIX: Access the .text property directly instead of calling a method.
        const jsonText = response.text?.trim() || '{}';
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error extracting text from image with Google GenAI:", error);
        throw error;
    }
};

/**
 * Translates text to a target language using Google GenAI.
 * @param text The text to translate.
 * @param targetLanguage The language to translate to (e.g., "English", "French").
 * @returns A promise that resolves to the translated text.
 */
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    try {
        // FIX: Switched to the simpler string format for the `contents` property for single-text prompts,
        // which is the recommended approach in the SDK guidelines. This resolves a 500 error from the API.
        const prompt = `Translate the following text to ${targetLanguage}. Return only the translated text, without any additional explanations or context: "${text}"`;
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        // FIX: Access the .text property directly instead of calling a method.
        return response.text?.trim() || '';
    } catch (error) {
        console.error("Error translating text with Google GenAI:", error);
        throw error;
    }
};

/**
 * Finds and decodes any type of barcode from an image using Google GenAI.
 * @param base64Image The Base64 encoded image data.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the barcode's raw text content, or null if not found.
 */
export const decodeBarcodeWithGoogle = async (base64Image: string, mimeType: string): Promise<string | null> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: base64Image,
            },
        };

        const textPart = {
            text: `
                Analyze the provided image for any type of scannable code (including QR codes and 1D barcodes like Code 128).
                If a code is found, decode it and return its raw, unmodified, un-summarized string content.
                
                Return a single JSON object with one key: 'content'.
                - 'content': The raw string from the code.
                
                If no code is found, return ONLY the JSON object: {"content": null}.
            `,
        };
        
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        content: { 
                            type: Type.STRING, 
                            description: "The decoded text content of the barcode or QR code. This will be null if no code is found.",
                            nullable: true 
                        },
                    },
                     required: ['content']
                },
                thinkingConfig: { thinkingBudget: 0 },
            }
        });

        // FIX: Access the .text property directly instead of calling a method.
        const jsonText = response.text?.trim() || '';
        const result = jsonText ? JSON.parse(jsonText) : { content: null };

        if (result && typeof result.content !== 'undefined') {
            return result.content; // This will be the string content or null
        }

        throw new Error("No scannable code found in the frame.");

    } catch (error) {
        if (!(error instanceof Error && error.message.includes("No scannable code"))) {
             console.error("Error decoding barcode with Google GenAI:", error);
        }
        // Re-throw to be handled by the caller, which can decide whether to show an error or just retry.
        throw error;
    }
};

/**
 * Fetches and summarizes the latest news for a given category using Google Search grounding.
 * @param category The news category (e.g., "Technology", "World News").
 * @returns A promise that resolves to an array of news story objects.
 */
export const getNewsFromAI = async (category: string): Promise<{ title: string; summary: string; url: string; imageUrl: string; }[]> => {
    try {
        const prompt = `
            Using Google Search, find up to 10 of the most recent and significant news stories in the "${category}" category.
            Include a mix of both prominent international news sources and local Ugandan media sources where relevant to the category.

            For each story, provide the following:
            1. title: The original, full headline of the news article.
            2. summary: A concise, 2-sentence summary of the key points of the story.
            3. url: The direct URL to the original news article.
            4. imageUrl: A direct URL to a prominent, high-quality image found within the news article itself, such as its main banner or feature image. This must be a direct link to an image file (e.g., .jpg, .png, .webp), not a generic webpage.

            Return ONLY a JSON array of these objects. Do not include any extra text, markdown, or explanations.
        `;
        
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        // FIX: Access the .text property directly instead of calling a method.
        const rawText = (response.text || '').trim();
        
        if (!rawText) {
            throw new Error("AI returned an empty response. This may be due to content filters or an inability to find relevant news.");
        }
        
        // Robustly find the JSON array within the response text, ignoring any conversational text or markdown.
        const jsonMatch = rawText.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
             throw new Error(`AI returned a non-JSON response: ${rawText}`);
        }

        const cleanedJsonText = jsonMatch[0];

        try {
            const result = JSON.parse(cleanedJsonText);
            
            // Basic validation of the parsed result
            if (Array.isArray(result) && result.every(item => 'title' in item && 'summary' in item && 'url' in item && 'imageUrl' in item)) {
                return result;
            } else {
                throw new Error("AI returned data in an unexpected format.");
            }
        } catch (parseError) {
             console.error("Failed to parse JSON from AI response:", cleanedJsonText);
             throw new Error(`AI returned malformed JSON data. Details: ${(parseError as Error).message}`);
        }

    } catch (error) {
        console.error(`Error fetching news for category "${category}" from Google GenAI:`, error);
        // The error from the try block is re-thrown, and this catch block adds context and a user-friendly message.
        throw new Error("Sorry, I couldn't fetch the latest news right now. Please try again in a moment.");
    }
};

/**
 * Fetches place suggestions from Google Maps using grounding.
 * @param query The user's search query for a place.
 * @param location The user's current latitude and longitude.
 * @returns A promise that resolves to an array of place suggestions.
 */
export const getPlaceSuggestionsFromAI = async (
    query: string,
    location: { latitude: number; longitude: number }
): Promise<Place[]> => {
    if (!query) return [];
    try {
        // FIX: Updated prompt to be more concise and rely on the `googleMaps` tool's context.
        const prompt = `
            You are a location search assistant. Find relevant places for the user's query.
            User's query: "${query}"

            Return ONLY a JSON array of place objects. Each object must have two keys:
            1.  "title": The name of the place.
            2.  "uri": A valid Google Maps URL for the place.

            Do not include any extra text, markdown, or explanations outside of the JSON array.
            Example response: [{"title": "Cafe Central", "uri": "https://www.google.com/maps/search/?api=1&query=Cafe+Central"}]
        `;

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // FIX: Switched to `googleMaps` tool for location-based queries and included `toolConfig`
                // with user's coordinates for more accurate results, as per API guidelines.
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                        latLng: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                        }
                    }
                }
            },
        });

        // FIX: Access the .text property directly instead of calling a method.
        const rawText = (response.text || '').trim();
        if (!rawText) {
            return [];
        }

        // Robustly find the JSON array within the response text
        const jsonMatch = rawText.match(/(\[[\s\S]*\])/);
        if (!jsonMatch || !jsonMatch[0]) {
             console.warn(`AI returned a non-JSON response for place search: ${rawText}`);
             return [];
        }

        const cleanedJsonText = jsonMatch[0];
        try {
            const result: Place[] = JSON.parse(cleanedJsonText);
            if (Array.isArray(result) && result.every(item => 'title' in item && 'uri' in item)) {
                // Deduplicate results based on URI
                return result.filter((place, index, self) => 
                    index === self.findIndex((p) => p.uri === place.uri)
                );
            }
            return [];
        } catch (parseError) {
             console.error("Failed to parse JSON from AI place search response:", cleanedJsonText);
             return [];
        }
    } catch (error) {
        console.error("Error getting place suggestions from Google GenAI:", error);
        throw new Error("Could not fetch place suggestions at this time.");
    }
};

/**
 * Auto-categorizes a marketplace listing using Google GenAI.
 * @param title The title of the listing.
 * @param description The description of the listing.
 * @returns A promise that resolves to a category name.
 */
export const categorizeListing = async (title: string, description: string): Promise<string> => {
    const categories = ['Electronics', 'Clothing', 'Books', 'Furniture', 'Services', 'Other'];
    try {
        const prompt = `
            Analyze the following product listing and categorize it into ONE of the following categories:
            ${categories.join(', ')}.

            Title: "${title}"
            Description: "${description}"

            Respond with ONLY the category name. For example: "Electronics".
            If no category fits well, respond with "Other".
        `;

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        // FIX: Access the .text property directly instead of calling a method.
        const category = response.text?.trim() || 'Other';
        // Validate if the AI response is one of the allowed categories
        if (categories.map(c => c.toLowerCase()).includes(category.toLowerCase())) {
            // Return the original casing
            return categories.find(c => c.toLowerCase() === category.toLowerCase())!;
        }
        return 'Other'; // Fallback if AI hallucinates a category
    } catch (error) {
        console.error("Error categorizing listing with Google GenAI:", error);
        throw new Error("Could not auto-categorize the listing.");
    }
};

// FIX: Add missing 'findSchoolByNameWithAI' function.
/**
 * Finds the best matching school name from a list based on a user's spoken query.
 * @param spokenName The transcribed voice input from the user.
 * @param schoolList A list of available school names.
 * @returns A promise that resolves to the best matching school name, or null if no good match is found.
 */
export const findSchoolByNameWithAI = async (spokenName: string, schoolList: string[]): Promise<string | null> => {
    try {
        const prompt = `
            From the following list of school names, find the one that best matches the user's spoken input.
            User input: "${spokenName}"

            List of school names:
            - ${schoolList.join('\n- ')}

            Return ONLY the single best matching school name from the list.
            If there is no clear match, return the string "null".
            Do not add any explanation or surrounding text.
        `;

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        // FIX: Access the .text property directly instead of calling a method.
        const matchedName = response.text?.trim() || 'null';

        // Check if the returned name is actually in the list to prevent hallucinations
        const exactMatch = schoolList.find(school => school.toLowerCase() === matchedName.toLowerCase());

        if (matchedName.toLowerCase() === 'null' || !exactMatch) {
            return null;
        }

        return exactMatch; // Return the name with correct casing from the original list
    } catch (error) {
        console.error("Error finding school by name with Google GenAI:", error);
        throw error;
    }
};

// FIX: Add missing 'isAffirmative' function.
/**
 * Determines if a user's spoken response is affirmative (e.g., "yes", "sure", "okay").
 * @param text The transcribed text from the user.
 * @returns A promise that resolves to true if the response is affirmative, false otherwise.
 */
export const isAffirmative = async (text: string): Promise<boolean> => {
    try {
        const prompt = `
            Analyze the following text and determine if it is an affirmative response (e.g., "yes", "sure", "okay", "yeah", "yep", "do it").
            User's response: "${text}"

            Return ONLY a single JSON object with one key: 'isAffirmative'.
            - 'isAffirmative': A boolean value (true or false).
            
            Do not include any extra text, markdown, or explanations.
            Example for "yes please": {"isAffirmative": true}
            Example for "no thanks": {"isAffirmative": false}
        `;

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isAffirmative: { type: Type.BOOLEAN },
                    },
                    required: ['isAffirmative']
                },
            },
        });

        // FIX: Access the .text property directly instead of calling a method.
        const jsonText = response.text?.trim() || '{}';
        const result = JSON.parse(jsonText);
        
        return result.isAffirmative === true;

    } catch (error) {
        console.error("Error in isAffirmative check with Google GenAI:", error);
        // In case of error, it's safer to assume a non-affirmative response
        // to prevent unintended actions.
        return false;
    }
};

// --- NEW FUNCTION for My Institute ---
export const getAICourseSuggestions = async (
    subjects: string[], 
    interests: string,
    allCourses: string[],
    allUniversities: string[]
): Promise<string> => {
    try {
        const prompt = `
            You are a university guidance counselor for a student in Uganda.
            Based on the student's A-Level subjects and career interests, suggest up to 5 suitable university courses from the provided list.
            For each suggestion, briefly explain why it's a good fit.

            Student's A-Level Subjects: ${subjects.join(', ') || 'None provided'}
            Student's Career Interests: "${interests || 'Not specified'}"

            Available Universities:
            - ${allUniversities.join('\n- ')}

            Available Courses:
            - ${allCourses.join('\n- ')}

            Consider the typical subject requirements for Ugandan university programs (e.g., PCM for Engineering, BCM for Medicine).
            Return only your suggestions and explanations as a plain text string. Do not use markdown or JSON.
            Your response should be a friendly, well-formatted paragraph.
        `;

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        // FIX: Access the .text property directly instead of calling a method.
        return response.text?.trim() || '';
    } catch (error) {
        console.error("Error getting AI course suggestions:", error);
        throw new Error("Sorry, I couldn't generate course suggestions right now.");
    }
};

// --- NEW FUNCTION for Visitor Center ---
/**
 * Extracts a visitor's name and ID number from an image of an ID card.
 * @param base64Image The Base64 encoded image of the ID card.
 * @returns A promise that resolves to an object with the extracted name and idNumber.
 */
export const extractDetailsFromIdCard = async (base64Image: string): Promise<{ name: string; idNumber: string }> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
            },
        };

        const textPart = {
            text: `
                Analyze the provided image of an identification card (like a National ID, Driving Permit, or School ID).
                Extract the following two pieces of information:
                1.  \`name\`: The full name of the person.
                2.  \`idNumber\`: The primary identification number on the card (e.g., National ID Number, Permit Number).

                Return this information ONLY as a JSON object matching the specified schema.
                If a field cannot be found, return it as an empty string.
                Do not include any extra text, markdown, or explanations.
            `,
        };

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        idNumber: { type: Type.STRING },
                    },
                    required: ['name', 'idNumber']
                },
            },
        });
        
        // FIX: Access the .text property directly instead of calling a method.
        const jsonText = response.text?.trim() || '{}';
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error extracting details from ID card with Google GenAI:", error);
        throw new Error("Could not read details from the ID card image. Please try again or enter manually.");
    }
};

// --- NEW FUNCTION: Verify Visitor Identity (Face Match) ---
/**
 * Compares a visitor's ID photo with a live selfie to verify identity.
 * @param idCardBase64 The Base64 encoded image of the ID card.
 * @param selfieBase64 The Base64 encoded image of the live selfie.
 * @param idCardMimeType MIME type for ID card image (default: image/jpeg)
 * @param selfieMimeType MIME type for selfie image (default: image/jpeg)
 * @returns A promise resolving to the extracted details and match verification result.
 */
export const verifyVisitorIdentity = async (
    idCardBase64: string, 
    selfieBase64: string,
    idCardMimeType: string = 'image/jpeg',
    selfieMimeType: string = 'image/jpeg'
): Promise<{ 
    name: string; 
    idNumber: string; 
    matchConfidence: 'High' | 'Medium' | 'Low';
    isMatch: boolean;
}> => {
    try {
        const idCardPart = {
            inlineData: {
                mimeType: idCardMimeType,
                data: idCardBase64,
            },
        };

        const selfiePart = {
            inlineData: {
                mimeType: selfieMimeType,
                data: selfieBase64,
            },
        };

        const textPart = {
            text: `
                You are a security assistant verifying a visitor's identity.
                
                **Task 1: Extract Data**
                Analyze Image 1 (the ID Card) and extract:
                - \`name\`: Full Name.
                - \`idNumber\`: Identification Number.

                **Task 2: Verify Identity (Face Match)**
                Compare the face on the ID Card (Image 1) with the live selfie (Image 2).
                Determine if they represent the same person.
                - \`matchConfidence\`: Return "High", "Medium", or "Low".
                - \`isMatch\`: Boolean true if they are likely the same person, false otherwise.

                Return the result ONLY as a JSON object matching this schema. Do not include markdown.
            `,
        };

        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [idCardPart, selfiePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        idNumber: { type: Type.STRING },
                        matchConfidence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                        isMatch: { type: Type.BOOLEAN },
                    },
                    required: ['name', 'idNumber', 'matchConfidence', 'isMatch']
                },
            },
        });
        
        // FIX: Access the .text property directly instead of calling a method.
        const jsonText = response.text?.trim() || '{}';
        const result = JSON.parse(jsonText);
        
        // Sanitize enum return just in case
        if (!["High", "Medium", "Low"].includes(result.matchConfidence)) {
            result.matchConfidence = "Low";
        }

        return result;

    } catch (error) {
        console.error("Error verifying visitor identity with Google GenAI:", error);
        throw new Error("Identity verification failed. Please try capturing the photos again.");
    }
};

// --- NEW FUNCTION: Remove Image Background ---
/**
 * Removes the background from an image using Gemini AI.
 * @param base64Image The Base64 encoded image data.
 * @param mimeType The MIME type of the image.
 * @returns A promise resolving to the base64 string of the processed image (likely PNG with transparency).
 */
export const removeImageBackground = async (base64Image: string, mimeType: string): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: base64Image,
            },
        };
        
        const prompt = "Remove the background from this image. Keep only the main subject (the person or the ID card). Return the result as an image.";

        // Note: gemini-2.5-flash-image can perform edits if prompted correctly.
        const response = await genAIClient.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, { text: prompt }] },
        });

        // Find the image part in the response candidates
        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    // The API returns the image data
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        // If no image returned, log a warning and return original (fallback)
        console.warn("Background removal failed to return an image, using original.");
        return `data:${mimeType};base64,${base64Image}`;

    } catch (error) {
        console.error("Background removal error:", error);
        // Return original on error to not block the flow
        return `data:${mimeType};base64,${base64Image}`;
    }
};
