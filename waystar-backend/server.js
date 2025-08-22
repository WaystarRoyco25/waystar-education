// server.js
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// It's recommended to use environment variables for your API key
// Ensure you have your GOOGLE_API_KEY set in your environment
const genAI = new GoogleGenerativeAI(process.env.AIzaSyBhuyvTVOPqI3f5zv0yT7opvYVyEbN2EKU);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

app.post('/get-predictions', async (req, res) => {
    try {
        const studentProfile = req.body.profile;
        const collegeList = req.body.colleges;

        if (!studentProfile || !collegeList) {
            return res.status(400).send("Missing student profile or college list.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        // --- MODIFICATION START ---
        // The prompt is enhanced with stricter rules for SAT scores and empty fields.
        const prompt = `
            You are an expert U.S. college admissions counselor. Based on the following detailed student profile, predict the admission chances for each university in the target list.

            CRITICAL INSTRUCTIONS:
            1.  **Analyze Holistically**: Consider all aspects of the profile. If key information like extracurriculars or awards is missing, you MUST comment on this as a significant weakness in your reasoning.
            2.  **SAT Score is Crucial**: Assume that for all selective universities, a standardized test score is a critical data point. If the SAT score is missing or not provided, treat this as a major weakness and significantly lower the admission chance. State this clearly in your reasoning.
            3.  **Analyze GPA Trend**: Pay close attention to the GPA trajectory from 9th to 11th grade. An upward trend is a significant positive factor, indicating growth and maturity. A downward trend is a concern. Mention this trend in your reasoning.
            4.  **Nuanced & Diversified Predictions**: Do NOT assign the same low percentage (e.g., 5%) to all highly selective schools. Differentiate your predictions based on subtle factors. For example, consider how the student's specific extracurriculars might align better with one university's programs or culture over another's.
            5.  **Structured Reasoning**: For each college, your reasoning MUST be structured into three distinct parts:
                -   **Strengths**: Clearly specify the aspects of the student's profile that are strong points for THIS SPECIFIC college.
                -   **Weaknesses**: Clearly specify the areas where the profile is weaker or falls short for THIS SPECIFIC college's standards.
                -   **Advice**: Provide concrete, actionable advice on how the student could improve their profile or better frame their application for this college.
            6.  **Constrain Percentages**: The predicted admission chance percentage MUST be between 5% and 70%.

            Student Profile:
            - Gender: ${studentProfile.gender || 'Not specified'}
            - US Citizen: ${studentProfile.isCitizen || 'Not specified'}
            - Attends US High School: ${studentProfile.isUsSchool || 'Not specified'}
            - GPA (9th Grade): ${studentProfile.gpa9 || 'Not specified'}
            - GPA (10th Grade): ${studentProfile.gpa10 || 'Not specified'}
            - GPA (11th Grade): ${studentProfile.gpa11 || 'Not specified'}
            - SAT Score: ${studentProfile.sat || 'Not provided'}
            - AP Scores: ${studentProfile.apResults.length > 0 ? studentProfile.apResults.map(ap => `${ap.subject}: ${ap.score}`).join(', ') : 'None provided'}
            - Extracurriculars: ${studentProfile.ecs.length > 0 ? studentProfile.ecs.join(', ') : 'None provided'}
            - Awards: ${studentProfile.awards.length > 0 ? studentProfile.awards.join(', ') : 'None provided'}

            Target College List:
            ${collegeList.map((college, i) => `${i + 1}. ${college}`).join('\n')}
        `;
        // --- MODIFICATION END ---

        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        college_name: { type: "STRING" },
                        admission_chance_percent: { type: "INTEGER" },
                        reasoning: {
                            type: "OBJECT",
                            properties: {
                                strengths: { type: "STRING", description: "Positive aspects of the profile for this specific college." },
                                weaknesses: { type: "STRING", description: "Areas of improvement or concern for this specific college." },
                                advice: { type: "STRING", description: "Actionable steps for the applicant." }
                            },
                            required: ["strengths", "weaknesses", "advice"]
                        }
                    },
                    required: ["college_name", "admission_chance_percent", "reasoning"]
                }
            }
        };


        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        });

        const response = result.response;
        
        if (!response || !response.text()) {
            throw new Error("Received an empty response from the API.");
        }

        let predictions = JSON.parse(response.text());

        // This clamping logic is kept as a safeguard.
        predictions = predictions.map(p => {
            let chance = p.admission_chance_percent;
            if (chance < 5) chance = 5;
            if (chance > 70) chance = 70;
            return { ...p, admission_chance_percent: chance };
        });

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
