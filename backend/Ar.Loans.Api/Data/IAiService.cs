using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Ar.Loans.Api.Models;

namespace Ar.Loans.Api.Data
{
    public interface IAiService
    {
        Task<FileData> IdentifyTransactionData(string filePath);
    }
}
