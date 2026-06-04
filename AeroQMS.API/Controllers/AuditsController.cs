using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.Services;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/audit")]
    public class AuditsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditLoggerService _auditLogger;
        private readonly AuditAuthorizationService _authService;

        public AuditsController(AppDbContext context, AuditLoggerService auditLogger, AuditAuthorizationService authService)
        {
            _context = context;
            _auditLogger = auditLogger;
            _authService = authService;
        }

        // Original Audit endpoints (keep for backward compatibility)
        [HttpGet("audits")]
        public async Task<ActionResult<IEnumerable<Audit>>> GetAudits()
        {
            return await _context.Audits.ToListAsync();
        }

        [HttpGet("audits/{id}")]
        public async Task<ActionResult<Audit>> GetAudit(int id)
        {
            var audit = await _context.Audits.FindAsync(id);
            if (audit == null) return NotFound();
            return audit;
        }

        // ==================== Audit History Endpoints ====================

        [HttpGet("ncr/{ncrId}")]
        public async Task<ActionResult<PaginatedAuditResponse>> GetNcrAudit(int ncrId, [FromQuery] int user_id, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
        {
            var hasAccess = await _authService.HasNcrAccessAsync(user_id, ncrId);
            if (!hasAccess)
                return StatusCode(403);

            var history = await _auditLogger.GetNcrHistoryAsync(ncrId, limit, offset);
            return Ok(history);
        }

        [HttpGet("capa/{capaId}")]
        public async Task<ActionResult<PaginatedAuditResponse>> GetCapaAudit(Guid capaId, [FromQuery] int user_id, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
        {
            var hasAccess = await _authService.HasCapaAccessAsync(user_id, capaId);
            if (!hasAccess)
                return StatusCode(403);

            var history = await _auditLogger.GetCapaHistoryAsync(capaId, limit, offset);
            return Ok(history);
        }

        [HttpGet("unified")]
        public async Task<ActionResult<UnifiedAuditResponse>> GetUnifiedAudit(
            [FromQuery] int user_id,
            [FromQuery] DateTime? start_date,
            [FromQuery] DateTime? end_date,
            [FromQuery] int? target_user_id,
            [FromQuery] string? user_ids,
            [FromQuery] string? entity_type,
            [FromQuery] string? action,
            [FromQuery] string? actions,
            [FromQuery] string? field,
            [FromQuery] string? search,
            [FromQuery] int limit = 100,
            [FromQuery] int offset = 0)
        {
            var isAdminOrQM = await _authService.IsAdminOrQualityManagerAsync(user_id);
            if (!isAdminOrQM)
                return StatusCode(403);

            List<int>? parsedUserIds = null;
            if (!string.IsNullOrWhiteSpace(user_ids))
            {
                parsedUserIds = user_ids
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(v => int.TryParse(v, out var n) ? (int?)n : null)
                    .Where(v => v.HasValue)
                    .Select(v => v!.Value)
                    .Distinct()
                    .ToList();
            }

            List<string>? parsedActions = null;
            if (!string.IsNullOrWhiteSpace(actions))
            {
                parsedActions = actions
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Select(v => v.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }

            var filters = new UnifiedHistoryFilters
            {
                StartDate = start_date,
                EndDate = end_date,
                UserId = target_user_id,
                UserIds = parsedUserIds,
                EntityType = entity_type,
                ActionType = action,
                ActionTypes = parsedActions,
                Field = field,
                Search = search,
                Limit = limit,
                Offset = offset
            };

            var history = await _auditLogger.GetUnifiedHistoryAsync(filters);
            return Ok(history);
        }

        [HttpGet("entry/{entryId}")]
        public async Task<IActionResult> GetAuditEntryDetail([FromRoute] string entryId)
        {
            if (!Guid.TryParse(entryId, out var id))
                return BadRequest("Invalid entry id");

            var ncrEntry = await _context.NCRHistories.FirstOrDefaultAsync(h => h.Id == id);
            if (ncrEntry != null)
            {
                var ncr = await _context.NonConformances.FirstOrDefaultAsync(n => n.Id == ncrEntry.NCRId);
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == ncrEntry.UserId);

                return Ok(new
                {
                    id = ncrEntry.Id,
                    entity_type = "NCR",
                    entity_id = ncrEntry.NCRId,
                    entity_reference = ncr?.NCRNumber,
                    entity_title = ncr?.Title,
                    user_id = ncrEntry.UserId,
                    user_name = ncrEntry.UserName,
                    user_email = user?.Email,
                    user_avatar = (string?)null,
                    user_role = user?.Role,
                    action = ncrEntry.Action,
                    old_value = ncrEntry.OldValue,
                    new_value = ncrEntry.NewValue,
                    change_reason = ncrEntry.ChangeReason,
                    timestamp = ncrEntry.Timestamp,
                    ip_address = ncrEntry.IpAddress,
                    user_agent = ncrEntry.UserAgent,
                    metadata = !string.IsNullOrEmpty(ncrEntry.Metadata) ? System.Text.Json.JsonSerializer.Deserialize<object>(ncrEntry.Metadata) : null
                });
            }

            var capaEntry = await _context.CapaHistories.FirstOrDefaultAsync(h => h.Id == id);
            if (capaEntry != null)
            {
                var capa = await _context.CapaActions.FirstOrDefaultAsync(c => c.Id == capaEntry.CapaId);
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == capaEntry.UserId);

                return Ok(new
                {
                    id = capaEntry.Id,
                    entity_type = "CAPA",
                    entity_id = capaEntry.CapaId,
                    entity_reference = capa?.Title,
                    entity_title = capa?.Title,
                    user_id = capaEntry.UserId,
                    user_name = capaEntry.UserName,
                    user_email = user?.Email,
                    user_avatar = (string?)null,
                    user_role = user?.Role,
                    action = capaEntry.Action,
                    old_value = capaEntry.OldValue,
                    new_value = capaEntry.NewValue,
                    change_reason = capaEntry.ChangeReason,
                    timestamp = capaEntry.Timestamp,
                    ip_address = capaEntry.IpAddress,
                    user_agent = capaEntry.UserAgent,
                    metadata = !string.IsNullOrEmpty(capaEntry.Metadata) ? System.Text.Json.JsonSerializer.Deserialize<object>(capaEntry.Metadata) : null
                });
            }

            return NotFound();
        }

        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<object>>> GetAuditUsers([FromQuery] int user_id)
        {
            var isAdminOrQM = await _authService.IsAdminOrQualityManagerAsync(user_id);
            if (!isAdminOrQM)
                return StatusCode(403);

            var fromHistory = await _context.NCRHistories
                .Select(h => new { h.UserId, h.UserName })
                .Union(_context.CapaHistories.Select(h => new { h.UserId, h.UserName }))
                .GroupBy(x => new { x.UserId, x.UserName })
                .Select(g => new { userId = g.Key.UserId, userName = g.Key.UserName })
                .OrderBy(x => x.userName)
                .ToListAsync();

            return Ok(fromHistory);
        }

        [HttpGet("user/{userId}/summary")]
        public async Task<ActionResult<UserActivitySummaryResponse>> GetUserActivitySummary(int userId, [FromQuery] int user_id, [FromQuery] int days = 30)
        {
            var isAdminOrQM = await _authService.IsAdminOrQualityManagerAsync(user_id);
            var isOwnActivity = await _authService.CanViewOwnActivityAsync(user_id, userId);

            if (!isAdminOrQM && !isOwnActivity)
                return StatusCode(403);

            var summary = await _auditLogger.GetUserActivitySummaryAsync(userId, days);
            return Ok(summary);
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportAudit(
            [FromQuery] int user_id,
            [FromQuery] DateTime? start_date,
            [FromQuery] DateTime? end_date,
            [FromQuery] int? target_user_id,
            [FromQuery] string? entity_type,
            [FromQuery] string? action,
            [FromQuery] string format = "csv")
        {
            var isAdminOrQM = await _authService.IsAdminOrQualityManagerAsync(user_id);
            if (!isAdminOrQM)
                return StatusCode(403);

            var filters = new UnifiedHistoryFilters
            {
                StartDate = start_date,
                EndDate = end_date,
                UserId = target_user_id,
                EntityType = entity_type,
                ActionType = action
            };

            if (format.ToLower() == "csv")
            {
                var csvContent = await _auditLogger.ExportToCsvAsync(filters);
                var fileName = $"audit-trail-{DateTime.Now:yyyy-MM-dd}.csv";
                return File(System.Text.Encoding.UTF8.GetBytes(csvContent), "text/csv", fileName);
            }

            return BadRequest("Only CSV format is currently supported");
        }

        [HttpGet("stats")]
        public async Task<ActionResult<AuditStatsResponse>> GetAuditStats([FromQuery] int user_id)
        {
            var isAdminOrQM = await _authService.IsAdminOrQualityManagerAsync(user_id);
            if (!isAdminOrQM)
                return StatusCode(403);

            var stats = await _auditLogger.GetAuditStatsAsync();
            return Ok(stats);
        }
    }
}
