using System;
using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json.Linq;

namespace Ar.Loans.Api.Models
{
    public class LogEntry
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Level { get; set; } = "Information";
        public string Source { get; set; } = string.Empty;
        public string? ChatId { get; set; }
        public string Message { get; set; } = string.Empty;
        public JObject? Data { get; set; }
        public string PartitionKey { get; set; } = "default";
    }
}
