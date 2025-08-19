// server.js
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// This line now correctly loads your API key from Render's environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- NEW ---
// Define safety settings to be less restrictive
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

app.post('/get-predictions', async (req, res) => {
    try {
        const studentProfile = req.body.profile;
        const collegeList = req.body.colleges;

        if (!studentProfile || !collegeList) {
            return res.status(400).send("Missing student profile or college list.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
            You are an expert college admissions counselor. Based on the following student profile, predict the admission chances for each university in the target list. For each prediction, provide a percentage chance and a brief, two-sentence reasoning.

            Student Profile:
            - GPA: ${studentProfile.gpa}
            - SAT: ${studentProfile.sat}
            - Extracurriculars: ${studentProfile.ecs.join(', ')}
            - Awards: ${studentProfile.awards.join(', ')}

            Target College List:
            ${collegeList.map((college, i) => `${i + 1}. ${college}`).join('\n')}
        `;

        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        college_name: { type: "STRING" },
                        admission_chance_percent: { type: "INTEGER" },
                        reasoning: { type: "STRING" }
                    },
                    required: ["college_name", "admission_chance_percent", "reasoning"]
                }
            }
        };

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings, // <-- The new safety settings are added here
        });

        const response = result.response;
        
        // Add a check to make sure the response is not empty
        if (!response || !response.text()) {
            throw new Error("Received an empty response from the API.");
        }

        const predictions = JSON.parse(response.text());
        res.json({ predictions });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send("An error occurred while getting predictions.");
    }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
