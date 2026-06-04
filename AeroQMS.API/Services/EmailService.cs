using AeroQMS.API.Models;
using System.Text;

namespace AeroQMS.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly ILogger<EmailService> _logger;
        private readonly string _logPath;

        public EmailService(ILogger<EmailService> logger, IWebHostEnvironment env)
        {
            _logger = logger;
            _logPath = Path.Combine(env.ContentRootPath, "Logs", "Emails");
            if (!Directory.Exists(_logPath)) Directory.CreateDirectory(_logPath);
        }

        private async Task SendEmail(string to, string subject, string body)
        {
            // In a real app, use SmtpClient or a service like SendGrid
            // For this project, we log to a file and console
            var fileName = $"Email_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString().Substring(0, 8)}.html";
            var filePath = Path.Combine(_logPath, fileName);

            var content = new StringBuilder();
            content.AppendLine($"To: {to}");
            content.AppendLine($"Subject: {subject}");
            content.AppendLine("<hr/>");
            content.AppendLine(body);

            await File.WriteAllTextAsync(filePath, content.ToString());
            _logger.LogInformation($"[EMAIL SENT] To: {to}, Subject: {subject}. Log: {filePath}");
        }

        public async Task SendNewCAPAEmail(CapaAction capa)
        {
            var subject = $"New Action Assigned: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>You've been assigned a new {capa.ActionType} action</h2>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                        <p><strong>Priority:</strong> {capa.Priority}</p>
                        <p><strong>Due Date:</strong> {capa.DueDate:yyyy-MM-dd}</p>
                        <p><strong>Assigned Date:</strong> {capa.AssignedDate:yyyy-MM-dd}</p>
                    </div>
                    <p>{capa.Description}</p>
                    <a href='#' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>View Action</a>
                    <p style='color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;'>
                        This is an automated notification from your QMS Platform.
                    </p>
                </div>";

            await SendEmail(capa.ResponsiblePersonEmail, subject, body);
        }

        public async Task SendDueDateReminderEmail(CapaAction capa, int daysUntilDue)
        {
            var timeText = daysUntilDue == 1 ? "Tomorrow" : $"in {daysUntilDue} days";
            var subject = $"Action Due {timeText}: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>⏰ Reminder: Action Due Soon</h2>
                    <p>This action is due <strong>{timeText}</strong>.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                        <p><strong>Status:</strong> {capa.Status}</p>
                        <p><strong>Due Date:</strong> {capa.DueDate:yyyy-MM-dd}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>Update Status</a>
                </div>";

            await SendEmail(capa.ResponsiblePersonEmail, subject, body);
        }

        public async Task SendOverdueEmail(CapaAction capa, int daysOverdue)
        {
            var subject = $"⚠️ Overdue Action: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2 style='color: #ef4444;'>⚠️ This action is {daysOverdue} days overdue</h2>
                    <p>This action requires immediate attention.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                        <p><strong>Due Date:</strong> {capa.DueDate:yyyy-MM-dd} ({daysOverdue} days ago)</p>
                        <p><strong>Status:</strong> {capa.Status}</p>
                        <p><strong>Priority:</strong> {capa.Priority}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>Take Action Now</a>
                </div>";

            await SendEmail(capa.ResponsiblePersonEmail, subject, body);
        }

        public async Task SendStatusChangeEmail(CapaAction capa, string oldStatus, string newStatus)
        {
            var subject = $"Action Status Updated: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>Action Status Changed</h2>
                    <p><strong>{capa.ResponsiblePersonName}</strong> updated the status:</p>
                    <div style='text-align: center; font-size: 18px; margin: 20px 0;'>
                        <span style='display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #e5e7eb;'>{oldStatus}</span>
                        <span> → </span>
                        <span style='display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #3b82f6; color: white;'>{newStatus}</span>
                    </div>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>View Details</a>
                </div>";

            // In real app, we'd notify the person who assigned it or quality managers
            await SendEmail("admin@aeroqms.com", subject, body);
        }

        public async Task SendVerificationRequestEmail(CapaAction capa)
        {
            var subject = $"Action Ready for Verification: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>✓ Action Completed - Verification Needed</h2>
                    <p><strong>{capa.ResponsiblePersonName}</strong> has marked this action as completed and it's ready for verification.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                        <p><strong>Completed Date:</strong> {DateTime.UtcNow:yyyy-MM-dd}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>Verify Now</a>
                </div>";

            await SendEmail("manager@aeroqms.com", subject, body);
        }

        public async Task SendVerifiedEmail(CapaAction capa)
        {
            var subject = $"Action Verified: {capa.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>✓ Action Verified Successfully</h2>
                    <p>Your action has been verified.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Action:</strong> {capa.Title}</p>
                        <p><strong>Effectiveness:</strong> {capa.EffectivenessRating}</p>
                        <p><strong>Verification Notes:</strong> {capa.VerificationNotes}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>View Details</a>
                    <p>Great job completing this action!</p>
                </div>";

            await SendEmail(capa.ResponsiblePersonEmail, subject, body);
        }

        public async Task SendMentionEmail(CapaComment comment, string mentionedUser, CapaAction capa)
        {
            var subject = $"{comment.UserName} mentioned you in a comment";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>{comment.UserName} mentioned you</h2>
                    <p><strong>In action:</strong> {capa.Title}</p>
                    <div style='background: #f9fafb; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0;'>
                        <p>{comment.Comment}</p>
                    </div>
                    <a href='#' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;'>View Comment</a>
                </div>";

            // In real app, look up mentionedUser's email
            await SendEmail($"{mentionedUser.ToLower()}@aeroqms.com", subject, body);
        }

        public async Task SendDocumentApprovalActionRequiredEmail(Document document, User approver, string stepName)
        {
            var subject = $"Action Required: Document Approval - {document.Title}";
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>Document Approval Needed</h2>
                    <p><strong>{approver.Name}</strong>, you have an approval step waiting.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                        <p><strong>Document:</strong> {document.DocumentNumber} — {document.Title}</p>
                        <p><strong>Revision:</strong> {document.Revision}</p>
                        <p><strong>Step:</strong> {stepName}</p>
                    </div>
                    <p style='color:#6b7280;font-size:12px;'>This is an automated notification from AeroQMS.</p>
                </div>";

            await SendEmail(approver.Email, subject, body);
        }

        public async Task SendDocumentAcknowledgmentRequiredEmail(Document document, User user, DateTime? dueDate, IReadOnlyList<string> keyChanges, string? linkUrl)
        {
            var subject = $"Action Required: Document Acknowledgment - {document.Title}";
            var dueText = dueDate.HasValue ? dueDate.Value.ToString("yyyy-MM-dd") : "-";
            var changes = keyChanges != null && keyChanges.Count > 0
                ? "<ul style='margin:10px 0; padding-left: 18px;'>" + string.Join("", keyChanges.Take(8).Select(c => $"<li>{System.Net.WebUtility.HtmlEncode(c)}</li>")) + "</ul>"
                : "<div style='color:#6b7280; font-size:12px;'>No change summary available.</div>";
            var link = string.IsNullOrWhiteSpace(linkUrl) ? "#" : linkUrl;

            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>Document Acknowledgment Needed</h2>
                    <p>Dear <strong>{user.Name}</strong>,</p>
                    <p>A new version of the following document requires your acknowledgment:</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 16px 0;'>
                        <p><strong>Document:</strong> {document.DocumentNumber} — {document.Title}</p>
                        <p><strong>Revision:</strong> {document.Revision}</p>
                        <p><strong>Effective Date:</strong> {document.EffectiveDate:yyyy-MM-dd}</p>
                        <p><strong>Due Date for Acknowledgment:</strong> {dueText}</p>
                    </div>
                    <div style='margin-top: 8px; font-weight:700;'>Key Changes</div>
                    {changes}
                    <a href='{link}' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; margin: 16px 0;'>View &amp; Acknowledge</a>
                    <p style='color:#6b7280;font-size:12px;'>This is an automated notification from AeroQMS.</p>
                </div>";

            await SendEmail(user.Email, subject, body);
        }

        public async Task SendDocumentReviewNotificationEmail(Document document, User user, int daysUntilDue, string templateName, string? linkUrl)
        {
            var template = string.IsNullOrWhiteSpace(templateName) ? "Review Reminder" : templateName.Trim();
            var subject = $"{template}: {document.DocumentNumber} — {document.Title}";

            var dueText = daysUntilDue < 0
                ? $"{Math.Abs(daysUntilDue)} day(s) overdue"
                : (daysUntilDue == 0 ? "Due today" : $"Due in {daysUntilDue} day(s)");

            var link = string.IsNullOrWhiteSpace(linkUrl) ? "#" : linkUrl;
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>Document Review Notification</h2>
                    <p>Dear <strong>{user.Name}</strong>,</p>
                    <p>This document requires review.</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 16px 0;'>
                        <p><strong>Document:</strong> {document.DocumentNumber} — {document.Title}</p>
                        <p><strong>Revision:</strong> {document.Revision}</p>
                        <p><strong>Review Date:</strong> {document.ReviewDate:yyyy-MM-dd}</p>
                        <p><strong>Status:</strong> {dueText}</p>
                    </div>
                    <a href='{link}' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; margin: 16px 0;'>Open Review Tasks</a>
                    <p style='color:#6b7280;font-size:12px;'>This is an automated notification from AeroQMS.</p>
                </div>";

            await SendEmail(user.Email, subject, body);
        }

        public async Task SendWeeklyReviewSummaryEmail(User manager, int dueSoonCount, int overdueCount, string? linkUrl)
        {
            var subject = "Weekly Review Summary";
            var link = string.IsNullOrWhiteSpace(linkUrl) ? "#" : linkUrl;
            var body = $@"
                <div style='font-family: sans-serif; max-width: 600px;'>
                    <h2>Weekly Review Summary</h2>
                    <p>Dear <strong>{manager.Name}</strong>,</p>
                    <div style='background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 16px 0;'>
                        <p><strong>Due within 7 days:</strong> {dueSoonCount}</p>
                        <p><strong>Overdue:</strong> {overdueCount}</p>
                    </div>
                    <a href='{link}' style='display: inline-block; background: #3b82f6; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; margin: 16px 0;'>Open Review Tasks</a>
                    <p style='color:#6b7280;font-size:12px;'>This is an automated notification from AeroQMS.</p>
                </div>";

            await SendEmail(manager.Email, subject, body);
        }
    }
}
