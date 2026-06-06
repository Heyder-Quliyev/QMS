using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using UglyToad.PdfPig;
using System.IO.Compression;
using System.Xml.Linq;

namespace AeroQMS.API.Controllers
{
    public class BulkExportRequest
    {
        public List<int> Ids { get; set; }
        public string Format { get; set; } // "csv" or "pdf"
    }

    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;
        private readonly AuditAuthorizationService _authService;
        private readonly string _uploadPath;

        public DocumentsController(AppDbContext context, IEmailService emailService, IWebHostEnvironment env, AuditAuthorizationService authService)
        {
            _context = context;
            _emailService = emailService;
            _authService = authService;
            _uploadPath = Path.Combine(env.ContentRootPath, "Uploads");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AeroQMS.API.Models.Document>>> GetDocuments() => await _context.Documents.ToListAsync();

        [HttpGet("{id}")]
        public async Task<ActionResult<AeroQMS.API.Models.Document>> GetDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();
            return doc;
        }

        private static bool IsAdminRole(string? role) =>
            !string.IsNullOrWhiteSpace(role) && role.IndexOf("admin", StringComparison.OrdinalIgnoreCase) >= 0;

        private async Task<User?> GetUserAsync(int userId) =>
            await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        private int? GetAuthenticatedUserId()
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(id, out var parsed) ? parsed : null;
        }

        private async Task<User?> GetAuthenticatedUserAsync()
        {
            var id = GetAuthenticatedUserId();
            if (!id.HasValue) return null;
            return await GetUserAsync(id.Value);
        }

        private static string NormalizeRoleKey(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            return role.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static string NormalizeWorkflowStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status)) return "pending";
            var s = status.Trim().ToLowerInvariant();
            if (s is "pending" or "approved" or "changes_requested" or "rejected") return s;
            return "pending";
        }

        private static bool IsDocumentOwner(AeroQMS.API.Models.Document doc, User user) =>
            !string.IsNullOrWhiteSpace(doc.Owner) &&
            !string.IsNullOrWhiteSpace(user.Name) &&
            doc.Owner.Trim().Equals(user.Name.Trim(), StringComparison.OrdinalIgnoreCase);

        private static bool CanUserActOnStep(AeroQMS.API.Models.Document doc, User user, DocumentApprovalWorkflow step)
        {
            if (IsAdminRole(user.Role)) return true;
            if (step.RequiredUserId.HasValue && step.RequiredUserId.Value == user.Id) return true;

            var requiredRoleKey = NormalizeRoleKey(step.RequiredRole);
            if (requiredRoleKey is "safety_manager" or "operations_manager")
                return false;
            if (requiredRoleKey == "document_owner")
                return IsDocumentOwner(doc, user);

            var userRoleKey = NormalizeRoleKey(user.Role);
            return !string.IsNullOrWhiteSpace(requiredRoleKey) && requiredRoleKey == userRoleKey;
        }

        private static object BuildApprovalStatusResponse(AeroQMS.API.Models.Document doc, List<DocumentApprovalWorkflow> steps, Dictionary<int, string>? userNames = null)
        {
            var ordered = steps.OrderBy(s => s.StepNumber).ToList();
            var status = ComputeApprovalStatus(doc, ordered);

            var currentStep = ordered.FirstOrDefault(s => !string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));

            return new
            {
                document = new
                {
                    id = doc.Id,
                    document_number = doc.DocumentNumber,
                    title = doc.Title,
                    revision = doc.Revision,
                    status = doc.Status,
                    owner = doc.Owner
                },
                status,
                current_step_number = currentStep?.StepNumber,
                steps = ordered.Select(s => new
                {
                    id = s.Id,
                    step_number = s.StepNumber,
                    step_name = s.StepName,
                    required_role = s.RequiredRole,
                    required_user_id = s.RequiredUserId,
                    required_user_name = (s.RequiredUserId.HasValue && userNames != null && userNames.TryGetValue(s.RequiredUserId.Value, out var n)) ? n : null,
                    status = s.Status,
                    action = s.Action,
                    comment = s.Comment,
                    actioned_by_id = s.ActionedById,
                    actioned_at = s.ActionedAt,
                    created_at = s.CreatedAt
                }).ToList()
            };
        }

        private static bool HasAnyApprovalAction(List<DocumentApprovalWorkflow> steps) =>
            steps.Any(s =>
                !string.IsNullOrWhiteSpace(s.Action) ||
                s.ActionedAt.HasValue ||
                s.ActionedById.HasValue);

        private static bool IsPendingApprovalDocumentStatus(string? docStatus) =>
            !string.IsNullOrWhiteSpace(docStatus) &&
            docStatus.Trim().Equals("Pending Approval", StringComparison.OrdinalIgnoreCase);

        private static string ComputeApprovalStatus(AeroQMS.API.Models.Document doc, List<DocumentApprovalWorkflow> steps)
        {
            if (steps.Count == 0) return "not_started";
            var ordered = steps.OrderBy(s => s.StepNumber).ToList();
            var anyRejected = ordered.Any(s => string.Equals(s.Status, "rejected", StringComparison.OrdinalIgnoreCase));
            var anyChanges = ordered.Any(s => string.Equals(s.Status, "changes_requested", StringComparison.OrdinalIgnoreCase));
            var allApproved = ordered.All(s => string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));
            if (anyRejected) return "rejected";
            if (anyChanges) return "changes_requested";
            if (allApproved) return "approved";

            var pendingApproval = IsPendingApprovalDocumentStatus(doc.Status);
            if (!pendingApproval && !HasAnyApprovalAction(ordered))
                return "not_started";

            return "pending_approval";
        }

        private static bool IsWorkflowManager(User user)
        {
            if (IsAdminRole(user.Role)) return true;
            return NormalizeRoleKey(user.Role) == "quality_manager";
        }

        private static bool IsEditableWorkflowStatus(string status) =>
            string.Equals(status, "not_started", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase);

        [HttpGet("{id}/approval-status")]
        public async Task<IActionResult> GetDocumentApprovalStatus(int id, [FromQuery] int user_id = 1)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var steps = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == id)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();

            var user = await GetAuthenticatedUserAsync() ?? await GetUserAsync(user_id);
            var canApprove = false;
            var isAdmin = user != null && IsAdminRole(user.Role);
            var isWorkflowManager = user != null && IsWorkflowManager(user);
            var canStart = user != null && (isAdmin || IsDocumentOwner(doc, user));

            if (steps.Count == 0)
            {
                return Ok(new
                {
                    approval = new
                    {
                        document = new { id = doc.Id, document_number = doc.DocumentNumber, title = doc.Title, revision = doc.Revision, status = doc.Status, owner = doc.Owner },
                        status = "not_started",
                        current_step_number = (int?)null,
                        steps = new List<object>()
                    },
                    permissions = new
                    {
                        user_id = user?.Id,
                        user_name = user?.Name,
                        user_role = user?.Role,
                        is_admin = isAdmin,
                        is_workflow_manager = isWorkflowManager,
                        can_manage_steps = isWorkflowManager,
                        workflow_locked = false,
                        can_approve = false,
                        can_start = canStart
                    }
                });
            }

            var current = steps.OrderBy(s => s.StepNumber).FirstOrDefault(s => !string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));
            if (user != null && current != null)
                canApprove = CanUserActOnStep(doc, user, current);

            var status = ComputeApprovalStatus(doc, steps);
            if (string.Equals(status, "not_started", StringComparison.OrdinalIgnoreCase))
                canApprove = false;
            var workflowLocked = !IsEditableWorkflowStatus(status);
            var ids = steps
                .Where(s => s.RequiredUserId.HasValue)
                .Select(s => s.RequiredUserId!.Value)
                .Distinct()
                .ToList();
            var userNames = ids.Count == 0
                ? new Dictionary<int, string>()
                : await _context.Users
                    .Where(u => ids.Contains(u.Id))
                    .Select(u => new { u.Id, u.Name })
                    .ToDictionaryAsync(x => x.Id, x => x.Name);
            var baseResponse = BuildApprovalStatusResponse(doc, steps, userNames);
            return Ok(new
            {
                approval = baseResponse,
                permissions = new
                {
                    user_id = user?.Id,
                    user_name = user?.Name,
                    user_role = user?.Role,
                    is_admin = isAdmin,
                    is_workflow_manager = isWorkflowManager,
                    can_manage_steps = isWorkflowManager && !workflowLocked,
                    workflow_locked = workflowLocked,
                    can_approve = canApprove,
                    can_start = canStart
                }
            });
        }

        [HttpGet("approval-users")]
        public async Task<IActionResult> GetApprovalUsers([FromQuery] int user_id)
        {
            var user = await GetAuthenticatedUserAsync() ?? await GetUserAsync(user_id);
            if (user == null) return StatusCode(403);

            var roleKey = NormalizeRoleKey(user.Role);
            var isManager = IsAdminRole(user.Role) || roleKey == "quality_manager";
            if (!isManager) return StatusCode(403);

            var users = await _context.Users
                .Select(u => new { id = u.Id, name = u.Name, email = u.Email, role = u.Role })
                .OrderBy(u => u.name)
                .ToListAsync();

            return Ok(users);
        }

        public sealed class WorkflowTemplateRequest
        {
            public List<WorkflowStepTemplate> Steps { get; set; } = new();
        }

        public sealed class WorkflowStepTemplate
        {
            public string StepName { get; set; } = "";
            public string? RequiredRole { get; set; }
            public int? RequiredUserId { get; set; }
        }

        [HttpPost("{id}/workflow-template")]
        public async Task<IActionResult> SetWorkflowTemplate(int id, [FromQuery] int user_id, [FromBody] WorkflowTemplateRequest request)
        {
            var user = await GetAuthenticatedUserAsync() ?? await GetUserAsync(user_id);
            if (user == null || !IsAdminRole(user.Role)) return StatusCode(403);

            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var incoming = request?.Steps ?? new List<WorkflowStepTemplate>();
            incoming = incoming
                .Where(s => s != null && !string.IsNullOrWhiteSpace(s.StepName))
                .Take(12)
                .ToList();

            if (incoming.Count == 0) return BadRequest("No steps provided");

            var existing = await _context.DocumentApprovalWorkflows.Where(x => x.DocumentId == id).ToListAsync();
            _context.DocumentApprovalWorkflows.RemoveRange(existing);

            var now = DateTime.UtcNow;
            var newSteps = incoming.Select((s, idx) => new DocumentApprovalWorkflow
            {
                Id = Guid.NewGuid(),
                DocumentId = id,
                StepNumber = idx + 1,
                StepName = s.StepName.Trim(),
                RequiredRole = string.IsNullOrWhiteSpace(s.RequiredRole) ? null : s.RequiredRole.Trim(),
                RequiredUserId = s.RequiredUserId,
                Status = "pending",
                CreatedAt = now
            }).ToList();

            _context.DocumentApprovalWorkflows.AddRange(newSteps);
            await _context.SaveChangesAsync();

            return Ok(new { ok = true });
        }

        public sealed class ApprovalActionRequest
        {
            public int UserId { get; set; }
            public string? Comment { get; set; }
        }

        [HttpPost("{id}/approval-start")]
        public async Task<IActionResult> StartApproval(int id, [FromBody] ApprovalActionRequest request)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var user = await GetAuthenticatedUserAsync();
            if (user == null) return StatusCode(403);

            var isAdmin = IsAdminRole(user.Role);
            var canStart = isAdmin || IsDocumentOwner(doc, user);
            if (!canStart) return StatusCode(403);

            var existing = await _context.DocumentApprovalWorkflows.Where(x => x.DocumentId == id).ToListAsync();
            if (existing.Count > 0)
            {
                var existingStatus = ComputeApprovalStatus(doc, existing);
                var canRestart =
                    string.Equals(existingStatus, "not_started", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(existingStatus, "rejected", StringComparison.OrdinalIgnoreCase);

                if (!canRestart)
                    return Ok(BuildApprovalStatusResponse(doc, existing));

                foreach (var s in existing)
                {
                    s.Status = "pending";
                    s.Action = null;
                    s.Comment = null;
                    s.ActionedById = null;
                    s.ActionedAt = null;
                }

                doc.Status = "Pending Approval";
                _context.Entry(doc).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                await NotifyNextApproverAsync(doc, existing);
                return Ok(BuildApprovalStatusResponse(doc, existing));
            }

            var now = DateTime.UtcNow;
            var users = await _context.Users.ToListAsync();

            int? ownerUserId = users
                .FirstOrDefault(u =>
                    !string.IsNullOrWhiteSpace(u.Name) &&
                    !string.IsNullOrWhiteSpace(doc.Owner) &&
                    u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase))
                ?.Id;

            int? qmUserId = users.FirstOrDefault(u => NormalizeRoleKey(u.Role) == "quality_manager")?.Id;
            int? dhUserId = users.FirstOrDefault(u => NormalizeRoleKey(u.Role) == "department_head")?.Id;

            var steps = new List<DocumentApprovalWorkflow>
            {
                new() { Id = Guid.NewGuid(), DocumentId = id, StepNumber = 1, StepName = "Document Owner Review", RequiredRole = "Document Owner", RequiredUserId = ownerUserId, Status = "pending", CreatedAt = now },
                new() { Id = Guid.NewGuid(), DocumentId = id, StepNumber = 2, StepName = "Quality Manager Review", RequiredRole = "Quality Manager", RequiredUserId = qmUserId, Status = "pending", CreatedAt = now },
                new() { Id = Guid.NewGuid(), DocumentId = id, StepNumber = 3, StepName = "Department Head Approval", RequiredRole = "Department Head", RequiredUserId = dhUserId, Status = "pending", CreatedAt = now }
            };

            _context.DocumentApprovalWorkflows.AddRange(steps);

            if (!string.Equals(doc.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                doc.Status = "Pending Approval";
                _context.Entry(doc).State = EntityState.Modified;
            }

            await _context.SaveChangesAsync();

            await NotifyNextApproverAsync(doc, steps);
            return Ok(BuildApprovalStatusResponse(doc, steps));
        }

        private async Task NotifyNextApproverAsync(AeroQMS.API.Models.Document doc, List<DocumentApprovalWorkflow> steps)
        {
            var next = steps.OrderBy(s => s.StepNumber).FirstOrDefault(s => string.Equals(s.Status, "pending", StringComparison.OrdinalIgnoreCase));
            if (next == null) return;

            User? target = null;
            if (next.RequiredUserId.HasValue)
                target = await _context.Users.FirstOrDefaultAsync(u => u.Id == next.RequiredUserId.Value);
            else if (!string.IsNullOrWhiteSpace(next.RequiredRole))
                target = await _context.Users.FirstOrDefaultAsync(u => u.Role == next.RequiredRole);

            if (target == null) return;

            await _emailService.SendDocumentApprovalActionRequiredEmail(doc, target, next.StepName);
        }

        [HttpPost("{id}/approve-step")]
        public async Task<IActionResult> ApproveStep(int id, [FromBody] ApprovalActionRequest request)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var user = await GetAuthenticatedUserAsync();
            if (user == null) return StatusCode(403);

            var steps = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == id)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();
            if (steps.Count == 0) return BadRequest("No workflow configured");

            var current = steps.FirstOrDefault(s => !string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));
            if (current == null) return BadRequest("Already approved");

            if (!CanUserActOnStep(doc, user, current)) return StatusCode(403);

            current.Status = "approved";
            current.Action = "approved";
            current.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
            current.ActionedById = user.Id;
            current.ActionedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var refreshed = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == id)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();

            if (refreshed.All(s => string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase)))
            {
                doc.Status = "Approved";
                _context.Entry(doc).State = EntityState.Modified;
                await _context.SaveChangesAsync();
            }
            else
            {
                await NotifyNextApproverAsync(doc, refreshed);
            }

            return Ok(BuildApprovalStatusResponse(doc, refreshed));
        }

        [HttpPost("{id}/request-changes")]
        public async Task<IActionResult> RequestChanges(int id, [FromBody] ApprovalActionRequest request)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var user = await GetAuthenticatedUserAsync();
            if (user == null) return StatusCode(403);

            var steps = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == id)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();
            if (steps.Count == 0) return BadRequest("No workflow configured");

            var current = steps.FirstOrDefault(s => !string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));
            if (current == null) return BadRequest("Already approved");

            if (!CanUserActOnStep(doc, user, current)) return StatusCode(403);

            current.Status = "changes_requested";
            current.Action = "request_changes";
            current.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
            current.ActionedById = user.Id;
            current.ActionedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(BuildApprovalStatusResponse(doc, steps));
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> RejectDocument(int id, [FromBody] ApprovalActionRequest request)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var user = await GetAuthenticatedUserAsync();
            if (user == null) return StatusCode(403);

            var steps = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == id)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();
            if (steps.Count == 0) return BadRequest("No workflow configured");

            var current = steps.FirstOrDefault(s => !string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase));
            if (current == null) return BadRequest("Already approved");

            if (!CanUserActOnStep(doc, user, current)) return StatusCode(403);

            current.Status = "rejected";
            current.Action = "rejected";
            current.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
            current.ActionedById = user.Id;
            current.ActionedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(BuildApprovalStatusResponse(doc, steps));
        }

        public sealed class CreateApprovalStepRequest
        {
            [JsonPropertyName("step_name")]
            public string StepName { get; set; } = "";

            [JsonPropertyName("required_role")]
            public string RequiredRole { get; set; } = "";

            [JsonPropertyName("required_user_id")]
            public int? RequiredUserId { get; set; }

            [JsonPropertyName("insert_after_step")]
            public int? InsertAfterStep { get; set; }
        }

        public sealed class ReorderApprovalStepsRequest
        {
            [JsonPropertyName("step_ids")]
            public List<string> StepIds { get; set; } = new();
        }

        private async Task<(AeroQMS.API.Models.Document? Doc, List<DocumentApprovalWorkflow> Steps, int UserId, IActionResult? Error)> LoadApprovalContextAsync(int documentId)
        {
            var authUserId = GetAuthenticatedUserId();
            if (!authUserId.HasValue) return (null, new List<DocumentApprovalWorkflow>(), 0, Unauthorized());

            var doc = await _context.Documents.FindAsync(documentId);
            if (doc == null) return (null, new List<DocumentApprovalWorkflow>(), authUserId.Value, NotFound(new { error = "Document not found" }));

            var canManage = await _authService.IsAdminOrQualityManagerAsync(authUserId.Value);
            if (!canManage)
                return (doc, new List<DocumentApprovalWorkflow>(), authUserId.Value, StatusCode(403, new { error = "Only Admins and Quality Managers can manage workflow steps" }));

            var steps = await _context.DocumentApprovalWorkflows
                .Where(x => x.DocumentId == documentId)
                .OrderBy(x => x.StepNumber)
                .ToListAsync();

            return (doc, steps, authUserId.Value, null);
        }

        private static IActionResult WorkflowLockedResult() =>
            new BadRequestObjectResult(new { error = "Cannot edit steps while approval is in progress" });

        [HttpPost("{id}/approval/steps")]
        public async Task<IActionResult> AddApprovalStep(int id, [FromBody] CreateApprovalStepRequest request = null!)
        {
            var ctx = await LoadApprovalContextAsync(id);
            if (ctx.Error != null) return ctx.Error;

            var doc = ctx.Doc!;
            var steps = ctx.Steps;
            var status = ComputeApprovalStatus(doc, steps);
            if (!IsEditableWorkflowStatus(status)) return WorkflowLockedResult();

            var stepName = (request?.StepName ?? "").Trim();
            var requiredRole = (request?.RequiredRole ?? "").Trim();
            if (string.IsNullOrWhiteSpace(stepName)) return BadRequest(new { error = "Step name is required" });
            if (stepName.Length > 100) return BadRequest(new { error = "Step name must be 100 characters or less" });
            if (string.IsNullOrWhiteSpace(requiredRole)) return BadRequest(new { error = "Required role is required" });

            int? requiredUserId = request.RequiredUserId;
            if (requiredUserId.HasValue)
            {
                var exists = await _context.Users.AnyAsync(u => u.Id == requiredUserId.Value);
                if (!exists) return BadRequest(new { error = "Assigned user not found" });
            }

            var maxStep = steps.Count == 0 ? 0 : steps.Max(s => s.StepNumber);
            var insertAfter = request.InsertAfterStep;
            if (!insertAfter.HasValue) insertAfter = maxStep;
            if (insertAfter.Value < 0) insertAfter = 0;
            if (insertAfter.Value > maxStep) insertAfter = maxStep;

            var newStepNumber = insertAfter.Value + 1;
            foreach (var s in steps.Where(s => s.StepNumber >= newStepNumber))
                s.StepNumber += 1;

            var now = DateTime.UtcNow;
            var step = new DocumentApprovalWorkflow
            {
                Id = Guid.NewGuid(),
                DocumentId = id,
                StepNumber = newStepNumber,
                StepName = stepName,
                RequiredRole = requiredRole,
                RequiredUserId = requiredUserId,
                Status = "pending",
                CreatedAt = now
            };

            _context.DocumentApprovalWorkflows.Add(step);

            var renumber = steps.Concat(new[] { step }).OrderBy(s => s.StepNumber).ToList();
            for (var i = 0; i < renumber.Count; i++)
                renumber[i].StepNumber = i + 1;

            if (string.Equals(doc.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                doc.Status = "Pending Approval";
                _context.Entry(doc).State = EntityState.Modified;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                step = new
                {
                    id = step.Id,
                    step_number = step.StepNumber,
                    step_name = step.StepName,
                    required_role = step.RequiredRole,
                    required_user_id = step.RequiredUserId,
                    status = step.Status
                }
            });
        }

        [HttpGet("{id}/approval/steps/{stepId}")]
        public async Task<IActionResult> GetApprovalStep(int id, Guid stepId)
        {
            var authUserId = GetAuthenticatedUserId();
            if (!authUserId.HasValue) return Unauthorized();

            var step = await _context.DocumentApprovalWorkflows.FirstOrDefaultAsync(s => s.DocumentId == id && s.Id == stepId);
            if (step == null) return NotFound(new { error = "Step not found" });

            return Ok(new
            {
                id = step.Id,
                document_id = step.DocumentId,
                step_number = step.StepNumber,
                step_name = step.StepName,
                required_role = step.RequiredRole,
                required_user_id = step.RequiredUserId,
                status = step.Status,
                action = step.Action,
                comment = step.Comment,
                actioned_by_id = step.ActionedById,
                actioned_at = step.ActionedAt,
                created_at = step.CreatedAt
            });
        }

        [HttpPut("{id}/approval/steps/{stepId}")]
        public async Task<IActionResult> UpdateApprovalStep(int id, Guid stepId, [FromBody] JsonElement body)
        {
            var ctx = await LoadApprovalContextAsync(id);
            if (ctx.Error != null) return ctx.Error;

            var doc = ctx.Doc!;
            var steps = ctx.Steps;
            var status = ComputeApprovalStatus(doc, steps);
            if (!IsEditableWorkflowStatus(status)) return WorkflowLockedResult();

            var step = steps.FirstOrDefault(s => s.Id == stepId);
            if (step == null) return NotFound(new { error = "Step not found" });

            string? stepName = null;
            if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("step_name", out var stepNameEl))
            {
                if (stepNameEl.ValueKind == JsonValueKind.Null) return BadRequest(new { error = "Step name is required" });
                stepName = (stepNameEl.GetString() ?? "").Trim();
                if (string.IsNullOrWhiteSpace(stepName)) return BadRequest(new { error = "Step name is required" });
                if (stepName.Length > 100) return BadRequest(new { error = "Step name must be 100 characters or less" });
                step.StepName = stepName;
            }

            string? requiredRole = null;
            if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("required_role", out var roleEl))
            {
                if (roleEl.ValueKind == JsonValueKind.Null) return BadRequest(new { error = "Required role is required" });
                requiredRole = (roleEl.GetString() ?? "").Trim();
                if (string.IsNullOrWhiteSpace(requiredRole)) return BadRequest(new { error = "Required role is required" });
                step.RequiredRole = requiredRole;
            }

            var touchedUser = false;
            int? requiredUserId = null;
            if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("required_user_id", out var userEl))
            {
                touchedUser = true;
                if (userEl.ValueKind == JsonValueKind.Null)
                {
                    requiredUserId = null;
                }
                else if (userEl.ValueKind == JsonValueKind.Number && userEl.TryGetInt32(out var n))
                {
                    requiredUserId = n;
                }
                else if (userEl.ValueKind == JsonValueKind.String && int.TryParse(userEl.GetString(), out var n2))
                {
                    requiredUserId = n2;
                }
                else
                {
                    return BadRequest(new { error = "Assigned user not found" });
                }

                if (requiredUserId.HasValue)
                {
                    var exists = await _context.Users.AnyAsync(u => u.Id == requiredUserId.Value);
                    if (!exists) return BadRequest(new { error = "Assigned user not found" });
                }
            }

            if (touchedUser)
            {
                step.RequiredUserId = requiredUserId;
            }

            if (stepName == null && requiredRole == null && !touchedUser)
                return BadRequest(new { error = "No fields to update" });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                step = new
                {
                    id = step.Id,
                    step_number = step.StepNumber,
                    step_name = step.StepName,
                    required_role = step.RequiredRole,
                    required_user_id = step.RequiredUserId,
                    status = step.Status
                }
            });
        }

        [HttpDelete("{id}/approval/steps/{stepId}")]
        public async Task<IActionResult> DeleteApprovalStep(int id, Guid stepId)
        {
            var ctx = await LoadApprovalContextAsync(id);
            if (ctx.Error != null) return ctx.Error;

            var doc = ctx.Doc!;
            var steps = ctx.Steps;
            var status = ComputeApprovalStatus(doc, steps);
            if (!IsEditableWorkflowStatus(status)) return WorkflowLockedResult();

            if (steps.Count == 1) return BadRequest(new { error = "Cannot delete the only step. Add another step first." });

            var step = steps.FirstOrDefault(s => s.Id == stepId);
            if (step == null) return NotFound(new { error = "Step not found" });

            var deletedStepNumber = step.StepNumber;
            _context.DocumentApprovalWorkflows.Remove(step);

            foreach (var s in steps.Where(s => s.Id != stepId && s.StepNumber > deletedStepNumber))
                s.StepNumber -= 1;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPatch("{id}/approval/steps/reorder")]
        public async Task<IActionResult> ReorderApprovalSteps(int id, [FromBody] ReorderApprovalStepsRequest request = null!)
        {
            var ctx = await LoadApprovalContextAsync(id);
            if (ctx.Error != null) return ctx.Error;

            var doc = ctx.Doc!;
            var steps = ctx.Steps;
            var status = ComputeApprovalStatus(doc, steps);
            if (!IsEditableWorkflowStatus(status)) return WorkflowLockedResult();

            var stepIdsRaw = request?.StepIds ?? new List<string>();
            if (stepIdsRaw.Count == 0) return BadRequest(new { error = "No step ids provided" });

            var parsed = new List<Guid>();
            foreach (var s in stepIdsRaw)
            {
                if (!Guid.TryParse(s, out var g)) return BadRequest(new { error = "Invalid step id" });
                parsed.Add(g);
            }

            if (parsed.Distinct().Count() != parsed.Count) return BadRequest(new { error = "Duplicate step ids provided" });
            if (parsed.Count != steps.Count) return BadRequest(new { error = "Step list does not match workflow" });

            var existingSet = steps.Select(s => s.Id).ToHashSet();
            if (!parsed.All(existingSet.Contains)) return BadRequest(new { error = "Step list does not match workflow" });

            var map = steps.ToDictionary(s => s.Id, s => s);
            for (var i = 0; i < parsed.Count; i++)
            {
                map[parsed[i]].StepNumber = i + 1;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPatch("{id}/approval/reorder")]
        public Task<IActionResult> ReorderApprovalStepsLegacy(int id, [FromBody] ReorderApprovalStepsRequest request = null!) =>
            ReorderApprovalSteps(id, request);

        [HttpGet("{id}/versions")]
        public async Task<IActionResult> GetDocumentVersions(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            static int ParseRevisionNumber(string? revision)
            {
                if (string.IsNullOrWhiteSpace(revision)) return -1;
                var digits = new string(revision.Where(char.IsDigit).ToArray());
                return int.TryParse(digits, out var n) ? n : -1;
            }

            var snapshots = await _context.DocumentVersions
                .Where(v => v.DocumentId == id)
                .OrderByDescending(v => v.SnapshotAt)
                .ToListAsync();

            var current = new DocumentVersionDto
            {
                id = doc.Id.ToString(),
                source = "document",
                document_id = doc.Id,
                document_number = doc.DocumentNumber,
                title = doc.Title,
                revision = doc.Revision,
                revision_number = ParseRevisionNumber(doc.Revision),
                effective_date = doc.EffectiveDate,
                review_date = doc.ReviewDate,
                owner = doc.Owner,
                status = doc.Status,
                file_name = doc.FileName,
                snapshot_at = (DateTime?)null,
                is_current = true
            };

            var previous = snapshots.Select(v => new DocumentVersionDto
                {
                    id = v.Id.ToString(),
                    source = "version",
                    document_id = v.DocumentId,
                    document_number = v.DocumentNumber,
                    title = v.Title,
                    revision = v.Revision,
                    revision_number = ParseRevisionNumber(v.Revision),
                    effective_date = v.EffectiveDate,
                    review_date = v.ReviewDate,
                    owner = v.Owner,
                    status = v.Status,
                    file_name = v.FileName,
                    snapshot_at = v.SnapshotAt,
                    is_current = false,
                    change_summary = v.ChangeSummary,
                    approval_snapshot = v.ApprovalSnapshot
                })
                .ToList();

            var versions = new List<DocumentVersionDto> { current };
            versions.AddRange(previous);

            versions = versions
                .OrderByDescending(v => v.revision_number)
                .ThenByDescending(v => v.snapshot_at ?? DateTime.MinValue)
                .ToList();

            return Ok(new { current_id = id.ToString(), versions });
        }

        private static DateTime ComputeAcknowledgmentDueDate(AeroQMS.API.Models.Document doc, int dueDays)
        {
            var start = doc.EffectiveDate.Date > DateTime.UtcNow.Date ? doc.EffectiveDate.Date : DateTime.UtcNow.Date;
            if (dueDays < 0) dueDays = 0;
            return start.AddDays(dueDays);
        }

        private static IReadOnlyList<string> ParseChangeSummary(string? summary)
        {
            if (string.IsNullOrWhiteSpace(summary)) return Array.Empty<string>();
            return summary
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .Where(s => s.Length > 0)
                .ToList();
        }

        private async Task<(AeroQMS.API.Models.Document? Doc, User? User, IActionResult? Error)> LoadAckDocumentContextAsync(int documentId)
        {
            var user = await GetAuthenticatedUserAsync();
            if (user == null) return (null, null, Unauthorized());
            var doc = await _context.Documents.FindAsync(documentId);
            if (doc == null) return (null, user, NotFound(new { error = "Document not found" }));
            return (doc, user, null);
        }

        [HttpGet("{id}/acknowledgment/summary")]
        public async Task<IActionResult> GetDocumentAcknowledgmentSummary(int id)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var doc = ctx.Doc!;
            var user = ctx.User!;

            var requirements = await _context.DocumentAcknowledgmentRequirements
                .Where(r => r.DocumentId == id)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var requiredUserIds = new HashSet<int>();
            var roleRequirements = requirements
                .Where(r => !string.IsNullOrWhiteSpace(r.RequiredRole))
                .Select(r => r.RequiredRole!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var allUsers = await _context.Users.Where(u => u.IsActive).ToListAsync();

            foreach (var role in roleRequirements)
            {
                var roleKey = NormalizeRoleKey(role);
                if (roleKey == "document_owner")
                {
                    var ownerIds = allUsers
                        .Where(u => !string.IsNullOrWhiteSpace(u.Name) && !string.IsNullOrWhiteSpace(doc.Owner) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase))
                        .Select(u => u.Id);
                    foreach (var uid in ownerIds) requiredUserIds.Add(uid);
                    continue;
                }

                foreach (var uid in allUsers.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id))
                    requiredUserIds.Add(uid);
            }

            foreach (var uid in requirements.Where(r => r.IndividualUserId.HasValue).Select(r => r.IndividualUserId!.Value))
            {
                if (allUsers.Any(u => u.Id == uid)) requiredUserIds.Add(uid);
            }

            var requiredUsers = allUsers
                .Where(u => requiredUserIds.Contains(u.Id))
                .OrderBy(u => u.Name)
                .Select(u => new { u.Id, u.Name, u.Email, u.Role })
                .ToList();

            var currentRevision = doc.Revision ?? "";
            var acknowledgments = await _context.DocumentAcknowledgments
                .Where(a => a.DocumentId == id && a.DocumentRevision == currentRevision)
                .ToListAsync();

            var ackMap = acknowledgments
                .GroupBy(a => a.UserId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AcknowledgedAt).First());

            var canManage = await _authService.IsAdminOrQualityManagerAsync(user.Id);

            var dueDays = requirements.Count > 0 ? requirements.Min(r => r.DueDays) : 7;
            var dueDate = ComputeAcknowledgmentDueDate(doc, dueDays);

            var groups = new List<object>();

            foreach (var role in roleRequirements)
            {
                var roleKey = NormalizeRoleKey(role);
                var userIds = new List<int>();
                if (roleKey == "document_owner")
                {
                    userIds = allUsers
                        .Where(u => !string.IsNullOrWhiteSpace(u.Name) && !string.IsNullOrWhiteSpace(doc.Owner) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase))
                        .Select(u => u.Id)
                        .ToList();
                }
                else
                {
                    userIds = allUsers.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id).ToList();
                }

                userIds = userIds.Where(requiredUserIds.Contains).Distinct().ToList();
                if (userIds.Count == 0) continue;

                var personnel = requiredUsers
                    .Where(u => userIds.Contains(u.Id))
                    .Select(u => new
                    {
                        user_id = u.Id,
                        name = u.Name,
                        email = u.Email,
                        role = u.Role,
                        acknowledged = ackMap.ContainsKey(u.Id),
                        acknowledged_at = ackMap.TryGetValue(u.Id, out var a) ? a.AcknowledgedAt : (DateTime?)null
                    })
                    .ToList();

                var total = personnel.Count;
                var acknowledgedCount = personnel.Count(p => p.acknowledged);
                var pct = total == 0 ? 100 : (int)Math.Round((acknowledgedCount * 100.0) / total);

                groups.Add(new
                {
                    group = role,
                    acknowledged = acknowledgedCount,
                    total,
                    pct,
                    personnel
                });
            }

            var individualReqIds = requirements
                .Where(r => r.IndividualUserId.HasValue && string.IsNullOrWhiteSpace(r.RequiredRole))
                .Select(r => r.IndividualUserId!.Value)
                .Distinct()
                .ToList();

            if (individualReqIds.Count > 0)
            {
                var personnel = requiredUsers
                    .Where(u => individualReqIds.Contains(u.Id))
                    .Select(u => new
                    {
                        user_id = u.Id,
                        name = u.Name,
                        email = u.Email,
                        role = u.Role,
                        acknowledged = ackMap.ContainsKey(u.Id),
                        acknowledged_at = ackMap.TryGetValue(u.Id, out var a) ? a.AcknowledgedAt : (DateTime?)null
                    })
                    .ToList();

                var total = personnel.Count;
                var acknowledgedCount = personnel.Count(p => p.acknowledged);
                var pct = total == 0 ? 100 : (int)Math.Round((acknowledgedCount * 100.0) / total);

                groups.Add(new
                {
                    group = "Individuals",
                    acknowledged = acknowledgedCount,
                    total,
                    pct,
                    personnel
                });
            }

            var totalRequired = requiredUsers.Count;
            var acknowledgedTotal = requiredUsers.Count(u => ackMap.ContainsKey(u.Id));
            var overallPct = totalRequired == 0 ? 100 : (int)Math.Round((acknowledgedTotal * 100.0) / totalRequired);

            return Ok(new
            {
                document = new
                {
                    id = doc.Id,
                    document_number = doc.DocumentNumber,
                    title = doc.Title,
                    revision = doc.Revision,
                    effective_date = doc.EffectiveDate,
                    status = doc.Status
                },
                stats = new
                {
                    acknowledged = acknowledgedTotal,
                    total = totalRequired,
                    pct = overallPct,
                    due_date = dueDate
                },
                groups,
                requirements = requirements.Select(r => new
                {
                    id = r.Id,
                    required_role = r.RequiredRole,
                    individual_user_id = r.IndividualUserId,
                    due_days = r.DueDays,
                    created_at = r.CreatedAt
                }).ToList(),
                permissions = new
                {
                    can_manage = canManage
                }
            });
        }

        [HttpPost("{id}/acknowledgment")]
        public async Task<IActionResult> AcknowledgeDocument(int id, [FromBody] JsonElement body)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var doc = ctx.Doc!;
            var user = ctx.User!;

            if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("confirm", out var confirmEl))
            {
                if (confirmEl.ValueKind == JsonValueKind.False) return BadRequest(new { error = "Confirmation is required" });
            }

            var revision = doc.Revision ?? "";
            if (string.IsNullOrWhiteSpace(revision)) return BadRequest(new { error = "Document revision is required" });

            var existing = await _context.DocumentAcknowledgments
                .FirstOrDefaultAsync(a => a.DocumentId == id && a.UserId == user.Id && a.DocumentRevision == revision);
            if (existing != null)
            {
                return Ok(new { success = true, acknowledged_at = existing.AcknowledgedAt });
            }

            var latestVersionId = await _context.DocumentVersions
                .Where(v => v.DocumentId == id && v.Revision == revision)
                .OrderByDescending(v => v.SnapshotAt)
                .Select(v => (Guid?)v.Id)
                .FirstOrDefaultAsync();

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var device = Request.Headers["User-Agent"].ToString();

            var ack = new DocumentAcknowledgment
            {
                Id = Guid.NewGuid(),
                DocumentId = id,
                VersionId = latestVersionId,
                UserId = user.Id,
                DocumentRevision = revision,
                AcknowledgedAt = DateTime.UtcNow,
                IpAddress = string.IsNullOrWhiteSpace(ip) ? null : ip,
                DeviceInfo = string.IsNullOrWhiteSpace(device) ? null : device
            };

            _context.DocumentAcknowledgments.Add(ack);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, acknowledged_at = ack.AcknowledgedAt });
        }

        public sealed class CreateAcknowledgmentRequirementRequest
        {
            [JsonPropertyName("required_role")]
            public string? RequiredRole { get; set; }

            [JsonPropertyName("individual_user_id")]
            public int? IndividualUserId { get; set; }

            [JsonPropertyName("due_days")]
            public int? DueDays { get; set; }
        }

        [HttpPost("{id}/acknowledgment/requirements")]
        public async Task<IActionResult> AddAcknowledgmentRequirement(int id, [FromBody] CreateAcknowledgmentRequirementRequest request = null!)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var user = ctx.User!;

            var canManage = await _authService.IsAdminOrQualityManagerAsync(user.Id);
            if (!canManage) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage acknowledgment requirements" });

            var requiredRole = (request?.RequiredRole ?? "").Trim();
            var individualUserId = request?.IndividualUserId;
            var dueDays = request?.DueDays ?? 7;

            if (string.IsNullOrWhiteSpace(requiredRole) && !individualUserId.HasValue)
                return BadRequest(new { error = "Required role or individual user is required" });

            if (individualUserId.HasValue)
            {
                var exists = await _context.Users.AnyAsync(u => u.Id == individualUserId.Value && u.IsActive);
                if (!exists) return BadRequest(new { error = "Assigned user not found" });
            }

            var entity = new DocumentAcknowledgmentRequirement
            {
                Id = Guid.NewGuid(),
                DocumentId = id,
                RequiredRole = string.IsNullOrWhiteSpace(requiredRole) ? null : requiredRole,
                IndividualUserId = individualUserId,
                DueDays = dueDays < 0 ? 0 : dueDays,
                CreatedAt = DateTime.UtcNow
            };

            _context.DocumentAcknowledgmentRequirements.Add(entity);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, id = entity.Id });
        }

        [HttpDelete("{id}/acknowledgment/requirements/{reqId:guid}")]
        public async Task<IActionResult> DeleteAcknowledgmentRequirement(int id, Guid reqId)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var user = ctx.User!;

            var canManage = await _authService.IsAdminOrQualityManagerAsync(user.Id);
            if (!canManage) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage acknowledgment requirements" });

            var entity = await _context.DocumentAcknowledgmentRequirements.FirstOrDefaultAsync(r => r.DocumentId == id && r.Id == reqId);
            if (entity == null) return NotFound(new { error = "Requirement not found" });
            _context.DocumentAcknowledgmentRequirements.Remove(entity);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("{id}/acknowledgment/reminders")]
        public async Task<IActionResult> SendAcknowledgmentReminders(int id, [FromQuery] int? user_id = null)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var doc = ctx.Doc!;
            var user = ctx.User!;

            var canManage = await _authService.IsAdminOrQualityManagerAsync(user.Id);
            if (!canManage) return StatusCode(403, new { error = "Only Admins and Quality Managers can send reminders" });

            var summary = await GetDocumentAcknowledgmentSummary(id) as OkObjectResult;
            if (summary?.Value == null) return StatusCode(500, new { error = "Unable to compute summary" });

            var requirements = await _context.DocumentAcknowledgmentRequirements
                .Where(r => r.DocumentId == id)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
            var dueDays = requirements.Count > 0 ? requirements.Min(r => r.DueDays) : 7;
            var dueDate = ComputeAcknowledgmentDueDate(doc, dueDays);

            var keyChanges = await _context.DocumentVersions
                .Where(v => v.DocumentId == id)
                .OrderByDescending(v => v.SnapshotAt)
                .Select(v => v.ChangeSummary)
                .FirstOrDefaultAsync();

            var changes = ParseChangeSummary(keyChanges);
            var link = $"{Request.Scheme}://{Request.Host}/my-documents";

            var allUsers = await _context.Users.Where(u => u.IsActive).ToListAsync();
            var requiredRoleKeys = requirements.Where(r => !string.IsNullOrWhiteSpace(r.RequiredRole)).Select(r => NormalizeRoleKey(r.RequiredRole)).Distinct().ToList();
            var requiredUserIds = new HashSet<int>();

            foreach (var roleKey in requiredRoleKeys)
            {
                if (roleKey == "document_owner")
                {
                    foreach (var uid in allUsers.Where(u => !string.IsNullOrWhiteSpace(u.Name) && !string.IsNullOrWhiteSpace(doc.Owner) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)).Select(u => u.Id))
                        requiredUserIds.Add(uid);
                    continue;
                }
                foreach (var uid in allUsers.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id))
                    requiredUserIds.Add(uid);
            }
            foreach (var uid in requirements.Where(r => r.IndividualUserId.HasValue).Select(r => r.IndividualUserId!.Value))
            {
                if (allUsers.Any(u => u.Id == uid)) requiredUserIds.Add(uid);
            }

            var revision = doc.Revision ?? "";
            var already = await _context.DocumentAcknowledgments
                .Where(a => a.DocumentId == id && a.DocumentRevision == revision)
                .Select(a => a.UserId)
                .Distinct()
                .ToListAsync();
            var acknowledgedSet = already.ToHashSet();

            var pendingUsers = allUsers.Where(u => requiredUserIds.Contains(u.Id) && !acknowledgedSet.Contains(u.Id)).ToList();
            if (user_id.HasValue)
                pendingUsers = pendingUsers.Where(u => u.Id == user_id.Value).ToList();
            foreach (var target in pendingUsers)
            {
                await _emailService.SendDocumentAcknowledgmentRequiredEmail(doc, target, dueDate, changes, link);
            }

            return Ok(new { success = true, sent = pendingUsers.Count });
        }

        [HttpGet("{id}/acknowledgment/report")]
        public async Task<IActionResult> ExportAcknowledgmentReport(int id)
        {
            var ctx = await LoadAckDocumentContextAsync(id);
            if (ctx.Error != null) return ctx.Error;
            var doc = ctx.Doc!;

            var requirements = await _context.DocumentAcknowledgmentRequirements
                .Where(r => r.DocumentId == id)
                .ToListAsync();
            if (requirements.Count == 0)
                return BadRequest(new { error = "No acknowledgment requirements configured" });

            var allUsers = await _context.Users.Where(u => u.IsActive).ToListAsync();
            var requiredUserIds = new HashSet<int>();
            foreach (var r in requirements)
            {
                if (r.IndividualUserId.HasValue)
                {
                    if (allUsers.Any(u => u.Id == r.IndividualUserId.Value)) requiredUserIds.Add(r.IndividualUserId.Value);
                    continue;
                }
                if (string.IsNullOrWhiteSpace(r.RequiredRole)) continue;
                var roleKey = NormalizeRoleKey(r.RequiredRole);
                if (roleKey == "document_owner")
                {
                    foreach (var uid in allUsers.Where(u => !string.IsNullOrWhiteSpace(u.Name) && !string.IsNullOrWhiteSpace(doc.Owner) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)).Select(u => u.Id))
                        requiredUserIds.Add(uid);
                    continue;
                }
                foreach (var uid in allUsers.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id))
                    requiredUserIds.Add(uid);
            }

            var requiredUsers = allUsers.Where(u => requiredUserIds.Contains(u.Id)).OrderBy(u => u.Name).ToList();
            var revision = doc.Revision ?? "";
            var acknowledgments = await _context.DocumentAcknowledgments
                .Where(a => a.DocumentId == id && a.DocumentRevision == revision)
                .ToListAsync();
            var ackMap = acknowledgments
                .GroupBy(a => a.UserId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.AcknowledgedAt).First());

            var sb = new StringBuilder();
            sb.AppendLine("UserId,Name,Email,Role,Acknowledged,AcknowledgedAt");
            foreach (var u in requiredUsers)
            {
                var acknowledged = ackMap.TryGetValue(u.Id, out var a);
                var ackAt = acknowledged ? a!.AcknowledgedAt.ToString("o") : "";
                sb.AppendLine($"{u.Id},\"{(u.Name ?? "").Replace("\"", "\"\"")}\",\"{(u.Email ?? "").Replace("\"", "\"\"")}\",\"{(u.Role ?? "").Replace("\"", "\"\"")}\",{(acknowledged ? "Yes" : "No")},\"{ackAt}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var fileName = $"ack_report_{doc.DocumentNumber}_{DateTime.UtcNow:yyyyMMdd}.csv";
            return File(bytes, "text/csv", fileName);
        }

        [HttpGet("my-documents")]
        public async Task<IActionResult> GetMyDocumentsRequiringAcknowledgment()
        {
            var user = await GetAuthenticatedUserAsync();
            if (user == null) return Unauthorized();

            var docs = await _context.Documents.ToListAsync();
            var requirements = await _context.DocumentAcknowledgmentRequirements.ToListAsync();
            var acknowledgments = await _context.DocumentAcknowledgments.Where(a => a.UserId == user.Id).ToListAsync();
            var ackKeys = acknowledgments
                .Select(a => $"{a.DocumentId}:{a.DocumentRevision}")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var roleKey = NormalizeRoleKey(user.Role);
            var result = new List<object>();

            foreach (var d in docs)
            {
                var reqs = requirements.Where(r => r.DocumentId == d.Id).ToList();
                if (reqs.Count == 0) continue;

                var required = false;
                foreach (var r in reqs)
                {
                    if (r.IndividualUserId.HasValue && r.IndividualUserId.Value == user.Id) { required = true; break; }
                    if (!string.IsNullOrWhiteSpace(r.RequiredRole))
                    {
                        var rk = NormalizeRoleKey(r.RequiredRole);
                        if (rk == "document_owner" && !string.IsNullOrWhiteSpace(d.Owner) && !string.IsNullOrWhiteSpace(user.Name) && d.Owner.Trim().Equals(user.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                        {
                            required = true; break;
                        }
                        if (rk == roleKey) { required = true; break; }
                    }
                }

                if (!required) continue;

                var key = $"{d.Id}:{(d.Revision ?? "")}";
                var acknowledged = ackKeys.Contains(key);
                if (acknowledged) continue;

                var dueDays = reqs.Min(r => r.DueDays);
                var dueDate = ComputeAcknowledgmentDueDate(d, dueDays);

                result.Add(new
                {
                    id = d.Id,
                    document_number = d.DocumentNumber,
                    title = d.Title,
                    revision = d.Revision,
                    due_date = dueDate,
                    effective_date = d.EffectiveDate
                });
            }

            return Ok(new
            {
                count = result.Count,
                documents = result
            });
        }

        private sealed class DocumentVersionDto
        {
            public string id { get; set; } = "";
            public string source { get; set; } = "";
            public int document_id { get; set; }
            public string document_number { get; set; } = "";
            public string title { get; set; } = "";
            public string revision { get; set; } = "";
            public int revision_number { get; set; }
            public DateTime effective_date { get; set; }
            public DateTime review_date { get; set; }
            public string owner { get; set; } = "";
            public string status { get; set; } = "";
            public string? file_name { get; set; }
            public DateTime? snapshot_at { get; set; }
            public bool is_current { get; set; }
            public string? change_summary { get; set; }
            public string? approval_snapshot { get; set; }
        }

        [HttpGet("{id}/impact-analysis")]
        public async Task<IActionResult> GetImpactAnalysis(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var needles = new List<string>();
            if (!string.IsNullOrWhiteSpace(doc.DocumentNumber)) needles.Add(doc.DocumentNumber.Trim());
            if (!string.IsNullOrWhiteSpace(doc.Title)) needles.Add(doc.Title.Trim());
            needles = needles
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            static bool ContainsAny(string? haystack, IReadOnlyList<string> terms)
            {
                if (string.IsNullOrWhiteSpace(haystack) || terms.Count == 0) return false;
                foreach (var t in terms)
                {
                    if (haystack.IndexOf(t, StringComparison.OrdinalIgnoreCase) >= 0) return true;
                }
                return false;
            }

            var otherDocs = await _context.Documents.Where(d => d.Id != id).ToListAsync();
            var referencingDocuments = otherDocs
                .Where(d => ContainsAny(d.DocumentNumber, needles)
                    || ContainsAny(d.Title, needles)
                    || ContainsAny(d.FileName, needles))
                .OrderBy(d => d.DocumentNumber)
                .Take(50)
                .Select(d => new
                {
                    id = d.Id,
                    document_number = d.DocumentNumber,
                    title = d.Title,
                    revision = d.Revision,
                    status = d.Status,
                    owner = d.Owner
                })
                .ToList();

            var ncrs = await _context.NonConformances.ToListAsync();
            var linkedNcrs = ncrs
                .Where(n => ContainsAny(n.NCRNumber, needles)
                    || ContainsAny(n.Title, needles)
                    || ContainsAny(n.Description, needles))
                .OrderByDescending(n => n.Date)
                .Take(50)
                .Select(n => new
                {
                    id = n.Id,
                    ncr_number = n.NCRNumber,
                    title = n.Title,
                    status = n.Status
                })
                .ToList();

            var capas = await _context.CapaActions.ToListAsync();
            var linkedCapas = capas
                .Where(c => ContainsAny(c.Title, needles)
                    || ContainsAny(c.Description, needles)
                    || ContainsAny(c.NCRReference, needles)
                    || ContainsAny(c.NCRTitle, needles))
                .OrderByDescending(c => c.UpdatedAt)
                .Take(50)
                .Select(c => new
                {
                    id = c.Id,
                    title = c.Title,
                    status = c.Status,
                    priority = c.Priority,
                    responsible = c.ResponsiblePersonName,
                    ncr_reference = c.NCRReference
                })
                .ToList();

            var trainings = await _context.TrainingRecords.ToListAsync();
            var trainedPeople = trainings
                .Where(t => ContainsAny(t.Course, needles)
                    || ContainsAny(t.Category, needles)
                    || (!string.IsNullOrWhiteSpace(doc.Category) && string.Equals(t.Category, doc.Category, StringComparison.OrdinalIgnoreCase)))
                .Select(t => new { t.StaffMember, t.Category })
                .Where(x => !string.IsNullOrWhiteSpace(x.StaffMember))
                .ToList();

            var trainedPersonnel = new
            {
                total = trainedPeople.Select(x => x.StaffMember).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                groups = trainedPeople
                    .GroupBy(x => string.IsNullOrWhiteSpace(x.Category) ? "General" : x.Category)
                    .Select(g => new
                    {
                        group = g.Key,
                        count = g.Select(x => x.StaffMember).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                        people = g.Select(x => x.StaffMember).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).Take(50).ToList()
                    })
                    .OrderByDescending(x => x.count)
                    .ToList()
            };

            return Ok(new
            {
                document = new
                {
                    id = doc.Id,
                    document_number = doc.DocumentNumber,
                    title = doc.Title,
                    revision = doc.Revision,
                    effective_date = doc.EffectiveDate,
                    review_date = doc.ReviewDate,
                    owner = doc.Owner,
                    status = doc.Status
                },
                referencing_documents = referencingDocuments,
                trained_personnel = trainedPersonnel,
                linked_ncrs = linkedNcrs,
                linked_capas = linkedCapas
            });
        }

        private sealed class DocumentSnapshot
        {
            public string Source { get; init; } = "";
            public string Id { get; init; } = "";
            public int DocumentId { get; init; }
            public string DocumentNumber { get; init; } = "";
            public string Title { get; init; } = "";
            public string Category { get; init; } = "";
            public string Department { get; init; } = "";
            public string Revision { get; init; } = "";
            public DateTime EffectiveDate { get; init; }
            public DateTime ReviewDate { get; init; }
            public string Status { get; init; } = "";
            public string Owner { get; init; } = "";
            public string? FileName { get; init; }
            public string? ExtractedText { get; init; }
            public DateTime? SnapshotAt { get; init; }
        }

        private async Task<string?> ExtractPdfTextFromFileAsync(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName)) return null;
            if (!string.Equals(Path.GetExtension(fileName), ".pdf", StringComparison.OrdinalIgnoreCase)) return null;

            var filePath = Path.Combine(_uploadPath, fileName);
            if (!System.IO.File.Exists(filePath)) return null;

            try
            {
                using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var pdf = PdfDocument.Open(fs);
                var sb = new StringBuilder();
                foreach (var page in pdf.GetPages())
                {
                    var text = page.Text;
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        sb.AppendLine(text.TrimEnd());
                        sb.AppendLine();
                    }
                    if (sb.Length > 250_000) break;
                }

                var result = sb.ToString().Trim();
                if (result.Length > 250_000) result = result.Substring(0, 250_000);
                return string.IsNullOrWhiteSpace(result) ? null : result;
            }
            catch
            {
                return null;
            }
        }

        private async Task<string?> ExtractDocxTextFromFileAsync(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName)) return null;
            if (!string.Equals(Path.GetExtension(fileName), ".docx", StringComparison.OrdinalIgnoreCase)) return null;

            var filePath = Path.Combine(_uploadPath, fileName);
            if (!System.IO.File.Exists(filePath)) return null;

            try
            {
                using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var zip = new ZipArchive(fs, ZipArchiveMode.Read, leaveOpen: false);
                var entry = zip.GetEntry("word/document.xml");
                if (entry == null) return null;

                using var s = entry.Open();
                var doc = await XDocument.LoadAsync(s, LoadOptions.None, CancellationToken.None);
                var w = (XNamespace)"http://schemas.openxmlformats.org/wordprocessingml/2006/main";

                var sb = new StringBuilder();
                foreach (var p in doc.Descendants(w + "p"))
                {
                    var texts = p.Descendants(w + "t").Select(t => (string?)t).Where(t => !string.IsNullOrEmpty(t)).ToList();
                    if (texts.Count == 0) continue;
                    sb.AppendLine(string.Join("", texts).TrimEnd());
                    if (sb.Length > 250_000) break;
                }

                var result = sb.ToString().Trim();
                if (result.Length > 250_000) result = result.Substring(0, 250_000);
                return string.IsNullOrWhiteSpace(result) ? null : result;
            }
            catch
            {
                return null;
            }
        }

        private async Task<string?> ExtractTextFromFileAsync(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName)) return null;
            var ext = Path.GetExtension(fileName).ToLowerInvariant();

            if (ext == ".pdf")
                return await ExtractPdfTextFromFileAsync(fileName);

            if (ext == ".docx")
                return await ExtractDocxTextFromFileAsync(fileName);

            var allowedText = ext is ".txt" or ".md" or ".csv" or ".log" or ".json" or ".xml" or ".html";
            if (!allowedText) return null;

            var filePath = Path.Combine(_uploadPath, fileName);
            if (!System.IO.File.Exists(filePath)) return null;

            try
            {
                using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var reader = new StreamReader(fs, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
                var content = await reader.ReadToEndAsync();
                if (content.Length > 250_000) content = content.Substring(0, 250_000);
                content = content.Trim();
                return string.IsNullOrWhiteSpace(content) ? null : content;
            }
            catch
            {
                return null;
            }
        }

        private async Task<DocumentSnapshot?> ResolveSnapshotAsync(string id)
        {
            if (int.TryParse(id, out var docId))
            {
                var d = await _context.Documents.FindAsync(docId);
                if (d == null) return null;
                var extracted = await _context.DocumentVersions
                    .Where(v => v.DocumentId == docId && v.FileName == d.FileName && v.ExtractedText != null && v.ExtractedText != "")
                    .OrderByDescending(v => v.SnapshotAt)
                    .Select(v => v.ExtractedText)
                    .FirstOrDefaultAsync();
                extracted ??= await ExtractTextFromFileAsync(d.FileName);
                return new DocumentSnapshot
                {
                    Source = "document",
                    Id = d.Id.ToString(),
                    DocumentId = d.Id,
                    DocumentNumber = d.DocumentNumber,
                    Title = d.Title,
                    Category = d.Category,
                    Department = d.Department,
                    Revision = d.Revision,
                    EffectiveDate = d.EffectiveDate,
                    ReviewDate = d.ReviewDate,
                    Status = d.Status,
                    Owner = d.Owner,
                    FileName = d.FileName,
                    ExtractedText = extracted
                };
            }

            if (Guid.TryParse(id, out var verId))
            {
                var v = await _context.DocumentVersions.FindAsync(verId);
                if (v == null) return null;
                var extracted = v.ExtractedText ?? await ExtractTextFromFileAsync(v.FileName);
                return new DocumentSnapshot
                {
                    Source = "version",
                    Id = v.Id.ToString(),
                    DocumentId = v.DocumentId,
                    DocumentNumber = v.DocumentNumber,
                    Title = v.Title,
                    Category = v.Category,
                    Department = v.Department,
                    Revision = v.Revision,
                    EffectiveDate = v.EffectiveDate,
                    ReviewDate = v.ReviewDate,
                    Status = v.Status,
                    Owner = v.Owner,
                    FileName = v.FileName,
                    ExtractedText = extracted,
                    SnapshotAt = v.SnapshotAt
                };
            }

            return null;
        }

        private sealed class DiffLine
        {
            public string Type { get; init; } = "";
            public string Text { get; init; } = "";
        }

        private static (List<DiffLine> Old, List<DiffLine> New) BuildAlignedLineDiff(string[] oldLines, string[] newLines)
        {
            var n = oldLines.Length;
            var m = newLines.Length;
            var dp = new int[n + 1, m + 1];

            for (var i = n - 1; i >= 0; i--)
            {
                for (var j = m - 1; j >= 0; j--)
                {
                    if (string.Equals(oldLines[i], newLines[j], StringComparison.Ordinal))
                        dp[i, j] = dp[i + 1, j + 1] + 1;
                    else
                        dp[i, j] = Math.Max(dp[i + 1, j], dp[i, j + 1]);
                }
            }

            var oldOut = new List<DiffLine>();
            var newOut = new List<DiffLine>();
            var oi = 0;
            var nj = 0;
            while (oi < n && nj < m)
            {
                if (string.Equals(oldLines[oi], newLines[nj], StringComparison.Ordinal))
                {
                    oldOut.Add(new DiffLine { Type = "same", Text = oldLines[oi] });
                    newOut.Add(new DiffLine { Type = "same", Text = newLines[nj] });
                    oi++;
                    nj++;
                }
                else if (dp[oi + 1, nj] >= dp[oi, nj + 1])
                {
                    oldOut.Add(new DiffLine { Type = "rem", Text = oldLines[oi] });
                    newOut.Add(new DiffLine { Type = "empty", Text = "" });
                    oi++;
                }
                else
                {
                    oldOut.Add(new DiffLine { Type = "empty", Text = "" });
                    newOut.Add(new DiffLine { Type = "add", Text = newLines[nj] });
                    nj++;
                }
            }
            while (oi < n)
            {
                oldOut.Add(new DiffLine { Type = "rem", Text = oldLines[oi] });
                newOut.Add(new DiffLine { Type = "empty", Text = "" });
                oi++;
            }
            while (nj < m)
            {
                oldOut.Add(new DiffLine { Type = "empty", Text = "" });
                newOut.Add(new DiffLine { Type = "add", Text = newLines[nj] });
                nj++;
            }

            return (oldOut, newOut);
        }

        private static string? BuildChangeSummary(string? oldText, string? newText)
        {
            var a = (oldText ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
            var b = (newText ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
            if (string.IsNullOrWhiteSpace(a) && string.IsNullOrWhiteSpace(b)) return null;

            var oldLines = a.Split('\n').Select(x => x.TrimEnd()).Take(1200).ToArray();
            var newLines = b.Split('\n').Select(x => x.TrimEnd()).Take(1200).ToArray();
            var diff = BuildAlignedLineDiff(oldLines, newLines);

            var adds = diff.New.Count(x => x.Type == "add");
            var rems = diff.Old.Count(x => x.Type == "rem");
            if (adds == 0 && rems == 0) return null;

            string Clean(string s)
            {
                s = s.Trim();
                if (s.Length > 140) s = s.Substring(0, 140);
                return s;
            }

            var addedSamples = diff.New.Where(x => x.Type == "add" && !string.IsNullOrWhiteSpace(x.Text)).Take(4).Select(x => Clean(x.Text)).ToList();
            var removedSamples = diff.Old.Where(x => x.Type == "rem" && !string.IsNullOrWhiteSpace(x.Text)).Take(4).Select(x => Clean(x.Text)).ToList();

            var parts = new List<string> { $"+{adds} lines, -{rems} lines" };
            if (addedSamples.Count > 0) parts.Add("Added: " + string.Join(" | ", addedSamples));
            if (removedSamples.Count > 0) parts.Add("Removed: " + string.Join(" | ", removedSamples));
            return string.Join(". ", parts);
        }

        private async Task<string[]?> TryReadTextLinesAsync(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName)) return null;
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            var allowed = ext is ".txt" or ".md" or ".csv" or ".log" or ".json" or ".xml" or ".html";
            if (!allowed) return null;

            var filePath = Path.Combine(_uploadPath, fileName);
            if (!System.IO.File.Exists(filePath)) return null;

            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(fs, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var content = await reader.ReadToEndAsync();
            var lines = content
                .Replace("\r\n", "\n")
                .Replace("\r", "\n")
                .Split('\n')
                .Take(600)
                .ToArray();
            return lines;
        }

        [HttpGet("compare")]
        public async Task<IActionResult> CompareDocuments([FromQuery] string old, [FromQuery(Name = "new")] string @new)
        {
            var oldSnap = await ResolveSnapshotAsync(old);
            var newSnap = await ResolveSnapshotAsync(@new);
            if (oldSnap == null || newSnap == null) return NotFound();

            static object Field(string name, string? oldValue, string? newValue) => new
            {
                field = name,
                old_value = oldValue,
                new_value = newValue,
                changed = !string.Equals(oldValue ?? "", newValue ?? "", StringComparison.Ordinal)
            };

            var fields = new List<object>
            {
                Field("document_number", oldSnap.DocumentNumber, newSnap.DocumentNumber),
                Field("title", oldSnap.Title, newSnap.Title),
                Field("category", oldSnap.Category, newSnap.Category),
                Field("department", oldSnap.Department, newSnap.Department),
                Field("revision", oldSnap.Revision, newSnap.Revision),
                Field("effective_date", oldSnap.EffectiveDate.ToString("yyyy-MM-dd"), newSnap.EffectiveDate.ToString("yyyy-MM-dd")),
                Field("review_date", oldSnap.ReviewDate.ToString("yyyy-MM-dd"), newSnap.ReviewDate.ToString("yyyy-MM-dd")),
                Field("status", oldSnap.Status, newSnap.Status),
                Field("owner", oldSnap.Owner, newSnap.Owner),
                Field("file_name", oldSnap.FileName, newSnap.FileName)
            };

            string[]? oldLines = null;
            string[]? newLines = null;

            if (!string.IsNullOrWhiteSpace(oldSnap.ExtractedText) && !string.IsNullOrWhiteSpace(newSnap.ExtractedText))
            {
                oldLines = oldSnap.ExtractedText.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n').Take(1200).ToArray();
                newLines = newSnap.ExtractedText.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n').Take(1200).ToArray();
            }
            else
            {
                oldLines = await TryReadTextLinesAsync(oldSnap.FileName);
                newLines = await TryReadTextLinesAsync(newSnap.FileName);
            }
            object? diffLines = null;
            int? additions = null;
            int? removals = null;

            if (oldLines != null && newLines != null)
            {
                var diff = BuildAlignedLineDiff(oldLines, newLines);
                diffLines = new
                {
                    old = diff.Old,
                    @new = diff.New
                };
                additions = diff.New.Count(x => x.Type == "add");
                removals = diff.Old.Count(x => x.Type == "rem");
            }

            return Ok(new
            {
                old_document = new { id = oldSnap.Id, source = oldSnap.Source, document_id = oldSnap.DocumentId, document_number = oldSnap.DocumentNumber, title = oldSnap.Title, revision = oldSnap.Revision, snapshot_at = oldSnap.SnapshotAt },
                new_document = new { id = newSnap.Id, source = newSnap.Source, document_id = newSnap.DocumentId, document_number = newSnap.DocumentNumber, title = newSnap.Title, revision = newSnap.Revision, snapshot_at = newSnap.SnapshotAt },
                changed_fields = fields,
                diff_lines = diffLines,
                additions,
                removals
            });
        }

        [HttpPost]
        [DisableRequestSizeLimit]
        public async Task<ActionResult<AeroQMS.API.Models.Document>> PostDocument([FromForm] AeroQMS.API.Models.Document doc, IFormFile? file)
        {
            try
            {
                if (file != null)
                {
                    var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
                    var filePath = Path.Combine(_uploadPath, fileName);
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }
                    doc.FileName = fileName;
                }

                _context.Documents.Add(doc);
                await _context.SaveChangesAsync();

                var extracted = await ExtractTextFromFileAsync(doc.FileName);
                var initial = new DocumentVersion
                {
                    Id = Guid.NewGuid(),
                    DocumentId = doc.Id,
                    DocumentNumber = doc.DocumentNumber,
                    Title = doc.Title,
                    Category = doc.Category,
                    Department = doc.Department,
                    Revision = doc.Revision,
                    EffectiveDate = doc.EffectiveDate,
                    ReviewDate = doc.ReviewDate,
                    Status = doc.Status,
                    Owner = doc.Owner,
                    FileName = doc.FileName,
                    ExtractedText = extracted,
                    SnapshotAt = DateTime.UtcNow
                };
                _context.DocumentVersions.Add(initial);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetDocument), new { id = doc.Id }, doc);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPut("{id}")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> PutDocument(int id, [FromForm] AeroQMS.API.Models.Document doc, IFormFile? file)
        {
            if (id != doc.Id) return BadRequest();

            try
            {
                var existingDoc = await _context.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
                if (existingDoc == null) return NotFound();

                var previousExtractedText = await _context.DocumentVersions
                    .Where(v => v.DocumentId == id && v.ExtractedText != null && v.ExtractedText != "")
                    .OrderByDescending(v => v.SnapshotAt)
                    .Select(v => v.ExtractedText)
                    .FirstOrDefaultAsync();

                var snapshot = new DocumentVersion
                {
                    Id = Guid.NewGuid(),
                    DocumentId = existingDoc.Id,
                    DocumentNumber = existingDoc.DocumentNumber,
                    Title = existingDoc.Title,
                    Category = existingDoc.Category,
                    Department = existingDoc.Department,
                    Revision = existingDoc.Revision,
                    EffectiveDate = existingDoc.EffectiveDate,
                    ReviewDate = existingDoc.ReviewDate,
                    Status = existingDoc.Status,
                    Owner = existingDoc.Owner,
                    FileName = existingDoc.FileName,
                    ExtractedText = previousExtractedText,
                    ApprovalSnapshot = null,
                    SnapshotAt = DateTime.UtcNow
                };
                if (file != null)
                {
                    var approval = await _context.DocumentApprovalWorkflows
                        .Where(x => x.DocumentId == id)
                        .OrderBy(x => x.StepNumber)
                        .Select(s => new
                        {
                            id = s.Id,
                            step_number = s.StepNumber,
                            step_name = s.StepName,
                            required_role = s.RequiredRole,
                            required_user_id = s.RequiredUserId,
                            status = s.Status,
                            action = s.Action,
                            comment = s.Comment,
                            actioned_by_id = s.ActionedById,
                            actioned_at = s.ActionedAt,
                            created_at = s.CreatedAt
                        })
                        .ToListAsync();
                    snapshot.ApprovalSnapshot = JsonSerializer.Serialize(approval);
                }
                _context.DocumentVersions.Add(snapshot);

                string? extractedText = null;
                if (file != null)
                {
                    var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
                    var filePath = Path.Combine(_uploadPath, fileName);
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }
                    doc.FileName = fileName;
                    extractedText = await ExtractTextFromFileAsync(fileName);
                }
                else
                {
                    doc.FileName = existingDoc.FileName;
                }

                _context.Entry(doc).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                if (file != null && !string.IsNullOrWhiteSpace(extractedText))
                {
                    var summary = BuildChangeSummary(previousExtractedText, extractedText);
                    var versionEntry = new DocumentVersion
                    {
                        Id = Guid.NewGuid(),
                        DocumentId = doc.Id,
                        DocumentNumber = doc.DocumentNumber,
                        Title = doc.Title,
                        Category = doc.Category,
                        Department = doc.Department,
                        Revision = doc.Revision,
                        EffectiveDate = doc.EffectiveDate,
                        ReviewDate = doc.ReviewDate,
                        Status = doc.Status,
                        Owner = doc.Owner,
                        FileName = doc.FileName,
                        ExtractedText = extractedText,
                        ChangeSummary = summary,
                        ApprovalSnapshot = null,
                        SnapshotAt = DateTime.UtcNow
                    };
                    _context.DocumentVersions.Add(versionEntry);
                    await _context.SaveChangesAsync();
                }

                if (file != null)
                {
                    var workflowSteps = await _context.DocumentApprovalWorkflows
                        .Where(x => x.DocumentId == id)
                        .OrderBy(x => x.StepNumber)
                        .ToListAsync();
                    if (workflowSteps.Count > 0)
                    {
                        foreach (var s in workflowSteps)
                        {
                            s.Status = "pending";
                            s.Action = null;
                            s.Comment = null;
                            s.ActionedById = null;
                            s.ActionedAt = null;
                        }

                        doc.Status = "Pending Approval";
                        _context.Entry(doc).State = EntityState.Modified;
                        await _context.SaveChangesAsync();

                        await NotifyNextApproverAsync(doc, workflowSteps);
                    }
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("versions/download/{versionId:guid}")]
        public async Task<IActionResult> DownloadDocumentVersion(Guid versionId)
        {
            var v = await _context.DocumentVersions.FindAsync(versionId);
            if (v == null || string.IsNullOrEmpty(v.FileName)) return NotFound();

            var filePath = Path.Combine(_uploadPath, v.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;
            return File(memory, "application/octet-stream", v.Title + Path.GetExtension(v.FileName));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            if (!string.IsNullOrEmpty(doc.FileName))
            {
                var filePath = Path.Combine(_uploadPath, doc.FileName);
                if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
            }

            _context.Documents.Remove(doc);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FileName)) return NotFound();

            var filePath = Path.Combine(_uploadPath, doc.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;
            return File(memory, "application/octet-stream", doc.Title + Path.GetExtension(doc.FileName));
        }

        [HttpGet("view/{id}")]
        public async Task<IActionResult> ViewDocumentInline(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FileName)) return NotFound();

            var filePath = Path.Combine(_uploadPath, doc.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var ext = Path.GetExtension(doc.FileName).ToLowerInvariant();
            var contentType = ext switch
            {
                ".pdf" => "application/pdf",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };

            Response.Headers["Content-Disposition"] = $"inline; filename=\"{doc.DocumentNumber}{ext}\"";
            var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            return File(stream, contentType, enableRangeProcessing: true);
        }

        [HttpPost("{id}/access")]
        public async Task<IActionResult> TrackDocumentAccess(int id, [FromBody] JsonElement body)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound(new { error = "Document not found" });

            var user = await GetAuthenticatedUserAsync();
            var source = "";
            var device = "";
            if (body.ValueKind == JsonValueKind.Object)
            {
                if (body.TryGetProperty("source", out var sEl) && sEl.ValueKind == JsonValueKind.String) source = sEl.GetString() ?? "";
                if (body.TryGetProperty("device", out var dEl) && dEl.ValueKind == JsonValueKind.String) device = dEl.GetString() ?? "";
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers["User-Agent"].ToString();
            if (string.IsNullOrWhiteSpace(device)) device = userAgent;

            var versionId = await _context.DocumentVersions
                .Where(v => v.DocumentId == id && v.Revision == doc.Revision)
                .OrderByDescending(v => v.SnapshotAt)
                .Select(v => (Guid?)v.Id)
                .FirstOrDefaultAsync();

            var log = new DocumentAccessLog
            {
                Id = Guid.NewGuid(),
                DocumentId = id,
                VersionId = versionId,
                UserId = user?.Id,
                Source = string.IsNullOrWhiteSpace(source) ? null : source.Trim(),
                DeviceInfo = string.IsNullOrWhiteSpace(device) ? null : device.Trim(),
                IpAddress = string.IsNullOrWhiteSpace(ip) ? null : ip,
                AccessedAt = DateTime.UtcNow
            };

            _context.DocumentAccessLogs.Add(log);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet("{id}/access/stats")]
        public async Task<IActionResult> GetDocumentAccessStats(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound(new { error = "Document not found" });

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var total = await _context.DocumentAccessLogs.CountAsync(x => x.DocumentId == id);
            var thisMonth = await _context.DocumentAccessLogs.CountAsync(x => x.DocumentId == id && x.AccessedAt >= monthStart);

            var uniqueUserIds = await _context.DocumentAccessLogs
                .Where(x => x.DocumentId == id && x.UserId.HasValue)
                .Select(x => x.UserId!.Value)
                .Distinct()
                .ToListAsync();

            var uniqueUsers = uniqueUserIds.Count;

            var since = DateTime.UtcNow.Date.AddDays(-29);
            var daily = await _context.DocumentAccessLogs
                .Where(x => x.DocumentId == id && x.AccessedAt >= since)
                .GroupBy(x => x.AccessedAt.Date)
                .Select(g => new { day = g.Key, count = g.Count() })
                .ToListAsync();

            var history = Enumerable.Range(0, 30)
                .Select(i =>
                {
                    var day = since.AddDays(i);
                    var found = daily.FirstOrDefault(d => d.day == day);
                    return new { day = day.ToString("yyyy-MM-dd"), count = found?.count ?? 0 };
                })
                .ToList();

            var recent = await _context.DocumentAccessLogs
                .Where(x => x.DocumentId == id)
                .OrderByDescending(x => x.AccessedAt)
                .Take(12)
                .ToListAsync();

            var ids = recent.Where(r => r.UserId.HasValue).Select(r => r.UserId!.Value).Distinct().ToList();
            var users = ids.Count == 0
                ? new Dictionary<int, User>()
                : await _context.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u);

            var recentDto = recent.Select(r =>
            {
                users.TryGetValue(r.UserId ?? -1, out var u);
                return new
                {
                    id = r.Id,
                    user_id = r.UserId,
                    user_name = u?.Name,
                    user_email = u?.Email,
                    device = r.DeviceInfo,
                    source = r.Source,
                    ip_address = r.IpAddress,
                    accessed_at = r.AccessedAt
                };
            }).ToList();

            return Ok(new
            {
                document = new { id = doc.Id, document_number = doc.DocumentNumber, title = doc.Title, revision = doc.Revision },
                stats = new { total_scans = total, scans_this_month = thisMonth, unique_users = uniqueUsers },
                history,
                recent_scans = recentDto
            });
        }

        [HttpGet("{id}/qr-label")]
        public async Task<IActionResult> DownloadQrLabelPdf(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();

            var linkUrl = $"{Request.Scheme}://{Request.Host}/d/{doc.Id}";
            var qrUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=256x256&format=png&data={Uri.EscapeDataString(linkUrl)}";
            byte[] qrBytes;
            try
            {
                using var http = new System.Net.Http.HttpClient();
                qrBytes = await http.GetByteArrayAsync(qrUrl);
            }
            catch
            {
                return StatusCode(500, new { error = "Unable to generate QR code" });
            }

            var pdf = QuestPDF.Fluent.Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A6);
                    page.Margin(16);
                    page.Content().Column(col =>
                    {
                        col.Spacing(8);
                        col.Item().Text(doc.DocumentNumber).SemiBold().FontSize(18);
                        col.Item().Text(doc.Title).FontSize(10);
                        col.Item().AlignCenter().Image(qrBytes, ImageScaling.FitWidth);
                        col.Item().AlignCenter().Text("Scan for latest version").FontSize(9).FontColor(QuestPDF.Helpers.Colors.Grey.Darken2);
                    });
                });
            }).GeneratePdf();

            return File(pdf, "application/pdf", $"{doc.DocumentNumber}_qr_label.pdf");
        }

        private static string DocNodeId(int id) => $"doc-{id}";
        private static string NcrNodeId(int id) => $"ncr-{id}";
        private static string CapaNodeId(Guid id) => $"capa-{id}";

        private static string NormalizeRelationshipTypeKey(string? type)
        {
            var t = NormalizeRoleKey(type);
            if (string.IsNullOrWhiteSpace(t)) return "related_to";
            if (t is "reference" or "references") return "references";
            if (t is "supersede" or "supersedes") return "supersedes";
            if (t is "related" or "related_to" or "relatedto") return "related_to";
            if (t is "linked_ncr" or "linked_to_ncr" or "ncr") return "linked_ncr";
            if (t is "linked_capa" or "linked_to_capa" or "capa") return "linked_capa";
            return t;
        }

        [HttpGet("relationships")]
        public async Task<IActionResult> GetDocumentRelationships()
        {
            var rels = await _context.DocumentRelationships
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var ncrIds = rels
                .Where(r => r.TargetNcrId.HasValue)
                .Select(r => r.TargetNcrId!.Value)
                .Distinct()
                .ToList();

            var capaIds = rels
                .Where(r => r.TargetCapaId.HasValue)
                .Select(r => r.TargetCapaId!.Value)
                .Distinct()
                .ToList();

            var docs = await _context.Documents.ToListAsync();

            var ncrs = ncrIds.Count == 0
                ? new List<NonConformance>()
                : await _context.NonConformances.Where(n => ncrIds.Contains(n.Id)).ToListAsync();

            var capas = capaIds.Count == 0
                ? new List<CapaAction>()
                : await _context.CapaActions.Where(c => capaIds.Contains(c.Id)).ToListAsync();

            var nodes = new List<object>();
            nodes.AddRange(docs.Select(d => new
            {
                id = DocNodeId(d.Id),
                doc_number = d.DocumentNumber,
                title = d.Title,
                status = NormalizeRoleKey(d.Status),
                category = d.Category,
                revision = d.Revision,
                owner = d.Owner,
                review_date = d.ReviewDate
            }));

            nodes.AddRange(ncrs.Select(n => new
            {
                id = NcrNodeId(n.Id),
                doc_number = n.NCRNumber,
                title = n.Title,
                status = NormalizeRoleKey(n.Status),
                category = n.Category,
                revision = "",
                owner = n.RaisedBy,
                review_date = n.Date
            }));

            nodes.AddRange(capas.Select(c => new
            {
                id = CapaNodeId(c.Id),
                doc_number = $"CAPA-{c.Id.ToString().Substring(0, 8)}",
                title = c.Title,
                status = NormalizeRoleKey(c.Status),
                category = "CAPA",
                revision = "",
                owner = c.ResponsiblePersonName,
                review_date = c.DueDate
            }));

            var links = rels.Select(r =>
            {
                var src = DocNodeId(r.SourceDocumentId);
                string tgt;
                var type = NormalizeRelationshipTypeKey(r.RelationshipType);
                if (r.TargetDocumentId.HasValue) tgt = DocNodeId(r.TargetDocumentId.Value);
                else if (r.TargetNcrId.HasValue) { tgt = NcrNodeId(r.TargetNcrId.Value); type = "linked_ncr"; }
                else if (r.TargetCapaId.HasValue) { tgt = CapaNodeId(r.TargetCapaId.Value); type = "linked_capa"; }
                else tgt = "";
                return new { source = src, target = tgt, type };
            })
            .Where(l => !string.IsNullOrWhiteSpace(l.target))
            .ToList();

            return Ok(new { nodes, links });
        }

        [HttpGet("relationships/map")]
        public async Task<IActionResult> GetDocumentRelationshipsMap()
        {
            return await GetDocumentRelationships();
        }

        [HttpGet("analytics")]
        public async Task<IActionResult> GetDocumentAnalytics([FromQuery] int period = 30)
        {
            if (period <= 0) period = 30;
            if (period > 3650) period = 3650;

            var now = DateTime.UtcNow;
            var from = now.AddDays(-period);
            var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var reviewSoonUntil = now.AddDays(30);

            static string StatusKey(string? status)
            {
                var s = NormalizeRoleKey(status);
                if (string.IsNullOrWhiteSpace(s)) return "draft";
                if (s.Contains("due_for_review") || s.Contains("due") || s.Contains("review")) return "due_for_review";
                if (s.Contains("expired") || s.Contains("overdue")) return "expired";
                if (s.Contains("approved") || s.Contains("valid")) return "approved";
                if (s.Contains("draft")) return "draft";
                return s;
            }

            var docs = await _context.Documents.ToListAsync();
            var totalDocs = docs.Count;
            var newThisMonth = docs.Count(d => d.EffectiveDate >= monthStart);

            var dueForReview = docs.Count(d =>
            {
                var key = StatusKey(d.Status);
                if (key == "due_for_review") return true;
                var rd = d.ReviewDate;
                return rd >= now && rd <= reviewSoonUntil;
            });

            var expired = docs.Count(d =>
            {
                var key = StatusKey(d.Status);
                if (key == "expired") return true;
                return d.ReviewDate < now;
            });

            var health = new
            {
                approved = docs.Count(d => StatusKey(d.Status) == "approved"),
                due_for_review = docs.Count(d => StatusKey(d.Status) == "due_for_review"),
                expired = docs.Count(d => StatusKey(d.Status) == "expired"),
                draft = docs.Count(d => StatusKey(d.Status) == "draft")
            };

            var accessLogsPeriod = await _context.DocumentAccessLogs
                .Where(l => l.AccessedAt >= from)
                .ToListAsync();

            var qrLogsMonth = accessLogsPeriod.Where(l => l.AccessedAt >= monthStart && string.Equals(l.Source, "qr", StringComparison.OrdinalIgnoreCase)).ToList();
            var qrScans = qrLogsMonth.Count;
            var uniqueScannerKeys = qrLogsMonth
                .Select(l => l.UserId.HasValue ? $"u:{l.UserId.Value}" : (!string.IsNullOrWhiteSpace(l.IpAddress) ? $"ip:{l.IpAddress}" : null))
                .Where(x => x != null)
                .Distinct()
                .ToList();
            var uniqueScanners = uniqueScannerKeys.Count;

            var accessCounts = accessLogsPeriod
                .GroupBy(l => l.DocumentId)
                .Select(g => new { documentId = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(8)
                .ToList();

            var maxAccess = accessCounts.Count == 0 ? 0 : accessCounts.Max(x => x.count);
            var mostAccessed = accessCounts
                .Select((x, idx) =>
                {
                    var d = docs.FirstOrDefault(dd => dd.Id == x.documentId);
                    return new
                    {
                        rank = idx + 1,
                        id = x.documentId,
                        doc_number = d?.DocumentNumber ?? $"DOC-{x.documentId}",
                        title = d?.Title ?? "",
                        count = x.count,
                        pct = maxAccess == 0 ? 0 : (int)Math.Round((x.count * 100.0) / maxAccess)
                    };
                })
                .ToList();

            var reviewMonthsStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var reviewMonthsEnd = reviewMonthsStart.AddMonths(12);
            var reviewCalendar = docs
                .Where(d => d.ReviewDate >= reviewMonthsStart && d.ReviewDate < reviewMonthsEnd)
                .GroupBy(d => new { d.ReviewDate.Year, d.ReviewDate.Month })
                .Select(g => new { year = g.Key.Year, month = g.Key.Month, count = g.Count() })
                .OrderBy(x => x.year).ThenBy(x => x.month)
                .ToList();

            var allSteps = await _context.DocumentApprovalWorkflows.ToListAsync();

            double? ComputeApprovalDaysForDoc(int documentId)
            {
                var steps = allSteps.Where(s => s.DocumentId == documentId).ToList();
                if (steps.Count == 0) return null;
                var startAt = steps.Min(s => s.CreatedAt);
                var endAt = steps
                    .Where(s => s.ActionedAt.HasValue && string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase))
                    .Select(s => s.ActionedAt!.Value)
                    .DefaultIfEmpty()
                    .Max();
                if (endAt == default) return null;
                return Math.Max(0, (endAt - startAt).TotalDays);
            }

            var approvalByDoc = docs
                .Select(d => new { d.Id, d.Category, d.Owner, days = ComputeApprovalDaysForDoc(d.Id) })
                .Where(x => x.days.HasValue)
                .ToList();

            var approvedInPeriod = approvalByDoc
                .Where(x =>
                {
                    var steps = allSteps.Where(s => s.DocumentId == x.Id).ToList();
                    var endAt = steps
                        .Where(s => s.ActionedAt.HasValue && string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase))
                        .Select(s => s.ActionedAt!.Value)
                        .DefaultIfEmpty()
                        .Max();
                    return endAt != default && endAt >= from;
                })
                .Select(x => x.days!.Value)
                .ToList();

            var avgApprovalDays = approvedInPeriod.Count == 0 ? 0 : Math.Round(approvedInPeriod.Average(), 1);

            var prevFrom = from.AddDays(-period);
            var prevApproved = approvalByDoc
                .Where(x =>
                {
                    var steps = allSteps.Where(s => s.DocumentId == x.Id).ToList();
                    var endAt = steps
                        .Where(s => s.ActionedAt.HasValue && string.Equals(s.Status, "approved", StringComparison.OrdinalIgnoreCase))
                        .Select(s => s.ActionedAt!.Value)
                        .DefaultIfEmpty()
                        .Max();
                    return endAt != default && endAt >= prevFrom && endAt < from;
                })
                .Select(x => x.days!.Value)
                .ToList();

            var prevAvg = prevApproved.Count == 0 ? 0 : Math.Round(prevApproved.Average(), 1);
            var trendPct = prevAvg <= 0 ? 0 : Math.Round(((avgApprovalDays - prevAvg) / prevAvg) * 100.0, 1);
            var trendClass = trendPct <= 0 ? "trend-up" : "trend-down";

            var approvalTimeByCategory = approvalByDoc
                .Where(x => !string.IsNullOrWhiteSpace(x.Category))
                .GroupBy(x => x.Category)
                .Select(g => new { category = g.Key, avg_days = Math.Round(g.Average(x => x.days!.Value), 1) })
                .OrderByDescending(x => x.avg_days)
                .ToList();

            var docsByCategory = docs
                .GroupBy(d => string.IsNullOrWhiteSpace(d.Category) ? "Uncategorized" : d.Category)
                .Select(g => new { category = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            var requirements = await _context.DocumentAcknowledgmentRequirements.ToListAsync();
            var acknowledgments = await _context.DocumentAcknowledgments.ToListAsync();
            var users = await _context.Users.Where(u => u.IsActive).ToListAsync();

            var requiredTotal = 0;
            var acknowledgedTotal = 0;

            foreach (var doc in docs)
            {
                var reqs = requirements.Where(r => r.DocumentId == doc.Id).ToList();
                if (reqs.Count == 0) continue;

                var requiredUserIds = new HashSet<int>();
                var roleRequirements = reqs
                    .Where(r => !string.IsNullOrWhiteSpace(r.RequiredRole))
                    .Select(r => r.RequiredRole!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var role in roleRequirements)
                {
                    var roleKey = NormalizeRoleKey(role);
                    if (roleKey == "document_owner")
                    {
                        foreach (var uid in users.Where(u => !string.IsNullOrWhiteSpace(u.Name) && !string.IsNullOrWhiteSpace(doc.Owner) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)).Select(u => u.Id))
                            requiredUserIds.Add(uid);
                        continue;
                    }
                    foreach (var uid in users.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id))
                        requiredUserIds.Add(uid);
                }

                foreach (var uid in reqs.Where(r => r.IndividualUserId.HasValue).Select(r => r.IndividualUserId!.Value))
                    if (users.Any(u => u.Id == uid)) requiredUserIds.Add(uid);

                if (requiredUserIds.Count == 0) continue;
                requiredTotal += requiredUserIds.Count;

                var rev = doc.Revision ?? "";
                var docAcks = acknowledgments
                    .Where(a => a.DocumentId == doc.Id && (a.DocumentRevision ?? "") == rev && requiredUserIds.Contains(a.UserId))
                    .GroupBy(a => a.UserId)
                    .Select(g => g.OrderByDescending(x => x.AcknowledgedAt).First())
                    .ToList();
                acknowledgedTotal += docAcks.Count;
            }

            var ackRate = requiredTotal == 0 ? 100 : (int)Math.Round((acknowledgedTotal * 100.0) / requiredTotal);

            var criticalDocs = docs
                .Select(d =>
                {
                    var days = (int)Math.Round((d.ReviewDate.Date - now.Date).TotalDays);
                    var key = StatusKey(d.Status);
                    var isExpired = key == "expired" || days < 0;
                    var severity = isExpired ? "danger" : (days <= 7 ? "warning" : "info");
                    return new
                    {
                        id = d.Id,
                        doc_number = d.DocumentNumber,
                        title = d.Title,
                        category = d.Category,
                        owner = d.Owner,
                        status = d.Status,
                        days,
                        is_expired = isExpired,
                        severity
                    };
                })
                .Where(x => x.is_expired || x.days <= 7)
                .OrderBy(x => x.is_expired ? 0 : 1)
                .ThenBy(x => x.days)
                .Take(20)
                .ToList();

            var ownerPerformance = docs
                .GroupBy(d => string.IsNullOrWhiteSpace(d.Owner) ? "Unassigned" : d.Owner)
                .Select(g =>
                {
                    var owner = g.Key;
                    var total = g.Count();
                    var overdue = g.Count(d => StatusKey(d.Status) == "expired" || d.ReviewDate < now);
                    var onTimeRate = total == 0 ? 100 : (int)Math.Round(((total - overdue) * 100.0) / total);
                    var ownerApproval = approvalByDoc.Where(a => string.Equals(a.Owner ?? "", owner ?? "", StringComparison.OrdinalIgnoreCase) && a.days.HasValue).Select(a => a.days!.Value).ToList();
                    var avgDays = ownerApproval.Count == 0 ? 0 : Math.Round(ownerApproval.Average(), 1);
                    var score = Math.Max(0, Math.Min(100, (int)Math.Round(100 - (overdue * 15) - (avgDays * 5))));
                    var level = score >= 85 ? "good" : (score >= 65 ? "mid" : "low");
                    return new
                    {
                        owner,
                        total,
                        overdue,
                        on_time_rate = onTimeRate,
                        avg_approval_days = avgDays,
                        score,
                        level
                    };
                })
                .OrderByDescending(x => x.score)
                .Take(30)
                .ToList();

            return Ok(new
            {
                kpis = new
                {
                    total_docs = totalDocs,
                    new_this_month = newThisMonth,
                    due_for_review = dueForReview,
                    expired,
                    ack_rate = ackRate,
                    acknowledged = acknowledgedTotal,
                    required = requiredTotal,
                    avg_approval_days = avgApprovalDays,
                    approval_trend_pct = trendPct,
                    approval_trend_class = trendClass,
                    qr_scans = qrScans,
                    unique_scanners = uniqueScanners
                },
                health_distribution = health,
                review_calendar = reviewCalendar,
                most_accessed = mostAccessed,
                approval_time_by_category = approvalTimeByCategory,
                documents_by_category = docsByCategory,
                critical_docs = criticalDocs,
                owner_performance = ownerPerformance
            });
        }

        [HttpGet("{id}/relationships")]
        public async Task<IActionResult> GetDocumentRelationshipDetails(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound(new { error = "Document not found" });

            var outgoing = await _context.DocumentRelationships.Where(r => r.SourceDocumentId == id).ToListAsync();
            var incoming = await _context.DocumentRelationships.Where(r => r.TargetDocumentId == id).ToListAsync();

            var referencedDocIds = outgoing.Where(r => r.TargetDocumentId.HasValue && NormalizeRoleKey(r.RelationshipType) == "references")
                .Select(r => r.TargetDocumentId!.Value).Distinct().ToList();

            var referencingDocIds = incoming.Where(r => NormalizeRoleKey(r.RelationshipType) == "references")
                .Select(r => r.SourceDocumentId).Distinct().ToList();

            var linkedNcrIds = outgoing.Where(r => r.TargetNcrId.HasValue).Select(r => r.TargetNcrId!.Value).Distinct().ToList();
            var linkedCapaIds = outgoing.Where(r => r.TargetCapaId.HasValue).Select(r => r.TargetCapaId!.Value).Distinct().ToList();

            var referencedDocs = referencedDocIds.Count == 0
                ? new List<AeroQMS.API.Models.Document>()
                : await _context.Documents.Where(d => referencedDocIds.Contains(d.Id)).ToListAsync();

            var referencingDocs = referencingDocIds.Count == 0
                ? new List<AeroQMS.API.Models.Document>()
                : await _context.Documents.Where(d => referencingDocIds.Contains(d.Id)).ToListAsync();

            var ncrs = linkedNcrIds.Count == 0
                ? new List<NonConformance>()
                : await _context.NonConformances.Where(n => linkedNcrIds.Contains(n.Id)).ToListAsync();

            var capas = linkedCapaIds.Count == 0
                ? new List<CapaAction>()
                : await _context.CapaActions.Where(c => linkedCapaIds.Contains(c.Id)).ToListAsync();

            var outgoingDocIds = outgoing.Where(r => r.TargetDocumentId.HasValue).Select(r => r.TargetDocumentId!.Value).Distinct().ToList();
            var outgoingDocs = outgoingDocIds.Count == 0
                ? new List<AeroQMS.API.Models.Document>()
                : await _context.Documents.Where(d => outgoingDocIds.Contains(d.Id)).ToListAsync();

            var outgoingDocLookup = outgoingDocs.ToDictionary(d => d.Id, d => d);
            var outgoingNcrLookup = ncrs.ToDictionary(n => n.Id, n => n);
            var outgoingCapaLookup = capas.ToDictionary(c => c.Id, c => c);

            var relationships = outgoing
                .OrderByDescending(r => r.CreatedAt)
                .Select(r =>
                {
                    if (r.TargetDocumentId.HasValue && outgoingDocLookup.TryGetValue(r.TargetDocumentId.Value, out var td))
                    {
                        return (object)new
                        {
                            id = r.Id,
                            relationship_type = NormalizeRelationshipTypeKey(r.RelationshipType),
                            target_kind = "document",
                            target_doc_id = td.Id,
                            target_doc_number = td.DocumentNumber,
                            target_title = td.Title,
                            note = r.Note,
                            created_at = r.CreatedAt,
                            created_by_id = r.CreatedById
                        };
                    }

                    if (r.TargetNcrId.HasValue && outgoingNcrLookup.TryGetValue(r.TargetNcrId.Value, out var tn))
                    {
                        return (object)new
                        {
                            id = r.Id,
                            relationship_type = "linked_ncr",
                            target_kind = "ncr",
                            target_ncr_id = tn.Id,
                            target_ncr_number = tn.NCRNumber,
                            target_title = tn.Title,
                            note = r.Note,
                            created_at = r.CreatedAt,
                            created_by_id = r.CreatedById
                        };
                    }

                    if (r.TargetCapaId.HasValue && outgoingCapaLookup.TryGetValue(r.TargetCapaId.Value, out var tc))
                    {
                        return (object)new
                        {
                            id = r.Id,
                            relationship_type = "linked_capa",
                            target_kind = "capa",
                            target_capa_id = tc.Id,
                            target_capa_number = $"CAPA-{tc.Id.ToString().Substring(0, 8)}",
                            target_title = tc.Title,
                            note = r.Note,
                            created_at = r.CreatedAt,
                            created_by_id = r.CreatedById
                        };
                    }

                    return (object)new
                    {
                        id = r.Id,
                        relationship_type = NormalizeRelationshipTypeKey(r.RelationshipType),
                        target_kind = "unknown",
                        note = r.Note,
                        created_at = r.CreatedAt,
                        created_by_id = r.CreatedById
                    };
                })
                .ToList();

            return Ok(new
            {
                document = new
                {
                    id = doc.Id,
                    doc_number = doc.DocumentNumber,
                    title = doc.Title,
                    status = doc.Status,
                    category = doc.Category,
                    revision = doc.Revision,
                    review_date = doc.ReviewDate,
                    owner = doc.Owner
                },
                references = referencedDocs.Select(d => new { doc_id = d.Id, doc_number = d.DocumentNumber, title = d.Title }).ToList(),
                referenced_by = referencingDocs.Select(d => new { doc_id = d.Id, doc_number = d.DocumentNumber, title = d.Title }).ToList(),
                linked_ncrs = ncrs.Select(n => new { ncr_id = n.Id, ncr_number = n.NCRNumber, title = n.Title }).ToList(),
                linked_capas = capas.Select(c => new { capa_id = c.Id, capa_number = $"CAPA-{c.Id.ToString().Substring(0, 8)}", title = c.Title }).ToList(),
                relationships
            });
        }

        [HttpPost("{id}/relationships")]
        public async Task<IActionResult> AddDocumentRelationship(int id, [FromBody] JsonElement body)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound(new { error = "Document not found" });

            string? relationshipType = null;
            if (body.TryGetProperty("relationship_type", out var rtProp)) relationshipType = rtProp.GetString();
            else if (body.TryGetProperty("relationshipType", out var rtProp2)) relationshipType = rtProp2.GetString();
            var typeKey = NormalizeRelationshipTypeKey(relationshipType);

            int? targetDocId = null;
            if (body.TryGetProperty("target_doc_id", out var tdProp) && tdProp.ValueKind is JsonValueKind.Number) targetDocId = tdProp.GetInt32();
            else if (body.TryGetProperty("target_document_id", out var tdProp2) && tdProp2.ValueKind is JsonValueKind.Number) targetDocId = tdProp2.GetInt32();

            int? targetNcrId = null;
            if (body.TryGetProperty("target_ncr_id", out var tnProp) && tnProp.ValueKind is JsonValueKind.Number) targetNcrId = tnProp.GetInt32();

            Guid? targetCapaId = null;
            if (body.TryGetProperty("target_capa_id", out var tcProp))
            {
                if (tcProp.ValueKind == JsonValueKind.String && Guid.TryParse(tcProp.GetString(), out var g)) targetCapaId = g;
            }

            string? note = null;
            if (body.TryGetProperty("note", out var noteProp) && noteProp.ValueKind == JsonValueKind.String) note = noteProp.GetString();

            if (typeKey is "linked_ncr")
            {
                if (!targetNcrId.HasValue) return BadRequest(new { error = "target_ncr_id is required for linked_ncr" });
                targetDocId = null;
                targetCapaId = null;
            }
            else if (typeKey is "linked_capa")
            {
                if (!targetCapaId.HasValue) return BadRequest(new { error = "target_capa_id is required for linked_capa" });
                targetDocId = null;
                targetNcrId = null;
            }
            else
            {
                if (!targetDocId.HasValue) return BadRequest(new { error = "target_doc_id is required for document relationships" });
                targetNcrId = null;
                targetCapaId = null;
            }

            var createdById = GetAuthenticatedUserId();

            var rel = new DocumentRelationship
            {
                Id = Guid.NewGuid(),
                SourceDocumentId = id,
                TargetDocumentId = targetDocId,
                TargetNcrId = targetNcrId,
                TargetCapaId = targetCapaId,
                RelationshipType = typeKey,
                Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                CreatedById = createdById,
                CreatedAt = DateTime.UtcNow
            };

            _context.DocumentRelationships.Add(rel);
            await _context.SaveChangesAsync();

            return Ok(new { id = rel.Id });
        }

        [HttpDelete("{id}/relationships/{relId}")]
        public async Task<IActionResult> DeleteDocumentRelationship(int id, Guid relId)
        {
            var rel = await _context.DocumentRelationships.FirstOrDefaultAsync(r => r.Id == relId && r.SourceDocumentId == id);
            if (rel == null) return NotFound(new { error = "Relationship not found" });
            _context.DocumentRelationships.Remove(rel);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportToCsv()
        {
            var docs = await _context.Documents.ToListAsync();
            var csv = GenerateCsv(docs);
            return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "documents_export.csv");
        }

        [HttpGet("export/pdf")]
        public async Task<IActionResult> ExportToPdf()
        {
            var docs = await _context.Documents.ToListAsync();
            var pdfData = GeneratePdf(docs);
            return File(pdfData, "application/pdf", "documents_export.pdf");
        }

        [HttpGet("export/pdf/{id}")]
        public async Task<IActionResult> ExportDocumentToPdf(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();
            var pdfData = GeneratePdf(new List<AeroQMS.API.Models.Document> { doc });
            return File(pdfData, "application/pdf", $"{doc.DocumentNumber}_export.pdf");
        }

        [HttpPost("export/bulk")]
        public async Task<IActionResult> BulkExport([FromBody] BulkExportRequest request)
        {
            var docs = await _context.Documents.Where(d => request.Ids.Contains(d.Id)).ToListAsync();
            if (request.Format.ToLower() == "pdf")
            {
                var pdfData = GeneratePdf(docs);
                return File(pdfData, "application/pdf", "bulk_export.pdf");
            }
            else
            {
                var csv = GenerateCsv(docs);
                return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "bulk_export.csv");
            }
        }

        private string GenerateCsv(IEnumerable<AeroQMS.API.Models.Document> docs)
        {
            var builder = new System.Text.StringBuilder();
            builder.AppendLine("Doc #,Title,Category,Department,Revision,Effective Date,Review Date,Status,Owner");
            foreach (var d in docs)
            {
                builder.AppendLine($"{d.DocumentNumber},{d.Title},{d.Category},{d.Department},{d.Revision},{d.EffectiveDate.ToShortDateString()},{d.ReviewDate.ToShortDateString()},{d.Status},{d.Owner}");
            }
            return builder.ToString();
        }

        private byte[] GeneratePdf(List<AeroQMS.API.Models.Document> docs)
        {
            return QuestPDF.Fluent.Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(1, Unit.Centimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(9));

                    page.Header().Text("AeroQMS Document Export").SemiBold().FontSize(18).FontColor(Colors.Blue.Medium);

                    page.Content().PaddingVertical(10).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(0.8f); // Doc #
                            columns.RelativeColumn(1.5f); // Title
                            columns.RelativeColumn(0.8f); // Category
                            columns.RelativeColumn(0.8f); // Dept
                            columns.RelativeColumn(0.6f); // Rev
                            columns.RelativeColumn(0.8f); // Eff Date
                            columns.RelativeColumn(0.8f); // Rev Date
                            columns.RelativeColumn(0.7f); // Status
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(CellStyle).Text("Doc #");
                            header.Cell().Element(CellStyle).Text("Title");
                            header.Cell().Element(CellStyle).Text("Category");
                            header.Cell().Element(CellStyle).Text("Dept");
                            header.Cell().Element(CellStyle).Text("Rev");
                            header.Cell().Element(CellStyle).Text("Eff. Date");
                            header.Cell().Element(CellStyle).Text("Rev. Date");
                            header.Cell().Element(CellStyle).Text("Status");

                            static IContainer CellStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold()).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                        });

                        foreach (var d in docs)
                        {
                            table.Cell().Element(CellStyle).Text(d.DocumentNumber);
                            table.Cell().Element(CellStyle).Text(d.Title);
                            table.Cell().Element(CellStyle).Text(d.Category);
                            table.Cell().Element(CellStyle).Text(d.Department);
                            table.Cell().Element(CellStyle).Text(d.Revision);
                            table.Cell().Element(CellStyle).Text(d.EffectiveDate.ToShortDateString());
                            table.Cell().Element(CellStyle).Text(d.ReviewDate.ToShortDateString());
                            table.Cell().Element(CellStyle).Text(d.Status);

                            static IContainer CellStyle(IContainer container) => container.PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
                        }
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Page ");
                        x.CurrentPageNumber();
                    });
                });
            }).GeneratePdf();
        }
    }

    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        public AuthController(AppDbContext context) { _context = context; }

        public sealed class LoginRequest
        {
            public string Email { get; set; } = "";
            public string Password { get; set; } = "";
            public bool RememberMe { get; set; }
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var email = (request?.Email ?? "").Trim().ToLowerInvariant();
            var password = request?.Password ?? "";

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return Unauthorized(new { error = "Invalid email or password" });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (user == null || !user.IsActive || string.IsNullOrWhiteSpace(user.PasswordHash))
                return Unauthorized(new { error = "Invalid email or password" });

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return Unauthorized(new { error = "Invalid email or password" });

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Name ?? ""),
                new(ClaimTypes.Email, user.Email ?? ""),
                new(ClaimTypes.Role, user.Role ?? "")
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = request?.RememberMe == true,
                    AllowRefresh = true
                });

            user.LastLogin = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                user = new
                {
                    id = user.Id,
                    name = user.Name,
                    email = user.Email,
                    role = user.Role,
                    force_password_change = user.ForcePasswordChange
                }
            });
        }

        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            return Ok(new
            {
                user = new
                {
                    id = user.Id,
                    name = user.Name,
                    email = user.Email,
                    role = user.Role,
                    force_password_change = user.ForcePasswordChange
                }
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { ok = true });
        }

        private int? GetCurrentUserId()
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(id, out var parsed) ? parsed : null;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return null;
            return await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class ChecklistsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public ChecklistsController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Checklist>>> GetChecklists() => await _context.Checklists.Include(c => c.Items).ToListAsync();

        [HttpPost]
        public async Task<ActionResult<Checklist>> PostChecklist(Checklist checklist)
        {
            _context.Checklists.Add(checklist);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetChecklists), new { id = checklist.Id }, checklist);
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class TrainingController : ControllerBase
    {
        private readonly AppDbContext _context;
        public TrainingController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TrainingRecord>>> GetTraining() => await _context.TrainingRecords.ToListAsync();
    }

    [ApiController]
    [Route("api/[controller]")]
    public class RisksController : ControllerBase
    {
        private readonly AppDbContext _context;
        public RisksController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Risk>>> GetRisks() => await _context.Risks.ToListAsync();
    }

    [ApiController]
    [Route("api/[controller]")]
    public class SuppliersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public SuppliersController(AppDbContext context) { _context = context; }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Supplier>>> GetSuppliers() => await _context.Suppliers.ToListAsync();
    }

    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public SettingsController(AppDbContext context) { _context = context; }

        private int? GetCurrentUserId()
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(id, out var parsed) ? parsed : null;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return null;
            return await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        private static bool IsAdminRole(string? role) =>
            !string.IsNullOrWhiteSpace(role) && role.IndexOf("admin", StringComparison.OrdinalIgnoreCase) >= 0;

        private static string NormalizeRoleKey(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            return role.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static bool IsAdminOrQualityManagerRole(string? role) =>
            IsAdminRole(role) || NormalizeRoleKey(role) == "quality_manager";

        [HttpGet]
        public async Task<ActionResult<OrganizationSetting>> GetSettings() => await _context.OrganizationSettings.FirstOrDefaultAsync() ?? new OrganizationSetting();

        [HttpPost]
        public async Task<IActionResult> UpdateSettings(OrganizationSetting settings)
        {
            var existing = await _context.OrganizationSettings.FirstOrDefaultAsync();
            if (existing == null) _context.OrganizationSettings.Add(settings);
            else
            {
                existing.OrganizationName = settings.OrganizationName;
                existing.IcaoCode = settings.IcaoCode;
                existing.RegulatoryAuthority = settings.RegulatoryAuthority;
                existing.QmsStandard = settings.QmsStandard;
                existing.Timezone = settings.Timezone;
            }
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("review-automation")]
        public async Task<IActionResult> GetReviewAutomationSettings()
        {
            var actor = await GetCurrentUserAsync();
            if (actor == null) return Unauthorized();
            if (!IsAdminOrQualityManagerRole(actor.Role)) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage review automation settings" });

            var existing = await _context.ReviewAutomationSettings
                .OrderByDescending(x => x.UpdatedAt)
                .FirstOrDefaultAsync();

            if (existing == null)
            {
                return Ok(new
                {
                    category_rules = new List<object>(),
                    notification_rules = new List<object>(),
                    escalation_rules = new List<object>()
                });
            }

            static JsonElement ParseJson(string s)
            {
                try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(s) ? "[]" : s).RootElement.Clone(); }
                catch { return JsonDocument.Parse("[]").RootElement.Clone(); }
            }

            return Ok(new
            {
                category_rules = ParseJson(existing.CategoryRulesJson),
                notification_rules = ParseJson(existing.NotificationRulesJson),
                escalation_rules = ParseJson(existing.EscalationRulesJson),
                updated_at = existing.UpdatedAt
            });
        }

        [HttpPost("review-automation")]
        public async Task<IActionResult> SaveReviewAutomationSettings([FromBody] JsonElement body)
        {
            var actor = await GetCurrentUserAsync();
            if (actor == null) return Unauthorized();
            if (!IsAdminOrQualityManagerRole(actor.Role)) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage review automation settings" });

            string categoryJson = "[]";
            string notifJson = "[]";
            string escalationJson = "[]";

            if (body.ValueKind == JsonValueKind.Object)
            {
                if (body.TryGetProperty("category_rules", out var c) && c.ValueKind == JsonValueKind.Array)
                    categoryJson = c.GetRawText();
                if (body.TryGetProperty("notification_rules", out var n) && n.ValueKind == JsonValueKind.Array)
                    notifJson = n.GetRawText();
                if (body.TryGetProperty("escalation_rules", out var e) && e.ValueKind == JsonValueKind.Array)
                    escalationJson = e.GetRawText();
            }

            var existing = await _context.ReviewAutomationSettings.FirstOrDefaultAsync();
            if (existing == null)
            {
                existing = new ReviewAutomationSetting
                {
                    CategoryRulesJson = categoryJson,
                    NotificationRulesJson = notifJson,
                    EscalationRulesJson = escalationJson,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.ReviewAutomationSettings.Add(existing);
            }
            else
            {
                existing.CategoryRulesJson = categoryJson;
                existing.NotificationRulesJson = notifJson;
                existing.EscalationRulesJson = escalationJson;
                existing.UpdatedAt = DateTime.UtcNow;
                _context.Entry(existing).State = EntityState.Modified;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, updated_at = existing.UpdatedAt });
        }
    }

    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public UsersController(AppDbContext context) { _context = context; }

        private static bool IsAdminRole(string? role) =>
            !string.IsNullOrWhiteSpace(role) && role.IndexOf("admin", StringComparison.OrdinalIgnoreCase) >= 0;

        private static string NormalizeRoleKey(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            return role.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static bool IsWorkflowManagerRole(string? role) =>
            IsAdminRole(role) || NormalizeRoleKey(role) == "quality_manager";

        private int? GetCurrentUserId()
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(id, out var parsed) ? parsed : null;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return null;
            return await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        private async Task<User?> RequireAdminAsync()
        {
            var actor = await GetCurrentUserAsync();
            if (actor == null) return null;
            return IsAdminRole(actor.Role) ? actor : null;
        }

        [HttpGet("lookup")]
        public async Task<IActionResult> LookupUsers()
        {
            var actor = await GetCurrentUserAsync();
            if (actor == null) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage workflow steps" });
            if (!IsWorkflowManagerRole(actor.Role)) return StatusCode(403, new { error = "Only Admins and Quality Managers can manage workflow steps" });

            var users = await _context.Users
                .Where(u => u.IsActive)
                .Select(u => new { id = u.Id, name = u.Name, email = u.Email, role = u.Role })
                .OrderBy(u => u.name)
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var actor = await RequireAdminAsync();
            if (actor == null) return StatusCode(403, new { error = "Admin access required" });

            var users = await _context.Users
                .Select(u => new
                {
                    id = u.Id,
                    name = u.Name,
                    email = u.Email,
                    role = u.Role,
                    is_active = u.IsActive,
                    force_password_change = u.ForcePasswordChange,
                    created_at = u.CreatedAt,
                    last_login = u.LastLogin
                })
                .OrderBy(u => u.name)
                .ToListAsync();

            return Ok(users);
        }

        public sealed class CreateUserRequest
        {
            public string Name { get; set; } = "";
            public string Email { get; set; } = "";
            public string Password { get; set; } = "";
            public string Role { get; set; } = "";
            public bool ForcePasswordChange { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var actor = await RequireAdminAsync();
            if (actor == null) return StatusCode(403, new { error = "Admin access required" });

            var name = (request?.Name ?? "").Trim();
            var email = (request?.Email ?? "").Trim().ToLowerInvariant();
            var password = request?.Password ?? "";
            var role = (request?.Role ?? "").Trim();

            if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { error = "Name is required" });
            if (string.IsNullOrWhiteSpace(email)) return BadRequest(new { error = "Email is required" });
            if (string.IsNullOrWhiteSpace(password)) return BadRequest(new { error = "Password is required" });
            if (string.IsNullOrWhiteSpace(role)) return BadRequest(new { error = "Role is required" });

            var exists = await _context.Users.AnyAsync(u => u.Email.ToLower() == email);
            if (exists) return BadRequest(new { error = "Email already exists" });

            var user = new User
            {
                Name = name,
                Email = email,
                Role = role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                IsActive = true,
                ForcePasswordChange = request?.ForcePasswordChange == true,
                CreatedAt = DateTime.UtcNow,
                LastLogin = null
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                user = new
                {
                    id = user.Id,
                    name = user.Name,
                    email = user.Email,
                    role = user.Role,
                    is_active = user.IsActive,
                    force_password_change = user.ForcePasswordChange,
                    created_at = user.CreatedAt,
                    last_login = user.LastLogin
                }
            });
        }

        public sealed class UpdateUserRequest
        {
            public string Name { get; set; } = "";
            public string Email { get; set; } = "";
            public string Role { get; set; } = "";
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
        {
            var actor = await RequireAdminAsync();
            if (actor == null) return StatusCode(403, new { error = "Admin access required" });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound(new { error = "User not found" });

            var name = (request?.Name ?? "").Trim();
            var email = (request?.Email ?? "").Trim().ToLowerInvariant();
            var role = (request?.Role ?? "").Trim();

            if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { error = "Name is required" });
            if (string.IsNullOrWhiteSpace(email)) return BadRequest(new { error = "Email is required" });
            if (string.IsNullOrWhiteSpace(role)) return BadRequest(new { error = "Role is required" });

            var exists = await _context.Users.AnyAsync(u => u.Id != id && u.Email.ToLower() == email);
            if (exists) return BadRequest(new { error = "Email already exists" });

            user.Name = name;
            user.Email = email;
            user.Role = role;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("{id:int}/deactivate")]
        public async Task<IActionResult> DeactivateUser(int id)
        {
            var actor = await RequireAdminAsync();
            if (actor == null) return StatusCode(403, new { error = "Admin access required" });
            if (actor.Id == id) return BadRequest(new { error = "Cannot deactivate your own user" });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound(new { error = "User not found" });

            user.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        public sealed class ResetPasswordRequest
        {
            public string Password { get; set; } = "";
            public bool ForcePasswordChange { get; set; } = true;
        }

        [HttpPost("{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
        {
            var actor = await RequireAdminAsync();
            if (actor == null) return StatusCode(403, new { error = "Admin access required" });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound(new { error = "User not found" });

            var password = request?.Password ?? "";
            if (string.IsNullOrWhiteSpace(password)) return BadRequest(new { error = "Password is required" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            user.ForcePasswordChange = request?.ForcePasswordChange != false;
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }

    [ApiController]
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public ReviewsController(AppDbContext context) { _context = context; }

        private int? GetCurrentUserId()
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(id, out var parsed) ? parsed : null;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return null;
            return await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        private static string NormalizeRoleKey(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            return role.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static int SafeInt(JsonElement el, int fallback)
        {
            try
            {
                if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n;
                if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var s)) return s;
            }
            catch
            {
            }
            return fallback;
        }

        private static string SafeString(JsonElement el)
        {
            try { return el.ValueKind == JsonValueKind.String ? (el.GetString() ?? "") : el.GetRawText(); }
            catch { return ""; }
        }

        private sealed record CategoryRule(string Category, int ReviewCycleMonths, int WarningDays, string AutoAssignTo);

        private async Task<List<CategoryRule>> LoadCategoryRulesAsync()
        {
            var settings = await _context.ReviewAutomationSettings.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync();
            var json = settings?.CategoryRulesJson ?? "[]";
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return new List<CategoryRule>();
                var result = new List<CategoryRule>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.ValueKind != JsonValueKind.Object) continue;
                    var category = el.TryGetProperty("category", out var c) ? SafeString(c).Trim() : "";
                    if (string.IsNullOrWhiteSpace(category)) continue;
                    var cycleMonths = el.TryGetProperty("review_cycle_months", out var m) ? SafeInt(m, 12) : 12;
                    var warningDays = el.TryGetProperty("warning_days", out var w) ? SafeInt(w, 30) : 30;
                    var autoAssignTo = el.TryGetProperty("auto_assign_to", out var a) ? SafeString(a).Trim() : "";
                    result.Add(new CategoryRule(category, cycleMonths, warningDays, autoAssignTo));
                }
                return result;
            }
            catch
            {
                return new List<CategoryRule>();
            }
        }

        private async Task<HashSet<int>> ResolveAssigneesAsync(AeroQMS.API.Models.Document doc, CategoryRule? rule, List<User> users)
        {
            var ids = new HashSet<int>();
            var target = (rule?.AutoAssignTo ?? "").Trim();

            if (string.IsNullOrWhiteSpace(target) || target.Equals("Document Owner", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(doc.Owner))
                {
                    foreach (var u in users.Where(u => !string.IsNullOrWhiteSpace(u.Name) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)).Select(u => u.Id))
                        ids.Add(u);
                }
            }
            else
            {
                var roleKey = NormalizeRoleKey(target);
                foreach (var u in users.Where(u => NormalizeRoleKey(u.Role) == roleKey).Select(u => u.Id))
                    ids.Add(u);
            }

            if (ids.Count == 0 && !string.IsNullOrWhiteSpace(doc.Owner))
            {
                foreach (var u in users.Where(u => !string.IsNullOrWhiteSpace(u.Name) && u.Name.Trim().Equals(doc.Owner.Trim(), StringComparison.OrdinalIgnoreCase)).Select(u => u.Id))
                    ids.Add(u);
            }

            return ids;
        }

        private sealed record ReviewTaskDto(
            int id,
            string document_number,
            string title,
            string revision,
            DateTime effective_date,
            DateTime review_date,
            string owner,
            string category,
            int due_in_days,
            string urgency
        );

        [HttpGet("my-tasks")]
        public async Task<IActionResult> GetMyReviewTasks()
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var today = DateTime.UtcNow.Date;
            var categoryRules = await LoadCategoryRulesAsync();
            var users = await _context.Users.Where(u => u.IsActive).ToListAsync();
            var docs = await _context.Documents.ToListAsync();

            var tasks = new List<ReviewTaskDto>();
            foreach (var d in docs)
            {
                var rule = categoryRules.FirstOrDefault(r => r.Category.Equals(d.Category ?? "", StringComparison.OrdinalIgnoreCase));
                var warningDays = rule?.WarningDays ?? 30;
                var dueInDays = (d.ReviewDate.Date - today).Days;

                if (dueInDays > warningDays) continue;

                var assignees = await ResolveAssigneesAsync(d, rule, users);
                if (!assignees.Contains(user.Id)) continue;

                var urgency = dueInDays < 0
                    ? $"OVERDUE - {Math.Abs(dueInDays)} days"
                    : (dueInDays <= 7 ? $"URGENT - Expires in {dueInDays} days" : $"Expires in {dueInDays} days");

                tasks.Add(new ReviewTaskDto(
                    d.Id,
                    d.DocumentNumber,
                    d.Title,
                    d.Revision,
                    d.EffectiveDate,
                    d.ReviewDate,
                    d.Owner,
                    d.Category,
                    dueInDays,
                    urgency
                ));
            }

            var ordered = tasks.OrderBy(t => t.due_in_days).ToList();

            return Ok(new { tasks = ordered });
        }
    }
}
