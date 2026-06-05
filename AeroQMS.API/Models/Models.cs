using System;
using System.Collections.Generic;

namespace AeroQMS.API.Models
{
    public class Audit
    {
        public int Id { get; set; }
        public string ReferenceNumber { get; set; }
        public string Title { get; set; }
        public string Type { get; set; } // Internal, External, Supplier
        public string Auditor { get; set; }
        public DateTime DueDate { get; set; }
        public string Status { get; set; } // In Progress, Overdue, Scheduled, Closed
        public int Findings { get; set; }
    }

    public class Document
    {
        public int Id { get; set; }
        public string DocumentNumber { get; set; }
        public string Title { get; set; }
        public string Category { get; set; }
        public string Department { get; set; }
        public string Revision { get; set; }
        public DateTime EffectiveDate { get; set; }
        public DateTime ReviewDate { get; set; }
        public string Status { get; set; } // Approved, Due for Review, Expired
        public string Owner { get; set; }
        public string? FileName { get; set; }
    }

    public class DocumentVersion
    {
        public Guid Id { get; set; }
        public int DocumentId { get; set; }
        public string DocumentNumber { get; set; }
        public string Title { get; set; }
        public string Category { get; set; }
        public string Department { get; set; }
        public string Revision { get; set; }
        public DateTime EffectiveDate { get; set; }
        public DateTime ReviewDate { get; set; }
        public string Status { get; set; }
        public string Owner { get; set; }
        public string? FileName { get; set; }
        public string? ExtractedText { get; set; }
        public string? ChangeSummary { get; set; }
        public string? ApprovalSnapshot { get; set; }
        public DateTime SnapshotAt { get; set; }
    }

