using System;

namespace Ar.Loans.Api.Data
{
    public static class AccountConstants
    {
        // Assets
        public static readonly Guid ArGoTyme = Guid.Parse("f49e4860-2936-407b-8451-2483533860bb");
        public static readonly Guid ArNonGoTyme = Guid.Parse("17d8a6f3-8b77-4b7b-816b-03c622a57342");
        public static readonly Guid MarkGoTyme = Guid.Parse("2659e354-94b1-496e-9316-d80c057b5451");
        public static readonly Guid LoanReceivables = Guid.Parse("e8494c8e-8db2-4809-9b4b-97e3a3861274");

        // Income
        public static readonly Guid ArIncome = Guid.Parse("44cc7e41-0f37-43ca-a0ad-8f96e814a601");
        public static readonly Guid MarkIncome = Guid.Parse("b0448f7d-2b3a-4416-8c4d-6e9f2d011f44");
        public static readonly Guid InterestIncome = Guid.Parse("cb5f2a1b-9d4e-4f3a-bf3d-cfcd9e12013b");

        // Liabilities
        public static readonly Guid Unionbank = Guid.Parse("a5d8f9e1-6b4c-4e89-9a2d-1ea234e6789c");

        public static string GetName(Guid id) => id switch
        {
            _ when id == ArGoTyme => "AR - GoTyme",
            _ when id == ArNonGoTyme => "AR - Non-GoTyme",
            _ when id == MarkGoTyme => "Mark - GoTyme",
            _ when id == LoanReceivables => "Loan Receivables",
            _ when id == ArIncome => "AR",
            _ when id == MarkIncome => "Mark",
            _ when id == InterestIncome => "Interest Income",
            _ when id == Unionbank => "Unionbank",
            _ => "Unknown Account"
        };
    }
}
