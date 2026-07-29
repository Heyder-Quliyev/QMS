using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using System.ComponentModel.DataAnnotations;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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
                    TemplateTitle = i.ChecklistTemplate.Title,
                    Progress = _context.ChecklistInstanceItems
                        .Count(x => x.ChecklistInstanceId == i.Id && x.Result != null)
                })
                .ToListAsync();

            return Ok(instances);
        }

        // GET: api/Checklists/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetChecklistInstance(int id)
        {
            var instance = await _context.ChecklistInstances
                .Include(i => i.Items.OrderBy(item => item.OrderIndex))
                .Include(i => i.ChecklistTemplate)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (instance == null)
            {
                return NotFound();
            }

            var items = instance.Items.Select(item => new
            {
                item.Id,
                item.ChecklistTemplateItemId,
                item.Text,
                item.OrderIndex,
                item.Result,
                item.NumericValue,
                item.Notes,
                item.PhotoPath,
                item.CompletedBy,
                item.CompletedAt,
                ItemType = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.ItemType ?? ChecklistItemType.Text,
                MinThreshold = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.MinThreshold,
                MaxThreshold = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.MaxThreshold,
                ReferenceDocument = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.ReferenceDocument,
                RequiresNoteOnFail = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.RequiresNoteOnFail ?? false,
                RequiresPhotoOnFail = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.RequiresPhotoOnFail ?? false,
                AllowNA = _context.ChecklistTemplateItems
                    .FirstOrDefault(t => t.Id == item.ChecklistTemplateItemId)?.AllowNA ?? true
            });

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
                AssignedTo = dto.AssignedTo,
                CreatedBy = "System", // TODO: Replace with actual user when auth
                DueDate = dto.DueDate
            };

            foreach (var templateItem in template.Items)
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

        // PATCH: api/Checklists/5/items/10
        [HttpPatch("{id}/items/{itemId}")]
        public async Task<IActionResult> PatchChecklistItem(int id, int itemId, [FromBody] UpdateChecklistItemDto dto)
        {
            var instance = await _context.ChecklistInstances.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == id);
            if (instance == null) return NotFound("Checklist instance not found.");

            var item = instance.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null) return NotFound("Checklist item not found.");

            var templateItem = await _context.ChecklistTemplateItems.FirstOrDefaultAsync(t => t.Id == item.ChecklistTemplateItemId);
            if (dto.Result == ChecklistItemResult.Fail)
            {
                if (templateItem?.RequiresNoteOnFail == true && string.IsNullOrWhiteSpace(dto.Notes))
                {
                    return BadRequest("Notes required for this item when result is Fail.");
                }
            }

            var oldResult = item.Result.ToString();
            var oldNotes = item.Notes;
            var oldPhotoPath = item.PhotoPath;

            // Auto-evaluate result for numeric items if user didn't explicitly select NA
            if (templateItem?.ItemType == ChecklistItemType.Numeric && dto.NumericValue.HasValue && dto.Result != ChecklistItemResult.NA)
            {
                bool isPass = true;
                if (templateItem.MinThreshold.HasValue && dto.NumericValue.Value < templateItem.MinThreshold.Value)
                {
                    isPass = false;
                }
                if (templateItem.MaxThreshold.HasValue && dto.NumericValue.Value > templateItem.MaxThreshold.Value)
                {
                    isPass = false;
                }
                item.Result = isPass ? ChecklistItemResult.Pass : ChecklistItemResult.Fail;
            }
            else
            {
                item.Result = dto.Result;
            }

            item.NumericValue = dto.NumericValue;
            item.Notes = dto.Notes;
            item.PhotoPath = dto.PhotoPath;
            item.CompletedAt = DateTime.UtcNow;
            item.CompletedBy = "System";

            // Update instance status
            if (instance.Status == ChecklistInstanceStatus.Draft)
                instance.Status = ChecklistInstanceStatus.InProgress;

            await _context.SaveChangesAsync();

            await LogAudit(instance, "UpdatedItem", oldResult, dto.Result.ToString(), "System", GetIpAddress());

            if (dto.Result == ChecklistItemResult.Fail)
            {
                await CreateNCRFromChecklist(instance, item, dto.Notes);
            }

            var updatedItem = new
            {
                item.Id,
                item.ChecklistTemplateItemId,
                item.Text,
                item.OrderIndex,
                item.Result,
                item.NumericValue,
                item.Notes,
                item.PhotoPath,
                item.CompletedBy,
                item.CompletedAt,
                ItemType = templateItem?.ItemType ?? ChecklistItemType.Text,
                MinThreshold = templateItem?.MinThreshold,
                MaxThreshold = templateItem?.MaxThreshold,
                ReferenceDocument = templateItem?.ReferenceDocument,
                RequiresNoteOnFail = templateItem?.RequiresNoteOnFail ?? false,
                RequiresPhotoOnFail = templateItem?.RequiresPhotoOnFail ?? false,
                AllowNA = templateItem?.AllowNA ?? true
            };

            return Ok(updatedItem);
        }

        // POST: api/Checklists/5/complete
        [HttpPost("{id}/complete")]
        public async Task<IActionResult> CompleteChecklist(int id)
        {
            var instance = await _context.ChecklistInstances.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == id);
            if (instance == null) return NotFound();
            if (instance.Items.Any(i => i.Result == null))
            {
                return BadRequest("Cannot complete checklist with pending items.");
            }

            instance.Status = ChecklistInstanceStatus.Completed;
            instance.CompletedAt = DateTime.UtcNow;
            instance.CompletedBy = "System";

            await _context.SaveChangesAsync();
            await LogAudit(instance, "Completed", null, null, "System", GetIpAddress());
            return Ok(new
            {
                instance.Id,
                instance.Status,
                instance.CompletedAt,
                instance.CompletedBy,
                message = "Checklist completed successfully."
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
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "checklists");
            if (!Directory.Exists(uploadPath)) Directory.CreateDirectory(uploadPath);

            var uniqueFileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadPath, uniqueFileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
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
                .Where(t => t.IsActive)
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
    public class UpdateChecklistItemDto
    {
        public ChecklistItemResult Result { get; set; }
        public decimal? NumericValue { get; set; }
        public string? Notes { get; set; }
        public string? PhotoPath { get; set; }
    }
    public class CreateChecklistTemplateDto
    {
        public string Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public List<CreateChecklistTemplateItemDto> Items { get; set; }
    }
    public class CreateChecklistTemplateItemDto
    {
        public string Text { get; set; }
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
