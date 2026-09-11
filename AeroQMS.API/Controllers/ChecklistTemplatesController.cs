using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/checklist-templates")]
    public class ChecklistTemplatesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChecklistTemplatesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/checklist-templates — reusable templates only (not ad-hoc)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetTemplates()
        {
            var templates = await _context.ChecklistTemplates
                .AsNoTracking()
                .Include(t => t.Items)
                .Include(t => t.Instances)
                .Where(t => t.IsActive && !t.IsAdHoc)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(templates.Select(MapTemplateListItem));
        }

        // GET: api/checklist-templates/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetTemplate(int id)
        {
            var template = await _context.ChecklistTemplates
                .AsNoTracking()
                .Include(t => t.Items)
                .Include(t => t.Instances)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (template == null)
                return NotFound();

            return Ok(MapTemplateDetail(template));
        }

        // POST: api/checklist-templates
        [HttpPost]
        public async Task<ActionResult<object>> CreateTemplate([FromBody] UpsertChecklistTemplateDto dto)
        {
            var validationError = ValidateTemplateDto(dto);
            if (validationError != null)
                return BadRequest(validationError);

            var title = ResolveTemplateTitle(dto.Name, dto.IsAdHoc);

            var template = new ChecklistTemplate
            {
                Title = title,
                IsAdHoc = dto.IsAdHoc,
                CreatedBy = "System",
                CreatedByUserId = dto.CreatedByUserId,
                CreatedAt = DateTime.UtcNow,
            };

            foreach (var itemDto in dto.Items.OrderBy(i => i.Order))
            {
                template.Items.Add(MapItemDtoToEntity(itemDto));
            }

            _context.ChecklistTemplates.Add(template);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, MapCreatedResponse(template));
        }

        // PUT: api/checklist-templates/5
        [HttpPut("{id}")]
        public async Task<ActionResult<object>> UpdateTemplate(int id, [FromBody] UpsertChecklistTemplateDto dto)
        {
            var validationError = ValidateTemplateDto(dto);
            if (validationError != null)
                return BadRequest(validationError);

            var template = await _context.ChecklistTemplates
                .Include(t => t.Items)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (template == null)
                return NotFound();

            if (template.IsAdHoc)
                return BadRequest("Ad-hoc templates cannot be edited. Create a reusable template instead.");

            var submissionCount = await _context.ChecklistInstances.CountAsync(i => i.ChecklistTemplateId == id);
            var hasSubmissions = submissionCount > 0;

            if (!hasSubmissions)
            {
                template.Title = ResolveTemplateTitle(dto.Name, isAdHoc: false, currentTitle: template.Title);
                _context.ChecklistTemplateItems.RemoveRange(template.Items);
                template.Items.Clear();

                foreach (var itemDto in dto.Items.OrderBy(i => i.Order))
                {
                    template.Items.Add(MapItemDtoToEntity(itemDto));
                }
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(dto.Name))
                    template.Title = dto.Name.Trim();

                var existingById = template.Items.ToDictionary(i => i.Id);
                var incomingExistingIds = dto.Items.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();

                var removedExisting = template.Items
                    .Where(i => !incomingExistingIds.Contains(i.Id))
                    .ToList();

                if (removedExisting.Count > 0)
                {
                    return BadRequest(
                        "This template has checklist submissions attached. Existing questions cannot be removed.");
                }

                foreach (var itemDto in dto.Items.Where(i => i.Id.HasValue))
                {
                    if (!existingById.TryGetValue(itemDto.Id!.Value, out var existing))
                        continue;

                    if (existing.Text != itemDto.QuestionText?.Trim() ||
                        existing.OrderIndex != itemDto.Order ||
                        existing.ItemType != ChecklistQuestionTypes.ToItemType(itemDto.Type) ||
                        existing.IsRequired != itemDto.IsRequired ||
                        (existing.ReferenceDocument ?? "") != (itemDto.RegulationReference?.Trim() ?? ""))
                    {
                        return BadRequest(
                            "This template has checklist submissions attached. Existing questions cannot be modified — you may only add new questions.");
                    }
                }

                var maxOrder = template.Items.Count > 0 ? template.Items.Max(i => i.OrderIndex) : 0;
                foreach (var itemDto in dto.Items.Where(i => !i.Id.HasValue).OrderBy(i => i.Order))
                {
                    var entity = MapItemDtoToEntity(itemDto);
                    if (entity.OrderIndex <= maxOrder)
                        entity.OrderIndex = maxOrder + 1;
                    maxOrder = entity.OrderIndex;
                    template.Items.Add(entity);
                }
            }

            await _context.SaveChangesAsync();

            var updated = await _context.ChecklistTemplates
                .AsNoTracking()
                .Include(t => t.Items)
                .FirstAsync(t => t.Id == id);

            return Ok(MapCreatedResponse(updated));
        }

        // DELETE: api/checklist-templates/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(int id)
        {
            var template = await _context.ChecklistTemplates.FirstOrDefaultAsync(t => t.Id == id);
            if (template == null)
                return NotFound();

            var submissionCount = await _context.ChecklistInstances.CountAsync(i => i.ChecklistTemplateId == id);
            if (submissionCount > 0)
            {
                return Conflict(new
                {
                    message = $"Cannot delete template because {submissionCount} checklist submission(s) reference it.",
                    submissionCount,
                });
            }

            _context.ChecklistTemplates.Remove(template);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static string? ValidateTemplateDto(UpsertChecklistTemplateDto dto)
        {
            if (dto.Items == null || dto.Items.Count == 0)
                return "At least one question is required.";

            foreach (var item in dto.Items)
            {
                if (string.IsNullOrWhiteSpace(item.QuestionText))
                    return "Each question must have question text.";

                if (!ChecklistQuestionTypes.IsValid(item.Type))
                    return $"Unsupported question type: {item.Type}. Allowed: {string.Join(", ", ChecklistQuestionTypes.All)}.";
            }

            return null;
        }

        private static string ResolveTemplateTitle(string? name, bool isAdHoc, string? currentTitle = null)
        {
            if (!string.IsNullOrWhiteSpace(name))
                return name.Trim();

            if (!string.IsNullOrWhiteSpace(currentTitle))
                return currentTitle;

            if (isAdHoc)
                return $"Custom Checklist - {DateTime.UtcNow:yyyy-MM-dd}";

            return "Untitled Template";
        }

        private static ChecklistTemplateItem MapItemDtoToEntity(UpsertChecklistTemplateItemDto dto)
        {
            var itemType = ChecklistQuestionTypes.ToItemType(dto.Type);
            var item = new ChecklistTemplateItem
            {
                Text = dto.QuestionText.Trim(),
                OrderIndex = dto.Order,
                ReferenceDocument = string.IsNullOrWhiteSpace(dto.RegulationReference)
                    ? null
                    : dto.RegulationReference.Trim(),
                IsRequired = dto.IsRequired,
            };
            ChecklistQuestionTypes.ApplyTypeDefaults(item, itemType);
            return item;
        }

        private static object MapTemplateListItem(ChecklistTemplate template) => new
        {
            template.Id,
            Name = template.Title,
            template.Description,
            template.Category,
            template.Version,
            template.IsActive,
            template.IsAdHoc,
            template.CreatedBy,
            template.CreatedByUserId,
            template.CreatedAt,
            template.ApprovedBy,
            template.ApprovedAt,
            ItemCount = template.Items.Count,
            TimesUsed = template.Instances.Count,
            Items = template.Items
                .OrderBy(i => i.OrderIndex)
                .Select(MapTemplateItem)
                .ToList(),
        };

        private static object MapTemplateDetail(ChecklistTemplate template) => new
        {
            template.Id,
            Name = template.Title,
            template.Description,
            template.Category,
            template.Version,
            template.IsActive,
            template.IsAdHoc,
            template.CreatedBy,
            template.CreatedByUserId,
            template.CreatedAt,
            template.ApprovedBy,
            template.ApprovedAt,
            ItemCount = template.Items.Count,
            TimesUsed = template.Instances.Count,
            HasSubmissions = template.Instances.Count > 0,
            Items = template.Items
                .OrderBy(i => i.OrderIndex)
                .Select(MapTemplateItem)
                .ToList(),
        };

        private static object MapTemplateItem(ChecklistTemplateItem i) => new
        {
            i.Id,
            Order = i.OrderIndex,
            QuestionText = i.Text,
            Type = ChecklistQuestionTypes.FromItemType(i.ItemType),
            i.IsRequired,
            RegulationReference = i.ReferenceDocument,
            i.AllowNA,
            i.RequiresNoteOnFail,
            i.RequiresPhotoOnFail,
            i.MinThreshold,
            i.MaxThreshold,
        };

        private static object MapCreatedResponse(ChecklistTemplate template) => new
        {
            TemplateId = template.Id,
            Name = template.Title,
            template.IsAdHoc,
            Items = template.Items
                .OrderBy(i => i.OrderIndex)
                .Select(i => new
                {
                    i.Id,
                    Order = i.OrderIndex,
                    QuestionText = i.Text,
                    Type = ChecklistQuestionTypes.FromItemType(i.ItemType),
                    i.IsRequired,
                    RegulationReference = i.ReferenceDocument,
                })
                .ToList(),
        };
    }

    public class UpsertChecklistTemplateDto
    {
        public string? Name { get; set; }
        public bool IsAdHoc { get; set; }
        public int? CreatedByUserId { get; set; }
        public List<UpsertChecklistTemplateItemDto> Items { get; set; } = new();
    }

    public class UpsertChecklistTemplateItemDto
    {
        public int? Id { get; set; }
        public int Order { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string Type { get; set; } = ChecklistQuestionTypes.PassFail;
        public bool IsRequired { get; set; } = true;
        public string? RegulationReference { get; set; }
    }
}
