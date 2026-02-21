using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Google.GenAI.Types;
using Google.GenAI;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;

namespace Ar.Loans.Api.Data.GoogleAi
{

		public class AiService : IAiService
		{
				private AppConfig _config;
				private readonly Client _client;
				private readonly string ModelId = "gemini-3-flash-preview";

				public AiService(AppConfig config)
				{
					_config = config;
						_client = new Client(apiKey: _config.GeminiKey);
				}

				public async Task<Models.FileData>  IdentifyTransactionData(string filePath)
				{
            string prompt = @"
							### **Task: Transaction Image to JSON Extraction**

						Extract all transaction details from the provided image. Output the data **strictly** in the following JSON format. Do not add any text before or after the JSON block.

						#### **Extraction Logic & Constraints:**
						1. **Missing Data:** If a field is not visible in the screenshot, leave the string empty (`""""`) or the decimal as `0.00`.
						2. **Transaction Type Logic:** - If transferring to another bank: Use `transfer_via_instapay`.
								- If paying a merchant or biller: Use `pay_merchant` or `bills_pay`.
								- Otherwise, select from: `transfer`, `transfer_via_instapay`, `transfer_via_pesonet`.
						3. **DateTime Conversion:** - Convert to `YYYY-MM-DDTHH:mm:ssZ` in UTC. 
								- *Calculation:* If the screenshot is in Philippine Time (GMT+8), subtract 8 hours to reach UTC.
						4. **Description Constraint:** Create a summary including the recipient's name. This field **must be at least 60 characters long**.
						5. **Data Types:** Ensure `amount` and `transactionFee` are decimal numbers (not strings).

						#### **Required JSON Schema:**
						{
							""transactionType"": """",
							""app"": """",
							""description"": """",
							""sourceFilename"": """",
							""reference"": """",
							""datetime"": """",
							""senderAcct"": """",
							""senderBank"": """",
							""senderName"": """",
							""recipientAcct"": """",
							""recipientBank"": """",
							""recipientName"": """",
							""amount"": 0.00,
							""transactionFee"": 0.00
						}
						";

						// 2. Build the request with the image content

						byte[] bytes = System.IO.File.ReadAllBytes(filePath);

						var content = new Content
						{
								Parts =new List<Part>
								{
										new Part { Text = prompt },
										new Part { InlineData = new Blob {
												MimeType = "image/jpeg",
												Data = bytes
										}}
								}
						};

						// 3. Call the AI
						var response = await _client.Models.GenerateContentAsync(
								model: ModelId,
								contents: content,
								config: new GenerateContentConfig
								{
										ResponseMimeType = "application/json" // Force JSON output
								}
						);

						// 4. Parse the AI result
						string jsonResult = response.Candidates[0].Content.Parts[0].Text;

						// Deserialize using the TransactionRecord class we created earlier
						var record = JsonSerializer.Deserialize<Models.FileData>(jsonResult);

						// Add the filename for your records
						//if (record != null) record.SourceFilename = fileName;

						return record;
				}

		}
}