    public class DocumentApprovalWorkflow
    {
        public Guid Id { get; set; }
        public int DocumentId { get; set; }
        public int StepNumber { get; set; }
        public string StepName { get; set; }
        public string? RequiredRole { get; set; }
        public int? RequiredUserId { get; set; }
        public string Status { get; set; }
        public string? Action { get; set; }
        public string? Comment { get; set; }
        public int? ActionedById { get; set; }
        public DateTime? ActionedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class DocumentAcknowledgment
    {
        public Guid Id { get; set; }
        public int DocumentId { get; set; }
        public Guid? VersionId { get; set; }
        public int UserId { get; set; }
        public string DocumentRevision { get; set; }
        public DateTime AcknowledgedAt { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
        public string? DeviceInfo { get; set; }
    }

    public class DocumentAcknowledgmentRequirement
    {
        public Guid Id { get; set; }
        public int DocumentId { get; set; }
        public string? RequiredRole { get; set; }
        public int? IndividualUserId { get; set; }
        public int DueDays { get; set; } = 7;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class ReviewAutomationSetting
    {
        public int Id { get; set; }
        public string CategoryRulesJson { get; set; } = "[]";
        public string NotificationRulesJson { get; set; } = "[]";
        public string EscalationRulesJson { get; set; } = "[]";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class DocumentAccessLog
    {
        public Guid Id { get; set; }
        public int DocumentId { get; set; }
        public Guid? VersionId { get; set; }
        public int? UserId { get; set; }
        public string? Source { get; set; }
        public string? DeviceInfo { get; set; }
        public string? IpAddress { get; set; }
        public DateTime AccessedAt { get; set; } = DateTime.UtcNow;
    }

    public class DocumentRelationship
    {
        public Guid Id { get; set; }
        public int SourceDocumentId { get; set; }
        public int? TargetDocumentId { get; set; }
        public int? TargetNcrId { get; set; }
        public Guid? TargetCapaId { get; set; }
        public string RelationshipType { get; set; }
        public string? Note { get; set; }
        public int? CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class NonConformance
    {
        public int Id { get; set; }
        public string NCRNumber { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string Area { get; set; }
        public string Category { get; set; }
        public string Severity { get; set; } // Critical, Major, Minor OR Matrix Value (e.g. 5E)
        public int LikelihoodScore { get; set; } // 1-5
        public int ConsequenceScore { get; set; } // 1-5
        public string RaisedBy { get; set; }
        public DateTime Date { get; set; }
        public string Status { get; set; } // Open, Investigation, Closed
        public string? FileName { get; set; }
    }

    public class Checklist
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string Inspector { get; set; }
        public DateTime Date { get; set; }
        public string Status { get; set; } // In Progress, Complete, Scheduled
        public List<ChecklistItem> Items { get; set; } = new();
    }

    public class ChecklistItem
    {
        public int Id { get; set; }
        public int ChecklistId { get; set; }
        public string Description { get; set; }
        public bool IsCompleted { get; set; }
    }

    public class TrainingRecord
    {
        public int Id { get; set; }
        public string StaffMember { get; set; }
        public string Course { get; set; }
        public string Category { get; set; }
        public DateTime CompletionDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        public string Status { get; set; } // Valid, Expiring, Expired
    }

    public class Risk
    {
        public int Id { get; set; }
        public string RiskId { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }
        public string Likelihood { get; set; } // High, Medium, Low
        public string Severity { get; set; } // Critical, Major, Moderate
        public string RiskLevel { get; set; } // High, Medium, Low
        public string Owner { get; set; }
    }

    public class Supplier
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Category { get; set; }
        public string Country { get; set; }
        public string Rating { get; set; }
        public string LastAudit { get; set; }
        public string Status { get; set; } // Approved, Under Review, Suspended
    }

    public class OrganizationSetting
    {
        public int Id { get; set; }
        public string OrganizationName { get; set; }
        public string IcaoCode { get; set; }
        public string RegulatoryAuthority { get; set; }
        public string QmsStandard { get; set; }
        public string Timezone { get; set; }
    }

    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsActive { get; set; } = true;
        public bool ForcePasswordChange { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLogin { get; set; }
    }

    public class CapaAction
    {
        public Guid Id { get; set; }
        public int? NCRId { get; set; }
        
        // Wizard fields
        public string? NCRReference { get; set; }
        public string? NCRTitle { get; set; }
        public string? NCRDescription { get; set; }
        public DateTime? OccurrenceDate { get; set; }
        public string? Location { get; set; }
        public string? ReportedByName { get; set; }
        public string? ReportedByEmail { get; set; }
        public string? RootCause { get; set; }
        public string? ContributingFactors { get; set; }
        
        public string ActionType { get; set; } // corrective, preventive
        public string Title { get; set; }
        public string Description { get; set; }
        public int ResponsiblePersonId { get; set; }
        public string ResponsiblePersonName { get; set; }
        public string ResponsiblePersonEmail { get; set; }
        public int? AssignedById { get; set; }
        public DateTime AssignedDate { get; set; }
        public DateTime DueDate { get; set; }
        public string Status { get; set; } // not_started, in_progress, pending_verification, verified, closed
        public string Priority { get; set; } // low, medium, high, critical
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? ClosedDate { get; set; }

        // Verification fields
        public string? VerificationNotes { get; set; }
        public string? EffectivenessRating { get; set; } // effective, partially_effective, not_effective
        public int? VerifiedById { get; set; }
        public DateTime? VerificationDate { get; set; }
    }

    public class CapaComment
    {
        public Guid Id { get; set; }
        public Guid CapaId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? EditedAt { get; set; }
        public bool IsEdited { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public Guid? ParentCommentId { get; set; }
    }

    public class CapaAttachment
    {
        public Guid Id { get; set; }
        public Guid CapaId { get; set; }
        public string FileName { get; set; }
        public string FileUrl { get; set; }
        public string FileType { get; set; }
        public int FileSize { get; set; }
        public int UploadedById { get; set; }
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }

    public class CapaHistory
    {
        public Guid Id { get; set; }
        public Guid CapaId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string Action { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public string? ChangeReason { get; set; }
        public string? Metadata { get; set; }
    }

    public class NCRHistory
    {
        public Guid Id { get; set; }
        public int NCRId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string Action { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public string? ChangeReason { get; set; }
        public string? Metadata { get; set; }
    }

    public class UnifiedAuditTrail
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; }
        public object EntityId { get; set; }
        public string EntityReference { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string Action { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public string? ChangeReason { get; set; }
        public string? Metadata { get; set; }
    }

    public class AuditEntryResponse
    {
        public Guid Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string? UserAvatar { get; set; }
        public string Action { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; }
        public string? IpAddress { get; set; }
        public string? ChangeReason { get; set; }
        public object? Metadata { get; set; }
    }

    public class PaginatedAuditResponse
    {
        public int Total { get; set; }
        public List<AuditEntryResponse> Entries { get; set; } = new();
    }

    public class UnifiedAuditResponse
    {
        public int Total { get; set; }
        public object Filters { get; set; } = new();
        public List<UnifiedAuditTrail> Entries { get; set; } = new();
    }

    public class UserActivityBreakdown
    {
        public string EntityType { get; set; }
        public string Action { get; set; }
        public int Count { get; set; }
    }

    public class DailyActivity
    {
        public string Date { get; set; }
        public int Count { get; set; }
    }

    public class UserActivitySummaryResponse
    {
        public int UserId { get; set; }
        public string UserName { get; set; }
        public int PeriodDays { get; set; }
        public int TotalActions { get; set; }
        public List<UserActivityBreakdown> Breakdown { get; set; } = new();
        public List<DailyActivity> DailyActivity { get; set; } = new();
    }

    public class AuditStatsResponse
    {
        public int TotalEntries { get; set; }
        public DateRange DateRange { get; set; } = new();
        public List<ActiveUser> MostActiveUsers { get; set; } = new();
        public List<CommonAction> MostCommonActions { get; set; } = new();
        public Dictionary<string, int> ByEntityType { get; set; } = new();
    }

    public class DateRange
    {
        public string? Earliest { get; set; }
        public string? Latest { get; set; }
    }

    public class ActiveUser
    {
        public int UserId { get; set; }
        public string UserName { get; set; }
        public int ActionCount { get; set; }
    }

    public class CommonAction
    {
        public string Action { get; set; }
        public int Count { get; set; }
    }
}
