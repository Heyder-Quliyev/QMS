using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.Services;
using System.Text.RegularExpressions;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CapaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;
        private readonly AuditLoggerService _auditLogger;
        private readonly string _uploadPath;

        public CapaController(AppDbContext context, IEmailService emailService, AuditLoggerService auditLogger, IWebHostEnvironment env)
        {
            _context = context;
            _emailService = emailService;
            _auditLogger = auditLogger;
            _uploadPath = Path.Combine(env.ContentRootPath, "Uploads", "Capa");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        public class CapaVerifyRequest
        {
            public string VerificationNotes { get; set; }
            public string EffectivenessRating { get; set; }
            public int VerifiedById { get; set; }
            public DateTime VerificationDate { get; set; }
        }

        [HttpPost("{id}/verify")]
        public async Task<IActionResult> VerifyCapa(Guid id, CapaVerifyRequest request)
        {
            var action = await _context.CapaActions.FindAsync(id);
            if (action == null) return NotFound();

            var oldStatus = action.Status;
            action.Status = "verified";
            action.VerificationNotes = request.VerificationNotes;
            action.EffectivenessRating = request.EffectivenessRating;
            action.VerifiedById = request.VerifiedById;
            action.VerificationDate = request.VerificationDate;
            action.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Add audit log entry
            await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
            {
                CapaId = id,
                UserId = request.VerifiedById,
                UserName = "Verifier",
                Action = "verified",
                OldValue = oldStatus,
                NewValue = "verified",
                Metadata = new
                {
                    verification_notes = request.VerificationNotes,
                    effectiveness_rating = request.EffectivenessRating
                }
            });

            // Notify user about verification
            await _emailService.SendVerifiedEmail(action);

            return Ok(action);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CapaAction>>> GetCapaActions()
        {
            return await _context.CapaActions.ToListAsync();
        }

        [HttpGet("my-actions")]
        public async Task<ActionResult<IEnumerable<object>>> GetMyActions(int userId = 1)
        {
            // Join with NCR to get NCR Number for context
            var actions = await (from capa in _context.CapaActions
                                 join ncr in _context.NonConformances on capa.NCRId equals ncr.Id into ncrJoin
                                 from ncr in ncrJoin.DefaultIfEmpty()
                                 where capa.ResponsiblePersonId == userId
                                 select new
                                 {
                                     capa.Id,
                                     capa.NCRId,
                                     NcrNumber = ncr != null ? ncr.NCRNumber : "N/A",
                                     capa.ActionType,
                                     capa.Title,
                                     capa.Description,
                                     capa.ResponsiblePersonId,
                                     capa.ResponsiblePersonName,
                                     capa.ResponsiblePersonEmail,
                                     capa.DueDate,
                                     capa.Status,
                                     capa.Priority,
                                     capa.CreatedAt,
                                     capa.UpdatedAt
                                 }).ToListAsync();
            return actions;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CapaAction>> GetCapaAction(Guid id)
        {
            var action = await _context.CapaActions.FindAsync(id);
            if (action == null) return NotFound();
            Console.WriteLine($"[GET CAPA {id}] Title: {action.Title} | Description: {action.Description}");
            return action;
        }

        public class CreateCommentRequest
        {
            public string Comment { get; set; }
        }

        [HttpPost("{capaId}/comments")]
        public async Task<ActionResult<CapaComment>> CreateComment(Guid capaId, CreateCommentRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Comment))
                return BadRequest("Comment cannot be empty.");

            if (request.Comment.Length > 2000)
                return BadRequest("Comment exceeds max length of 2000 characters.");

            var action = await _context.CapaActions.FindAsync(capaId);
            if (action == null) return NotFound("CAPA Action not found.");

            var userId = 1;
            var userName = "Admin User";

            var comment = new CapaComment
            {
                Id = Guid.NewGuid(),
                CapaId = capaId,
                UserId = userId,
                UserName = userName,
                Comment = request.Comment,
                CreatedAt = DateTime.UtcNow
            };

            _context.CapaComments.Add(comment);

            var history = new CapaHistory
            {
                Id = Guid.NewGuid(),
                CapaId = capaId,
                UserId = userId,
                UserName = userName,
                Action = "added a comment",
                Timestamp = DateTime.UtcNow
            };
            _context.CapaHistories.Add(history);

            var mentions = Regex.Matches(request.Comment, @"@(\w+)");
            foreach (Match match in mentions)
            {
                var mentionedUser = match.Groups[1].Value;
                await _emailService.SendMentionEmail(comment, mentionedUser, action);
            }

            await _context.SaveChangesAsync();
            return Ok(comment);
        }

        [HttpGet("{capaId}/comments")]
        public async Task<ActionResult<IEnumerable<CapaComment>>> GetComments(Guid capaId, [FromQuery] string sort = "newest")
        {
            var query = _context.CapaComments.Where(c => c.CapaId == capaId);

            if (sort.ToLower() == "oldest")
                query = query.OrderBy(c => c.CreatedAt);
            else
                query = query.OrderByDescending(c => c.CreatedAt);

            return await query.ToListAsync();
        }

        [HttpPut("comments/{commentId}")]
        public async Task<ActionResult<CapaComment>> UpdateComment(Guid commentId, CreateCommentRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Comment))
                return BadRequest("Comment cannot be empty.");

            if (request.Comment.Length > 2000)
                return BadRequest("Comment exceeds max length of 2000 characters.");

            var comment = await _context.CapaComments.FindAsync(commentId);
            if (comment == null) return NotFound("Comment not found.");

            var currentUserId = 1;
            if (comment.UserId != currentUserId)
                return Forbid("Only the author can edit this comment.");

            comment.Comment = request.Comment;
            comment.IsEdited = true;
            comment.EditedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(comment);
        }

        [HttpDelete("comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(Guid commentId)
        {
            var comment = await _context.CapaComments.FindAsync(commentId);
            if (comment == null) return NotFound("Comment not found.");

            var currentUserId = 1;
            var isAdmin = true;
            if (comment.UserId != currentUserId && !isAdmin)
                return Forbid("Permission denied.");

            comment.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Comment deleted successfully." });
        }

        [HttpPost("{capaId}/attachments")]
        public async Task<ActionResult<CapaAttachment>> UploadAttachment(Guid capaId, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");
            if (file.Length > 10 * 1024 * 1024) return BadRequest("File size exceeds 10MB.");

            var action = await _context.CapaActions.FindAsync(capaId);
            if (action == null) return NotFound("CAPA Action not found.");

            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(_uploadPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var attachment = new CapaAttachment
            {
                Id = Guid.NewGuid(),
                CapaId = capaId,
                FileName = file.FileName,
                FileUrl = $"/Uploads/Capa/{fileName}",
                FileType = file.ContentType,
                FileSize = (int)file.Length,
                UploadedById = 1,
                UploadedAt = DateTime.UtcNow
            };

            _context.CapaAttachments.Add(attachment);

            _context.CapaHistories.Add(new CapaHistory
            {
                Id = Guid.NewGuid(),
                CapaId = capaId,
                UserId = 1,
                UserName = "Admin User",
                Action = $"uploaded attachment: {file.FileName}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(attachment);
        }

        [HttpGet("attachments/{id}/download")]
        public async Task<IActionResult> DownloadAttachment(Guid id)
        {
            var attachment = await _context.CapaAttachments.FindAsync(id);
            if (attachment == null) return NotFound();

            var fileName = Path.GetFileName(attachment.FileUrl);
            var filePath = Path.Combine(_uploadPath, fileName);

            if (!System.IO.File.Exists(filePath)) return NotFound();

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;

            return File(memory, attachment.FileType, attachment.FileName);
        }

        [HttpDelete("attachments/{id}")]
        public async Task<IActionResult> DeleteAttachment(Guid id)
        {
            var attachment = await _context.CapaAttachments.FindAsync(id);
            if (attachment == null) return NotFound();

            var fileName = Path.GetFileName(attachment.FileUrl);
            var filePath = Path.Combine(_uploadPath, fileName);

            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }

            _context.CapaAttachments.Remove(attachment);

            _context.CapaHistories.Add(new CapaHistory
            {
                Id = Guid.NewGuid(),
                CapaId = attachment.CapaId,
                UserId = 1,
                UserName = "Admin User",
                Action = $"deleted attachment: {attachment.FileName}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Attachment deleted successfully" });
        }

        [HttpGet("{id}/attachments")]
        public async Task<ActionResult<IEnumerable<CapaAttachment>>> GetCapaAttachments(Guid id)
        {
            var attachments = await _context.CapaAttachments
                .Where(a => a.CapaId == id)
                .OrderByDescending(a => a.UploadedAt)
                .ToListAsync();
            return attachments;
        }

        [HttpGet("{id}/history")]
        public async Task<ActionResult<IEnumerable<object>>> GetCapaHistory(Guid id)
        {
            var histories = await _context.CapaHistories
                .Where(h => h.CapaId == id)
                .OrderByDescending(h => h.Timestamp)
                .ToListAsync();

            return histories.Select(h => new
            {
                h.Id,
                h.CapaId,
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
        }

        [HttpGet("{id}/export/csv")]
        public async Task<IActionResult> ExportCapaHistoryCsv(Guid id)
        {
            var histories = await _context.CapaHistories
                .Where(h => h.CapaId == id)
                .OrderBy(h => h.Timestamp)
                .ToListAsync();

            var csv = new System.Text.StringBuilder();
            csv.AppendLine("Timestamp,User,Action,OldValue,NewValue");

            foreach (var h in histories)
            {
                csv.AppendLine($"{h.Timestamp:yyyy-MM-dd HH:mm:ss},{EscapeCsv(h.UserName)},{EscapeCsv(h.Action)},{EscapeCsv(h.OldValue)},{EscapeCsv(h.NewValue)}");
            }

            return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"CapaHistory_{id}.csv");
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

        [HttpPost]
        public async Task<ActionResult<CapaAction>> PostCapaAction(CapaAction action)
        {
            if (action.Id == Guid.Empty) action.Id = Guid.NewGuid();
            
            // Set defaults if not provided
            if (string.IsNullOrEmpty(action.Status)) action.Status = "not_started";
            if (string.IsNullOrEmpty(action.Priority)) action.Priority = "medium";
            
            action.CreatedAt = DateTime.UtcNow;
            action.UpdatedAt = DateTime.UtcNow;
            action.AssignedDate = DateTime.UtcNow;
            
            _context.CapaActions.Add(action);
            await _context.SaveChangesAsync();

            // Add audit log entry
            await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
            {
                CapaId = action.Id,
                UserId = action.ResponsiblePersonId,
                UserName = action.ResponsiblePersonName,
                Action = "created",
                NewValue = "CAPA created",
                Metadata = new
                {
                    title = action.Title,
                    action_type = action.ActionType,
                    priority = action.Priority
                }
            });

            // Trigger Email
            await _emailService.SendNewCAPAEmail(action);
            
            return CreatedAtAction(nameof(GetCapaAction), new { id = action.Id }, action);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCapaAction(Guid id, CapaAction action)
        {
            if (id != action.Id) return BadRequest();
            
            var existingAction = await _context.CapaActions.FirstOrDefaultAsync(a => a.Id == id);
            if (existingAction == null) return NotFound();

            Console.WriteLine($"[PUT CAPA] Old Title: {existingAction.Title} | New Title: {action.Title}");
            Console.WriteLine($"[PUT CAPA] Old Description: {existingAction.Description} | New Description: {action.Description}");
            Console.WriteLine($"[PUT CAPA] Old Status: {existingAction.Status} | New Status: {action.Status}");

            // Store old values to check for changes
            var oldTitle = existingAction.Title;
            var oldDescription = existingAction.Description;
            var oldActionType = existingAction.ActionType;
            var oldResponsiblePersonId = existingAction.ResponsiblePersonId;
            var oldResponsiblePersonName = existingAction.ResponsiblePersonName;
            var oldResponsiblePersonEmail = existingAction.ResponsiblePersonEmail;
            var oldDueDate = existingAction.DueDate;
            var oldStatus = existingAction.Status;
            var oldPriority = existingAction.Priority;
            var oldNcrId = existingAction.NCRId;
            var oldNcrReference = existingAction.NCRReference;
            var oldNcrTitle = existingAction.NCRTitle;
            var oldNcrDescription = existingAction.NCRDescription;
            var oldOccurrenceDate = existingAction.OccurrenceDate;
            var oldLocation = existingAction.Location;
            var oldReportedByName = existingAction.ReportedByName;
            var oldReportedByEmail = existingAction.ReportedByEmail;
            var oldRootCause = existingAction.RootCause;
            var oldContributingFactors = existingAction.ContributingFactors;

            // Update all fields, preserve CreatedAt
            existingAction.Title = action.Title;
            existingAction.Description = action.Description;
            existingAction.ActionType = action.ActionType;
            existingAction.ResponsiblePersonId = action.ResponsiblePersonId;
            existingAction.ResponsiblePersonName = action.ResponsiblePersonName;
            existingAction.ResponsiblePersonEmail = action.ResponsiblePersonEmail;
            existingAction.DueDate = action.DueDate;
            existingAction.Status = action.Status;
            existingAction.Priority = action.Priority;
            existingAction.NCRId = action.NCRId;
            existingAction.NCRReference = action.NCRReference;
            existingAction.NCRTitle = action.NCRTitle;
            existingAction.NCRDescription = action.NCRDescription;
            existingAction.OccurrenceDate = action.OccurrenceDate;
            existingAction.Location = action.Location;
            existingAction.ReportedByName = action.ReportedByName;
            existingAction.ReportedByEmail = action.ReportedByEmail;
            existingAction.RootCause = action.RootCause;
            existingAction.ContributingFactors = action.ContributingFactors;
            existingAction.UpdatedAt = DateTime.UtcNow;

            // Set ClosedDate when status becomes closed
            if (oldStatus != "closed" && action.Status == "closed")
            {
                existingAction.ClosedDate = DateTime.UtcNow;
            }
            else if (oldStatus == "closed" && action.Status != "closed")
            {
                existingAction.ClosedDate = null;
            }

            // Set VerificationDate when status becomes verified
            if (oldStatus != "verified" && action.Status == "verified")
            {
                existingAction.VerificationDate = DateTime.UtcNow;
            }
            else if (oldStatus == "verified" && action.Status != "verified")
            {
                existingAction.VerificationDate = null;
                existingAction.VerificationNotes = null;
                existingAction.EffectivenessRating = null;
                existingAction.VerifiedById = null;
            }

            try 
            { 
                await _context.SaveChangesAsync(); 

                Console.WriteLine($"[PUT CAPA] Saved changes! Updated Title is now: {existingAction.Title}");
                Console.WriteLine($"[PUT CAPA] Updated Description is now: {existingAction.Description}");

                // Log all field changes
                var userId = existingAction.ResponsiblePersonId;
                var userName = existingAction.ResponsiblePersonName;

                if (oldTitle != action.Title)
                {
                    Console.WriteLine($"[PUT CAPA] Logging title change!");
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "title_changed",
                        OldValue = oldTitle,
                        NewValue = action.Title,
                        Metadata = new { field = "title" }
                    });
                }

                if (oldDescription != action.Description)
                {
                    Console.WriteLine($"[PUT CAPA] Logging description change!");
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "description_changed",
                        OldValue = oldDescription,
                        NewValue = action.Description,
                        Metadata = new { field = "description" }
                    });
                }

                if (oldActionType != action.ActionType)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "action_type_changed",
                        OldValue = oldActionType,
                        NewValue = action.ActionType,
                        Metadata = new { field = "action_type" }
                    });
                }

                if (oldResponsiblePersonName != action.ResponsiblePersonName)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "assigned_to_changed",
                        OldValue = oldResponsiblePersonName,
                        NewValue = action.ResponsiblePersonName,
                        Metadata = new { field = "assigned_to" }
                    });
                }

                if (oldDueDate != action.DueDate)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "due_date_changed",
                        OldValue = oldDueDate.ToString("yyyy-MM-dd"),
                        NewValue = action.DueDate.ToString("yyyy-MM-dd"),
                        Metadata = new { field = "due_date" }
                    });
                }

                if (oldPriority != action.Priority)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "priority_changed",
                        OldValue = oldPriority,
                        NewValue = action.Priority,
                        Metadata = new { field = "priority" }
                    });
                }

                if (oldStatus != action.Status)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "status_changed",
                        OldValue = oldStatus,
                        NewValue = action.Status,
                        Metadata = new { field = "status", previous_status = oldStatus, new_status = action.Status, trigger = "manual" }
                    });

                    await _emailService.SendStatusChangeEmail(existingAction, oldStatus, action.Status);
                    
                    if (action.Status == "pending_verification")
                    {
                        await _emailService.SendVerificationRequestEmail(existingAction);
                    }
                }

                // Log NCR-related field changes
                if (oldNcrReference != action.NCRReference)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "ncr_reference_changed",
                        OldValue = oldNcrReference,
                        NewValue = action.NCRReference,
                        Metadata = new { field = "ncr_reference" }
                    });
                }

                if (oldNcrTitle != action.NCRTitle)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "ncr_title_changed",
                        OldValue = oldNcrTitle,
                        NewValue = action.NCRTitle,
                        Metadata = new { field = "ncr_title" }
                    });
                }

                if (oldNcrDescription != action.NCRDescription)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "ncr_description_changed",
                        OldValue = oldNcrDescription,
                        NewValue = action.NCRDescription,
                        Metadata = new { field = "ncr_description" }
                    });
                }

                if (oldLocation != action.Location)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "location_changed",
                        OldValue = oldLocation,
                        NewValue = action.Location,
                        Metadata = new { field = "location" }
                    });
                }

                if (oldReportedByName != action.ReportedByName)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "reported_by_name_changed",
                        OldValue = oldReportedByName,
                        NewValue = action.ReportedByName,
                        Metadata = new { field = "reported_by_name" }
                    });
                }

                if (oldReportedByEmail != action.ReportedByEmail)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "reported_by_email_changed",
                        OldValue = oldReportedByEmail,
                        NewValue = action.ReportedByEmail,
                        Metadata = new { field = "reported_by_email" }
                    });
                }

                if (oldRootCause != action.RootCause)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "root_cause_changed",
                        OldValue = oldRootCause,
                        NewValue = action.RootCause,
                        Metadata = new { field = "root_cause" }
                    });
                }

                if (oldContributingFactors != action.ContributingFactors)
                {
                    await _auditLogger.LogCapaChangeAsync(new CapaChangeParams
                    {
                        CapaId = id,
                        UserId = userId,
                        UserName = userName,
                        Action = "contributing_factors_changed",
                        OldValue = oldContributingFactors,
                        NewValue = action.ContributingFactors,
                        Metadata = new { field = "contributing_factors" }
                    });
                }
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CapaActionExists(id)) return NotFound();
                throw;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PUT CAPA ERROR] {ex.Message}");
                Console.WriteLine($"[PUT CAPA ERROR STACK] {ex.StackTrace}");
                return StatusCode(500, $"Error updating CAPA: {ex.Message}");
            }
            return Ok(existingAction);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCapaAction(Guid id)
        {
            var action = await _context.CapaActions.FindAsync(id);
            if (action == null) return NotFound();
            _context.CapaActions.Remove(action);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private bool CapaActionExists(Guid id) => _context.CapaActions.Any(e => e.Id == id);

        public class SetCompletionDateRequest
        {
            public DateTime CompletionDate { get; set; }
        }

        [HttpPost("{id}/set-completion-date")]
        public async Task<IActionResult> SetCompletionDate(Guid id, SetCompletionDateRequest request)
        {
            var action = await _context.CapaActions.FindAsync(id);
            if (action == null) return NotFound();

            if (action.Status == "closed")
            {
                action.ClosedDate = request.CompletionDate;
            }
            else if (action.Status == "verified")
            {
                action.VerificationDate = request.CompletionDate;
            }
            else
            {
                return BadRequest("CAPA must be closed or verified to set completion date");
            }

            action.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(action);
        }

        [HttpGet("debug/list-with-dates")]
        public async Task<ActionResult<IEnumerable<object>>> GetCapasWithDates()
        {
            var capas = await _context.CapaActions
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Status,
                    c.CreatedAt,
                    c.UpdatedAt,
                    c.ClosedDate,
                    c.VerificationDate,
                    DaysToComplete = (c.Status == "closed" || c.Status == "verified") 
                        ? (double?)(
                            (c.Status == "closed" && c.ClosedDate.HasValue ? c.ClosedDate.Value : 
                             c.Status == "verified" && c.VerificationDate.HasValue ? c.VerificationDate.Value : 
                             c.UpdatedAt) - c.CreatedAt
                        ).TotalDays 
                        : null
                })
                .ToListAsync();

            return capas;
        }
    }
}
