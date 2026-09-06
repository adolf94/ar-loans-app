using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.OpenRouter
{

		public class AiService : IAiService
		{
				private const string BaseUrl = "https://openrouter.ai/api/v1";
				private readonly AppConfig _config;
				private readonly HttpClient _http;
				private readonly string ModelId;

				public AiService(AppConfig config, IHttpClientFactory httpClientFactory)
				{
					_config = config;
					ModelId = string.IsNullOrWhiteSpace(config.OpenRouterModel)
							? "google/gemini-2.5-flash"
							: config.OpenRouterModel;
					_http = httpClientFactory.CreateClient();
					_http.BaseAddress = new Uri(BaseUrl);
					_http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.OpenRouterKey);
				}

				public async Task<Models.FileData>  IdentifyTransactionData(string filePath)
				{

					string fileName = Path.GetFileName(filePath);
            string prompt = @"
							# ROLE
							You are a precise financial data extraction assistant specialized in processing digital transaction receipts.

							# TASK
							Analyze the provided screenshot and extract transaction details into a structured JSON format. 

							# EXTRACTION RULES
							1. **Logic Step**: Identify the App (GoTyme, GCash, Maya, etc.) first.
							2. **Missing Data**: If a field is not visible, leave it as """" (or 0.00). 
							3. **Date & Time Extraction (Strict Priority)**:
							- **Priority 1 (Receipt Text)**: Use the date/time explicitly labeled in the receipt.
							- **Priority 2 (GoTyme Logic)**: If Ref starts with ITR/UTO, extract date from digits 4-9 (YYMMDD).
							- **Priority 3 (Filename)**: Look for date patterns (YYYYMMDD or YYYY-MM-DD) in the provided `sourceFilename`.
							- **Priority 4 (System Clock)**: Look at the phone's status bar clock at the top of the image.
							4. **Timezone**: Convert to UTC ""YYYY-MM-DDTHH:mm:ssZ"". Assume GMT+8 (PHT) for conversion.
							5. **Transaction Types**: Use: [""transfer"", ""transfer_via_instapay"", ""transfer_via_pesonet"", ""pay_merchant"", ""bills_pay""].
							6. **Description**: Concise summary (min 60 characters) including recipient and app name.

							# JSON SCHEMA - SHOULD ONLY BE A SINGLE OBJECT NOT AN ARRAY
							{
							""transactionType"": ""string"",
							""app"": ""string"",
							""description"": ""string"",
							""sourceFilename"": ""string"",
							""reference"": ""string"",
							""datetime"": ""string (ISO 8601 UTC)"",
							""senderAcct"": ""string"",
							""senderBank"": ""string"",
							""senderName"": ""string"",
							""recipientAcct"": ""string"",
							""recipientBank"": ""string"",
							""recipientName"": ""string"",
							""amount"": decimal,
							""transactionFee"": decimal
							}

							# INPUT

							Filename: {fileName}

						";

						// 2. Build the request with the image content
						prompt = prompt.Replace("{fileName}", fileName);

						byte[] bytes = File.ReadAllBytes(filePath);

						var payload = new Dictionary<string, object?>
						{
								["model"] = ModelId,
								["temperature"] = 0.2,
								["messages"] = new object[]
								{
										new
										{
												role = "system",
												content = @"You are a precise data extraction engine. Respond with ONLY a single raw JSON object. No markdown, no code fences, no explanations, no reasoning text — just the JSON object matching the requested schema."
										},
										new
										{
												role = "user",
												content = new object[]
												{
														new { type = "text", text = prompt },
														new { type = "image_url", image_url = new { url = $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}" } }
												}
										}
								},
								// Force JSON output
								["response_format"] = new { type = "json_object" },
								// Ask OpenRouter to enforce response_format even on providers that ignore it
								["provider"] = new { require_parameters = true }
						};

						// Enable reasoning (thinking) via OpenRouter, e.g. "low", "medium", "high".
						// Note: some models drop the reasoning trace when response_format is set,
						// in which case the JSON is recovered from the final content.
						var reasoningEffort = _config.OpenRouterReasoningEffort;
						if (!string.IsNullOrWhiteSpace(reasoningEffort))
						{
								payload["reasoning"] = new { effort = reasoningEffort };
						}

						// Optional but recommended by OpenRouter for app attribution
						var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/chat/completions");
						request.Headers.TryAddWithoutValidation("HTTP-Referer", "https://ar-loans.app");
						request.Headers.TryAddWithoutValidation("X-Title", "AR Loans");
						request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

						// 3. Call the AI
						var httpResponse = await _http.SendAsync(request);
						var body = await httpResponse.Content.ReadAsStringAsync();

						if (!httpResponse.IsSuccessStatusCode)
						{
								throw new HttpRequestException($"OpenRouter request failed ({(int)httpResponse.StatusCode}): {body}");
						}

						// 4. Parse the AI result
						using var doc = JsonDocument.Parse(body);
						string jsonResult = doc.RootElement
								.GetProperty("choices")[0]
								.GetProperty("message")
								.GetProperty("content")
								.GetString()!;

						// Some OpenRouter models wrap the JSON in <think> tags,
						// markdown fences, or prose — extract the JSON object
						jsonResult = ExtractJsonObject(jsonResult);

						// Deserialize using the TransactionRecord class we created earlier
						var record = JsonSerializer.Deserialize<Models.FileData>(jsonResult);

						return record;
				}

				private static string ExtractJsonObject(string text)
				{
						if (string.IsNullOrWhiteSpace(text)) return text;

						var trimmed = text.Trim();

						// Strip markdown code fences
						if (trimmed.StartsWith("```", StringComparison.Ordinal))
						{
								var firstNewline = trimmed.IndexOf('\n');
								if (firstNewline >= 0) trimmed = trimmed[(firstNewline + 1)..];
								var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
								if (lastFence >= 0) trimmed = trimmed[..lastFence];
								trimmed = trimmed.Trim();
						}

						// Last resort: slice from the first '{' to the last '}'.
						// Handles any remaining wrapper: reasoning tags, prose, etc.
						var firstBrace = trimmed.IndexOf('{');
						var lastBrace = trimmed.LastIndexOf('}');
						if (firstBrace >= 0 && lastBrace > firstBrace)
						{
								trimmed = trimmed[firstBrace..(lastBrace + 1)];
						}

						return trimmed;
				}

		}
}
