import assert from "node:assert/strict";
import { test } from "node:test";
import { companyFromEmail, extractEmails, pickApplyEmail } from "./emails";
import { matchRole, postedAtFromAge, postSearchUrl } from "./match";
import { extractWithRules } from "./rules";
import { fillTemplate } from "../settings";

test("finds plain and mailto-style emails, lowercased and deduped", () => {
  const text = "Send your CV to HR@Acme.ai or hr@acme.ai. Questions: jobs@acme-labs.co.in.";
  assert.deepEqual(extractEmails(text), ["hr@acme.ai", "jobs@acme-labs.co.in"]);
});

test("decodes obfuscated emails", () => {
  assert.deepEqual(extractEmails("Mail resume to priya [at] nuplay [dot] ai"), ["priya@nuplay.ai"]);
  assert.deepEqual(extractEmails("careers(at)example-co(dot)com"), ["careers@example-co.com"]);
  assert.deepEqual(extractEmails("reach me: ravi at gmail dot com"), ["ravi@gmail.com"]);
});

test("ignores prose that only looks like an email", () => {
  assert.deepEqual(extractEmails("I work at Google dot com these days"), []);
  assert.deepEqual(extractEmails("Join us at acme.com for the event"), []);
  assert.deepEqual(extractEmails("logo@2x.png and noreply@acme.com"), []);
});

test("prefers the address next to 'send your resume'", () => {
  const text = "Questions about the event: events@acme.com. To apply, send your resume to talent@acme.com";
  const emails = extractEmails(text);
  assert.equal(pickApplyEmail(emails, text), "talent@acme.com");
});

test("company from email skips personal mailboxes", () => {
  assert.equal(companyFromEmail("hr@deep-vision.ai"), "Deep Vision");
  assert.equal(companyFromEmail("someone@gmail.com"), null);
});

test("rules: spots a hiring post and its details", () => {
  const post = `We're hiring a Machine Learning Engineer (3-5 years) in Bengaluru, hybrid.
Location: Bengaluru
Send your resume to careers@nuplay.ai`;
  const r = extractWithRules(post, ["Machine Learning Engineer", "Data Scientist"], ["Bengaluru", "Remote"]);
  assert.equal(r.isHiring, true);
  assert.equal(r.applyEmail, "careers@nuplay.ai");
  assert.equal(r.location, "Bengaluru");
  assert.equal(r.workMode, "hybrid");
  assert.match(r.experience ?? "", /3-5 years/);
});

test("rules: job seekers are not hiring posts", () => {
  const post = "#OpenToWork I'm actively looking for a Data Scientist role in Hyderabad. Email me at me@gmail.com";
  assert.equal(extractWithRules(post, ["Data Scientist"], ["Hyderabad"]).isHiring, false);
});

test("matches role variants to the right target", () => {
  const roles = ["Machine Learning Engineer", "AI Engineer", "Data Scientist"];
  assert.equal(matchRole("Senior ML Engineer", "", roles), "Machine Learning Engineer");
  assert.equal(matchRole("GenAI Engineer", "", roles), "AI Engineer");
  assert.equal(matchRole("Lead Data Scientist", "", roles), "Data Scientist");
  assert.equal(matchRole("Data Engineer", "", roles), null);
});

test("turns LinkedIn post ages into dates", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  assert.equal(postedAtFromAge("3d • Edited", now), "2026-10-18T12:00:00.000Z");
  assert.equal(postedAtFromAge("5h", now), "2026-10-21T07:00:00.000Z");
  assert.equal(postedAtFromAge("2mo", now), new Date(now.getTime() - 2 * 2592e6).toISOString());
  assert.equal(postedAtFromAge(null, now), null);
});

test("builds a search link from the post's opening words", () => {
  const url = postSearchUrl("We're hiring! 🚀 ML Engineer at NuPlay https://lnkd.in/x apply now please today");
  assert.ok(url.startsWith("https://www.linkedin.com/search/results/content/?keywords="));
  assert.equal(decodeURIComponent(url.split("=")[1]), `"We're hiring ML Engineer at NuPlay apply now please"`);
});

test("template drops lines whose only placeholder is blank", () => {
  const out = fillTemplate("Hi {{greeting_name}},\n\nThanks,\n{{name}}\n{{phone}}\n{{linkedin}}", {
    greeting_name: "Ritesh",
    name: "Vamsi",
    phone: "",
    linkedin: "linkedin.com/in/vamsi",
  });
  assert.equal(out, "Hi Ritesh,\n\nThanks,\nVamsi\nlinkedin.com/in/vamsi");
});

test("skill matching understands common aliases, whole words only", async () => {
  const { skillMatches } = await import("./skills");
  const mine = ["YOLO", "Vision-Language Models", "ONNX", "Edge Deployment", "Object Detection", "RAG", "PyTorch"];
  const post = "Build YOLOv8 detectors and Qwen2-VL pipelines, deployed with ONNX Runtime on Jetson devices.";
  assert.deepEqual(skillMatches(post, mine), ["YOLO", "Vision-Language Models", "ONNX", "Edge Deployment", "Object Detection"]);
  assert.deepEqual(skillMatches("Manage data storage and average latency", ["RAG"]), []);
  assert.deepEqual(skillMatches("Experience with an unusual tool like Kornia", ["Kornia"]), ["Kornia"]);
});

test("matches computer-vision and GenAI titles", () => {
  const roles = ["Computer Vision Engineer", "AI Engineer", "Machine Learning Engineer", "Generative AI Engineer", "Data Scientist"];
  assert.equal(matchRole("CV Engineer", "", roles), "Computer Vision Engineer");
  assert.equal(matchRole("GenAI Engineer (LLMs)", "", roles), "Generative AI Engineer");
  assert.equal(matchRole("Associate Data Scientist", "", roles), "Data Scientist");
});

test("finds bracketed gaps a draft leaves to fill in", async () => {
  const { unfilledPlaceholders } = await import("../placeholders");
  assert.deepEqual(unfilledPlaceholders("Notice: [notice period]\nCTC: [current CTC] / [expected CTC]\n[notice period]"), [
    "[notice period]",
    "[current CTC]",
    "[expected CTC]",
  ]);
  assert.deepEqual(unfilledPlaceholders("No gaps here, see https://www.linkedin.com/in/x"), []);
});
