using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Ar.Loans.Api.Data.Cosmos;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Ar.Loans.Api.Services
{
    public class TelegramWorkflowService
    {
        private readonly TelegramService _telegramService;
        private readonly IConversationStateRepo _stateRepo;
        private readonly IAiService _aiService;
        private readonly IUserRepo _userRepo;
        private readonly ILoanRepo _loanRepo;
        private readonly IBankAccountRepo _bankAccountRepo;
        private readonly IInterestRuleRepo _interestRuleRepo;
        private readonly LoanService _loanService;
        private readonly ILogger<TelegramWorkflowService> _logger;
        private readonly LogService _logService;

        public TelegramWorkflowService(
            TelegramService telegramService,
            IConversationStateRepo stateRepo,
            IAiService aiService,
            IUserRepo userRepo,
            ILoanRepo loanRepo,
            IBankAccountRepo bankAccountRepo,
            IInterestRuleRepo interestRuleRepo,
            LoanService loanService,
            ILogger<TelegramWorkflowService> logger,
            LogService logService)
        {
            _telegramService = telegramService;
            _stateRepo = stateRepo;
            _aiService = aiService;
            _userRepo = userRepo;
            _loanRepo = loanRepo;
            _bankAccountRepo = bankAccountRepo;
            _interestRuleRepo = interestRuleRepo;
            _loanService = loanService;
            _logger = logger;
            _logService = logService;
        }

        public async Task HandleUpdateAsync(Update update)
        {
            if (update.Message != null)
            {
                await HandleMessageAsync(update.Message);
            }
            else if (update.CallbackQuery != null)
            {
                await HandleCallbackQueryAsync(update.CallbackQuery);
            }
        }

        private async Task HandleMessageAsync(Message message)
        {
            var chatId = message.Chat.Id.ToString();
            var telegramId = message.From?.Id.ToString();

            if (string.IsNullOrEmpty(telegramId)) return;

            // 1. Auth Check - Ensure user exists in our system with this TelegramId
            var users = await _userRepo.GetAllUsers();
            var systemUser = users.FirstOrDefault(u => u.TelegramId == telegramId);
            
            if (systemUser == null)
            {
                var linkUrl = $"https://coop.adolfrey.com/link-telegram?tgId={telegramId}";
                var linkMessage = "❌ *Access Denied*\n\nYour Telegram account is not linked to any user in our system.\n\n" +
                                 $"Please [click here to link your account]({linkUrl}) by logging in to the portal.";
                
                await _telegramService.BotClient.SendMessage(
                    chatId: chatId,
                    text: linkMessage,
                    parseMode: ParseMode.Markdown
                );
                return;
            }

            var text = message.Text?.Trim();
            var photo = message.Photo?.LastOrDefault();
            var state = await _stateRepo.GetStateAsync(chatId) ?? new ConversationState { Id = chatId };

            // 2. Command Trigger
            if (text != null && text.StartsWith("/addloan"))
            {
                state.Workflow = "AddLoan";
                state.Step = "AwaitingImage";
                state.Buffer = null;
                await _stateRepo.UpsertStateAsync(state);
                await _telegramService.SendMessageAsync(chatId, "🏦 *Add Loan Workflow Started*\nPlease upload a screenshot of the transaction or loan documentation.");
                return;
            }

            // 3. State Processing
            if (state.Workflow == "AddLoan")
            {
                if (state.Step == "AwaitingImage")
                {
                    if (photo != null)
                    {
                        await ProcessLoanPhotoAsync(chatId, photo, state);
                    }
                    else
                    {
                        await _telegramService.SendMessageAsync(chatId, "⚠️ Please upload a photo/screenshot to proceed with the loan creation.");
                    }
                }
                else if (state.Step == "AwaitingFieldUpdate")
                {
                    // Handle manual editing of fields (future enhancement)
                    await _telegramService.SendMessageAsync(chatId, "Feature coming soon. Please use [Confirm] or [Cancel] for now.");
                }
            }
            else if (photo != null && state.Workflow == "None")
            {
                // Photo First Flow
                state.Workflow = "Unknown";
                state.Step = "AwaitingCommand";
                state.Buffer = JsonSerializer.Serialize(new { FileId = photo.FileId });
                await _stateRepo.UpsertStateAsync(state);
                
                var keyboard = new InlineKeyboardMarkup(new[]
                {
                    new [] { InlineKeyboardButton.WithCallbackData("➕ Add Loan", "cmd:addloan") },
                    new [] { InlineKeyboardButton.WithCallbackData("❌ Cancel", "cmd:cancel") }
                });

                await _telegramService.BotClient.SendMessage(
                    chatId: chatId,
                    text: "📷 I've received your photo! What would you like to do with it?",
                    replyMarkup: keyboard
                );
            }
        }

        private async Task ProcessLoanPhotoAsync(string chatId, PhotoSize photo, ConversationState state)
        {
            await _telegramService.SendMessageAsync(chatId, "🔍 *Processing image...* Please wait while Gemini analyzes the document.");

            try
            {
                // Download file
                var file = await _telegramService.BotClient.GetFile(photo.FileId);
                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.jpg");
                
                using (var saveImageStream = System.IO.File.Create(tempPath))
                {
                    await _telegramService.BotClient.DownloadFile(file.FilePath!, saveImageStream);
                }

                // Call AI
                var extractedData = await _aiService.IdentifyTransactionData(tempPath);
                
                // Cleanup
                if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath);

                if (extractedData == null)
                {
                    await _telegramService.SendMessageAsync(chatId, "❌ AI failed to extract data. Please try another photo or enter details manually.");
                    return;
                }

                // Try to identify the client via bank account matching
                var bankAcct = await _bankAccountRepo.GetByAccountId(extractedData.recipientAcct);
                string clientInfo = "❓ *Client Not Found*";
                Guid? clientId = null;
                InterestRule? rule = null;

                if (bankAcct != null)
                {
                    var client = await _userRepo.GetUser(bankAcct.UserId);
                    if (client != null)
                    {
                        clientInfo = $"👤 *Client:* {client.Name}";
                        clientId = client.Id;
                        
                        // Fetch interest rule defaults
                        if (client.DefaultInterestRuleId != null)
                        {
                            rule = await _interestRuleRepo.GetRuleById(client.DefaultInterestRuleId.Value);
                        }
                    }
                }

                // Fallback to system default if no user-specific rule found yet
                if (rule == null)
                {
                    rule = await _interestRuleRepo.GetRuleById(new Guid("019cbbab-e1dd-7e68-b501-f2962425d11d"));
                }

                // Determine Source Account from senderAcct
                var sourceBankAcct = await _bankAccountRepo.GetByAccountId(extractedData.senderAcct);
                Guid sourceAcctId = sourceBankAcct?.AccountId ?? AccountConstants.ArGoTyme;
                string sourceAcctName = AccountConstants.GetName(sourceAcctId);

                state.Step = "VerifyingData";
                // Store clientId in buffer if found
                var bufferData = new { Extracted = extractedData, ClientId = clientId };
                state.Buffer = JsonSerializer.Serialize(bufferData);
                await _stateRepo.UpsertStateAsync(state);

                var sb = new StringBuilder();
                sb.AppendLine("📋 *Verify Loan Details:*");
                sb.AppendLine(clientInfo);
                sb.AppendLine($"• *Date:* {extractedData.datetime}");
                sb.AppendLine($"• *Principal:* {extractedData.amount:N2}");
                sb.AppendLine($"• *Interest Rule:* {rule?.Name ?? "Default"}");
                sb.AppendLine($"• *Rate:* {rule?.InterestPerMonth ?? 10}%");
                sb.AppendLine($"• *Source Acct:* {sourceAcctName}");
                sb.AppendLine($"\n_Extract Data Info:_");
                sb.AppendLine($"• *Recipient Acct:* {extractedData.recipientAcct}");
                sb.AppendLine($"• *Ref:* {extractedData.reference}");
                
                if (clientId == null)
                {
                    sb.AppendLine("\n⚠️ _Could not auto-match recipient account. Please ensure the client is registered or use Manual Entry._");
                }

                sb.AppendLine("\nDoes this look correct?");

                var keyboard = new InlineKeyboardMarkup(new[]
                {
                    new [] { InlineKeyboardButton.WithCallbackData("✅ Confirm & Save", "loan:confirm") },
                    new [] { InlineKeyboardButton.WithUrl("📝 Manual Entry", "https://coop.adolfrey.com") },
                    new [] { InlineKeyboardButton.WithCallbackData("❌ Cancel", "cmd:cancel") }
                });

                await _telegramService.BotClient.SendMessage(
                    chatId: chatId,
                    text: sb.ToString(),
                    parseMode: ParseMode.Markdown,
                    replyMarkup: keyboard
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing loan photo for chat {ChatId}", chatId);
                await _telegramService.SendMessageAsync(chatId, "❌ An error occurred while processing the image. Please try again.");
            }
        }

        private async Task HandleCallbackQueryAsync(CallbackQuery callbackQuery)
        {
            var chatId = callbackQuery.Message!.Chat.Id.ToString();
            var data = callbackQuery.Data;
            var state = await _stateRepo.GetStateAsync(chatId);

            if (state == null) return;

            if (data == "cmd:cancel")
            {
                await _stateRepo.DeleteStateAsync(chatId);
                await _telegramService.BotClient.AnswerCallbackQuery(callbackQuery.Id, "Workflow cancelled.");
                await _telegramService.SendMessageAsync(chatId, "🚫 Workflow cancelled.");
                return;
            }

            if (data == "cmd:addloan" && state.Step == "AwaitingCommand")
            {
                var buffer = JsonSerializer.Deserialize<JsonElement>(state.Buffer!);
                var fileId = buffer.GetProperty("FileId").GetString()!;
                
                state.Workflow = "AddLoan";
                state.Step = "ExtractingData";
                await _stateRepo.UpsertStateAsync(state);
                
                await _telegramService.BotClient.AnswerCallbackQuery(callbackQuery.Id, "Starting Add Loan workflow...");
                await ProcessLoanPhotoAsync(chatId, new PhotoSize { FileId = fileId }, state);
                return;
            }

            if (data == "loan:confirm" && state.Step == "VerifyingData")
            {
                var buffer = JsonSerializer.Deserialize<JsonElement>(state.Buffer!);
                var fileData = JsonSerializer.Deserialize<FileData>(buffer.GetProperty("Extracted").GetRawText());
                Guid? clientId = null;
                if (buffer.TryGetProperty("ClientId", out var clientIdProp) && clientIdProp.ValueKind != JsonValueKind.Null)
                {
                    clientId = clientIdProp.GetGuid();
                }

                if (clientId == null)
                {
                    await _telegramService.BotClient.AnswerCallbackQuery(callbackQuery.Id, "❌ Cannot confirm: Client not identified.");
                    await _telegramService.SendMessageAsync(chatId, "❌ Cannot save loan without an identified client. Please use Manual Entry or register the client's bank account.");
                    return;
                }

                // Get Guarantor
                var telegramId = callbackQuery.From.Id.ToString();
                var guarantor = (await _userRepo.GetAllUsers()).FirstOrDefault(u => u.TelegramId == telegramId);

                await SaveLoanAsync(chatId, fileData!, clientId.Value, guarantor?.Id);
                await _stateRepo.DeleteStateAsync(chatId);
                await _telegramService.BotClient.AnswerCallbackQuery(callbackQuery.Id, "Loan saved successfully!");
            }
        }

        private async Task SaveLoanAsync(string chatId, FileData data, Guid clientId, Guid? guarantorId)
        {
            try
            {
                DateTime parsedDate;
                if (!DateTime.TryParse(data.datetime, out parsedDate))
                {
                    parsedDate = DateTime.UtcNow.AddHours(8);
                }

                // Fetch client and interest rule defaults
                var client = await _userRepo.GetUser(clientId);
                InterestRule? rule = null;
                if (client?.DefaultInterestRuleId != null)
                {
                    rule = await _interestRuleRepo.GetRuleById(client.DefaultInterestRuleId.Value);
                }
                
                // Fallback to system default if no user-specific rule
                if (rule == null)
                {
                    rule = await _interestRuleRepo.GetRuleById(new Guid("019cbbab-e1dd-7e68-b501-f2962425d11d"));
                }

                // Determine Source Account from senderAcct
                var sourceBankAcct = await _bankAccountRepo.GetByAccountId(data.senderAcct);
                Guid sourceAcct = sourceBankAcct?.AccountId ?? AccountConstants.ArGoTyme;

                var loan = new Loan
                {
                    Id = Guid.CreateVersion7(),
                    ClientId = clientId,
                    GuarantorId = guarantorId,
                    Principal = data.amount,
                    InterestRate = rule?.InterestPerMonth ?? 10,
                    GracePeriodDays = rule?.GracePeriodDays ?? 0,
                    GracePeriodInterest = rule?.GracePeriodInterest ?? 0,
                    LatePaymentPenalty = rule?.LatePaymentPenalty ?? 0,
                    InterestBase = rule?.InterestBase ?? "principal",
                    TermMonths = rule?.DefaultTerms ?? 0,
                    RecurringGracePeriod = rule?.RecurringGracePeriod ?? false,
                    Date = DateOnly.FromDateTime(parsedDate),
                    SourceAcct = sourceAcct,
                    Status = "Active",
                    PartitionKey = "default",
                    FileId = data.reference // Use reference as a temporary link or metadata
                };

                var result = await _loanService.CreateLoanWithNotificationsAsync(loan);
                // Success message is handled by the service (in terms of channel & direct notifications)
                // But we can add a brief confirmation to the current chat if it's not already notified.
                // Actually, the service sends back to the channel. Let's send a quick confirm here.
                
                await _telegramService.SendMessageAsync(chatId, $"✅ *Loan Created:* {loan.Principal:N2} (Ref: {loan.AlternateId})");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving loan for chat {ChatId}", chatId);
                await _telegramService.SendMessageAsync(chatId, "❌ Failed to save loan record. Please try manual entry.");
            }
        }
    }
}
