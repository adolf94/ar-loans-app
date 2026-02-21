using System.Text.Json.Serialization;
using Google.Cloud.AIPlatform.V1;

namespace Ar.Loans.Api.Models
{
    public class BlobFile
    {

        public Guid Id { get; set; }
        public string Container { get; set; } = "";
        public string PartitionKey { get; set; } = "default";
        public string Service { get; set; } = "blob";
        public string OriginalFileName { get; set; } = "";
        public string MimeType { get; set; } = "";
        public string FileKey { get; set; } = "";
        public DateTime DateCreated { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "Active";
        public FileData? Data { get; set; } = null;

    }
    public class FileData
    {
        public string transactionType { get; set; }
        public string app { get; set; }
        public string description { get; set; }
        public string sourceFilename { get; set; }
        public string reference { get; set; }
        public string datetime { get; set; }
        public string senderAcct { get; set; }
        public string senderBank { get; set; }
        public string senderName { get; set; }
        public string recipientAcct { get; set; }
        public string recipientBank { get; set; }
        public string recipientName { get; set; }
        public decimal amount { get; set; }
        public decimal transactionFee { get; set; }
        public Guid? fileId {get;set;}
    }
}
