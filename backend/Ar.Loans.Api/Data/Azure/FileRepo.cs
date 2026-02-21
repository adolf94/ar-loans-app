using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
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

				public async Task<BlobFile> UploadFile(string filePath, string container)
				{
						BlobServiceClient blobServiceClient = new BlobServiceClient(_config.AzureStorage);
                        Guid id = Guid.CreateVersion7();
                        BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(container);
                        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                        string fileType = Path.GetExtension(filePath);

                        // 3. Get a reference to the specific blob (file) name
                        BlobClient blobClient = containerClient.GetBlobClient(id + fileType);


                        // 4. Upload the file
                        using FileStream uploadFileStream = File.OpenRead(filePath);
                        await blobClient.UploadAsync(uploadFileStream, overwrite: true);
                        uploadFileStream.Close();

                        return new BlobFile
                        {
                            Id = id,
                            OriginalFileName = Path.GetFileName(filePath),
                            FileKey = id + fileType,
                            Container = container
                        };

				}
		}
}
