using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Azure
{
    public class AzureFileRepo
    {
        private readonly AppConfig _config;
        private readonly BlobServiceClient _blobServiceClient;
        // Tracks containers already ensured in this host lifetime so each
        // upload doesn't pay ListContainers + CreateContainer transactions.
        private readonly ConcurrentDictionary<string, bool> _ensuredContainers = new();

        public AzureFileRepo(AppConfig config)
        {
            _config = config;

            if (Uri.TryCreate(_config.AzureStorage, UriKind.Absolute, out var uri))
            {
                // If the config is a URL (e.g., https://mystorage.blob.core.windows.net)
                // Use RBAC via DefaultAzureCredential
                _blobServiceClient = new BlobServiceClient(uri, new DefaultAzureCredential());
            }
            else
            {
                // If the config is a full Connection String (DefaultEndpointsProtocol=https...)
                _blobServiceClient = new BlobServiceClient(_config.AzureStorage);
            }
        }

        public async Task<BlobFile> UploadFile(string filePath, string container, string contentType)
        {
            BlobContainerClient containerClient = _blobServiceClient.GetBlobContainerClient(container);
            await EnsureContainerAsync(containerClient);

            Guid id = Guid.CreateVersion7();
            string fileType = Path.GetExtension(filePath);

            // Get a reference to the specific blob (file) name
            BlobClient blobClient = containerClient.GetBlobClient(id + fileType);
            var blobHttpHeader = new BlobHttpHeaders
            {
                ContentType = contentType,
                // Use "application/pdf" for PDFs, etc.

            };

            // Upload the file
            using FileStream uploadFileStream = File.OpenRead(filePath);
            await blobClient.UploadAsync(uploadFileStream, blobHttpHeader);
            uploadFileStream.Close();

            return new BlobFile
            {
                Id = id,
                OriginalFileName = Path.GetFileName(filePath),
                FileKey = id + fileType,
                Container = container
            };
        }

        public async Task<(Stream stream, string contentType)> GetFileStream(string fileKey, string container)
        {
            BlobContainerClient containerClient = _blobServiceClient.GetBlobContainerClient(container);
            BlobClient blobClient = containerClient.GetBlobClient(fileKey);

            BlobDownloadInfo download = await blobClient.DownloadAsync();
            return (download.Content, download.ContentType);
        }

        private async Task EnsureContainerAsync(BlobContainerClient containerClient)
        {
            if (_ensuredContainers.ContainsKey(containerClient.Name))
                return;

            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);
            _ensuredContainers[containerClient.Name] = true;
        }
    }
}
