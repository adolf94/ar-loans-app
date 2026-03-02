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

							# JSON SCHEMA
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
