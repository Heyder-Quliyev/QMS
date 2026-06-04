using AeroQMS.API.Data;
using AeroQMS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AeroQMS.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AppDbContext context)
        {
            context.Database.EnsureCreated();

            EnsureUserAuthSchema(context);
            EnsureDocumentVersionSchema(context);
            EnsureDocumentAcknowledgmentSchema(context);
            EnsureReviewAutomationSchema(context);
            EnsureDocumentAccessSchema(context);

            EnsureSeedAdminUser(context);

            if (context.Audits.Any()) return;

            var audits = new Audit[]
            {
                new Audit { ReferenceNumber = "AUD-2024-051", Title = "Runway 34L Safety Inspection", Type = "Internal", Auditor = "M. Yılmaz", DueDate = DateTime.Parse("2025-04-10"), Status = "In Progress", Findings = 3 },
                new Audit { ReferenceNumber = "AUD-2024-050", Title = "Ground Handling Compliance", Type = "External", Auditor = "S. Chen", DueDate = DateTime.Parse("2025-04-08"), Status = "Overdue", Findings = 7 },
                new Audit { ReferenceNumber = "AUD-2024-049", Title = "ARFF Equipment Readiness", Type = "Internal", Auditor = "A. Koç", DueDate = DateTime.Parse("2025-04-15"), Status = "Scheduled", Findings = 0 },
                new Audit { ReferenceNumber = "AUD-2024-048", Title = "Wildlife Management Review", Type = "External", Auditor = "R. Patel", DueDate = DateTime.Parse("2025-03-28"), Status = "Overdue", Findings = 2 },
                new Audit { ReferenceNumber = "AUD-2024-047", Title = "SMS Documentation Audit", Type = "Internal", Auditor = "M. Yılmaz", DueDate = DateTime.Parse("2025-04-20"), Status = "Scheduled", Findings = 0 },
                new Audit { ReferenceNumber = "AUD-2024-046", Title = "Fuel System Inspection", Type = "Supplier", Auditor = "L. García", DueDate = DateTime.Parse("2025-04-25"), Status = "Scheduled", Findings = 0 },
                new Audit { ReferenceNumber = "AUD-2024-042", Title = "Gate Operations Review", Type = "Internal", Auditor = "A. Koç", DueDate = DateTime.Parse("2025-03-22"), Status = "Closed", Findings = 1 }
            };
            context.Audits.AddRange(audits);

            var docs = new Document[]
            {
                new Document { DocumentNumber = "DOC-8821", Title = "Safety Management System Manual", Category = "SMS", Department = "Safety", Revision = "Rev. 4", EffectiveDate = DateTime.Parse("2024-06-01"), ReviewDate = DateTime.Parse("2025-06-01"), Status = "Approved", Owner = "A. Kaya" },
                new Document { DocumentNumber = "DOC-8820", Title = "Runway Inspection Procedure", Category = "Operations", Department = "Airside", Revision = "Rev. 7", EffectiveDate = DateTime.Parse("2024-04-01"), ReviewDate = DateTime.Parse("2025-04-01"), Status = "Due for Review", Owner = "M. Yılmaz" },
                new Document { DocumentNumber = "DOC-8812", Title = "Emergency Response Plan", Category = "Safety", Department = "Emergency", Revision = "Rev. 2", EffectiveDate = DateTime.Parse("2024-05-01"), ReviewDate = DateTime.Parse("2025-05-01"), Status = "Approved", Owner = "R. Patel" },
                new Document { DocumentNumber = "DOC-8809", Title = "Wildlife Hazard Management", Category = "Operations", Department = "Airside", Revision = "Rev. 3", EffectiveDate = DateTime.Parse("2024-04-01"), ReviewDate = DateTime.Parse("2025-04-01"), Status = "Due for Review", Owner = "S. Chen" },
                new Document { DocumentNumber = "DOC-8804", Title = "SNOWTAM Reporting Procedure", Category = "ATC", Department = "Ops", Revision = "Rev. 5", EffectiveDate = DateTime.Parse("2024-10-01"), ReviewDate = DateTime.Parse("2025-10-01"), Status = "Approved", Owner = "A. Koç" },
                new Document { DocumentNumber = "DOC-8799", Title = "Supplier Qualification Criteria", Category = "Procurement", Department = "Supply Chain", Revision = "Rev. 1", EffectiveDate = DateTime.Parse("2024-03-01"), ReviewDate = DateTime.Parse("2025-03-01"), Status = "Expired", Owner = "L. García" }
            };
            context.Documents.AddRange(docs);

            var ncrs = new NonConformance[]
            {
                new NonConformance { NCRNumber = "NCR-2024-001", Title = "FOD on Runway", Description = "Foreign Object Debris found during inspection", Area = "Airside", Category = "Safety", Severity = "4D", LikelihoodScore = 4, ConsequenceScore = 4, RaisedBy = "M. Yılmaz", Date = DateTime.Parse("2024-04-01"), Status = "Open" },
                new NonConformance { NCRNumber = "NCR-2024-002", Title = "Unauthorized Access", Description = "Personnel found in restricted area without permit", Area = "Terminal 1", Category = "Security", Severity = "3C", LikelihoodScore = 3, ConsequenceScore = 3, RaisedBy = "A. Koç", Date = DateTime.Parse("2024-04-05"), Status = "Investigation" }
            };
            context.NonConformances.AddRange(ncrs);

            var training = new TrainingRecord[]
            {
                new TrainingRecord { StaffMember = "Mehmet Yılmaz", Course = "SMS Awareness Training", Category = "Safety", CompletionDate = DateTime.Parse("2025-01-15"), ExpiryDate = DateTime.Parse("2026-01-01"), Status = "Valid" },
                new TrainingRecord { StaffMember = "Selin Çelik", Course = "Airside Safety Induction", Category = "Safety", CompletionDate = DateTime.Parse("2025-02-03"), ExpiryDate = DateTime.Parse("2026-02-01"), Status = "Valid" },
                new TrainingRecord { StaffMember = "Ahmet Koç", Course = "ARFF Level 3 Certification", Category = "ARFF", CompletionDate = DateTime.Parse("2024-10-10"), ExpiryDate = DateTime.Parse("2025-04-01"), Status = "Expiring" },
                new TrainingRecord { StaffMember = "Riya Patel", Course = "Wildlife Hazard Management", Category = "Ops", CompletionDate = DateTime.Parse("2025-03-12"), ExpiryDate = DateTime.Parse("2026-03-01"), Status = "Valid" },
                new TrainingRecord { StaffMember = "Luis García", Course = "Dangerous Goods Awareness", Category = "DG", CompletionDate = DateTime.Parse("2024-09-01"), ExpiryDate = DateTime.Parse("2025-09-01"), Status = "Valid" },
                new TrainingRecord { StaffMember = "Ana Stojanović", Course = "Ground Handling Safety", Category = "Safety", CompletionDate = DateTime.Parse("2024-07-20"), ExpiryDate = DateTime.Parse("2025-03-01"), Status = "Expired" }
            };
            context.TrainingRecords.AddRange(training);

            var risks = new Risk[]
            {
                new Risk { RiskId = "RISK-0041", Description = "Bird strike on final approach", Category = "Wildlife", Likelihood = "High", Severity = "Critical", RiskLevel = "High", Owner = "R. Patel" },
                new Risk { RiskId = "RISK-0039", Description = "Runway incursion — peak hours", Category = "Safety", Likelihood = "Medium", Severity = "Critical", RiskLevel = "High", Owner = "M. Yılmaz" },
                new Risk { RiskId = "RISK-0035", Description = "Fuel spill near terminal gate", Category = "Environment", Likelihood = "Low", Severity = "Major", RiskLevel = "Medium", Owner = "A. Koç" },
                new Risk { RiskId = "RISK-0033", Description = "NOTAM system downtime", Category = "ATC", Likelihood = "Medium", Severity = "Major", RiskLevel = "Medium", Owner = "S. Chen" },
                new Risk { RiskId = "RISK-0028", Description = "Contractor vehicle access breach", Category = "Security", Likelihood = "Low", Severity = "Moderate", RiskLevel = "Low", Owner = "L. García" }
            };
            context.Risks.AddRange(risks);

            var suppliers = new Supplier[]
            {
                new Supplier { Name = "AviaTech Solutions", Category = "Ground Equipment", Country = "Germany", Rating = "⭐ 4.8", LastAudit = "Feb 2025", Status = "Approved" },
                new Supplier { Name = "SafeAir Fuels Ltd.", Category = "Fuel Supply", Country = "UK", Rating = "⭐ 4.5", LastAudit = "Jan 2025", Status = "Approved" },
                new Supplier { Name = "Nordic Ground Services", Category = "Handling Services", Country = "Sweden", Rating = "⭐ 3.9", LastAudit = "Nov 2024", Status = "Under Review" },
                new Supplier { Name = "TechMaint Systems", Category = "IT Infrastructure", Country = "Turkey", Rating = "⭐ 4.2", LastAudit = "Mar 2025", Status = "Approved" },
                new Supplier { Name = "EastAir Catering", Category = "Catering", Country = "UAE", Rating = "⭐ 2.1", LastAudit = "Aug 2024", Status = "Suspended" }
            };
            context.Suppliers.AddRange(suppliers);

            var settings = new OrganizationSetting
            {
                OrganizationName = "Istanbul Airport Authority",
                IcaoCode = "LTFM",
                RegulatoryAuthority = "DGCA — Turkey",
                QmsStandard = "ISO 9001:2015",
                Timezone = "UTC+3 (Istanbul)"
            };
            context.OrganizationSettings.Add(settings);

            var checklist = new Checklist
            {
                Title = "Daily Runway Inspection — RWY 34L",
                Inspector = "M. Yılmaz",
                Date = DateTime.Parse("2025-04-05"),
                Status = "In Progress",
                Items = new List<ChecklistItem>
                {
                    new ChecklistItem { Description = "Surface condition — no cracks or FOD detected", IsCompleted = true },
                    new ChecklistItem { Description = "Edge lights operational (all 42 functional)", IsCompleted = true },
                    new ChecklistItem { Description = "Threshold markings visible and clear", IsCompleted = true },
                    new ChecklistItem { Description = "Touchdown zone markings condition check", IsCompleted = false },
                    new ChecklistItem { Description = "PAPI / VASIS alignment verification", IsCompleted = false },
                    new ChecklistItem { Description = "Drainage channels clear of debris", IsCompleted = false },
                    new ChecklistItem { Description = "Wildlife detection — bird scan complete", IsCompleted = false },
                    new ChecklistItem { Description = "Braking action measurement (μ > 0.25)", IsCompleted = false }
                }
            };
            context.Checklists.Add(checklist);

            var capas = new CapaAction[]
            {
                new CapaAction { 
                    Title = "Immediate FOD Removal Training", 
                    ActionType = "corrective", 
                    Description = "Conduct training for all airside personnel on immediate FOD removal protocols.", 
                    ResponsiblePersonId = 1, 
                    ResponsiblePersonName = "Mehmet Yılmaz", 
                    ResponsiblePersonEmail = "m.yilmaz@aeroqms.com",
                    DueDate = DateTime.Parse("2025-05-01"),
                    Status = "in_progress",
                    Priority = "high",
                    NCRId = 1 // Linked to the first NCR
                },
                new CapaAction { 
                    Title = "Security Badge Audit", 
                    ActionType = "preventive", 
                    Description = "Perform a complete audit of all active security badges to prevent unauthorized access.", 
                    ResponsiblePersonId = 2, 
                    ResponsiblePersonName = "Ahmet Koç", 
                    ResponsiblePersonEmail = "a.koc@aeroqms.com",
                    DueDate = DateTime.Parse("2025-05-15"),
                    Status = "not_started",
                    Priority = "medium",
                    NCRId = 2 // Linked to the second NCR
                }
            };
            context.CapaActions.AddRange(capas);

            context.SaveChanges();
        }

        private static void EnsureUserAuthSchema(AppDbContext context)
        {
            try
            {
                var table = ResolveUsersTableName(context);
                if (string.IsNullOrWhiteSpace(table)) return;

                var existingColumns = GetTableColumns(context, table);
                if (existingColumns.Count == 0) return;

                if (!existingColumns.Contains("PasswordHash"))
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN PasswordHash TEXT;");

                if (!existingColumns.Contains("IsActive"))
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN IsActive INTEGER NOT NULL DEFAULT 1;");

                if (!existingColumns.Contains("ForcePasswordChange"))
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN ForcePasswordChange INTEGER NOT NULL DEFAULT 0;");

                if (!existingColumns.Contains("CreatedAt"))
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN CreatedAt TEXT;");

                if (!existingColumns.Contains("LastLogin"))
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN LastLogin TEXT;");

                existingColumns = GetTableColumns(context, table);

                if (existingColumns.Contains("IsActive"))
                    context.Database.ExecuteSqlRaw($"UPDATE \"{table}\" SET IsActive = 1 WHERE IsActive IS NULL;");

                if (existingColumns.Contains("ForcePasswordChange"))
                    context.Database.ExecuteSqlRaw($"UPDATE \"{table}\" SET ForcePasswordChange = 0 WHERE ForcePasswordChange IS NULL;");

                if (existingColumns.Contains("CreatedAt"))
                    context.Database.ExecuteSqlRaw($"UPDATE \"{table}\" SET CreatedAt = CURRENT_TIMESTAMP WHERE CreatedAt IS NULL;");
            }
            catch
            {
            }
        }

        private static string ResolveUsersTableName(AppDbContext context)
        {
            try
            {
                var connection = context.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open) connection.Open();
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Users','User','users','user') ORDER BY CASE name WHEN 'Users' THEN 0 WHEN 'users' THEN 1 WHEN 'User' THEN 2 ELSE 3 END LIMIT 1;";
                var result = cmd.ExecuteScalar();
                return result?.ToString() ?? "Users";
            }
            catch
            {
                return "Users";
            }
        }

        private static HashSet<string> GetTableColumns(AppDbContext context, string table)
        {
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var connection = context.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open) connection.Open();
                using var cmd = connection.CreateCommand();
                cmd.CommandText = $"PRAGMA table_info(\"{table}\");";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    var name = reader.GetString(1);
                    if (!string.IsNullOrWhiteSpace(name)) columns.Add(name);
                }
            }
            catch
            {
            }
            return columns;
        }

        private static void EnsureSeedAdminUser(AppDbContext context)
        {
            var now = DateTime.UtcNow;

            if (!context.Users.Any())
            {
                context.Users.AddRange(
                    new User { Id = 1, Name = "Admin User", Email = "admin@aeroqms.com", Role = "Admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Temp123!"), IsActive = true, ForcePasswordChange = true, CreatedAt = now },
                    new User { Id = 2, Name = "Quality Manager", Email = "qm@aeroqms.com", Role = "Quality Manager", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Temp123!"), IsActive = true, ForcePasswordChange = true, CreatedAt = now },
                    new User { Id = 3, Name = "Department Head", Email = "dept.head@aeroqms.com", Role = "Department Head", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Temp123!"), IsActive = true, ForcePasswordChange = true, CreatedAt = now }
                );
                context.SaveChanges();
            }

            var admin = context.Users.FirstOrDefault(u => u.Email.ToLower() == "admin@system.com");
            if (admin == null)
            {
                var nextId = context.Users.Any() ? context.Users.Max(u => u.Id) + 1 : 1;
                admin = new User
                {
                    Id = nextId,
                    Name = "Admin",
                    Email = "admin@system.com",
                    Role = "Admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                    IsActive = true,
                    ForcePasswordChange = false,
                    CreatedAt = now
                };
                context.Users.Add(admin);
                context.SaveChanges();
            }
            else
            {
                var changed = false;
                if (string.IsNullOrWhiteSpace(admin.PasswordHash))
                {
                    admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!");
                    changed = true;
                }
                if (!admin.IsActive)
                {
                    admin.IsActive = true;
                    changed = true;
                }
                if (admin.CreatedAt == default)
                {
                    admin.CreatedAt = now;
                    changed = true;
                }
                if (changed) context.SaveChanges();
            }

            var users = context.Users.ToList();
            var updated = false;
            foreach (var u in users)
            {
                if (string.IsNullOrWhiteSpace(u.PasswordHash))
                {
                    u.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Temp123!");
                    if (u.Email.ToLower() != "admin@system.com") u.ForcePasswordChange = true;
                    updated = true;
                }

                if (u.CreatedAt == default)
                {
                    u.CreatedAt = now;
                    updated = true;
                }
            }

            if (updated) context.SaveChanges();
        }

        private static void EnsureDocumentVersionSchema(AppDbContext context)
        {
            try
            {
                var table = "DocumentVersions";
                var existingColumns = GetTableColumns(context, table);
                if (existingColumns.Count == 0) return;

                if (!existingColumns.Contains("ApprovalSnapshot"))
                    context.Database.ExecuteSqlRaw("ALTER TABLE DocumentVersions ADD COLUMN ApprovalSnapshot TEXT;");
            }
            catch
            {
            }
        }

        private static void EnsureDocumentAcknowledgmentSchema(AppDbContext context)
        {
            try
            {
                context.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS DocumentAcknowledgments (
  Id TEXT NOT NULL PRIMARY KEY,
  DocumentId INTEGER NOT NULL,
  VersionId TEXT NULL,
  UserId INTEGER NOT NULL,
  DocumentRevision TEXT NOT NULL,
  AcknowledgedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  IpAddress TEXT NULL,
  DeviceInfo TEXT NULL
);");

                context.Database.ExecuteSqlRaw(@"
CREATE UNIQUE INDEX IF NOT EXISTS IX_DocumentAcknowledgments_Document_User_Revision
ON DocumentAcknowledgments (DocumentId, UserId, DocumentRevision);");

                context.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS DocumentAcknowledgmentRequirements (
  Id TEXT NOT NULL PRIMARY KEY,
  DocumentId INTEGER NOT NULL,
  RequiredRole TEXT NULL,
  IndividualUserId INTEGER NULL,
  DueDays INTEGER NOT NULL DEFAULT 7,
  CreatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);");

                context.Database.ExecuteSqlRaw(@"
CREATE INDEX IF NOT EXISTS IX_DocumentAcknowledgmentRequirements_DocumentId
ON DocumentAcknowledgmentRequirements (DocumentId);");
            }
            catch
            {
            }
        }

        private static void EnsureReviewAutomationSchema(AppDbContext context)
        {
            try
            {
                context.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS ReviewAutomationSettings (
  Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  CategoryRulesJson TEXT NOT NULL DEFAULT '[]',
  NotificationRulesJson TEXT NOT NULL DEFAULT '[]',
  EscalationRulesJson TEXT NOT NULL DEFAULT '[]',
  UpdatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);");

                context.Database.ExecuteSqlRaw(@"
CREATE INDEX IF NOT EXISTS IX_ReviewAutomationSettings_UpdatedAt
ON ReviewAutomationSettings (UpdatedAt);");
            }
            catch
            {
            }
        }

        private static void EnsureDocumentAccessSchema(AppDbContext context)
        {
            try
            {
                context.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS DocumentAccessLogs (
  Id TEXT NOT NULL PRIMARY KEY,
  DocumentId INTEGER NOT NULL,
  VersionId TEXT NULL,
  UserId INTEGER NULL,
  Source TEXT NULL,
  DeviceInfo TEXT NULL,
  IpAddress TEXT NULL,
  AccessedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);");

                context.Database.ExecuteSqlRaw(@"
CREATE INDEX IF NOT EXISTS IX_DocumentAccessLogs_DocumentId
ON DocumentAccessLogs (DocumentId);");

                context.Database.ExecuteSqlRaw(@"
CREATE INDEX IF NOT EXISTS IX_DocumentAccessLogs_AccessedAt
ON DocumentAccessLogs (AccessedAt);");
            }
            catch
            {
            }
        }
    }
}
