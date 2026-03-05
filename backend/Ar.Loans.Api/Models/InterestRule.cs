using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Models
{
    public class InterestRule
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; } = Guid.CreateVersion7();

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        // Percentage for the monthly interest (e.g. 10 for 10%)
        [JsonPropertyName("interestPerMonth")]
        public decimal InterestPerMonth { get; set; }

        // How long the user has to pay with the grace period interest (e.g. 7 days)
        [JsonPropertyName("gracePeriodDays")]
        public int GracePeriodDays { get; set; }

        // The interest applied if paid within grace period (usually 0)
        [JsonPropertyName("gracePeriodInterest")]
        public decimal GracePeriodInterest { get; set; }

        // Rate applied to late payments on top of regular interest (e.g. 5 for 5%)
        [JsonPropertyName("latePaymentPenalty")]
        public decimal LatePaymentPenalty { get; set; }

        // Default term in months
        [JsonPropertyName("defaultTerms")]
        public int DefaultTerms { get; set; }

        // "principal" = always compute on original principal, "balance" = compute on remaining balance
        [JsonPropertyName("interestBase")]
        public string InterestBase { get; set; } = "principal";

        [JsonPropertyName("partitionKey")]
        public string PartitionKey { get; set; } = "default";
    }
}
