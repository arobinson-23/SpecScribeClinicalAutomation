import { config } from "dotenv";
config({ path: ".env.local" });
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const region = process.env.BEDROCK_AWS_REGION;
const accessKey = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
const secretKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;

const client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 20,
    messages: [{ role: "user", content: "Say: hello" }],
});

// Try model IDs in order of preference for ca-central-1
const candidates = [
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0",
];

for (const modelId of candidates) {
    process.stdout.write(`Testing ${modelId}... `);
    try {
        const cmd = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: new TextEncoder().encode(body),
        });
        await client.send(cmd);
        console.log("✅  WORKS");
        break;
    } catch (err) {
        console.log(`❌  ${err.name}: ${err.message?.slice(0, 80)}`);
    }
}
