import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Loan, PortfolioStats } from '../@types/types';

// Note: In a real app, this would be an environment variable
const GENAI_API_KEY = 'YOUR_GEMINI_API_KEY';

export const analyzePortfolio = async (loans: Loan[], stats: PortfolioStats) => {
    try {
        const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = `
      Analyze the following micro-lending portfolio and provide financial advice:
      
      Portfolio Metrics:
      - Total Principal Outstanding: $${stats.totalPrincipal}
      - Total Interest Receivable: $${stats.totalInterestReceivable}
      - Total Risk Exposure: $${stats.totalRiskExposure}
      - Portfolio Health Score: ${stats.healthScore}/100
      
      Individual Loans:
      ${loans.map(l => `- Loan ${l.id}: $${l.principal} at ${l.interestRate}% APR, Status: ${l.status}`).join('\n')}
      
      Provide a concise 3-point summary of risk trends and specific health metrics.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return "Unable to perform AI analysis at this time. Please check your API key and connection.";
    }
};

export const extractDataFromImage = async (base64Image: string, type: 'User' | 'Payment') => {
    try {
        const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = type === 'User'
            ? `Extract user information from this image (ID, business card, or QR). Return only a JSON object with: fullName, email, mobileNumber, and optionally accounts: [{ bank, accountNumber, name }]. Return as valid JSON strictly.`
            : `Extract payment information from this bank transfer or payment screenshot. Return only a JSON object with: amount (number), date (YYYY-MM-DD), and description. Return as valid JSON strictly.`;

        const imageParts = [{
            inlineData: {
                data: base64Image.split(',')[1] || base64Image,
                mimeType: 'image/jpeg'
            }
        }];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Extract JSON block if it exists
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (error) {
        console.error('Image Extraction Error:', error);
        return null;
    }
};
