using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Models
{
		public class Loan
		{
				[JsonPropertyName("id")]
				public Guid Id { get; set; }

				[JsonPropertyName("alternateId")]
				public string AlternateId { get; set; } = "";

				[JsonPropertyName("clientId")]
				public Guid ClientId { get; set; }

				[JsonPropertyName("guarantorId")]
				public Guid? GuarantorId { get; set; }

				[JsonPropertyName("principal")]
				public decimal Principal { get; set; }

				[JsonPropertyName("interestRate")]
				public decimal InterestRate { get; set; } // Monthly Interest Rate (%)

				[JsonPropertyName("termMonths")]
				public int TermMonths { get; set; }

				[JsonPropertyName("balance")]
				public decimal Balance { get; set; }

				[JsonPropertyName("date")]
				public DateOnly Date { get; set; }

				[JsonPropertyName("nextInterestDate")]
				public DateOnly NextInterestDate { get; set; }

				[JsonPropertyName("ledgerId")]
				public Guid LedgerId { get; set; }

				[JsonPropertyName("sourceAcct")]
				public Guid SourceAcct { get; set; }

				[JsonPropertyName("status")]
				public string Status { get; set; } = "Active";

				[JsonPropertyName("transactions")]
				public IList<LoanLedger> Transactions { get; set; } = new List<LoanLedger>();

				[JsonPropertyName("partitionKey")]
				public string PartitionKey { get; set; } = "default";
				[JsonPropertyName("fileId")]
				public string FileId {get;set;} = "";
		}
		
		public class LoanLedger
		{
				[JsonPropertyName("ledgerId")]
				public Guid LedgerId { get; set; }

				[JsonPropertyName("altKey")]
				public string AltKey { get; set; }

				[JsonPropertyName("type")]
				public string Type { get; set; } = "interest";

				[JsonPropertyName("amount")]
				public decimal Amount { get; set; }

				[JsonPropertyName("dateStart")]
				public DateOnly DateStart { get; set; }

				[JsonPropertyName("endDate")]
				public DateOnly EndDate { get; set; }
		}
}
