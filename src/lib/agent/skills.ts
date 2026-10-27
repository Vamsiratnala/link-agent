// Other ways posts commonly name a skill. Keys are lowercase skill names as
// entered in Settings; values are regex fragments. Skills not listed here are
// matched by their own name.
const ALIASES: Record<string, string[]> = {
  "computer vision": ["computer vision", "cv", "image processing", "vision ai"],
  "vision-language models": ["vlms?", "vision[- ]language", "multi-?modal", "qwen[- ]?2?(?:\\.5)?[- ]?vl", "llava"],
  "object detection": ["object detection", "detection models?", "yolo(?:v\\d+)?", "detr"],
  yolo: ["yolo(?:v\\d+)?", "ultralytics"],
  ocr: ["ocr", "document ai", "text extraction", "idp"],
  "defect detection": ["defects?(?: detection)?", "anomaly detection", "visual inspection", "quality inspection"],
  "llm/vlm fine-tuning": ["fine[- ]?tun\\w*", "lora", "qlora", "peft"],
  pytorch: ["pytorch", "torch"],
  "hugging face transformers": ["hugging ?face", "hf transformers", "transformers"],
  opencv: ["opencv"],
  onnx: ["onnx(?: runtime)?", "tensorrt"],
  "model quantization": ["quantiz\\w*"],
  "edge deployment": ["edge (?:ai|deployment|devices?|computing)", "jetson", "raspberry pi", "on-?device"],
  rag: ["rag", "retrieval[- ]augmented"],
  langchain: ["langchain", "langgraph"],
  nlp: ["nlp", "natural language processing"],
  llms: ["llms?", "large language models?", "gen ?ai", "generative ai"],
  python: ["python"],
  sql: ["sql"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function patternFor(skill: string): RegExp {
  const aliases = ALIASES[skill.toLowerCase().trim()] ?? [escape(skill.toLowerCase().trim())];
  // Whole-word matches only, so "rag" doesn't match "storage".
  return new RegExp(`(?<![a-z0-9])(?:${aliases.join("|")})(?![a-z0-9])`, "i");
}

/** The user's skills that a post asks for, in the user's own wording. */
export function skillMatches(text: string, skills: string[]): string[] {
  return skills.filter((s) => s.trim() && patternFor(s).test(text));
}
