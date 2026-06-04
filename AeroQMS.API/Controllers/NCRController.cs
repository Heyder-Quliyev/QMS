using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.Services;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NCRController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _uploadPath;
        private readonly AuditLoggerService _auditLogger;

        public NCRController(AppDbContext context, IWebHostEnvironment env, AuditLoggerService auditLogger)
        {
            _context = context;
            _uploadPath = Path.Combine(env.ContentRootPath, "Uploads");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
            _auditLogger = auditLogger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NonConformance>>> GetNCRs()
        {
            return await _context.NonConformances.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<NonConformance>> GetNCR(int id)
        {
            var ncr = await _context.NonConformances.FindAsync(id);
            if (ncr == null) return NotFound();
            return ncr;
        }

        [HttpPost]
        public async Task<ActionResult<NonConformance>> PostNCR([FromForm] NonConformance ncr, IFormFile? file)
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
                    ncr.FileName = fileName;
                }

                _context.NonConformances.Add(ncr);
                await _context.SaveChangesAsync();

                // Add audit log entry
                await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                {
                    NcrId = ncr.Id,
                    UserId = 1,
                    UserName = "Raised By",
                    Action = "created",
                    NewValue = "NCR created",
                    Metadata = new
                    {
                        title = ncr.Title,
                        ncr_number = ncr.NCRNumber
                    }
                });

                return CreatedAtAction(nameof(GetNCR), new { id = ncr.Id }, ncr);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutNCR(int id, [FromForm] NonConformance ncr, IFormFile? file)
        {
            if (id != ncr.Id) return BadRequest();

            try
            {
                var existingNcr = await _context.NonConformances.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
                if (existingNcr == null) return NotFound();

                if (file != null)
                {
                    // Delete old file if exists
                    if (!string.IsNullOrEmpty(existingNcr.FileName))
                    {
                        var oldPath = Path.Combine(_uploadPath, existingNcr.FileName);
                        if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
                    }

                    var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
                    var filePath = Path.Combine(_uploadPath, fileName);
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }
                    ncr.FileName = fileName;
                }
                else
                {
                    ncr.FileName = existingNcr.FileName;
                }

                var oldNcrNumber = existingNcr.NCRNumber;
                var oldTitle = existingNcr.Title;
                var oldDescription = existingNcr.Description;
                var oldArea = existingNcr.Area;
                var oldCategory = existingNcr.Category;
                var oldSeverity = existingNcr.Severity;
                var oldLikelihood = existingNcr.LikelihoodScore;
                var oldConsequence = existingNcr.ConsequenceScore;
                var oldRaisedBy = existingNcr.RaisedBy;
                var oldDate = existingNcr.Date;
                var oldStatus = existingNcr.Status;
                var oldFileName = existingNcr.FileName;

                _context.Entry(ncr).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                var userId = 1;
                var userName = "Updated By";

                if (!string.Equals(oldNcrNumber, ncr.NCRNumber, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "ncr_number_changed",
                        OldValue = oldNcrNumber,
                        NewValue = ncr.NCRNumber,
                        Metadata = new { field = "ncr_number" }
                    });
                }

                if (!string.Equals(oldTitle, ncr.Title, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "title_changed",
                        OldValue = oldTitle,
                        NewValue = ncr.Title,
                        Metadata = new { field = "title" }
                    });
                }

                if (!string.Equals(oldDescription, ncr.Description, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "description_changed",
                        OldValue = oldDescription,
                        NewValue = ncr.Description,
                        Metadata = new { field = "description" }
                    });
                }

                if (!string.Equals(oldArea, ncr.Area, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "area_changed",
                        OldValue = oldArea,
                        NewValue = ncr.Area,
                        Metadata = new { field = "area" }
                    });
                }

                if (!string.Equals(oldCategory, ncr.Category, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "category_changed",
                        OldValue = oldCategory,
                        NewValue = ncr.Category,
                        Metadata = new { field = "category" }
                    });
                }

                if (!string.Equals(oldSeverity, ncr.Severity, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "severity_changed",
                        OldValue = oldSeverity,
                        NewValue = ncr.Severity,
                        Metadata = new { field = "severity" }
                    });
                }

                if (oldLikelihood != ncr.LikelihoodScore)
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "likelihood_score_changed",
                        OldValue = oldLikelihood.ToString(),
                        NewValue = ncr.LikelihoodScore.ToString(),
                        Metadata = new { field = "likelihood_score" }
                    });
                }

                if (oldConsequence != ncr.ConsequenceScore)
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "consequence_score_changed",
                        OldValue = oldConsequence.ToString(),
                        NewValue = ncr.ConsequenceScore.ToString(),
                        Metadata = new { field = "consequence_score" }
                    });
                }

                if (!string.Equals(oldRaisedBy, ncr.RaisedBy, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "raised_by_changed",
                        OldValue = oldRaisedBy,
                        NewValue = ncr.RaisedBy,
                        Metadata = new { field = "raised_by" }
                    });
                }

                if (oldDate != ncr.Date)
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "date_changed",
                        OldValue = oldDate.ToString("yyyy-MM-dd"),
                        NewValue = ncr.Date.ToString("yyyy-MM-dd"),
                        Metadata = new { field = "date" }
                    });
                }

                if (!string.Equals(oldStatus, ncr.Status, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "status_changed",
                        OldValue = oldStatus,
                        NewValue = ncr.Status,
                        Metadata = new { field = "status", previous_status = oldStatus, new_status = ncr.Status, trigger = "manual" }
                    });
                }

                if (!string.Equals(oldFileName, ncr.FileName, StringComparison.Ordinal))
                {
                    await _auditLogger.LogNcrChangeAsync(new NcrChangeParams
                    {
                        NcrId = ncr.Id,
                        UserId = userId,
                        UserName = userName,
                        Action = "attachment_changed",
                        OldValue = oldFileName,
                        NewValue = ncr.FileName,
                        Metadata = new { field = "file_name" }
                    });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNCR(int id)
        {
            var ncr = await _context.NonConformances.FindAsync(id);
            if (ncr == null) return NotFound();

            if (!string.IsNullOrEmpty(ncr.FileName))
            {
                var filePath = Path.Combine(_uploadPath, ncr.FileName);
                if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
            }

            _context.NonConformances.Remove(ncr);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadAttachment(int id)
        {
            var ncr = await _context.NonConformances.FindAsync(id);
            if (ncr == null || string.IsNullOrEmpty(ncr.FileName)) return NotFound();

            var filePath = Path.Combine(_uploadPath, ncr.FileName);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;
            return File(memory, "application/octet-stream", $"NCR_{ncr.NCRNumber}_Attachment{Path.GetExtension(ncr.FileName)}");
        }

        [HttpGet("{id}/history")]
        public async Task<ActionResult<IEnumerable<object>>> GetNCRHistory(int id)
        {
            var histories = await _context.NCRHistories
                .Where(h => h.NCRId == id)
                .OrderByDescending(h => h.Timestamp)
                .ToListAsync();

            var result = histories.Select(h => new
            {
                h.Id,
                h.NCRId,
                h.UserId,
                h.UserName,
                h.Action,
                h.OldValue,
                h.NewValue,
                h.Timestamp,
                h.IpAddress,
                h.UserAgent,
                h.ChangeReason,
                Metadata = !string.IsNullOrEmpty(h.Metadata) ? System.Text.Json.JsonSerializer.Deserialize<object>(h.Metadata) : null
            }).ToList();

            return Ok(new { entries = result });
        }

        [HttpGet("{id}/export/csv")]
        public async Task<IActionResult> ExportNcrHistoryCsv(int id)
        {
            var histories = await _context.NCRHistories
                .Where(h => h.NCRId == id)
                .OrderBy(h => h.Timestamp)
                .ToListAsync();

            var csv = new System.Text.StringBuilder();
            csv.AppendLine("Timestamp,User,Action,OldValue,NewValue");

            foreach (var h in histories)
            {
                csv.AppendLine($"{h.Timestamp:yyyy-MM-dd HH:mm:ss},{EscapeCsv(h.UserName)},{EscapeCsv(h.Action)},{EscapeCsv(h.OldValue)},{EscapeCsv(h.NewValue)}");
            }

            return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"NcrHistory_{id}.csv");
        }

        private string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n"))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }
            return value;
        }

        private bool NCRExists(int id) => _context.NonConformances.Any(e => e.Id == id);
    }
}
