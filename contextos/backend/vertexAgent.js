import dotenv from "dotenv";
import { VertexAI } from "@google-cloud/vertexai";

dotenv.config({ path: "../.env" });

export const vertexConfig = {
  project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "",
  location: process.env.GOOGLE_CLOUD_LOCATION || process.env.GCLOUD_LOCATION || "us-central1",
  model: process.env.VERTEX_MODEL || "gemini-2.5-pro",
};

if (vertexConfig.project) {
  process.env.GCLOUD_PROJECT = vertexConfig.project;
}
process.env.GCLOUD_LOCATION = vertexConfig.location;

const vertexAI = new VertexAI({
  project: vertexConfig.project || "your-gcp-project-id",
  location: vertexConfig.location,
});

export const coreAgent = vertexAI.getGenerativeModel({
  model: vertexConfig.model,
});

export function getVertexStatus() {
  return {
    project: vertexConfig.project || null,
    location: vertexConfig.location,
    model: vertexConfig.model,
  };
}

function extractText(result) {
  return result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export function parseAgentJSON(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Empty response from Vertex core agent");

  let text = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escaped = false;

    for (const ch of text) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === "\"") { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      if (ch === "[") brackets++;
      if (ch === "]") brackets--;
    }

    if (inString) text += "\"";
    text += "]".repeat(Math.max(0, brackets));
    text += "}".repeat(Math.max(0, braces));

    return JSON.parse(text);
  }
}

export async function callCoreAgent(prompt, {
  systemInstruction,
  contents,
  temperature = 0.4,
  maxOutputTokens = 2048,
  responseMimeType,
} = {}) {
  const request = {
    contents: contents || [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };

  if (systemInstruction) {
    request.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (responseMimeType) {
    request.generationConfig.responseMimeType = responseMimeType;
  }

  const result = await coreAgent.generateContent(request);
  return extractText(result);
}

export async function callCoreAgentJSON(prompt, opts = {}) {
  const text = await callCoreAgent(prompt, {
    ...opts,
    responseMimeType: "application/json",
  });
  return parseAgentJSON(text);
}
