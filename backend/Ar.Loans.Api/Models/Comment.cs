using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Models
{
    public class Comment
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; } = Guid.CreateVersion7();

        [JsonPropertyName("loanId")]
        public Guid LoanId { get; set; }

        [JsonPropertyName("userId")]
        public Guid UserId { get; set; }

        [JsonPropertyName("userName")]
        public string UserName { get; set; } = "";

        [JsonPropertyName("content")]
        public string Content { get; set; } = "";

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow.AddHours(8); // Default to UTC+8

        [JsonPropertyName("partitionKey")]
        public string PartitionKey { get; set; } = "default";
    }
}
