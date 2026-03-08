using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Models
{
    public class User
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }
        [JsonPropertyName("partitionKey")]
        public string PartitionKey { get; set; } = "default";
        [JsonPropertyName("name")]
        public string Name { get; set; }
        [JsonPropertyName("role")]
        public string Role { get; set; }
        [JsonPropertyName("mobileNumber")]
        public string MobileNumber { get; set; }
        [JsonPropertyName("email")]
        public string EmailAddress { get; set; }
        [JsonPropertyName("accounts")]
        public List<UserBankAccount> Accounts { get; set; } = new List<UserBankAccount>();
        [JsonPropertyName("defaultInterestRuleId")]
        public Guid? DefaultInterestRuleId { get; set; }
    }


}
