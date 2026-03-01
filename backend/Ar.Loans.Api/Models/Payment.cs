using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Models
{
		public class Payment
		{
				[JsonPropertyName("id")]
				public Guid Id { get; set; }

				[JsonPropertyName("alternateId")]
				public string AlternateId { get; set; } = "";

				[JsonPropertyName("userId")]
				public Guid UserId { get; set; }

				[JsonPropertyName("loanId")]
				public Guid LoanId { get; set; }

				[JsonPropertyName("ledgerId")]
				public Guid? LedgerId { get; set; }

				[JsonPropertyName("amount")]
				public decimal Amount { get; set; }

				[JsonPropertyName("date")]
				public DateOnly Date { get; set; }

				[JsonPropertyName("description")]
				public string Description { get; set; } = "";

				[JsonPropertyName("fileId")]
				public string? FileId { get; set; } = null;

				[JsonPropertyName("destinationAcctId")]
				public Guid DestinationAcctId { get; set; }

				[JsonPropertyName("partitionKey")]
				public string PartitionKey { get; set; } = "default";
		}
}
