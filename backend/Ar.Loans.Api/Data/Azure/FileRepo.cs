using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Azure
{
		public class AzureFileRepo
		{
				private readonly AppConfig _config;

				public AzureFileRepo(AppConfig config)
				{
						_config = config;
				}

				public async Task<BlobFile> UploadFile(string filePath, string container, string contentType)
				{
						BlobServiceClient blobServiceClient;

                        if (Uri.TryCreate(_config.AzureStorage, UriKind.Absolute, out var uri))
                        {
                            // If the config is a URL (e.g., https://mystorage.blob.core.windows.net)
                            // Use RBAC via DefaultAzureCredential
                            blobServiceClient = new BlobServiceClient(uri, new DefaultAzureCredential());
                        }
                        else
                        {
                            // If the config is a full Connection String (DefaultEndpointsProtocol=https...)
                            blobServiceClient = new BlobServiceClient(_config.AzureStorage);
                        }
                        Guid id = Guid.CreateVersion7();
                        BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(container);
                        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                        string fileType = Path.GetExtension(filePath);

                        // 3. Get a reference to the specific blob (file) name
                        BlobClient blobClient = containerClient.GetBlobClient(id + fileType);
												var blobHttpHeader = new BlobHttpHeaders
												{
														ContentType = contentType,
														// Use "application/pdf" for PDFs, etc.
														
												};

						// 4. Upload the file
												using FileStream uploadFileStream = File.OpenRead(filePath);
                        await blobClient.UploadAsync(uploadFileStream,  blobHttpHeader);
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
						BlobServiceClient blobServiceClient;

						if (Uri.TryCreate(_config.AzureStorage, UriKind.Absolute, out var uri))
						{
								blobServiceClient = new BlobServiceClient(uri, new DefaultAzureCredential());
						}
						else
						{
								blobServiceClient = new BlobServiceClient(_config.AzureStorage);
						}

						BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(container);
						BlobClient blobClient = containerClient.GetBlobClient(fileKey);

						BlobDownloadInfo download = await blobClient.DownloadAsync();
						return (download.Content, download.ContentType);
				}
		}
}
