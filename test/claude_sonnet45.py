import boto3
import json
from datetime import datetime

session = boto3.Session(region_name="ap-northeast-1", profile_name="default")
client = session.client(
    "bedrock-runtime",
    endpoint_url="https://bedrock-runtime.ap-northeast-1.amazonaws.com",
    )

with open("prompt.md") as prompt:
    prompt_content = prompt.read()

question = prompt_content
convesation = [
    {
        "role": "user",
        "content": [{"text": question}]
    }]

model_id = "global.anthropic.claude-sonnet-4-20250514-v1:0"
response = client.converse(
    modelId= model_id,
    messages= convesation
)

output = response["output"]["message"]["content"][0]["text"]

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
response_data = {
    "response": output,
    "full_response": response
}

with open(f"claude_response_{timestamp}.txt", "w", encoding="utf-8") as f:
    f.write(f"Response:\n{output}")