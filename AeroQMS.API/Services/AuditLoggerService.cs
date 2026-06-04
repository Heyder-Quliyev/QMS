using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace AeroQMS.API.Services
{
    public class AuditLoggerService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly AuditAuthorizationService _authService;

        public AuditLoggerService(AppDbContext context, IHttpContextAccessor httpContextAccessor, AuditAuthorizationService authService)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _authService = authService;
        }

        private string? GetClientIpAddress()
        {
            var connection = _httpContextAccessor.HttpContext?.Connection;
            return connection?.RemoteIpAddress?.ToString();
        }

        private string? GetUserAgent()
        {
            return _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString();
        }

        public async Task LogNcrChangeAsync(NcrChangeParams parameters)
        {
            var history = new NCRHistory
            {
                Id = Guid.NewGuid(),
                NCRId = parameters.NcrId,
                UserId = parameters.UserId,
                UserName = parameters.UserName,
                Action = parameters.Action,
                OldValue = parameters.OldValue != null ? _authService.SanitizeForAudit(parameters.OldValue) : null,
                NewValue = parameters.NewValue != null ? _authService.SanitizeForAudit(parameters.NewValue) : null,
                ChangeReason = parameters.ChangeReason != null ? _authService.SanitizeForAudit(parameters.ChangeReason) : null,
                IpAddress = GetClientIpAddress(),
                UserAgent = GetUserAgent(),
                Metadata = parameters.Metadata != null ? JsonSerializer.Serialize(parameters.Metadata) : null,
                Timestamp = DateTime.UtcNow
            };

            _context.NCRHistories.Add(history);
            await _context.SaveChangesAsync();
        }

        public async Task LogCapaChangeAsync(CapaChangeParams parameters)
        {
            var history = new CapaHistory
            {
                Id = Guid.NewGuid(),
                CapaId = parameters.CapaId,
                UserId = parameters.UserId,
                UserName = parameters.UserName,
                Action = parameters.Action,
                OldValue = parameters.OldValue != null ? _authService.SanitizeForAudit(parameters.OldValue) : null,
                NewValue = parameters.NewValue != null ? _authService.SanitizeForAudit(parameters.NewValue) : null,
                ChangeReason = parameters.ChangeReason != null ? _authService.SanitizeForAudit(parameters.ChangeReason) : null,
                IpAddress = GetClientIpAddress(),
                UserAgent = GetUserAgent(),
                Metadata = parameters.Metadata != null ? JsonSerializer.Serialize(parameters.Metadata) : null,
                Timestamp = DateTime.UtcNow
            };

            _context.CapaHistories.Add(history);
            await _context.SaveChangesAsync();
        }

        private AuditEntryResponse ConvertToAuditEntry(NCRHistory history)
        {
            return new AuditEntryResponse
            {
                Id = history.Id,
                UserId = history.UserId,
                UserName = history.UserName,
                UserAvatar = null,
                Action = history.Action,
                OldValue = history.OldValue,
                NewValue = history.NewValue,
                Timestamp = history.Timestamp,
                IpAddress = history.IpAddress,
                ChangeReason = history.ChangeReason,
                Metadata = !string.IsNullOrEmpty(history.Metadata) ? JsonSerializer.Deserialize<object>(history.Metadata) : null
            };
        }

        private AuditEntryResponse ConvertToAuditEntry(CapaHistory history)
        {
            return new AuditEntryResponse
            {
                Id = history.Id,
                UserId = history.UserId,
                UserName = history.UserName,
                UserAvatar = null,
                Action = history.Action,
                OldValue = history.OldValue,
                NewValue = history.NewValue,
                Timestamp = history.Timestamp,
                IpAddress = history.IpAddress,
                ChangeReason = history.ChangeReason,
                Metadata = !string.IsNullOrEmpty(history.Metadata) ? JsonSerializer.Deserialize<object>(history.Metadata) : null
            };
        }

        public async Task<PaginatedAuditResponse> GetNcrHistoryAsync(int ncrId, int limit = 50, int offset = 0)
        {
            var query = _context.NCRHistories.Where(h => h.NCRId == ncrId);
            var total = await query.CountAsync();
            var histories = await query
                .OrderByDescending(h => h.Timestamp)
                .Skip(offset)
                .Take(limit)
                .ToListAsync();

            return new PaginatedAuditResponse
            {
                Total = total,
                Entries = histories.Select(ConvertToAuditEntry).ToList()
            };
        }

        public async Task<PaginatedAuditResponse> GetCapaHistoryAsync(Guid capaId, int limit = 50, int offset = 0)
        {
            var query = _context.CapaHistories.Where(h => h.CapaId == capaId);
            var total = await query.CountAsync();
            var histories = await query
                .OrderByDescending(h => h.Timestamp)
                .Skip(offset)
                .Take(limit)
                .ToListAsync();

            return new PaginatedAuditResponse
            {
                Total = total,
                Entries = histories.Select(ConvertToAuditEntry).ToList()
            };
        }

        public async Task<UnifiedAuditResponse> GetUnifiedHistoryAsync(UnifiedHistoryFilters? filters = null)
        {
            var ncrHistory = _context.NCRHistories
                .Join(
                    _context.NonConformances,
                    h => h.NCRId,
                    n => n.Id,
                    (h, n) => new UnifiedAuditTrail
                    {
                        Id = h.Id,
                        EntityType = "NCR",
                        EntityId = h.NCRId,
                        EntityReference = n.NCRNumber,
                        UserId = h.UserId,
                        UserName = h.UserName,
                        Action = h.Action,
                        OldValue = h.OldValue,
                        NewValue = h.NewValue,
                        Timestamp = h.Timestamp,
                        IpAddress = h.IpAddress,
                        UserAgent = h.UserAgent,
                        ChangeReason = h.ChangeReason,
                        Metadata = h.Metadata
                    }
                );

            var capaHistory = _context.CapaHistories
                .Join(
                    _context.CapaActions,
                    h => h.CapaId,
                    c => c.Id,
                    (h, c) => new UnifiedAuditTrail
                    {
                        Id = h.Id,
                        EntityType = "CAPA",
                        EntityId = h.CapaId,
                        EntityReference = c.Title,
                        UserId = h.UserId,
                        UserName = h.UserName,
                        Action = h.Action,
                        OldValue = h.OldValue,
                        NewValue = h.NewValue,
                        Timestamp = h.Timestamp,
                        IpAddress = h.IpAddress,
                        UserAgent = h.UserAgent,
                        ChangeReason = h.ChangeReason,
                        Metadata = h.Metadata
                    }
                );

            var query = ncrHistory.Union(capaHistory);

            List<string>? actionFilters = null;
            if (filters?.ActionTypes != null && filters.ActionTypes.Count > 0)
            {
                actionFilters = filters.ActionTypes
                    .Where(a => !string.IsNullOrWhiteSpace(a))
                    .Select(a => a.Trim().ToLowerInvariant())
                    .Distinct()
                    .ToList();
            }

            if (filters != null)
            {
                if (filters.StartDate.HasValue)
                    query = query.Where(x => x.Timestamp >= filters.StartDate.Value);

                if (filters.EndDate.HasValue)
                    query = query.Where(x => x.Timestamp <= filters.EndDate.Value);

                if (filters.UserId.HasValue)
                    query = query.Where(x => x.UserId == filters.UserId.Value);

                if (filters.UserIds != null && filters.UserIds.Count > 0)
                    query = query.Where(x => filters.UserIds.Contains(x.UserId));

                if (!string.IsNullOrEmpty(filters.EntityType))
                    query = query.Where(x => x.EntityType == filters.EntityType);

                if (!string.IsNullOrEmpty(filters.ActionType))
                    query = query.Where(x => x.Action == filters.ActionType);
            }

            var candidates = await query.ToListAsync();

            IEnumerable<UnifiedAuditTrail> filtered = candidates;

            if (actionFilters != null && actionFilters.Count > 0)
                filtered = filtered.Where(e => MatchesActionFilter(e, actionFilters));

            if (!string.IsNullOrWhiteSpace(filters?.Field) && !string.Equals(filters.Field, "all", StringComparison.OrdinalIgnoreCase))
                filtered = filtered.Where(e => MatchesFieldFilter(e, filters.Field!));

            if (!string.IsNullOrWhiteSpace(filters?.Search))
                filtered = filtered.Where(e => MatchesSearch(e, filters.Search!));

            var total = filtered.Count();
            var limit = filters?.Limit ?? 100;
            var offset = filters?.Offset ?? 0;
            var entries = filtered.OrderByDescending(x => x.Timestamp).Skip(offset).Take(limit).ToList();

            return new UnifiedAuditResponse
            {
                Total = total,
                Filters = filters ?? new UnifiedHistoryFilters(),
                Entries = entries
            };
        }

        private static bool MatchesActionFilter(UnifiedAuditTrail entry, List<string> actionFilters)
        {
            var action = (entry.Action ?? "").ToLowerInvariant();

            foreach (var f in actionFilters)
            {
                if (f == "created" && action.Contains("created")) return true;
                if (f == "status_changed" && action.Contains("status")) return true;
                if (f == "commented" && action.Contains("comment")) return true;
                if (f == "attachment_added" && (action.Contains("attachment") || action.Contains("uploaded"))) return true;
                if (f == "assigned" && (action.Contains("assigned") || action.Contains("responsible"))) return true;

                if (action == f) return true;
            }

            return false;
        }

        private static bool MatchesFieldFilter(UnifiedAuditTrail entry, string field)
        {
            var f = field.Trim().ToLowerInvariant();
            var action = (entry.Action ?? "").ToLowerInvariant();
            var metadata = (entry.Metadata ?? "").ToLowerInvariant();

            if (f == "status") return action.Contains("status") || metadata.Contains("\"field\":\"status\"");
            if (f == "severity") return action.Contains("severity") || metadata.Contains("\"field\":\"severity\"");
            if (f == "priority") return action.Contains("priority") || metadata.Contains("\"field\":\"priority\"");
            if (f == "assigned_to") return action.Contains("assigned") || metadata.Contains("\"field\":\"assigned_to\"");
            if (f == "due_date") return action.Contains("due") || metadata.Contains("\"field\":\"due_date\"");

            return false;
        }

        private static bool MatchesSearch(UnifiedAuditTrail entry, string search)
        {
            var s = search.Trim();
            if (string.IsNullOrEmpty(s)) return true;

            return Contains(entry.EntityType, s)
                || Contains(entry.EntityReference, s)
                || Contains(entry.UserName, s)
                || Contains(entry.Action, s)
                || Contains(entry.OldValue, s)
                || Contains(entry.NewValue, s)
                || Contains(entry.ChangeReason, s)
                || Contains(entry.Metadata, s);
        }

        private static bool Contains(string? value, string search)
        {
            if (string.IsNullOrEmpty(value)) return false;
            return value.IndexOf(search, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        public async Task<UserActivitySummaryResponse> GetUserActivitySummaryAsync(int userId, int days = 30)
        {
            var sinceDate = DateTime.UtcNow.AddDays(-days);
            
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            var userName = user?.Name ?? "Unknown";

            var allActivity = await _context.NCRHistories
                .Where(h => h.UserId == userId && h.Timestamp >= sinceDate)
                .Select(h => new { h.Action, EntityType = "NCR", h.Timestamp })
                .Union(
                    _context.CapaHistories
                        .Where(h => h.UserId == userId && h.Timestamp >= sinceDate)
                        .Select(h => new { h.Action, EntityType = "CAPA", h.Timestamp })
                )
                .ToListAsync();

            var totalActions = allActivity.Count;

            var breakdown = allActivity
                .GroupBy(a => new { a.EntityType, a.Action })
                .Select(g => new UserActivityBreakdown
                {
                    EntityType = g.Key.EntityType,
                    Action = g.Key.Action,
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .ToList();

            var dailyActivity = allActivity
                .GroupBy(a => a.Timestamp.Date)
                .Select(g => new DailyActivity
                {
                    Date = g.Key.ToString("yyyy-MM-dd"),
                    Count = g.Count()
                })
                .OrderBy(x => x.Date)
                .ToList();

            return new UserActivitySummaryResponse
            {
                UserId = userId,
                UserName = userName,
                PeriodDays = days,
                TotalActions = totalActions,
                Breakdown = breakdown,
                DailyActivity = dailyActivity
            };
        }

        public async Task<AuditStatsResponse> GetAuditStatsAsync()
        {
            var ncrHistories = _context.NCRHistories;
            var capaHistories = _context.CapaHistories;

            var totalNcr = await ncrHistories.CountAsync();
            var totalCapa = await capaHistories.CountAsync();
            var totalEntries = totalNcr + totalCapa;

            var ncrTimestamps = await ncrHistories.Select(h => h.Timestamp).ToListAsync();
            var capaTimestamps = await capaHistories.Select(h => h.Timestamp).ToListAsync();
            var allTimestamps = ncrTimestamps.Concat(capaTimestamps).ToList();

            var earliest = allTimestamps.Any() ? allTimestamps.Min().ToString("yyyy-MM-dd") : null;
            var latest = allTimestamps.Any() ? allTimestamps.Max().ToString("yyyy-MM-dd") : null;

            var ncrUserActivity = await ncrHistories
                .GroupBy(h => new { h.UserId, h.UserName })
                .Select(g => new { g.Key.UserId, g.Key.UserName, Count = g.Count() })
                .ToListAsync();

            var capaUserActivity = await capaHistories
                .GroupBy(h => new { h.UserId, h.UserName })
                .Select(g => new { g.Key.UserId, g.Key.UserName, Count = g.Count() })
                .ToListAsync();

            var mostActiveUsers = ncrUserActivity
                .Concat(capaUserActivity)
                .GroupBy(x => new { x.UserId, x.UserName })
                .Select(g => new ActiveUser
                {
                    UserId = g.Key.UserId,
                    UserName = g.Key.UserName,
                    ActionCount = g.Sum(x => x.Count)
                })
                .OrderByDescending(x => x.ActionCount)
                .Take(10)
                .ToList();

            var ncrActions = await ncrHistories
                .GroupBy(h => h.Action)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .ToListAsync();

            var capaActions = await capaHistories
                .GroupBy(h => h.Action)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .ToListAsync();

            var mostCommonActions = ncrActions
                .Concat(capaActions)
                .GroupBy(x => x.Action)
                .Select(g => new CommonAction
                {
                    Action = g.Key,
                    Count = g.Sum(x => x.Count)
                })
                .OrderByDescending(x => x.Count)
                .Take(10)
                .ToList();

            return new AuditStatsResponse
            {
                TotalEntries = totalEntries,
                DateRange = new DateRange { Earliest = earliest, Latest = latest },
                MostActiveUsers = mostActiveUsers,
                MostCommonActions = mostCommonActions,
                ByEntityType = new Dictionary<string, int>
                {
                    { "NCR", totalNcr },
                    { "CAPA", totalCapa }
                }
            };
        }

        public async Task<string> ExportToCsvAsync(UnifiedHistoryFilters? filters = null)
        {
            var history = await GetUnifiedHistoryAsync(filters);

            var csvHeader = new[]
            {
                "Timestamp",
                "Entity Type",
                "Entity Reference",
                "User",
                "Action",
                "Old Value",
                "New Value",
                "Reason",
                "IP Address"
            };

            var csvRows = history.Entries.Select(row => new[]
            {
                row.Timestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                row.EntityType,
                row.EntityReference ?? "",
                row.UserName,
                row.Action,
                EscapeCsv(row.OldValue ?? ""),
                EscapeCsv(row.NewValue ?? ""),
                EscapeCsv(row.ChangeReason ?? ""),
                EscapeCsv(row.IpAddress ?? "")
            });

            var allRows = new[] { csvHeader }.Concat(csvRows);
            var csvContent = string.Join(Environment.NewLine, allRows.Select(row => string.Join(",", row)));

            return csvContent;
        }

        private string EscapeCsv(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n"))
            {
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            }
            return value;
        }
    }

    public class NcrChangeParams
    {
        public int NcrId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public string Action { get; set; } = "";
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string? ChangeReason { get; set; }
        public object? Metadata { get; set; }
    }

    public class CapaChangeParams
    {
        public Guid CapaId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public string Action { get; set; } = "";
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string? ChangeReason { get; set; }
        public object? Metadata { get; set; }
    }

    public class UnifiedHistoryFilters
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? UserId { get; set; }
        public List<int>? UserIds { get; set; }
        public string? EntityType { get; set; }
        public string? ActionType { get; set; }
        public List<string>? ActionTypes { get; set; }
        public string? Field { get; set; }
        public string? Search { get; set; }
        public int Limit { get; set; } = 100;
        public int Offset { get; set; } = 0;
    }

    public class UserActivitySummary
    {
        public string Action { get; set; } = "";
        public string EntityType { get; set; } = "";
        public int Count { get; set; }
    }
}
