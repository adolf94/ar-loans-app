using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Azure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class FileController
    {
        private readonly IAiService _ai;
        private readonly AzureFileRepo _azFile;
				private readonly IFileRepo _files;
				private readonly IDbHelper _db;

				public FileController(IAiService ai, AzureFileRepo azFile, IFileRepo files, IDbHelper db)
        {
            _ai = ai;
            _azFile = azFile;
            _files = files;
            _db = db;
        }

        [Function("IdentifyTransactionInformation")]
        public async Task<IActionResult> IdentifyTransactionInformation(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "files/identify_transaction")] HttpRequest req)
        {
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

                var fileRecord = await _azFile.UploadFile(tempPath, "loan-files");



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
    }
}
