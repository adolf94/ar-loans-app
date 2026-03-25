using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Azure;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class FileController(IAiService ai, AzureFileRepo azFile, IFileRepo files, IDbHelper db, CurrentUser user, AppConfig config)
    {
        private readonly IAiService _ai = ai;
        private readonly AzureFileRepo _azFile = azFile;
        private readonly IFileRepo _files = files;
        private readonly IDbHelper _db = db;
        private readonly CurrentUser _user = user;
        private readonly AppConfig _config = config;

        [Function("IdentifyTransactionInformation")]
        public async Task<IActionResult> IdentifyTransactionInformation(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "files/identify_transaction")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            try
            {
                if (!req.HasFormContentType)
                {
                    return new BadRequestObjectResult("Request must be a form with a file.");
                }

                var file = req.Form.Files.FirstOrDefault();
                if (file == null || file.Length == 0)
                {
                    return new BadRequestObjectResult("No file uploaded.");
                }

                // Save file temporarily
                var tempPath = Path.Combine(Path.GetTempPath(), file.FileName);

                using (var stream = new FileStream(tempPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var fileRecord = await _azFile.UploadFile(tempPath, _config.StorageContainer, file.ContentType);



                try
                {
                    // Identify transaction data using AI service
                    var result = await _ai.IdentifyTransactionData(tempPath);

                    fileRecord.Data = result;
                    result.fileId = fileRecord.Id;

                    await _files.SaveFileRecord(fileRecord);
                    await _db.SaveChangesAsync();

                    return new OkObjectResult(result);
                }
                finally
                {
                    // Cleanup: Delete temporary file to prevent storage buildup
                    if (File.Exists(tempPath))
                    {
                        File.Delete(tempPath);
                    }
                }
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { error = ex.Message });
            }
        }

        [Function("GetFile")]
        public async Task<IActionResult> GetFile(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "files/{id}")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();

            var idStr = req.RouteValues["id"]?.ToString();
            if (!Guid.TryParse(idStr, out var fileId))
            {
                return new BadRequestObjectResult("Invalid file ID.");
            }

            var fileRecord = await _files.GetFileRecord(fileId);
            if (fileRecord == null)
            {
                return new NotFoundObjectResult("File not found.");
            }

            try
            {
                var (stream, contentType) = await _azFile.GetFileStream(fileRecord.FileKey, fileRecord.Container);
                return new FileStreamResult(stream, contentType ?? "application/octet-stream")
                {
                    FileDownloadName = fileRecord.OriginalFileName
                };
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { error = ex.Message });
            }
        }
    }
}
