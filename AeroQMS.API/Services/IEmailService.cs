using AeroQMS.API.Models;

namespace AeroQMS.API.Services
{
    public interface IEmailService
    {
        Task SendNewCAPAEmail(CapaAction capa);
        Task SendDueDateReminderEmail(CapaAction capa, int daysUntilDue);
        Task SendOverdueEmail(CapaAction capa, int daysOverdue);
        Task SendStatusChangeEmail(CapaAction capa, string oldStatus, string newStatus);
        Task SendVerificationRequestEmail(CapaAction capa);
        Task SendVerifiedEmail(CapaAction capa);
        Task SendMentionEmail(CapaComment comment, string mentionedUser, CapaAction capa);
        Task SendDocumentApprovalActionRequiredEmail(Document document, User approver, string stepName);
        Task SendDocumentAcknowledgmentRequiredEmail(Document document, User user, DateTime? dueDate, IReadOnlyList<string> keyChanges, string? linkUrl);
        Task SendDocumentReviewNotificationEmail(Document document, User user, int daysUntilDue, string templateName, string? linkUrl);
        Task SendWeeklyReviewSummaryEmail(User manager, int dueSoonCount, int overdueCount, string? linkUrl);
    }
}
