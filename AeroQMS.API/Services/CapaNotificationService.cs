using AeroQMS.API.Data;
using AeroQMS.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AeroQMS.API.Services
{
    public class CapaNotificationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<CapaNotificationService> _logger;

        public CapaNotificationService(IServiceProvider serviceProvider, ILogger<CapaNotificationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("CAPA Notification Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                // Run daily at 9:00 AM (for this demo, we run every hour to be more visible, 
                // but usually you'd check the current time)
                var now = DateTime.UtcNow;
                
                // For demonstration, we'll run every 1 minute in this environment if we wanted to see logs,
                // but let's stick to a reasonable interval like 1 hour.
                _logger.LogInformation($"Checking for CAPA reminders at: {now}");

                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                    try
                    {
                        await SendDueReminders(context, emailService);
                        await SendOverdueAlerts(context, emailService);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not send CAPA notifications - database tables may not be initialized yet.");
                    }
                }

                // Wait for 1 hour before next check
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }

        private async Task SendDueReminders(AppDbContext context, IEmailService emailService)
        {
            try
            {
                var now = DateTime.UtcNow.Date;
                var targetDates = new[] { 7, 3, 1 };

                foreach (var days in targetDates)
                {
                    var targetDate = now.AddDays(days);
                    var actions = await context.CapaActions
                        .Where(a => a.Status != "closed" && a.Status != "verified" && a.DueDate.Date == targetDate)
                        .ToListAsync();

                    foreach (var action in actions)
                    {
                        await emailService.SendDueDateReminderEmail(action, days);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error sending due reminders");
            }
        }

        private async Task SendOverdueAlerts(AppDbContext context, IEmailService emailService)
        {
            try
            {
                var now = DateTime.UtcNow.Date;
                var overdueActions = await context.CapaActions
                    .Where(a => a.Status != "closed" && a.Status != "verified" && a.DueDate.Date < now)
                    .ToListAsync();

                foreach (var action in overdueActions)
                {
                    var daysOverdue = (now - action.DueDate.Date).Days;
                    await emailService.SendOverdueEmail(action, daysOverdue);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error sending overdue alerts");
            }
        }
    }

    public class ReviewAutomationNotificationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ReviewAutomationNotificationService> _logger;
        private DateTime? _lastDailyRunUtcDate;
        private DateTime? _lastWeeklyRunUtcDate;

        public ReviewAutomationNotificationService(IServiceProvider serviceProvider, ILogger<ReviewAutomationNotificationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.UtcNow;
                var today = now.Date;

                var shouldDaily = now.Hour >= 8 && _lastDailyRunUtcDate != today;
                var shouldWeekly = now.DayOfWeek == DayOfWeek.Monday && now.Hour >= 9 && _lastWeeklyRunUtcDate != today;

                if (shouldDaily || shouldWeekly)
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                    try
                    {
                        var baseUrl = "http://localhost:5149";
                        var linkUrl = $"{baseUrl}/my-reviews";

                        var settings = await context.ReviewAutomationSettings.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(stoppingToken);
                        var notifRules = ParseNotificationRules(settings?.NotificationRulesJson);

                        if (shouldDaily)
                        {
                            await RunDailyAsync(context, emailService, notifRules, linkUrl, stoppingToken);
                            _lastDailyRunUtcDate = today;
                        }

                        if (shouldWeekly)
                        {
                            await RunWeeklyAsync(context, emailService, notifRules, linkUrl, stoppingToken);
                            _lastWeeklyRunUtcDate = today;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not send review automation notifications.");
                    }
                }

                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }

        private sealed record NotificationRule(string Trigger, List<string> Recipients, string Template);

        private static List<NotificationRule> ParseNotificationRules(string? json)
        {
            var raw = string.IsNullOrWhiteSpace(json) ? "[]" : json;
            try
            {
                using var doc = JsonDocument.Parse(raw);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return DefaultNotificationRules();
                var list = new List<NotificationRule>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.ValueKind != JsonValueKind.Object) continue;
                    var trigger = el.TryGetProperty("trigger", out var t) && t.ValueKind == JsonValueKind.String ? (t.GetString() ?? "").Trim() : "";
                    var template = el.TryGetProperty("template", out var tpl) && tpl.ValueKind == JsonValueKind.String ? (tpl.GetString() ?? "").Trim() : "Review Reminder";
                    var recipients = new List<string>();
                    if (el.TryGetProperty("recipients", out var r) && r.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var rr in r.EnumerateArray())
                        {
                            if (rr.ValueKind == JsonValueKind.String)
                            {
                                var v = (rr.GetString() ?? "").Trim();
                                if (!string.IsNullOrWhiteSpace(v)) recipients.Add(v);
                            }
                        }
                    }
                    if (string.IsNullOrWhiteSpace(trigger)) continue;
                    if (recipients.Count == 0) recipients.Add("Document Owner");
                    list.Add(new NotificationRule(trigger, recipients, string.IsNullOrWhiteSpace(template) ? "Review Reminder" : template));
                }
                return list.Count == 0 ? DefaultNotificationRules() : list;
            }
            catch
            {
                return DefaultNotificationRules();
            }
        }

        private static List<NotificationRule> DefaultNotificationRules() => new()
        {
            new NotificationRule("60", new List<string> { "Document Owner" }, "Review Reminder"),
            new NotificationRule("30", new List<string> { "Document Owner" }, "Review Reminder"),
            new NotificationRule("7", new List<string> { "Document Owner" }, "Urgent Review Required"),
            new NotificationRule("0", new List<string> { "Document Owner", "Quality Manager" }, "Document Expired Alert"),
            new NotificationRule("overdue_weekly", new List<string> { "Quality Manager" }, "Document Expired Alert")
        };

        private static string NormalizeRoleKey(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            return role.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static IEnumerable<User> ResolveRecipients(Document doc, IEnumerable<User> users, IEnumerable<string> recipientRoles)
        {
            var resolved = new List<User>();
            foreach (var role in recipientRoles)
            {
                var r = (role ?? "").Trim();
                if (string.IsNullOrWhiteSpace(r)) continue;
                if (r.Equals("Document Owner", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(doc.Owner)) continue;
                    resolved.AddRange(users.Where(u => !string.IsNullOrWhiteSpace(u.Name) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)));
                    continue;
                }

                var key = NormalizeRoleKey(r);
                resolved.AddRange(users.Where(u => NormalizeRoleKey(u.Role) == key));
            }
            return resolved
                .Where(u => u.IsActive)
                .GroupBy(u => u.Id)
                .Select(g => g.First());
        }

        private static int DueInDaysUtc(Document doc, DateTime utcToday)
        {
            return (doc.ReviewDate.Date - utcToday).Days;
        }

        private async Task RunDailyAsync(AppDbContext context, IEmailService emailService, List<NotificationRule> rules, string linkUrl, CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;
            var users = await context.Users.Where(u => u.IsActive).ToListAsync(ct);
            var triggers = new[] { 60, 30, 7, 0 };

            foreach (var days in triggers)
            {
                var target = today.AddDays(days);
                var docs = await context.Documents.Where(d => d.ReviewDate.Date == target).ToListAsync(ct);
                var matchingRules = rules.Where(r => r.Trigger == days.ToString()).ToList();
                if (matchingRules.Count == 0) continue;

                foreach (var doc in docs)
                {
                    foreach (var rule in matchingRules)
                    {
                        var recipients = ResolveRecipients(doc, users, rule.Recipients);
                        foreach (var u in recipients)
                        {
                            await emailService.SendDocumentReviewNotificationEmail(doc, u, days, rule.Template, linkUrl);
                        }
                    }
                }
            }
        }

        private async Task RunWeeklyAsync(AppDbContext context, IEmailService emailService, List<NotificationRule> rules, string linkUrl, CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;
            var users = await context.Users.Where(u => u.IsActive).ToListAsync(ct);

            var overdueDocs = await context.Documents.Where(d => d.ReviewDate.Date < today).ToListAsync(ct);
            var overdueRule = rules.FirstOrDefault(r => r.Trigger == "overdue_weekly");
            if (overdueRule != null)
            {
                foreach (var doc in overdueDocs)
                {
                    var dueIn = DueInDaysUtc(doc, today);
                    var recipients = ResolveRecipients(doc, users, overdueRule.Recipients);
                    foreach (var u in recipients)
                    {
                        await emailService.SendDocumentReviewNotificationEmail(doc, u, dueIn, overdueRule.Template, linkUrl);
                    }
                }
            }

            var dueSoonCount = await context.Documents.CountAsync(d => d.ReviewDate.Date >= today && d.ReviewDate.Date <= today.AddDays(7), ct);
            var overdueCount = overdueDocs.Count;

            var qualityManagers = users.Where(u => NormalizeRoleKey(u.Role) == "quality_manager").ToList();
            foreach (var qm in qualityManagers)
            {
                await emailService.SendWeeklyReviewSummaryEmail(qm, dueSoonCount, overdueCount, linkUrl);
            }
        }
    }
}
