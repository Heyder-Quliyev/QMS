using System;
using System.Collections.Generic;

namespace AeroQMS.API.DTOs.Portal
{
    // Portal Group DTOs
    public record PortalGroupDto(int Id, string Name, string Slug, int CompanyId, DateTime CreatedAt);
    public record CreatePortalGroupDto(string Name, string Slug);

    // Portal Document DTOs
    public record PortalDocumentDto(
        int Id, 
        int DocumentId, 
        string DocNumber, 
        string Title, 
        string Revision, 
        DateTime EffectiveDate, 
        string Status,
        DateTime AddedAt
    );
    public record AddPortalDocumentDto(int DocumentId);

    // Portal User DTOs
    public record PortalUserDto(
        int Id, 
        int PortalGroupId, 
        string Email, 
        string Name, 
        string AccessToken, 
        DateTime? LastAccess, 
        DateTime CreatedAt
    );
    public record InvitePortalUserDto(string Email, string Name);

    // Portal Access Log DTOs
    public record PortalAccessLogDto(
        int Id, 
        int? PortalUserId, 
        string? UserName,
        int DocumentId, 
        string DocNumber,
        string DocTitle,
        string Action, 
        DateTime AccessedAt
    );
    public record CreatePortalAccessLogDto(int PortalUserId, int DocumentId, string Action);

    // External Portal DTOs
    public record ExternalPortalDto(
        string GroupName, 
        List<ExternalPortalDocumentDto> Documents
    );
    public record ExternalPortalDocumentDto(
        int Id, 
        string DocNumber, 
        string Title, 
        string Revision, 
        DateTime EffectiveDate, 
        string Status
    );
    public record SubmitFeedbackDto(string? Email, int? DocumentId, string Message);
    public record InviteUserResponse(int UserId, string UserName, string Email, string AccessToken, bool EmailSent, string? EmailError = null);
}
