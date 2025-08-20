// server.js
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
            You are an expert U.S. college admissions counselor. Based on the following detailed student profile, predict the admission chances for each university in the target list.

            CRITICAL INSTRUCTIONS:
            1.  **Analyze Holistically**: Consider all aspects of the profile, including demographics, academic performance, and extracurriculars.
            2.  **Analyze Quality**: Objectively evaluate the quality and impact of each activity and honor. An international award is more impressive than a regional one. Leadership is more impactful than membership. Factor this heavily into your prediction.
            3.  **Analyze Consistency**: Reward students who show a consistent passion or a clear theme in their activities.
            4.  **Constrain Percentages**: The predicted admission chance percentage MUST be between 5% and 70%.

            Student Profile:
            - Gender: ${studentProfile.gender || 'Not specified'}
            - US Citizen: ${studentProfile.isCitizen || 'Not specified'}
            - Attends US High School: ${studentProfile.isUsSchool || 'Not specified'}
            - GPA: ${studentProfile.gpa}
            - SAT Score: ${student-profile.sat}
            - AP Scores: ${studentProfile.apResults.join(', ') || 'None'}
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
            safetySettings,
        });

        const response = result.response;
        
        if (!response || !response.text()) {
            throw new Error("Received an empty response from the API.");
        }

        let predictions = JSON.parse(response.text());

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

