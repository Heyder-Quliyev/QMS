using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.DTOs.Portal;
using AeroQMS.API.Services;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace AeroQMS.API.Controllers
{
    [Route("api/portal")]
    [ApiController]
    public class PortalController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _uploadPath;
        private readonly IEmailService _emailService;
        private readonly EmailSettings _emailSettings;

        public PortalController(AppDbContext context, IWebHostEnvironment env, IEmailService emailService, IOptions<EmailSettings> emailSettings)
        {
            _context = context;
            _uploadPath = Path.Combine(env.ContentRootPath, "Uploads");
            _emailService = emailService;
            _emailSettings = emailSettings.Value;
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        private static string GenerateSecureToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }

        // ========================================
        // PORTAL GROUPS (Admin only)
        // ========================================

        [HttpGet("groups")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<PortalGroupDto>>> GetGroups()
        {
            var groups = await _context.PortalGroups
                .Where(g => g.CompanyId == 1) // Single-tenant default
                .Select(g => new PortalGroupDto(g.Id, g.Name, g.Slug, g.CompanyId, g.CreatedAt))
                .ToListAsync();
            return Ok(groups);
        }

        [HttpPost("groups")]
        [Authorize]
        public async Task<ActionResult<PortalGroupDto>> CreateGroup([FromBody] CreatePortalGroupDto dto)
        {
            var group = new PortalGroup { Name = dto.Name, Slug = dto.Slug, CompanyId = 1 };
            _context.PortalGroups.Add(group);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetGroups), new PortalGroupDto(group.Id, group.Name, group.Slug, group.CompanyId, group.CreatedAt));
        }

        [HttpDelete("groups/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteGroup(int id)
        {
            var group = await _context.PortalGroups.FindAsync(id);
            if (group == null) return NotFound();
            _context.PortalGroups.Remove(group);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ========================================
        // PORTAL DOCUMENTS (Admin only)
        // ========================================

        [HttpGet("groups/{groupId}/documents")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<PortalDocumentDto>>> GetGroupDocuments(int groupId)
        {
            var docs = await _context.PortalDocuments
                .Where(pd => pd.PortalGroupId == groupId)
                .Include(pd => pd.Document)
                .Select(pd => new PortalDocumentDto(
                    pd.Id,
                    pd.DocumentId,
                    pd.Document.DocumentNumber,
                    pd.Document.Title,
                    pd.Document.Revision,
                    pd.Document.EffectiveDate,
                    pd.Document.Status,
                    pd.AddedAt
                ))
                .ToListAsync();
            return Ok(docs);
        }

        [HttpGet("documents")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> GetAllDocuments()
        {
            // Return all documents for selection in admin UI
            var docs = await _context.Documents
                .Select(d => new { d.Id, d.DocumentNumber, d.Title, d.Revision, d.Status })
                .ToListAsync();
            return Ok(docs);
        }

        [HttpPost("groups/{groupId}/documents")]
        [Authorize]
        public async Task<ActionResult<PortalDocumentDto>> AddDocumentToGroup(int groupId, [FromBody] AddPortalDocumentDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var exists = await _context.PortalDocuments
                .AnyAsync(pd => pd.PortalGroupId == groupId && pd.DocumentId == dto.DocumentId);
            if (exists) return BadRequest("Document already in group");

            var pd = new PortalDocument { PortalGroupId = groupId, DocumentId = dto.DocumentId };
            _context.PortalDocuments.Add(pd);
            await _context.SaveChangesAsync();

            // Now load the full document to create the DTO
            var fullPd = await _context.PortalDocuments
                .Include(p => p.Document)
                .FirstOrDefaultAsync(p => p.Id == pd.Id);

            return Ok(new PortalDocumentDto(
                fullPd.Id,
                fullPd.DocumentId,
                fullPd.Document.DocumentNumber,
                fullPd.Document.Title,
                fullPd.Document.Revision,
                fullPd.Document.EffectiveDate,
                fullPd.Document.Status,
                fullPd.AddedAt
            ));
        }

        [HttpDelete("groups/{groupId}/documents/{portalDocumentId}")]
        [Authorize]
        public async Task<IActionResult> RemoveDocumentFromGroup(int groupId, int portalDocumentId)
        {
            var pd = await _context.PortalDocuments
                .FirstOrDefaultAsync(x => x.PortalGroupId == groupId && x.Id == portalDocumentId);
            if (pd == null) return NotFound();
            _context.PortalDocuments.Remove(pd);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ========================================
        // PORTAL USERS (Admin only)
        // ========================================

        [HttpGet("groups/{groupId}/users")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<PortalUserDto>>> GetGroupUsers(int groupId)
        {
            var users = await _context.PortalUsers
                .Where(u => u.PortalGroupId == groupId)
                .Select(u => new PortalUserDto(u.Id, u.PortalGroupId, u.Email, u.Name, u.AccessToken, u.LastAccess, u.CreatedAt))
                .ToListAsync();
            return Ok(users);
        }

        [HttpPost("groups/{groupId}/users/invite")]
        [Authorize]
        public async Task<ActionResult<InviteUserResponse>> InviteUser(int groupId, [FromBody] InvitePortalUserDto dto)
        {
            var user = new PortalUser
            {
                PortalGroupId = groupId,
                Email = dto.Email,
                Name = dto.Name,
                AccessToken = GenerateSecureToken()
            };
            _context.PortalUsers.Add(user);
            await _context.SaveChangesAsync();

            bool emailSent = false;
            string? emailError = null;
            try
            {
                var portalLink = $"{_emailSettings.FrontendBaseUrl}/portal/{user.AccessToken}";
                await _emailService.SendPortalInviteEmail(user.Email, user.Name, "AeroQMS Inc.", portalLink);
                emailSent = true;
            }
            catch (Exception ex)
            {
                // Log the error and capture it for response
                emailError = ex.Message;
            }

            return Ok(new InviteUserResponse(user.Id, user.Name, user.Email, user.AccessToken, emailSent, emailError));
        }

        [HttpDelete("groups/{groupId}/users/{userId}")]
        [Authorize]
        public async Task<IActionResult> RevokeUser(int groupId, int userId)
        {
            var user = await _context.PortalUsers.FirstOrDefaultAsync(u => u.PortalGroupId == groupId && u.Id == userId);
            if (user == null) return NotFound();
            _context.PortalUsers.Remove(user);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("groups/{groupId}/users/{userId}/regenerate-token")]
        [Authorize]
        public async Task<ActionResult<InviteUserResponse>> RegenerateToken(int groupId, int userId, [FromQuery] bool sendEmail = false)
        {
            var user = await _context.PortalUsers.FirstOrDefaultAsync(u => u.PortalGroupId == groupId && u.Id == userId);
            if (user == null) return NotFound();
            user.AccessToken = GenerateSecureToken();
            await _context.SaveChangesAsync();
            
            bool emailSent = false;
            string? emailError = null;
            if (sendEmail)
            {
                try
                {
                    var portalLink = $"{_emailSettings.FrontendBaseUrl}/portal/{user.AccessToken}";
                    await _emailService.SendPortalInviteEmail(user.Email, user.Name, "AeroQMS Inc.", portalLink);
                    emailSent = true;
                }
                catch (Exception ex)
                {
                    // Log the error and capture it for response
                    emailError = ex.Message;
                }
            }
            return Ok(new InviteUserResponse(user.Id, user.Name, user.Email, user.AccessToken, emailSent, emailError));
        }

        // ========================================
        // PORTAL ACCESS LOGS (Admin only)
        // ========================================

        [HttpGet("groups/{groupId}/logs")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<PortalAccessLogDto>>> GetGroupLogs(int groupId)
        {
            var logs = await _context.PortalAccessLogs
                .Where(l => l.PortalUser!.PortalGroupId == groupId || (l.PortalUser == null && l.Document != null))
                .Include(l => l.PortalUser)
                .Include(l => l.Document)
                .OrderByDescending(l => l.AccessedAt)
                .Select(l => new PortalAccessLogDto(
                    l.Id,
                    l.PortalUserId,
                    l.PortalUser != null ? l.PortalUser.Name : null,
                    l.DocumentId,
                    l.Document.DocumentNumber,
                    l.Document.Title,
                    l.Action,
                    l.AccessedAt
                ))
                .ToListAsync();
            return Ok(logs);
        }

        [HttpGet("groups/{groupId}/feedback")]
        [Authorize]
        public async Task<IActionResult> GetGroupFeedback(int groupId)
        {
            var feedbacks = await _context.PortalFeedbacks
                .Where(f => f.PortalGroupId == groupId)
                .Include(f => f.Document)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new
                {
                    id = f.Id,
                    email = f.Email,
                    documentId = f.DocumentId,
                    documentNumber = f.Document != null ? f.Document.DocumentNumber : null,
                    documentTitle = f.Document != null ? f.Document.Title : null,
                    message = f.Message,
                    createdAt = f.CreatedAt
                })
                .ToListAsync();
            return Ok(feedbacks);
        }

        [HttpPost("log")]
        [AllowAnonymous]
        public async Task<IActionResult> LogAction([FromBody] CreatePortalAccessLogDto dto)
        {
            // Optional: Verify access token if needed
            var user = await _context.PortalUsers.FindAsync(dto.PortalUserId);
            if (user == null) return BadRequest("Invalid user");

            user.LastAccess = DateTime.UtcNow;

            var log = new PortalAccessLog
            {
                PortalUserId = dto.PortalUserId,
                DocumentId = dto.DocumentId,
                Action = dto.Action
            };
            _context.PortalAccessLogs.Add(log);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // ========================================
        // EXTERNAL PORTAL (No auth, token-based)
        // ========================================

        [HttpGet("access/{token}")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetPortalByToken(string token)
        {
            var user = await _context.PortalUsers
                .Include(u => u.PortalGroup)
                    .ThenInclude(g => g.PortalDocuments)
                        .ThenInclude(pd => pd.Document)
                .FirstOrDefaultAsync(u => u.AccessToken == token);
            if (user == null) return NotFound("This portal link is not valid or has expired.");

            // Update last access time
            user.LastAccess = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                portalUserId = user.Id,
                userName = user.Name,
                groupName = user.PortalGroup.Name,
                companyName = "AeroQMS Inc.",
                documents = user.PortalGroup.PortalDocuments.Select(pd => new
                {
                    id = pd.Id,
                    docNumber = pd.Document.DocumentNumber,
                    title = pd.Document.Title,
                    revision = pd.Document.Revision,
                    effectiveDate = pd.Document.EffectiveDate.ToString("yyyy-MM-dd"),
                    status = pd.Document.Status
                }).ToList()
            });
        }

        [HttpGet("access/{token}/documents/{id}/view")]
        [AllowAnonymous]
        public async Task<IActionResult> ViewDocument(string token, int id)
        {
            var user = await _context.PortalUsers
                .Include(u => u.PortalGroup)
                .FirstOrDefaultAsync(u => u.AccessToken == token);
            if (user == null) return NotFound("This portal link is not valid or has expired.");

            // Find the portal document
            var pd = await _context.PortalDocuments
                .Include(x => x.Document)
                .FirstOrDefaultAsync(x => x.PortalGroupId == user.PortalGroupId && x.Id == id);
            if (pd == null || pd.Document == null) return NotFound();

            // Log view
            _context.PortalAccessLogs.Add(new PortalAccessLog
            {
                PortalUserId = user.Id,
                DocumentId = pd.DocumentId,
                Action = "view"
            });
            await _context.SaveChangesAsync();

            // Serve file
            if (string.IsNullOrWhiteSpace(pd.Document.FileName))
                return NotFound("Document has no file attached");
            var filePath = Path.Combine(_uploadPath, pd.Document.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound("Document file not found");

            var contentType = GetContentType(pd.Document.FileName);
            var fileStream = System.IO.File.OpenRead(filePath);
            return File(fileStream, contentType, enableRangeProcessing: true);
        }

        [HttpGet("access/{token}/documents/{id}/download")]
        [AllowAnonymous]
        public async Task<IActionResult> DownloadDocument(string token, int id)
        {
            var user = await _context.PortalUsers
                .Include(u => u.PortalGroup)
                .FirstOrDefaultAsync(u => u.AccessToken == token);
            if (user == null) return NotFound("This portal link is not valid or has expired.");

            var pd = await _context.PortalDocuments
                .Include(x => x.Document)
                .FirstOrDefaultAsync(x => x.PortalGroupId == user.PortalGroupId && x.Id == id);
            if (pd == null || pd.Document == null) return NotFound();

            // Log download
            _context.PortalAccessLogs.Add(new PortalAccessLog
            {
                PortalUserId = user.Id,
                DocumentId = pd.DocumentId,
                Action = "download"
            });
            await _context.SaveChangesAsync();

            if (string.IsNullOrWhiteSpace(pd.Document.FileName))
                return NotFound("Document has no file attached");
            var filePath = Path.Combine(_uploadPath, pd.Document.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound("Document file not found");

            var contentType = GetContentType(pd.Document.FileName);
            var fileStream = System.IO.File.OpenRead(filePath);
            return File(fileStream, contentType, pd.Document.FileName);
        }

        [HttpPost("access/{token}/feedback")]
        [AllowAnonymous]
        public async Task<IActionResult> SubmitFeedback(string token, [FromBody] SubmitFeedbackDto dto)
        {
            var user = await _context.PortalUsers
                .Include(u => u.PortalGroup)
                .FirstOrDefaultAsync(u => u.AccessToken == token);
            if (user == null) return NotFound("This portal link is not valid or has expired.");

            var feedback = new PortalFeedback
            {
                PortalGroupId = user.PortalGroupId,
                Email = dto.Email ?? "",
                DocumentId = dto.DocumentId,
                Message = dto.Message
            };
            _context.PortalFeedbacks.Add(feedback);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Feedback submitted successfully" });
        }

        // Keep legacy endpoints (for backward compatibility, optional)
        [HttpGet("public/{slug}")]
        [AllowAnonymous]
        [Obsolete("Use GET /api/portal/access/{token} instead")]
        public async Task<ActionResult<object>> GetPublicPortal(string slug)
        {
            var group = await _context.PortalGroups
                .Include(g => g.PortalDocuments)
                .ThenInclude(pd => pd.Document)
                .FirstOrDefaultAsync(g => g.Slug == slug);
            if (group == null) return NotFound("This portal link is not valid or has expired.");

            return Ok(new
            {
                groupName = group.Name,
                companyName = "AeroQMS Inc.",
                documents = group.PortalDocuments.Select(pd => new
                {
                    id = pd.Id,
                    docNumber = pd.Document.DocumentNumber,
                    title = pd.Document.Title,
                    revision = pd.Document.Revision,
                    effectiveDate = pd.Document.EffectiveDate.ToString("yyyy-MM-dd"),
                    status = pd.Document.Status
                }).ToList()
            });
        }

        [HttpGet("public/{slug}/documents/{id}/view")]
        [AllowAnonymous]
        [Obsolete("Use GET /api/portal/access/{token}/documents/{id}/view instead")]
        public async Task<IActionResult> ViewPublicDocument(string slug, int id)
        {
            var group = await _context.PortalGroups.FirstOrDefaultAsync(g => g.Slug == slug);
            if (group == null) return NotFound();

            var pd = await _context.PortalDocuments
                .Include(x => x.Document)
                .FirstOrDefaultAsync(x => x.PortalGroupId == group.Id && x.Id == id);
            if (pd == null || pd.Document == null) return NotFound();

            _context.PortalAccessLogs.Add(new PortalAccessLog
            {
                PortalUserId = null,
                DocumentId = pd.DocumentId,
                Action = "view"
            });
            await _context.SaveChangesAsync();

            if (string.IsNullOrWhiteSpace(pd.Document.FileName)) return NotFound("Document has no file attached");
            var filePath = Path.Combine(_uploadPath, pd.Document.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound("Document file not found");
            var contentType = GetContentType(pd.Document.FileName);
            var fileStream = System.IO.File.OpenRead(filePath);
            return File(fileStream, contentType, enableRangeProcessing: true);
        }

        [HttpGet("public/{slug}/documents/{id}/download")]
        [AllowAnonymous]
        [Obsolete("Use GET /api/portal/access/{token}/documents/{id}/download instead")]
        public async Task<IActionResult> DownloadPublicDocument(string slug, int id)
        {
            var group = await _context.PortalGroups.FirstOrDefaultAsync(g => g.Slug == slug);
            if (group == null) return NotFound();

            var pd = await _context.PortalDocuments
                .Include(x => x.Document)
                .FirstOrDefaultAsync(x => x.PortalGroupId == group.Id && x.Id == id);
            if (pd == null || pd.Document == null) return NotFound();

            _context.PortalAccessLogs.Add(new PortalAccessLog
            {
                PortalUserId = null,
                DocumentId = pd.DocumentId,
                Action = "download"
            });
            await _context.SaveChangesAsync();

            if (string.IsNullOrWhiteSpace(pd.Document.FileName)) return NotFound("Document has no file attached");
            var filePath = Path.Combine(_uploadPath, pd.Document.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound("Document file not found");
            var contentType = GetContentType(pd.Document.FileName);
            var fileStream = System.IO.File.OpenRead(filePath);
            return File(fileStream, contentType, pd.Document.FileName);
        }

        [HttpPost("public/{slug}/feedback")]
        [AllowAnonymous]
        [Obsolete("Use POST /api/portal/access/{token}/feedback instead")]
        public async Task<IActionResult> SubmitPublicFeedback(string slug, [FromBody] SubmitFeedbackDto dto)
        {
            var group = await _context.PortalGroups.FirstOrDefaultAsync(g => g.Slug == slug);
            if (group == null) return NotFound();

            var feedback = new PortalFeedback
            {
                PortalGroupId = group.Id,
                Email = dto.Email ?? "",
                DocumentId = dto.DocumentId,
                Message = dto.Message
            };
            _context.PortalFeedbacks.Add(feedback);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("users/{portalUserId}")]
        [Authorize]
        public async Task<IActionResult> RevokeUser(int portalUserId)
        {
            var user = await _context.PortalUsers.FindAsync(portalUserId);
            if (user == null) return NotFound();
            _context.PortalUsers.Remove(user);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".ppt" => "application/vnd.ms-powerpoint",
                ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".txt" => "text/plain",
                ".html" => "text/html",
                ".htm" => "text/html",
                ".csv" => "text/csv",
                _ => "application/octet-stream"
            };
        }
    }
}
