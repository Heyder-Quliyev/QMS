using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using AeroQMS.API.Services;
using System.Text.RegularExpressions;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/capa-comments")]
    public class CapaCommentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;

        public CapaCommentsController(AppDbContext context, IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
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

            // Mock user info (In a real app, this would come from Auth)
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

            // History entry
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

            // Parse mentions and notify
            var mentions = Regex.Matches(request.Comment, @"@(\w+)");
            foreach (Match match in mentions)
            {
                var mentionedUser = match.Groups[1].Value;
                await _emailService.SendMentionEmail(comment, mentionedUser, action);
            }

            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetComments), new { capaId = capaId }, comment);
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

            // Author validation (Mock)
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

            // Author or Admin validation (Mock)
            var currentUserId = 1;
            var isAdmin = true;
            if (comment.UserId != currentUserId && !isAdmin)
                return Forbid("Permission denied.");

            // Soft delete
            comment.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Comment deleted successfully." });
        }
    }
}
