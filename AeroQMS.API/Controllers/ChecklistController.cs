using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using System.ComponentModel.DataAnnotations;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Route("api/checklists")]
    public class ChecklistController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ChecklistController> _logger;

        public ChecklistController(AppDbContext context, ILogger<ChecklistController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/Checklists
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetChecklistInstances()
        {
            var instances = await _context.ChecklistInstances
                .Include(i => i.ChecklistTemplate)
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.Status,
                    i.AssignedTo,
                    i.DueDate,
                    i.CreatedAt,
                    i.CompletedAt,
                    TemplateTitle = i.ChecklistTemplate.Title,
                    Progress = _context.ChecklistInstanceItems.Count(x =>
                        x.ChecklistInstanceId == i.Id &&
                        (x.Result != null ||
                         x.NumericValue != null ||
                         (x.TextValue != null && x.TextValue != string.Empty) ||
                         (x.PhotoPath != null && x.PhotoPath != string.Empty)))
                })
                .ToListAsync();

            return Ok(instances);
        }

        // GET: api/Checklists/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetChecklistInstance(int id)
        {
            var instance = await _context.ChecklistInstances
                .Include(i => i.Items)
                .Include(i => i.ChecklistTemplate)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (instance == null)
            {
                return NotFound();
            }

            var templateItemIds = instance.Items
                .Select(item => item.ChecklistTemplateItemId)
                .Distinct()
                .ToList();

            var templateItems = await _context.ChecklistTemplateItems
                .Where(t => templateItemIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id);

            var items = instance.Items
                .OrderBy(item => item.OrderIndex)
                .Select(item => ProjectItem(item, templateItems.GetValueOrDefault(item.ChecklistTemplateItemId)))
                .ToList();

            return Ok(new
            {
                instance.Id,
                instance.Title,
                instance.Status,
                instance.AssignedTo,
                instance.DueDate,
                instance.CreatedBy,
                instance.CreatedAt,
                instance.CompletedBy,
                instance.CompletedAt,
                Items = items
            });
        }

        // POST: api/Checklists
        [HttpPost]
        public async Task<ActionResult<object>> PostChecklistInstance(CreateChecklistInstanceDto dto)
        {
            var template = await _context.ChecklistTemplates
                .Include(t => t.Items.OrderBy(i => i.OrderIndex))
                .FirstOrDefaultAsync(t => t.Id == dto.TemplateId);

            if (template == null)
            {
                return NotFound("Checklist template not found.");
            }

            var instance = new ChecklistInstance
            {
                ChecklistTemplateId = dto.TemplateId,
                Title = template.Title,
                AssignedTo = NormalizeOptionalText(dto.AssignedTo),
                CreatedBy = "System",
                DueDate = dto.DueDate
            };

            foreach (var templateItem in template.Items.OrderBy(i => i.OrderIndex))
            {
                instance.Items.Add(new ChecklistInstanceItem
                {
                    ChecklistTemplateItemId = templateItem.Id,
                    Text = templateItem.Text,
                    OrderIndex = templateItem.OrderIndex
                });
            }

            _context.ChecklistInstances.Add(instance);
            await _context.SaveChangesAsync();

            await LogAudit(instance, "Created", null, null, instance.CreatedBy, GetIpAddress());

            var createdInstance = await _context.ChecklistInstances
                .Where(i => i.Id == instance.Id)
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.Status,
                    i.AssignedTo,
                    i.DueDate,
                    i.CreatedBy,
                    i.CreatedAt,
                    i.CompletedBy,
                    i.CompletedAt
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetChecklistInstance), new { id = instance.Id }, createdInstance);
        }

        // PUT: api/Checklists/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateChecklistInstance(int id, [FromBody] UpdateChecklistInstanceDto dto)
        {
            var instance = await _context.ChecklistInstances.FirstOrDefaultAsync(i => i.Id == id);
            if (instance == null)
            {
                return NotFound("Checklist instance not found.");
            }

            if (!CanEditMetadata(instance.Status, out var blockedMessage))
            {
                return Conflict(new { message = blockedMessage });
            }

            var title = NormalizeOptionalText(dto.Title);
            if (string.IsNullOrWhiteSpace(title))
            {
                return BadRequest(new { message = "Checklist title is required." });
            }

            var oldValue = $"Title={instance.Title}; AssignedTo={instance.AssignedTo}; DueDate={instance.DueDate:o}";

            instance.Title = title;
            instance.AssignedTo = NormalizeOptionalText(dto.AssignedTo);
            instance.DueDate = dto.DueDate;

            await _context.SaveChangesAsync();
            await LogAudit(
                instance,
                "UpdatedMetadata",
                oldValue,
                $"Title={instance.Title}; AssignedTo={instance.AssignedTo}; DueDate={instance.DueDate:o}",
                "System",
                GetIpAddress());

            return Ok(new
            {
                instance.Id,
                instance.Title,
                instance.Status,
                instance.AssignedTo,
                instance.DueDate,
                instance.CreatedBy,
                instance.CreatedAt,
                instance.CompletedBy,
                instance.CompletedAt
            });
        }

        // PUT/PATCH: api/Checklists/5/items/10
        [HttpPut("{id}/items/{itemId}")]
        [HttpPatch("{id}/items/{itemId}")]
        public async Task<IActionResult> UpdateChecklistItem(int id, int itemId, [FromBody] UpdateChecklistItemDto dto)
        {
            var instance = await _context.ChecklistInstances
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (instance == null)
            {
                return NotFound("Checklist instance not found.");
            }

            if (!CanUpdateItems(instance.Status, out var statusMessage))
            {
                return Conflict(new { message = statusMessage });
            }

            var item = instance.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
            {
                return NotFound("Checklist item not found.");
            }

            var templateItem = await _context.ChecklistTemplateItems
                .FirstOrDefaultAsync(t => t.Id == item.ChecklistTemplateItemId);

            if (templateItem == null)
            {
                return NotFound("Checklist template item not found.");
            }

            var candidateTextValue = NormalizeOptionalText(dto.TextValue);
            var candidateNotes = NormalizeOptionalText(dto.Notes);
            var candidatePhotoPath = NormalizeOptionalText(dto.PhotoPath);
            var candidateResult = ResolveChecklistResult(
                templateItem,
                dto.Result,
                dto.NumericValue,
                candidateTextValue,
                candidatePhotoPath);

            var validationMessage = ValidateChecklistItemState(
                templateItem,
                candidateResult,
                dto.NumericValue,
                candidateTextValue,
                candidateNotes,
                candidatePhotoPath,
                dto.ValidateRequired);

            if (validationMessage != null)
            {
                return BadRequest(new { message = validationMessage });
            }

            var oldResult = item.Result?.ToString();
            var oldValue =
                $"Result={item.Result}; NumericValue={item.NumericValue}; TextValue={item.TextValue}; Notes={item.Notes}; PhotoPath={item.PhotoPath}";

            item.Result = candidateResult;
            item.NumericValue = dto.NumericValue;
            item.TextValue = candidateTextValue;
            item.Notes = candidateNotes;
            item.PhotoPath = candidatePhotoPath;

            if (IsItemAnswered(templateItem, item))
            {
                item.CompletedAt = DateTime.UtcNow;
                item.CompletedBy = "System";
            }
            else
            {
                item.CompletedAt = null;
                item.CompletedBy = null;
            }

            if (instance.Status == ChecklistInstanceStatus.Draft && IsItemAnswered(templateItem, item))
            {
                instance.Status = ChecklistInstanceStatus.InProgress;
            }

            await _context.SaveChangesAsync();

            await LogAudit(
                instance,
                "UpdatedItem",
                oldValue,
                $"Result={item.Result}; NumericValue={item.NumericValue}; TextValue={item.TextValue}; Notes={item.Notes}; PhotoPath={item.PhotoPath}",
                "System",
                GetIpAddress());

            if (candidateResult == ChecklistItemResult.Fail && oldResult != ChecklistItemResult.Fail.ToString())
            {
                await CreateNCRFromChecklist(instance, item, candidateNotes);
            }

            return Ok(ProjectItem(item, templateItem));
        }

        // DELETE: api/Checklists/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteChecklistInstance(int id)
        {
            var instance = await _context.ChecklistInstances
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (instance == null)
            {
                return NotFound("Checklist instance not found.");
            }

            if (!CanDelete(instance.Status, out var blockedMessage))
            {
                return Conflict(new { message = blockedMessage });
            }

            _context.ChecklistInstances.Remove(instance);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Checklist deleted successfully." });
        }

        // POST: api/Checklists/5/complete
        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteChecklist(int id)
        {
            var instance = await _context.ChecklistInstances
                .Include(i => i.Items)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (instance == null)
            {
                return NotFound();
            }

            if (instance.Status == ChecklistInstanceStatus.PendingApproval)
            {
                return Conflict(new { message = "Checklist is already pending approval." });
            }

            if (instance.Status == ChecklistInstanceStatus.Approved)
            {
                return Conflict(new { message = "Approved checklists cannot be resubmitted." });
            }

            if (instance.Status == ChecklistInstanceStatus.Voided)
            {
                return Conflict(new { message = "Voided checklists cannot be submitted." });
            }

            var templateItemIds = instance.Items
                .Select(item => item.ChecklistTemplateItemId)
                .Distinct()
                .ToList();

            var templateItems = await _context.ChecklistTemplateItems
                .Where(t => templateItemIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id);

            foreach (var item in instance.Items.OrderBy(i => i.OrderIndex))
            {
                if (!templateItems.TryGetValue(item.ChecklistTemplateItemId, out var templateItem))
                {
                    return BadRequest(new { message = $"Template metadata missing for item '{item.Text}'." });
                }

                var validationMessage = ValidateChecklistItemState(
                    templateItem,
                    ResolveChecklistResult(templateItem, item.Result, item.NumericValue, item.TextValue, item.PhotoPath),
                    item.NumericValue,
                    item.TextValue,
                    item.Notes,
                    item.PhotoPath,
                    true);

                if (validationMessage != null)
                {
                    return BadRequest(new { message = $"{item.Text}: {validationMessage}" });
                }
            }

            instance.Status = ChecklistInstanceStatus.PendingApproval;
            instance.CompletedAt = DateTime.UtcNow;
            instance.CompletedBy = "System";

            await _context.SaveChangesAsync();
            await LogAudit(instance, "SubmittedForApproval", null, null, "System", GetIpAddress());

            return Ok(new
            {
                instance.Id,
                instance.Status,
                instance.CompletedAt,
                instance.CompletedBy,
                message = "Checklist submitted for approval."
            });
        }

        // GET: api/Checklists/5/auditlog
        [HttpGet("{id}/auditlog")]
        public async Task<ActionResult<IEnumerable<object>>> GetAuditLog(int id)
        {
            var logs = await _context.ChecklistAuditLogs
                .Where(l => l.ChecklistInstanceId == id)
                .OrderByDescending(l => l.ChangedAt)
                .Select(l => new
                {
                    l.Id,
                    l.ChecklistInstanceId,
                    l.ItemId,
                    l.Action,
                    l.OldValue,
                    l.NewValue,
                    l.ChangedBy,
                    l.ChangedAt,
                    l.IPAddress
                })
                .ToListAsync();

            return Ok(logs);
        }

        // POST: api/Checklists/5/photo/10
        [HttpPost("{id}/photo/{itemId}")]
        public async Task<IActionResult> UploadPhoto(int id, int itemId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded." });
            }

            var instanceExists = await _context.ChecklistInstances.AnyAsync(i => i.Id == id);
            if (!instanceExists)
            {
                return NotFound(new { message = "Checklist instance not found." });
            }

            var itemExists = await _context.ChecklistInstanceItems.AnyAsync(i => i.Id == itemId && i.ChecklistInstanceId == id);
            if (!itemExists)
            {
                return NotFound(new { message = "Checklist item not found." });
            }

            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "checklists");
            if (!Directory.Exists(uploadPath))
            {
                Directory.CreateDirectory(uploadPath);
            }

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadPath, uniqueFileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/uploads/checklists/{uniqueFileName}";
            return Ok(new { path = relativePath });
        }

        // GET: api/Checklists/templates
        [HttpGet("templates")]
        public async Task<ActionResult<IEnumerable<object>>> GetTemplates()
        {
            var templates = await _context.ChecklistTemplates
                .Where(t => t.IsActive && !t.IsAdHoc)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    t.Description,
                    t.Category,
                    t.Version,
                    t.IsActive,
                    t.CreatedBy,
                    t.CreatedAt,
                    t.ApprovedBy,
                    t.ApprovedAt,
                    Items = t.Items
                        .OrderBy(i => i.OrderIndex)
                        .Select(i => new
                        {
                            i.Id,
                            i.Text,
                            i.ReferenceDocument,
                            i.OrderIndex,
                            i.ItemType,
                            i.MinThreshold,
                            i.MaxThreshold,
                            i.IsRequired,
                            i.AllowNA,
                            i.RequiresNoteOnFail,
                            i.RequiresPhotoOnFail
                        })
                        .ToList()
                })
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(templates);
        }

        // POST: api/Checklists/templates
        [HttpPost("templates")]
        public async Task<ActionResult<object>> PostTemplate([FromBody] CreateChecklistTemplateDto dto)
        {
            var template = new ChecklistTemplate
            {
                Title = dto.Title,
                Description = dto.Description,
                Category = dto.Category,
                CreatedBy = "System",
                CreatedAt = DateTime.UtcNow
            };

            foreach (var item in dto.Items)
            {
                template.Items.Add(new ChecklistTemplateItem
                {
                    Text = item.Text,
                    ReferenceDocument = item.ReferenceDocument,
                    OrderIndex = item.OrderIndex,
                    ItemType = item.ItemType,
                    MinThreshold = item.MinThreshold,
                    MaxThreshold = item.MaxThreshold,
                    IsRequired = item.IsRequired,
                    AllowNA = item.AllowNA,
                    RequiresNoteOnFail = item.RequiresNoteOnFail,
                    RequiresPhotoOnFail = item.RequiresPhotoOnFail
                });
            }

            _context.ChecklistTemplates.Add(template);
            await _context.SaveChangesAsync();

            var createdTemplate = await _context.ChecklistTemplates
                .Where(t => t.Id == template.Id)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    t.Description,
                    t.Category,
                    t.Version,
                    t.IsActive,
                    t.CreatedBy,
                    t.CreatedAt,
                    t.ApprovedBy,
                    t.ApprovedAt,
                    Items = t.Items
                        .OrderBy(i => i.OrderIndex)
                        .Select(i => new
                        {
                            i.Id,
                            i.Text,
                            i.ReferenceDocument,
                            i.OrderIndex,
                            i.ItemType,
                            i.MinThreshold,
                            i.MaxThreshold,
                            i.IsRequired,
                            i.AllowNA,
                            i.RequiresNoteOnFail,
                            i.RequiresPhotoOnFail
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetTemplates), new { id = template.Id }, createdTemplate);
        }

        private object ProjectItem(ChecklistInstanceItem item, ChecklistTemplateItem? templateItem)
        {
            return new
            {
                item.Id,
                item.ChecklistTemplateItemId,
                item.Text,
                item.OrderIndex,
                item.Result,
                item.NumericValue,
                item.TextValue,
                item.Notes,
                item.PhotoPath,
                item.CompletedBy,
                item.CompletedAt,
                ItemType = templateItem?.ItemType ?? ChecklistItemType.PassFail,
                MinThreshold = templateItem?.MinThreshold,
                MaxThreshold = templateItem?.MaxThreshold,
                ReferenceDocument = templateItem?.ReferenceDocument,
                IsRequired = templateItem?.IsRequired ?? true,
                RequiresNoteOnFail = templateItem?.RequiresNoteOnFail ?? false,
                RequiresPhotoOnFail = templateItem?.RequiresPhotoOnFail ?? false,
                AllowNA = templateItem?.AllowNA ?? true
            };
        }

        private static string? ValidateChecklistItemState(
            ChecklistTemplateItem templateItem,
            ChecklistItemResult? result,
            decimal? numericValue,
            string? textValue,
            string? notes,
            string? photoPath,
            bool validateRequired)
        {
            if (result == ChecklistItemResult.NA && !templateItem.AllowNA)
            {
                return "N/A is not allowed for this item.";
            }

            if (validateRequired && templateItem.IsRequired)
            {
                switch (templateItem.ItemType)
                {
                    case ChecklistItemType.PassFail:
                    case ChecklistItemType.YesNo:
                        if (result == null)
                        {
                            return "A selection is required for this item.";
                        }
                        break;
                    case ChecklistItemType.Text:
                        if (string.IsNullOrWhiteSpace(textValue))
                        {
                            return "A text answer is required for this item.";
                        }
                        break;
                    case ChecklistItemType.Number:
                        if (!numericValue.HasValue && result != ChecklistItemResult.NA)
                        {
                            return "A numeric value is required for this item.";
                        }
                        break;
                    case ChecklistItemType.PhotoRequired:
                        if (string.IsNullOrWhiteSpace(photoPath))
                        {
                            return "A photo is required for this item.";
                        }
                        break;
                }
            }

            if (result == ChecklistItemResult.Fail && templateItem.RequiresNoteOnFail && string.IsNullOrWhiteSpace(notes))
            {
                return "Notes are required when this item fails.";
            }

            if (result == ChecklistItemResult.Fail && templateItem.RequiresPhotoOnFail && string.IsNullOrWhiteSpace(photoPath))
            {
                return "A photo is required when this item fails.";
            }

            return null;
        }

        private static ChecklistItemResult? ResolveChecklistResult(
            ChecklistTemplateItem templateItem,
            ChecklistItemResult? requestedResult,
            decimal? numericValue,
            string? textValue,
            string? photoPath)
        {
            if (requestedResult == ChecklistItemResult.NA && templateItem.AllowNA)
            {
                return ChecklistItemResult.NA;
            }

            return templateItem.ItemType switch
            {
                ChecklistItemType.PassFail => requestedResult,
                ChecklistItemType.YesNo => requestedResult,
                ChecklistItemType.Text => string.IsNullOrWhiteSpace(textValue) ? null : ChecklistItemResult.Pass,
                ChecklistItemType.PhotoRequired => string.IsNullOrWhiteSpace(photoPath) ? null : ChecklistItemResult.Pass,
                ChecklistItemType.Number => ResolveNumericResult(templateItem, numericValue),
                _ => requestedResult
            };
        }

        private static ChecklistItemResult? ResolveNumericResult(ChecklistTemplateItem templateItem, decimal? numericValue)
        {
            if (!numericValue.HasValue)
            {
                return null;
            }

            var isPass = true;
            if (templateItem.MinThreshold.HasValue && numericValue.Value < templateItem.MinThreshold.Value)
            {
                isPass = false;
            }
            if (templateItem.MaxThreshold.HasValue && numericValue.Value > templateItem.MaxThreshold.Value)
            {
                isPass = false;
            }

            return isPass ? ChecklistItemResult.Pass : ChecklistItemResult.Fail;
        }

        private static bool IsItemAnswered(ChecklistTemplateItem templateItem, ChecklistInstanceItem item)
        {
            return templateItem.ItemType switch
            {
                ChecklistItemType.Text => !string.IsNullOrWhiteSpace(item.TextValue),
                ChecklistItemType.Number => item.NumericValue.HasValue || item.Result == ChecklistItemResult.NA,
                ChecklistItemType.PhotoRequired => !string.IsNullOrWhiteSpace(item.PhotoPath),
                _ => item.Result != null
            };
        }

        private static bool CanEditMetadata(ChecklistInstanceStatus status, out string? message)
        {
            if (status == ChecklistInstanceStatus.Approved)
            {
                message = "Approved checklists cannot be edited.";
                return false;
            }

            if (status == ChecklistInstanceStatus.Voided)
            {
                message = "Voided checklists cannot be edited.";
                return false;
            }

            message = null;
            return true;
        }

        private static bool CanUpdateItems(ChecklistInstanceStatus status, out string? message)
        {
            if (status == ChecklistInstanceStatus.PendingApproval)
            {
                message = "Checklist is pending approval and can no longer be edited.";
                return false;
            }

            if (status == ChecklistInstanceStatus.Approved)
            {
                message = "Approved checklists cannot be edited.";
                return false;
            }

            if (status == ChecklistInstanceStatus.Voided)
            {
                message = "Voided checklists cannot be edited.";
                return false;
            }

            message = null;
            return true;
        }

        private static bool CanDelete(ChecklistInstanceStatus status, out string message)
        {
            if (status == ChecklistInstanceStatus.Draft || status == ChecklistInstanceStatus.PendingApproval)
            {
                message = string.Empty;
                return true;
            }

            if (status == ChecklistInstanceStatus.Approved)
            {
                message = "Approved checklists cannot be deleted.";
                return false;
            }

            message = "Only Draft or Pending Approval checklists can be deleted.";
            return false;
        }

        private static string? NormalizeOptionalText(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private async Task LogAudit(ChecklistInstance instance, string action, string? oldValue, string? newValue, string changedBy, string? ipAddress)
        {
            var log = new ChecklistAuditLog
            {
                ChecklistInstanceId = instance.Id,
                Action = action,
                OldValue = oldValue,
                NewValue = newValue,
                ChangedBy = changedBy,
                ChangedAt = DateTime.UtcNow,
                IPAddress = ipAddress
            };

            _context.ChecklistAuditLogs.Add(log);
            await _context.SaveChangesAsync();
        }

        private async Task<int> CreateNCRFromChecklist(ChecklistInstance instance, ChecklistInstanceItem item, string? notes)
        {
            var lastNcr = await _context.NonConformances.OrderByDescending(n => n.Id).FirstOrDefaultAsync();
            var ncr = new NonConformance
            {
                NCRNumber = $"NCR-{DateTime.UtcNow.Year}-{(lastNcr?.Id + 1 ?? 1):0000}",
                Title = $"Checklist Fail: {item.Text} - {instance.Title}",
                Description = notes ?? "No description provided",
                Area = "Checklist",
                Category = "Checklist",
                Severity = "Major",
                LikelihoodScore = 3,
                ConsequenceScore = 3,
                RaisedBy = "System",
                Date = DateTime.UtcNow,
                Status = "Open"
            };

            _context.NonConformances.Add(ncr);
            await _context.SaveChangesAsync();
            return ncr.Id;
        }

        private string GetIpAddress()
        {
            return Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        }
    }

    public class CreateChecklistInstanceDto
    {
        public int TemplateId { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime? DueDate { get; set; }
    }

    public class UpdateChecklistInstanceDto
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? AssignedTo { get; set; }
        public DateTime? DueDate { get; set; }
    }

    public class UpdateChecklistItemDto
    {
        public ChecklistItemResult? Result { get; set; }
        public decimal? NumericValue { get; set; }
        public string? TextValue { get; set; }
        public string? Notes { get; set; }
        public string? PhotoPath { get; set; }
        public bool ValidateRequired { get; set; } = true;
    }

    public class CreateChecklistTemplateDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public List<CreateChecklistTemplateItemDto> Items { get; set; } = new();
    }

    public class CreateChecklistTemplateItemDto
    {
        public string Text { get; set; } = string.Empty;
        public string? ReferenceDocument { get; set; }
        public int OrderIndex { get; set; }
        public ChecklistItemType ItemType { get; set; }
        public decimal? MinThreshold { get; set; }
        public decimal? MaxThreshold { get; set; }
        public bool IsRequired { get; set; }
        public bool AllowNA { get; set; }
        public bool RequiresNoteOnFail { get; set; }
        public bool RequiresPhotoOnFail { get; set; }
    }
}
