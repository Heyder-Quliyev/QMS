using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Data;
using AeroQMS.API.Models;
using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using OfficeOpenXml;

namespace AeroQMS.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("capa-stats")]
        public async Task<ActionResult<object>> GetCapaStats()
        {
            try
            {
                var now = DateTime.UtcNow;
                var thirtyDaysAgo = now.AddDays(-30);
                var nextWeek = now.AddDays(7);

                var allCapas = await _context.CapaActions.ToListAsync();

                var activeCapas = allCapas.Where(a => a.Status != "closed" && a.Status != "verified").ToList();
                var closedCapas = allCapas.Where(a => a.Status == "closed" || a.Status == "verified").ToList();

                // Status Distribution
                var statusDistribution = new
                {
                    not_started = allCapas.Count(a => a.Status == "not_started"),
                    in_progress = allCapas.Count(a => a.Status == "in_progress"),
                    pending_verification = allCapas.Count(a => a.Status == "pending_verification"),
                    verified = allCapas.Count(a => a.Status == "verified"),
                    closed = allCapas.Count(a => a.Status == "closed")
                };

                // Metrics
                var closedLast30Days = closedCapas.Count(a => GetCompletionDate(a) >= thirtyDaysAgo);
                var createdLast30Days = allCapas.Count(a => a.CreatedAt >= thirtyDaysAgo);
                
                var completionRate = createdLast30Days > 0 ? (double)closedLast30Days / createdLast30Days * 100 : 0;
                
                var avgDaysToComplete = closedCapas.Any() 
                    ? closedCapas.Average(a => (GetCompletionDate(a) - a.DueDate).TotalDays) 
                    : 0;

                var onTimeClosed = closedCapas.Count(a => GetCompletionDate(a).Date <= a.DueDate.Date);
                var onTimeRate = closedCapas.Any() ? (double)onTimeClosed / closedCapas.Count * 100 : 0;

                // Top Priority
                var topPriority = activeCapas
                    .OrderByDescending(a => GetPriorityWeight(a.Priority))
                    .ThenBy(a => a.DueDate)
                    .Take(3)
                    .Select(a => new {
                        a.Id,
                        a.Title,
                        a.Priority,
                        a.DueDate,
                        DueDateRelative = GetRelativeTime(a.DueDate)
                    })
                    .ToList();

                return new
                {
                    total_active = activeCapas.Count,
                    overdue_count = activeCapas.Count(a => a.DueDate < now.Date),
                    due_this_week = activeCapas.Count(a => a.DueDate >= now.Date && a.DueDate <= nextWeek),
                    pending_verification = activeCapas.Count(a => a.Status == "pending_verification"),
                    status_distribution = statusDistribution,
                    metrics = new {
                        completion_rate = Math.Round(completionRate, 1),
                        avg_days_to_complete = Math.Round(avgDaysToComplete, 1),
                        on_time_rate = Math.Round(onTimeRate, 1)
                    },
                    top_priority = topPriority
                };
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Database tables not initialized yet", message = ex.Message });
            }
        }

        [HttpGet("capa-analytics")]
        public async Task<ActionResult<object>> GetCapaAnalytics([FromQuery] string range = "30")
        {
            var now = DateTime.UtcNow;
            DateTime startDate;
            int rangeDays = 30;

            if (range == "all") 
            {
                startDate = DateTime.MinValue;
                rangeDays = 365; // Default to 1 year for the trend chart if 'all'
            }
            else if (int.TryParse(range, out rangeDays)) 
            {
                startDate = now.AddDays(-rangeDays);
            }
            else 
            {
                startDate = now.AddDays(-30);
                rangeDays = 30;
            }

            var allCapas = await _context.CapaActions.ToListAsync();
            var allNcrs = await _context.NonConformances.ToListAsync();

            // Filter by range: created within range OR closed within range
            var filteredCapas = allCapas.Where(a => a.CreatedAt >= startDate || 
                                               ((a.Status == "closed" || a.Status == "verified") && GetCompletionDate(a) >= startDate))
                                         .ToList();
            
            var completedCapas = filteredCapas.Where(a => a.Status == "closed" || a.Status == "verified").ToList();

            // Summary
            var avgTime = completedCapas.Any() ? completedCapas.Average(a => (GetCompletionDate(a) - a.DueDate).TotalDays) : 0;
            var verifiedCapas = completedCapas.Where(a => a.Status == "verified").ToList();
            var effectivenessRate = verifiedCapas.Any() ? (double)verifiedCapas.Count(a => a.EffectivenessRating == "effective") / verifiedCapas.Count * 100 : 0;

            // Trend
            var dates = Enumerable.Range(0, rangeDays)
                .Select(i => now.AddDays(-i).Date)
                .OrderBy(d => d)
                .ToList();
            
            var createdTrend = dates.Select(d => allCapas.Count(a => a.CreatedAt.Date == d)).ToList();
            var completedTrend = dates.Select(d => allCapas.Count(a => (a.Status == "closed" || a.Status == "verified") && GetCompletionDate(a).Date == d)).ToList();

            // By Category
            var categoryData = allNcrs.GroupBy(n => (n.Category ?? "Uncategorized").Trim())
                .Select(g => {
                    var ncrIdsInGroup = g.Select(n => n.Id).ToList();
                    return new { 
                        Category = g.Key, 
                        Count = allCapas.Count(a => a.NCRId != null && ncrIdsInGroup.Contains(a.NCRId.Value)) 
                    };
                })
                .OrderByDescending(x => x.Count)
                .ToList();

            // By Priority
            var priorityData = new {
                critical = filteredCapas.Count(a => a.Priority?.ToLower() == "critical"),
                high = filteredCapas.Count(a => a.Priority?.ToLower() == "high"),
                medium = filteredCapas.Count(a => a.Priority?.ToLower() == "medium"),
                low = filteredCapas.Count(a => a.Priority?.ToLower() == "low")
            };

            // Top Performers
            var performers = allCapas.GroupBy(a => a.ResponsiblePersonName)
                .Select(g => new {
                    Name = g.Key ?? "Unknown",
                    Completed = g.Count(a => a.Status == "closed" || a.Status == "verified"),
                    Total = g.Count(),
                    Rate = g.Count() > 0 ? (double)g.Count(a => a.Status == "closed" || a.Status == "verified") / g.Count() * 100 : 0
                })
                .OrderByDescending(x => x.Rate)
                .Take(5)
                .ToList();

            // Recurring Issues (Grouped by fuzzy title or same category)
            var recurring = allNcrs.GroupBy(n => new { 
                    NormalizedTitle = (n.Title ?? "").ToLower().Trim(), 
                    n.Category 
                })
                .Select(g => {
                    var ncrsInGroup = g.OrderByDescending(n => n.Date).ToList();
                    var ncrIdsInGroup = ncrsInGroup.Select(n => n.Id).ToList();
                    return new {
                        title = ncrsInGroup.First().Title,
                        category = ncrsInGroup.First().Category,
                        occurrenceCount = g.Count(),
                        latestStatus = ncrsInGroup.First().Status,
                        ncrNumbers = string.Join(", ", ncrsInGroup.Select(n => n.NCRNumber)),
                        capaCount = allCapas.Count(a => a.NCRId != null && ncrIdsInGroup.Contains(a.NCRId.Value)),
                        relatedNcrs = ncrsInGroup.Select(n => new {
                            id = n.Id,
                            ncrNumber = n.NCRNumber,
                            title = n.Title,
                            createdAt = n.Date,
                            status = n.Status,
                            description = n.Description,
                            area = n.Area,
                            severity = n.Severity,
                            relatedCapas = allCapas.Where(a => a.NCRId == n.Id).Select(a => new {
                                id = a.Id,
                                title = a.Title,
                                status = a.Status,
                                createdAt = a.CreatedAt,
                                dueDate = a.DueDate
                            }).ToList()
                        }).ToList()
                    };
                })
                .Where(x => x.occurrenceCount > 1 || x.capaCount > 2)
                .OrderByDescending(x => x.occurrenceCount)
                .ToList();

            // Time Distribution
            var distribution = new int[5];
            foreach (var capa in completedCapas)
            {
                // Calculate based on Due Date (as requested by user)
                DateTime completionDate;
                
                if (capa.Status == "closed" && capa.ClosedDate.HasValue)
                {
                    completionDate = capa.ClosedDate.Value;
                }
                else if (capa.Status == "verified" && capa.VerificationDate.HasValue)
                {
                    completionDate = capa.VerificationDate.Value;
                }
                else
                {
                    // Fallback for existing data
                    completionDate = capa.UpdatedAt;
                }
                
                // Calculate days from Due Date to completion date
                var daysToComplete = (completionDate - capa.DueDate).TotalDays;
                
                if (daysToComplete <= 7) distribution[0]++;
                else if (daysToComplete <= 14) distribution[1]++;
                else if (daysToComplete <= 30) distribution[2]++;
                else if (daysToComplete <= 60) distribution[3]++;
                else distribution[4]++;
            }

            return new
            {
                summary = new {
                    completed_count = completedCapas.Count,
                    avg_completion_time = Math.Round(avgTime, 1),
                    effectiveness_rate = Math.Round(effectivenessRate, 1)
                },
                trend = new {
                    dates = dates.Select(d => d.ToString("yyyy-MM-dd")),
                    created = createdTrend,
                    completed = completedTrend
                },
                by_category = new {
                    categories = categoryData.Select(x => x.Category),
                    counts = categoryData.Select(x => x.Count)
                },
                by_priority = priorityData,
                top_performers = performers,
                recurring_ncrs = recurring,
                time_distribution = distribution
            };
        }

        private DateTime GetCompletionDate(CapaAction capa)
        {
            if (capa.Status == "closed")
            {
                if (capa.ClosedDate.HasValue)
                {
                    return capa.ClosedDate.Value;
                }
                // If ClosedDate is not set, calculate actual time from CreatedAt to the first time it was closed
                // Fallback: use UpdatedAt only if we don't have anything else
            }
            if (capa.Status == "verified")
            {
                if (capa.VerificationDate.HasValue)
                {
                    return capa.VerificationDate.Value;
                }
            }
            
            // Last resort: calculate based on CreatedAt and UpdatedAt, but make sure it's reasonable
            var daysDiff = (capa.UpdatedAt - capa.CreatedAt).TotalDays;
            if (daysDiff > 0)
            {
                // Return CreatedAt + actual days difference
                return capa.CreatedAt.AddDays(daysDiff);
            }
            
            return capa.UpdatedAt;
        }

        private int GetPriorityWeight(string priority)
        {
            return (priority?.ToLower()) switch
            {
                "critical" => 4,
                "high" => 3,
                "medium" => 2,
                "low" => 1,
                _ => 0
            };
        }

        private string GetRelativeTime(DateTime date)
        {
            var diff = (date.Date - DateTime.UtcNow.Date).Days;
            if (diff == 0) return "today";
            if (diff == 1) return "tomorrow";
            if (diff == -1) return "yesterday";
            if (diff > 0) return $"in {diff} days";
            return $"{Math.Abs(diff)} days ago";
        }

        [HttpGet("debug/capa-dates")]
        public async Task<ActionResult<IEnumerable<object>>> DebugCapaDates()
        {
            var allCapas = await _context.CapaActions.ToListAsync();
            var result = allCapas.Select(c => new
            {
                c.Id,
                c.Title,
                c.Status,
                DueDate = c.DueDate.ToString("yyyy-MM-dd HH:mm:ss"),
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                UpdatedAt = c.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                ClosedDate = c.ClosedDate?.ToString("yyyy-MM-dd HH:mm:ss"),
                VerificationDate = c.VerificationDate?.ToString("yyyy-MM-dd HH:mm:ss"),
                DaysFromDueDateToClosed = c.ClosedDate.HasValue ? (c.ClosedDate.Value - c.DueDate).TotalDays : (double?)null,
                DaysFromDueDateToVerified = c.VerificationDate.HasValue ? (c.VerificationDate.Value - c.DueDate).TotalDays : (double?)null
            }).ToList();

            return result;
        }

        [HttpGet("export/pdf")]
        public async Task<IActionResult> ExportDashboardToPdf()
        {
            var analyticsData = await GetCapaAnalyticsInternal();
            var pdfData = GenerateDashboardPdf(analyticsData);
            return File(pdfData, "application/pdf", "AeroQMS_CAPA_Analytics.pdf");
        }

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportDashboardToExcel()
        {
            var analyticsData = await GetCapaAnalyticsInternal();
            
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("CAPA Analytics");
            
            // Executive Summary
            worksheet.Cells[1, 1].Value = "EXECUTIVE SUMMARY";
            worksheet.Cells[1, 1].Style.Font.Bold = true;
            worksheet.Cells[1, 1].Style.Font.Size = 14;
            
            worksheet.Cells[3, 1].Value = "Total CAPAs";
            worksheet.Cells[3, 2].Value = analyticsData.AllCapas.Count;
            
            worksheet.Cells[4, 1].Value = "Completed CAPAs";
            worksheet.Cells[4, 2].Value = analyticsData.CompletedCapas.Count;
            
            worksheet.Cells[5, 1].Value = "Avg. Completion Time";
            worksheet.Cells[5, 2].Value = Math.Round(analyticsData.AvgTime, 1) + " days";
            
            worksheet.Cells[6, 1].Value = "Effectiveness Rate";
            worksheet.Cells[6, 2].Value = Math.Round(analyticsData.EffectivenessRate, 1) + "%";
            
            // Time Distribution
            worksheet.Cells[8, 1].Value = "COMPLETION TIME DISTRIBUTION";
            worksheet.Cells[8, 1].Style.Font.Bold = true;
            worksheet.Cells[8, 1].Style.Font.Size = 12;
            
            var timeLabels = new[] { "0-7 days", "8-14 days", "15-30 days", "31-60 days", "60+ days" };
            for (int i = 0; i < 5; i++)
            {
                worksheet.Cells[10 + i, 1].Value = timeLabels[i];
                worksheet.Cells[10 + i, 2].Value = analyticsData.TimeDistribution[i];
            }
            
            // CAPA Details
            var startRow = 17;
            worksheet.Cells[startRow, 1].Value = "CAPA DETAILS";
            worksheet.Cells[startRow, 1].Style.Font.Bold = true;
            worksheet.Cells[startRow, 1].Style.Font.Size = 12;
            
            startRow += 2;
            worksheet.Cells[startRow, 1].Value = "ID";
            worksheet.Cells[startRow, 2].Value = "Title";
            worksheet.Cells[startRow, 3].Value = "Status";
            worksheet.Cells[startRow, 4].Value = "Priority";
            worksheet.Cells[startRow, 5].Value = "Created At";
            worksheet.Cells[startRow, 6].Value = "Due Date";
            worksheet.Cells[startRow, 7].Value = "Days to Complete";
            
            worksheet.Cells[startRow, 1, startRow, 7].Style.Font.Bold = true;
            
            startRow++;
            
            foreach (var capa in analyticsData.AllCapas)
            {
                worksheet.Cells[startRow, 1].Value = capa.Id.ToString();
                worksheet.Cells[startRow, 2].Value = capa.Title;
                worksheet.Cells[startRow, 3].Value = capa.Status;
                worksheet.Cells[startRow, 4].Value = capa.Priority;
                worksheet.Cells[startRow, 5].Value = capa.CreatedAt.ToString("yyyy-MM-dd");
                worksheet.Cells[startRow, 6].Value = capa.DueDate.ToString("yyyy-MM-dd");
                
                if ((capa.Status == "closed" || capa.Status == "verified"))
                {
                    var completionDate = GetCompletionDate(capa);
                    var days = (completionDate - capa.DueDate).TotalDays;
                    worksheet.Cells[startRow, 7].Value = Math.Round(days, 1);
                }
                
                startRow++;
            }
            
            // Auto-fit columns
            worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();
            
            var stream = new MemoryStream();
            package.SaveAs(stream);
            stream.Position = 0;
            
            return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "AeroQMS_CAPA_Analytics.xlsx");
        }

        private async Task<DashboardAnalyticsData> GetCapaAnalyticsInternal()
        {
            var now = DateTime.UtcNow;
            var rangeDays = 30;
            var startDate = now.AddDays(-rangeDays);

            var allCapas = await _context.CapaActions.ToListAsync();
            var allNcrs = await _context.NonConformances.ToListAsync();

            var filteredCapas = allCapas.Where(a => a.CreatedAt >= startDate || 
                                               ((a.Status == "closed" || a.Status == "verified") && GetCompletionDate(a) >= startDate))
                                         .ToList();
            
            var completedCapas = filteredCapas.Where(a => a.Status == "closed" || a.Status == "verified").ToList();

            var avgTime = completedCapas.Any() ? completedCapas.Average(a => (GetCompletionDate(a) - a.DueDate).TotalDays) : 0;
            var verifiedCapas = completedCapas.Where(a => a.Status == "verified").ToList();
            var effectivenessRate = verifiedCapas.Any() ? (double)verifiedCapas.Count(a => a.EffectivenessRating == "effective") / verifiedCapas.Count * 100 : 0;

            var distribution = new int[5];
            foreach (var capa in completedCapas)
            {
                DateTime completionDate;
                
                if (capa.Status == "closed" && capa.ClosedDate.HasValue)
                {
                    completionDate = capa.ClosedDate.Value;
                }
                else if (capa.Status == "verified" && capa.VerificationDate.HasValue)
                {
                    completionDate = capa.VerificationDate.Value;
                }
                else
                {
                    completionDate = capa.UpdatedAt;
                }
                
                var daysToComplete = (completionDate - capa.DueDate).TotalDays;
                
                if (daysToComplete <= 7) distribution[0]++;
                else if (daysToComplete <= 14) distribution[1]++;
                else if (daysToComplete <= 30) distribution[2]++;
                else if (daysToComplete <= 60) distribution[3]++;
                else distribution[4]++;
            }

            return new DashboardAnalyticsData
            {
                AllCapas = allCapas,
                AllNcrs = allNcrs,
                CompletedCapas = completedCapas,
                AvgTime = avgTime,
                EffectivenessRate = effectivenessRate,
                TimeDistribution = distribution
            };
        }

        private string GenerateDashboardCsv(DashboardAnalyticsData data)
        {
            var builder = new System.Text.StringBuilder();
            
            // Executive Summary
            builder.AppendLine("=== Executive Summary ===");
            builder.AppendLine($"Total CAPAs,{data.AllCapas.Count}");
            builder.AppendLine($"Completed CAPAs,{data.CompletedCapas.Count}");
            builder.AppendLine($"Average Time to Complete (days),{Math.Round(data.AvgTime, 1)}");
            builder.AppendLine($"Effectiveness Rate (%),{Math.Round(data.EffectivenessRate, 1)}");
            builder.AppendLine();
            
            // Time Distribution
            builder.AppendLine("=== Completion Time Distribution ===");
            builder.AppendLine("0-7 days," + data.TimeDistribution[0]);
            builder.AppendLine("8-14 days," + data.TimeDistribution[1]);
            builder.AppendLine("15-30 days," + data.TimeDistribution[2]);
            builder.AppendLine("31-60 days," + data.TimeDistribution[3]);
            builder.AppendLine("60+ days," + data.TimeDistribution[4]);
            builder.AppendLine();
            
            // CAPA Details
            builder.AppendLine("=== CAPA Details ===");
            builder.AppendLine("ID,Title,Status,Priority,Created At,Due Date,Completed At,Days to Complete");
            foreach (var capa in data.AllCapas)
            {
                var completionDate = capa.Status == "closed" || capa.Status == "verified" ? GetCompletionDate(capa) : (DateTime?)null;
                var daysToComplete = completionDate.HasValue ? (completionDate.Value - capa.DueDate).TotalDays : (double?)null;
                builder.AppendLine($"{capa.Id},{capa.Title},{capa.Status},{capa.Priority},{capa.CreatedAt:yyyy-MM-dd},{capa.DueDate:yyyy-MM-dd},{(completionDate.HasValue ? completionDate.Value.ToString("yyyy-MM-dd") : "")},{(daysToComplete.HasValue ? Math.Round(daysToComplete.Value, 1) : "")}");
            }
            
            return builder.ToString();
        }

        private byte[] GenerateDashboardPdf(DashboardAnalyticsData data)
        {
            return QuestPDF.Fluent.Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(1, Unit.Centimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Header()
                        .Column(column =>
                        {
                            column.Item().Text("AeroQMS CAPA Analytics Report").SemiBold().FontSize(20).FontColor(Colors.Blue.Medium);
                            column.Item().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}").FontSize(10).FontColor(Colors.Grey.Darken1);
                            column.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                        });

                    page.Content().Column(column =>
                    {
                        // Executive Summary
                        column.Item().PaddingVertical(10).Text("Executive Summary").SemiBold().FontSize(14).FontColor(Colors.Black);
                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                            });
                            
                            table.Cell().Element(CellStyle).Text("Total CAPAs");
                            table.Cell().Element(CellStyle).Text(data.AllCapas.Count.ToString());
                            
                            table.Cell().Element(CellStyle).Text("Completed CAPAs");
                            table.Cell().Element(CellStyle).Text(data.CompletedCapas.Count.ToString());
                            
                            table.Cell().Element(CellStyle).Text("Average Time to Complete (days)");
                            table.Cell().Element(CellStyle).Text(Math.Round(data.AvgTime, 1).ToString());
                            
                            table.Cell().Element(CellStyle).Text("Effectiveness Rate (%)");
                            table.Cell().Element(CellStyle).Text(Math.Round(data.EffectivenessRate, 1).ToString());

                            static IContainer CellStyle(IContainer container) => container.Padding(5).Border(1).BorderColor(Colors.Grey.Lighten2);
                        });

                        // Time Distribution
                        column.Item().PaddingVertical(15).Text("Completion Time Distribution").SemiBold().FontSize(14).FontColor(Colors.Black);
                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                            });
                            
                            table.Header(header =>
                            {
                                header.Cell().Element(HeaderStyle).Text("Range");
                                header.Cell().Element(HeaderStyle).Text("Count");
                            });
                            
                            table.Cell().Element(CellStyle).Text("0-7 days");
                            table.Cell().Element(CellStyle).Text(data.TimeDistribution[0].ToString());
                            
                            table.Cell().Element(CellStyle).Text("8-14 days");
                            table.Cell().Element(CellStyle).Text(data.TimeDistribution[1].ToString());
                            
                            table.Cell().Element(CellStyle).Text("15-30 days");
                            table.Cell().Element(CellStyle).Text(data.TimeDistribution[2].ToString());
                            
                            table.Cell().Element(CellStyle).Text("31-60 days");
                            table.Cell().Element(CellStyle).Text(data.TimeDistribution[3].ToString());
                            
                            table.Cell().Element(CellStyle).Text("60+ days");
                            table.Cell().Element(CellStyle).Text(data.TimeDistribution[4].ToString());

                            static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold()).Padding(5).Border(1).BorderColor(Colors.Black);
                            static IContainer CellStyle(IContainer container) => container.Padding(5).Border(1).BorderColor(Colors.Grey.Lighten2);
                        });

                        // CAPA List
                        column.Item().PaddingVertical(15).Text("CAPA Details").SemiBold().FontSize(14).FontColor(Colors.Black);
                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(0.8f);
                                columns.RelativeColumn(1.5f);
                                columns.RelativeColumn(0.7f);
                                columns.RelativeColumn(0.7f);
                                columns.RelativeColumn(0.8f);
                                columns.RelativeColumn(0.8f);
                                columns.RelativeColumn(0.8f);
                                columns.RelativeColumn(0.8f);
                            });
                            
                            table.Header(header =>
                            {
                                header.Cell().Element(HeaderStyle).Text("Title");
                                header.Cell().Element(HeaderStyle).Text("Status");
                                header.Cell().Element(HeaderStyle).Text("Priority");
                                header.Cell().Element(HeaderStyle).Text("Created");
                                header.Cell().Element(HeaderStyle).Text("Due Date");
                                header.Cell().Element(HeaderStyle).Text("Completed");
                                header.Cell().Element(HeaderStyle).Text("Days");

                                static IContainer HeaderStyle(IContainer container) => container.DefaultTextStyle(x => x.SemiBold().FontSize(8)).Padding(3).Border(1).BorderColor(Colors.Black);
                            });
                            
                            foreach (var capa in data.AllCapas.Take(20)) // Limit to 20 for PDF readability
                            {
                                var completionDate = capa.Status == "closed" || capa.Status == "verified" ? GetCompletionDate(capa) : (DateTime?)null;
                                var daysToComplete = completionDate.HasValue ? (completionDate.Value - capa.DueDate).TotalDays : (double?)null;
                                
                                table.Cell().Element(CellStyle).Text(capa.Title);
                                table.Cell().Element(CellStyle).Text(capa.Status);
                                table.Cell().Element(CellStyle).Text(capa.Priority ?? "-");
                                table.Cell().Element(CellStyle).Text(capa.CreatedAt.ToString("yyyy-MM-dd"));
                                table.Cell().Element(CellStyle).Text(capa.DueDate.ToString("yyyy-MM-dd"));
                                table.Cell().Element(CellStyle).Text(completionDate.HasValue ? completionDate.Value.ToString("yyyy-MM-dd") : "-");
                                table.Cell().Element(CellStyle).Text(daysToComplete.HasValue ? Math.Round(daysToComplete.Value, 1).ToString() : "-");

                                static IContainer CellStyle(IContainer container) => container.Padding(2).Border(1).BorderColor(Colors.Grey.Lighten2).DefaultTextStyle(x => x.FontSize(7));
                            }
                        });
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Page ");
                        x.CurrentPageNumber();
                        x.Span(" of ");
                        x.TotalPages();
                    });
                });
            }).GeneratePdf();
        }
    }

    public class DashboardAnalyticsData
    {
        public List<CapaAction> AllCapas { get; set; } = new();
        public List<NonConformance> AllNcrs { get; set; } = new();
        public List<CapaAction> CompletedCapas { get; set; } = new();
        public double AvgTime { get; set; }
        public double EffectivenessRate { get; set; }
        public int[] TimeDistribution { get; set; } = new int[5];
    }
}
