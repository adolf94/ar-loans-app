using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.Fonts;
using SixLabors.ImageSharp.PixelFormats;

namespace Ar.Loans.Api.Functions
{
    public class InterestTimerFunction
    {
        private readonly ILoanRepo _loanRepo;
        private readonly IUserRepo _userRepo;
        private readonly TelegramService _telegramService;
        private readonly AppConfig _appConfig;
        private readonly ILogger _logger;

        public InterestTimerFunction(
            ILoanRepo loanRepo, 
            IUserRepo userRepo,
            TelegramService telegramService,
            AppConfig appConfig,
            ILoggerFactory loggerFactory)
        {
            _loanRepo = loanRepo;
            _userRepo = userRepo;
            _telegramService = telegramService;
            _appConfig = appConfig;
            _logger = loggerFactory.CreateLogger<InterestTimerFunction>();
        }

        [Function("InterestTimerFunction")]
        public async Task Run([TimerTrigger("0 0 16 * * *", RunOnStartup = true)] TimerInfo myTimer)
        {
            _logger.LogInformation($"InterestTimerFunction executed at: {DateTime.Now}");

            // UTC+8 Reference Date
            DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);

            var loans = await _loanRepo.GetLoansPendingInterest(referenceDateUTC8);
            _logger.LogInformation($"Found {loans.Count} loans pending interest accrual.");

            foreach (var loan in loans)
            {
                try
                {
                    var client = await _userRepo.GetUserById(loan.ClientId);
                    var newTransactions = await _loanRepo.AccrueInterest(loan, referenceDateUTC8);
                    
                    if (newTransactions != null && newTransactions.Any())
                    {
                        bool hasNewTelegramIds = false;
                        var runningBalance = loan.Balance - newTransactions.Sum(t => t.Amount);
                        foreach (var tx in newTransactions)
                        {
                            runningBalance += tx.Amount;
                            var message = new StringBuilder();
                            message.AppendLine("📈 *New Interest Accrued*");
                            message.AppendLine($"*ID*: {loan.AlternateId}");
                            message.AppendLine($"*Name*: {client?.Name ?? "Unknown"}");
                            message.AppendLine($"*Type*: {(tx.Type == "interest" ? "Interest" : "Penalty")}");
                            message.AppendLine($"*Amount*: {tx.Amount:N2}");
                            message.AppendLine($"*Until*: {tx.EndDate:MMM dd}");
                            message.AppendLine($"*Balance*: {runningBalance:N2}");

                            var msgId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, message.ToString());
                            if (msgId.HasValue)
                            {
                                tx.TelegramMessageId = msgId;
                                hasNewTelegramIds = true;
                            }
                        }

                        if (hasNewTelegramIds)
                        {
                            await _loanRepo.UpdateLoan(loan);
                        }
                    }

                    _logger.LogInformation($"Accrued interest for loan {loan.Id}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error accruing interest for loan {loan.Id}: {ex.Message}");
                }
            }

            // Summary of Upcoming Accruals
            try
            {
                var activeLoans = await _loanRepo.GetActiveLoans();
                var refDateOnly = DateOnly.FromDateTime(referenceDateUTC8);
                var targetDays = new[] { 0, 1, 3, 7 };
                var summaryList = new List<string>();

                foreach (var loan in activeLoans.OrderBy(l => l.NextInterestDate))
                {
                    var daysRemaining = loan.NextInterestDate.DayNumber - refDateOnly.DayNumber;
                    if (targetDays.Contains(daysRemaining))
                    {
                        var client = await _userRepo.GetUserById(loan.ClientId);
                        // Determine if Grace Period (🛡️) or Regular (⚡)
                        var totalDaysFromStart = loan.NextInterestDate.DayNumber - loan.Date.DayNumber;
                        bool isGrace = totalDaysFromStart <= loan.GracePeriodDays;
                        var typeEmoji = isGrace ? "🛡️" : "⚡";

                        summaryList.Add($"{daysRemaining}|{loan.NextInterestDate:MMM dd}|{typeEmoji}|{client?.Name ?? "Unknown"}");
                    }
                }

                if (summaryList.Any())
                {
                    // Generate Image using ImageSharp (Cross-platform)
                    var imageBytes = DrawInterestSummaryTable(summaryList, referenceDateUTC8);

                    await _telegramService.SendPhotoAsync(
                        _appConfig.Telegram.GuarantorChannel, 
                        imageBytes,
                        $"InterestSummary_{referenceDateUTC8:yyyyMMdd}.png",
                        $"⏳ *Upcoming Interest Accruals Summary* - {referenceDateUTC8:MMM dd, yyyy}");
                }
            }
            catch (Exception ex)
            {
                await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorGroupChat, $"Error generating interest summary: {ex.Message}");
                _logger.LogError($"Error generating interest summary: {ex.Message}");
            }
        }

        private byte[] DrawInterestSummaryTable(List<string> summaryList, DateTime referenceDate)
        {
            int rowHeight = 40;
            int headerHeight = 80;
            int width = 500;
            int height = headerHeight + (summaryList.Count * rowHeight) + 20;

            using (var image = new Image<Rgba32>(width, height))
            {
                image.Mutate(ctx =>
                {
                    ctx.Fill(Color.White);

                    // Header Background
                    ctx.Fill(Color.FromRgb(44, 62, 80), new RectangleF(0, 0, width, headerHeight));

                    // Font selection
                    var family = SystemFonts.Families.FirstOrDefault(f => f.Name == "Arial");
                    if (string.IsNullOrEmpty(family.Name))
                    {
                        family = SystemFonts.Families.First();
                    }
                    
                    var titleFont = family.CreateFont(24, FontStyle.Bold);
                    var headerFont = family.CreateFont(16, FontStyle.Bold);
                    var rowFont = family.CreateFont(14, FontStyle.Regular);

                    // Title
                    ctx.DrawText($"Upcoming Interest Accruals", titleFont, Color.White, new PointF(20, 15));
                    ctx.DrawText($"{referenceDate:MMMM dd, yyyy}", rowFont, Color.LightGray, new PointF(20, 45));

                    // Column Setup
                    float[] colX = { 20, 100, 200, 270 };
                    string[] headers = { "Days", "Date", "Mat", "Client" };

                    // Sub-header bg
                    ctx.Fill(Color.FromRgb(52, 73, 94), new RectangleF(0, headerHeight - 35, width, 35));
                    for (int i = 0; i < headers.Length; i++)
                    {
                        ctx.DrawText(headers[i], headerFont, Color.White, new PointF(colX[i], headerHeight - 30));
                    }

                    // Draw Rows
                    for (int i = 0; i < summaryList.Count; i++)
                    {
                        int y = headerHeight + (i * rowHeight);
                        var parts = summaryList[i].Split('|');

                        // Alternating background
                        if (i % 2 != 0)
                        {
                            ctx.Fill(Color.GhostWhite, new RectangleF(0, y, width, rowHeight));
                        }

                        // Row Border
                        ctx.DrawLine(Color.LightGray, 1, new PointF(0, y + rowHeight), new PointF(width, y + rowHeight));

                        for (int j = 0; j < parts.Length; j++)
                        {
                            if (j < parts.Length)
                                ctx.DrawText(parts[j], rowFont, Color.Black, new PointF(colX[j], y + 10));
                        }
                    }
                });

                using (var ms = new MemoryStream())
                {
                    image.SaveAsPng(ms);
                    return ms.ToArray();
                }
            }
        }
    }
}
