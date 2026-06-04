using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/capa-attachments")]
    public class CapaAttachmentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _uploadPath;

        public CapaAttachmentsController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _uploadPath = Path.Combine(env.ContentRootPath, "Uploads", "Capa");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
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
                UploadedById = 1, // Mock user ID
                UploadedAt = DateTime.UtcNow
            };

            _context.CapaAttachments.Add(attachment);
            
            // Add history entry
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

        [HttpGet("{capaId}/attachments")]
        public async Task<ActionResult<IEnumerable<CapaAttachment>>> GetAttachments(Guid capaId)
        {
            return await _context.CapaAttachments
                .Where(a => a.CapaId == capaId)
                .OrderByDescending(a => a.UploadedAt)
                .ToListAsync();
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
            
            // Add history entry
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
    }
}
