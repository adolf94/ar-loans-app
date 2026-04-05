using System;
using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Models
{
    public class ConversationState
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } // This will be the ChatId (string)

        [JsonPropertyName("workflow")]
        public string Workflow { get; set; } = "None"; // e.g., "AddLoan"

        [JsonPropertyName("step")]
        public string Step { get; set; } = "None"; // e.g., "AwaitingImage", "VerifyingData"

        [JsonPropertyName("buffer")]
        public string? Buffer { get; set; } // JSON-encoded temporary data (e.g., FileId or extracted FileData)

        [JsonPropertyName("lastUpdated")]
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("partitionKey")]
        public string PartitionKey { get; set; } = "default";
    }
}
