import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";

async function listModels() {
  try {
    const envFile = fs.readFileSync(".env.local", "utf-8");
    const keyMatch = envFile.match(/GEMINI_API_KEY=([^\s]+)/);
    const key = keyMatch ? keyMatch[1] : null;
    
    if (!key) throw new Error("No API key");
    
    // The SDK doesn't have a direct listModels method on the client usually, 
    // but we can try to use a dummy call or check the REST API.
    // Actually, let's just try the name the user wants.
    
    const genAI = new GoogleGenerativeAI(key);
    const modelName = "gemini-3.1-flash-lite";
    console.log(`Testing model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hola");
    console.log("Success with", modelName, ":", result.response.text().substring(0, 50));
  } catch (error: any) {
    console.error("Error testing model:", error.message);
  }
}

listModels();
