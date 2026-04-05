using System;
using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json.Linq;

namespace Ar.Loans.Api.Models
{
    public class TelegramMessage
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        
        /// <summary>
        /// reference to LogEntry record
        /// </summary>
        public string? LogId { get; set; }

        /// <summary>
        /// groups message together until inactive > 10m
        /// </summary>
        public string ConvoId { get; set; } = string.Empty;
        
        /// <summary>
        /// id from telegram (message_id)
        /// </summary>
        public long MessageId { get; set; }
        
        /// <summary>
        /// telegram chat_id (Partition Key)
        /// </summary>
        public string ChatId { get; set; } = string.Empty;
        
        /// <summary>
        /// message.from
        /// </summary>
        public JObject? Sender { get; set; }
        
        /// <summary>
        /// null for now
        /// </summary>
        public string? UserId { get; set; }
        
        /// <summary>
        /// message.chat.type
        /// </summary>
        public string? ConvoType { get; set; }
        
        /// <summary>
        /// message.text
        /// </summary>
        public string? Text { get; set; }
        
        /// <summary>
        /// message.entities
        /// </summary>
        public List<TelegramMessageEntity>? Entities { get; set; }
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class TelegramMessageEntity
    {
        public int Offset { get; set; }
        public int Length { get; set; }
        public string? Type { get; set; }
    }
}
