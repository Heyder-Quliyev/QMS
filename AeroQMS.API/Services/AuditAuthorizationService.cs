using System;
using System.Threading.Tasks;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AeroQMS.API.Services
{
    public class AuditAuthorizationService
    {
        private readonly AppDbContext _context;

        public AuditAuthorizationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> IsAdminOrQualityManagerAsync(int userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return false;

            var roleKey = (user.Role ?? "")
                .Trim()
                .ToLowerInvariant()
                .Replace(' ', '_');

            return roleKey == "admin" || roleKey == "quality_manager";
        }

        public async Task<bool> CanViewOwnActivityAsync(int currentUserId, int targetUserId)
        {
            return currentUserId == targetUserId;
        }

        public async Task<bool> HasNcrAccessAsync(int userId, int ncrId)
        {
            if (await IsAdminOrQualityManagerAsync(userId))
                return true;

            var ncr = await _context.NonConformances.FindAsync(ncrId);
            if (ncr == null)
                return false;

            return ncr.RaisedBy == userId.ToString();
        }

        public async Task<bool> HasCapaAccessAsync(int userId, Guid capaId)
        {
            if (await IsAdminOrQualityManagerAsync(userId))
                return true;

            var capa = await _context.CapaActions.FindAsync(capaId);
            if (capa == null)
                return false;

            return capa.ResponsiblePersonId == userId || capa.AssignedById == userId;
        }

        public string SanitizeForAudit(string value)
        {
            if (string.IsNullOrEmpty(value))
                return value;

            value = System.Text.RegularExpressions.Regex.Replace(value, @"password", "***", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            value = System.Text.RegularExpressions.Regex.Replace(value, @"\b\d{16}\b", "****-****-****-****");
            value = System.Text.RegularExpressions.Regex.Replace(value, @"\b\d{3}-\d{2}-\d{4}\b", "***-**-****");

            return value;
        }
    }
}
