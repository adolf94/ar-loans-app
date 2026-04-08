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
    public class InterestNotificationFunction
    {
        private readonly ILoanRepo _loanRepo;
        private readonly IUserRepo _userRepo;
        private readonly TelegramService _telegramService;
        private readonly AppConfig _appConfig;
        private readonly ILogger _logger;

        public InterestNotificationFunction(
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
            _logger = loggerFactory.CreateLogger<InterestNotificationFunction>();
        }

        [Function("InterestNotificationFunction")]
        public async Task Run([TimerTrigger("0 0 2 * * *", RunOnStartup = true)] TimerInfo myTimer)
        {
            _logger.LogInformation($"InterestNotificationFunction executed at: {DateTime.Now}");

            // UTC+8 Reference Date
            DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);
            var refDateOnly = DateOnly.FromDateTime(referenceDateUTC8);

            // Summary of Upcoming Accruals and User Reminders
            try
            {
                var activeLoans = await _loanRepo.GetActiveLoans();
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

                        // Direct Notification to Client (3 days and 0 days)
                        if (client != null && !string.IsNullOrWhiteSpace(client.TelegramId) && (daysRemaining == 0 || daysRemaining == 3))
                        {
                            try
                            {
                                // Simple prediction of interest
                                decimal balance = Math.Max(loan.Balance, 0);
                                decimal originalPrincipal = loan.Principal;
                                decimal remainingPrincipal = Math.Min(balance, originalPrincipal);
                                decimal totalInterestAccruedSoFar = Math.Max(0, balance - originalPrincipal);
                                decimal interestFactor = loan.InterestBase switch
                                {
                                    "principalBalance" => Math.Max(remainingPrincipal, (remainingPrincipal + totalInterestAccruedSoFar) / 2m),
                                    "balance" => Math.Min(originalPrincipal, balance),
                                    "principal" => originalPrincipal,
                                    _ => originalPrincipal
                                };

                                decimal rateToUse = isGrace ? loan.GracePeriodInterest : loan.InterestRate;
                                decimal upcomingInterest = interestFactor * (rateToUse / 100M);
                                decimal newBalance = balance + upcomingInterest;

                                int graceDaysForPeriod = (loan.RecurringGracePeriod || loan.NextInterestDate == loan.Date) ? loan.GracePeriodDays : 0;
                                DateTime penaltyDeadline = loan.NextInterestDate.AddDays(graceDaysForPeriod).ToDateTime(new TimeOnly(8, 0));

                                var userMessage = new StringBuilder();
                                userMessage.AppendLine(daysRemaining == 0 ? "🔔 *Account Reminder - Today*" : "📅 *Account Reminder*");
                                userMessage.AppendLine($"Loan ID: {loan.AlternateId}");
                                userMessage.AppendLine($"Billing Date: {loan.NextInterestDate:MMM dd, yyyy}");
                                userMessage.AppendLine();

                                if (graceDaysForPeriod > 0)
                                {
                                    userMessage.AppendLine("🛡️ *Grace Period Reminder*");
                                    userMessage.AppendLine($"Your {graceDaysForPeriod}-day grace period for this billing cycle is active.");
                                    userMessage.AppendLine($"Please settle your amount on or before *{penaltyDeadline:MMM dd, yyyy}* to maintain your current low rate.");
                                }

                                if (isGrace && !loan.RecurringGracePeriod)
                                {
                                    userMessage.AppendLine();
                                    userMessage.AppendLine($"⚠️ *One-time Perk*: After this cycle, the regular interest rate of *{loan.InterestRate:N2}%* will apply.");
                                }

                                if (graceDaysForPeriod > 0)
                                {
                                    userMessage.AppendLine();
                                    userMessage.AppendLine($"*Projected Grace Rate*: {rateToUse:N2}%");
                                    userMessage.AppendLine($"*Projected Charge*: {upcomingInterest:N2}");
                                    userMessage.AppendLine($"*Estimated Balance*: {newBalance:N2}");
                                    userMessage.AppendLine();
                                }
                                else
                                {
                                    userMessage.AppendLine();
                                    userMessage.AppendLine($"*Projected Interest Rate*: {rateToUse:N2}%");
                                    userMessage.AppendLine($"*Projected Charge*: {upcomingInterest:N2}");
                                    userMessage.AppendLine($"*Estimated Balance*: {newBalance:N2}");
                                    userMessage.AppendLine();
                                }
                                
                                if (loan.LatePaymentPenalty > 0 || loan.InterestRate > rateToUse)
                                {
                                    // Calculate penalty-based projection
                                    decimal penaltyRate = loan.InterestRate;
                                    decimal penaltyCharge = interestFactor * (penaltyRate / 100M);
                                    decimal latePenaltyAmount = balance * (loan.LatePaymentPenalty / 100M); 
                                    decimal penaltyBalance = balance + penaltyCharge + latePenaltyAmount;

                                    StringBuilder penaltyMsg = new StringBuilder();
                                    penaltyMsg.Append($"🚨 *Penalty Warning*: If unpaid by the deadline of *{penaltyDeadline:MMM dd}*, ");
                                    
                                    List<string> consequences = new List<string>();
                                    if (loan.InterestRate > rateToUse) consequences.Add($"the interest rate will hike to **{loan.InterestRate:N1}%**");
                                    if (loan.LatePaymentPenalty > 0) consequences.Add($"an additional **{loan.LatePaymentPenalty:N1}%** penalty will be applied to the late amount");
                                    
                                    penaltyMsg.Append(string.Join(" and ", consequences));
                                    penaltyMsg.Append($". This will result in a total balance of **{penaltyBalance:N2}**.");
                                    
                                    userMessage.AppendLine(penaltyMsg.ToString());
                                    userMessage.AppendLine();
                                }
                                
                                userMessage.AppendLine($"_Please pay before {loan.NextInterestDate:MMM dd} to prevent any accruals._");

                                await _telegramService.SendMessageAsync(client.TelegramId, userMessage.ToString());
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError($"Failed to send notification to user {client.Id} for loan {loan.Id}: {ex.Message}");
                            }
                        }
                    }
                }

                if (summaryList.Any())
                {
                    byte[]? imageBytes = null;
                    try
                    {
                        // Generate Image using ImageSharp (Cross-platform)
                        imageBytes = DrawInterestSummaryTable(summaryList, referenceDateUTC8);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Failed to generate interest summary image: {ex.Message}. Falling back to text summary.");
                    }

                    if (imageBytes != null)
                    {
                        await _telegramService.SendPhotoAsync(
                            _appConfig.Telegram.GuarantorChannel, 
                            imageBytes,
                            $"InterestSummary_{referenceDateUTC8:yyyyMMdd}.png",
                            $"⏳ *Upcoming Interest Accruals Summary* - {referenceDateUTC8:MMM dd, yyyy}");
                    }
                    else
                    {
                        // Fallback to text message
                        var sb = new StringBuilder();
                        sb.AppendLine($"⏳ *Upcoming Interest Accruals Summary*");
                        sb.AppendLine($"{referenceDateUTC8:MMM dd, yyyy}");
                        sb.AppendLine();
                        sb.AppendLine("`Days | Date   | M | Client` ");
                        sb.AppendLine("`--------------------------` ");
                        foreach (var item in summaryList)
                        {
                            var parts = item.Split('|');
                            // Ensure parts length to avoid IndexOutOfRangeException
                            if (parts.Length >= 4)
                            {
                                sb.AppendLine($"`{parts[0],4} | {parts[1],6} | {parts[2]} | {parts[3]}`");
                            }
                        }
                        await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, sb.ToString());
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error generating interest summary: {ex.Message}");
                await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorGroupChat, $"Error generating interest summary: {ex.Message}");
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

                    // Font selection: Prefer bundled font, fallback to system fonts
                    var fontCollection = new FontCollection();
                    FontFamily family = default;
                    
                    string fontPath = Path.Combine(AppContext.BaseDirectory, "Fonts", "Roboto.ttf");
                    if (File.Exists(fontPath))
                    {
                        try
                        {
                            family = fontCollection.Add(fontPath);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning($"Failed to load bundled font: {ex.Message}");
                        }
                    }

                    if (string.IsNullOrEmpty(family.Name))
                    {
                        family = SystemFonts.Families.FirstOrDefault(f => f.Name == "Arial");
                        if (string.IsNullOrEmpty(family.Name) && SystemFonts.Families.Any())
                        {
                            family = SystemFonts.Families.First();
                        }
                    }

                    if (string.IsNullOrEmpty(family.Name))
                    {
                        throw new InvalidOperationException("No fonts found on the system or in the bundled assets.");
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
