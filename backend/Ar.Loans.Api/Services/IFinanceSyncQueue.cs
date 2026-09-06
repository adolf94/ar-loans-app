using System;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Services
{
    /// <summary>
    /// Pushes finance sync notifications (event-driven, no polling).
    /// Implementations must never throw to the caller (best-effort).
    /// </summary>
    public interface IFinanceSyncQueue
    {
        bool IsConfigured { get; }
        Task PublishAsync(Guid syncItemId);
    }
}
