using AeroQMS.API.Data;
using AeroQMS.API.Models;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using Microsoft.AspNetCore.Http.Features;
using AeroQMS.API.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;

// Set QuestPDF license
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Email and Notification Services
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHostedService<CapaNotificationService>();
builder.Services.AddHostedService<ReviewAutomationNotificationService>();

// Audit Logger Service
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditLoggerService>();
builder.Services.AddScoped<AuditAuthorizationService>();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 104857600; // 100MB
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .WithExposedHeaders("Content-Disposition");
        });
});

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "AeroQMS.Auth";
        options.LoginPath = "/login";
        options.AccessDeniedPath = "/login";
        options.SlidingExpiration = true;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = ctx =>
            {
                if (ctx.Request.Path.StartsWithSegments("/api"))
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                }
                ctx.Response.Redirect(ctx.RedirectUri);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddControllers(options =>
    {
        options.Filters.Add(new AuthorizeFilter());
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 104857600; // 100MB
    serverOptions.ListenAnyIP(5149); // Force listen on 5149
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Initialize the database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        
        // First: Ensure database and tables are created!
        await context.Database.EnsureCreatedAsync();
        
        // Add new columns for CAPA wizard (if not exists) - using safe check
        var wizardColumns = new[]
        {
            "NCRReference", "NCRTitle", "NCRDescription",
            "OccurrenceDate", "Location",
            "ReportedByName", "ReportedByEmail",
            "RootCause", "ContributingFactors"
        };
        
        // Get existing columns from CapaActions table
        var existingCapaColumns = new List<string>();
        try
        {
            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = "PRAGMA table_info(CapaActions)";
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var colName = reader.GetString(1);
                        existingCapaColumns.Add(colName);
                    }
                }
            }
            await connection.CloseAsync();
            Console.WriteLine($"Found existing CapaActions columns: {string.Join(", ", existingCapaColumns)}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not check existing columns: {ex.Message}");
        }
        
        foreach (var column in wizardColumns)
        {
            if (!existingCapaColumns.Contains(column))
            {
                try
                {
                    await context.Database.ExecuteSqlRawAsync($"ALTER TABLE CapaActions ADD COLUMN {column} TEXT");
                    Console.WriteLine($"✅ Column {column} added successfully.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️  Could not add column {column}: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine($"ℹ️  Column {column} already exists, skipping.");
            }
        }

        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS DocumentVersions (
  Id TEXT PRIMARY KEY NOT NULL,
  DocumentId INTEGER NOT NULL,
  DocumentNumber TEXT NOT NULL,
  Title TEXT NOT NULL,
  Category TEXT NOT NULL,
  Department TEXT NOT NULL,
  Revision TEXT NOT NULL,
  EffectiveDate TEXT NOT NULL,
  ReviewDate TEXT NOT NULL,
  Status TEXT NOT NULL,
  Owner TEXT NOT NULL,
  FileName TEXT NULL,
  ExtractedText TEXT NULL,
  ChangeSummary TEXT NULL,
  SnapshotAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS IX_DocumentVersions_DocumentId ON DocumentVersions(DocumentId);
CREATE INDEX IF NOT EXISTS IX_DocumentVersions_DocumentNumber ON DocumentVersions(DocumentNumber);
CREATE INDEX IF NOT EXISTS IX_DocumentVersions_SnapshotAt ON DocumentVersions(SnapshotAt);
");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not ensure DocumentVersions table: {ex.Message}");
        }

        try
        {
            var connection = context.Database.GetDbConnection();
            await connection.OpenAsync();
            var existingCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(DocumentVersions)";
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        existingCols.Add(reader.GetString(1));
                    }
                }
            }

            if (!existingCols.Contains("ExtractedText"))
            {
                try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE DocumentVersions ADD COLUMN ExtractedText TEXT"); } catch { }
            }
            if (!existingCols.Contains("ChangeSummary"))
            {
                try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE DocumentVersions ADD COLUMN ChangeSummary TEXT"); } catch { }
            }
            await connection.CloseAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not ensure DocumentVersions columns: {ex.Message}");
        }

        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS DocumentApprovalWorkflows (
  Id TEXT PRIMARY KEY NOT NULL,
  DocumentId INTEGER NOT NULL,
  StepNumber INTEGER NOT NULL,
  StepName TEXT NOT NULL,
  RequiredRole TEXT NULL,
  RequiredUserId INTEGER NULL,
  Status TEXT NOT NULL DEFAULT 'pending',
  Action TEXT NULL,
  Comment TEXT NULL,
  ActionedById INTEGER NULL,
  ActionedAt TEXT NULL,
  CreatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS IX_DocumentApprovalWorkflows_DocumentId ON DocumentApprovalWorkflows(DocumentId);
CREATE INDEX IF NOT EXISTS IX_DocumentApprovalWorkflows_DocumentId_StepNumber ON DocumentApprovalWorkflows(DocumentId, StepNumber);
CREATE INDEX IF NOT EXISTS IX_DocumentApprovalWorkflows_Status ON DocumentApprovalWorkflows(Status);
");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not ensure DocumentApprovalWorkflows table: {ex.Message}");
        }

        // Create Portal tables
        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS PortalGroups (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Slug TEXT NOT NULL UNIQUE,
    CompanyId INTEGER NOT NULL DEFAULT 1,
    CreatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS IX_PortalGroups_Slug ON PortalGroups(Slug);
CREATE INDEX IF NOT EXISTS IX_PortalGroups_CompanyId ON PortalGroups(CompanyId);

CREATE TABLE IF NOT EXISTS PortalDocuments (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PortalGroupId INTEGER NOT NULL,
    DocumentId INTEGER NOT NULL,
    AddedAt TEXT NOT NULL,
    FOREIGN KEY (PortalGroupId) REFERENCES PortalGroups(Id) ON DELETE CASCADE,
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE,
    UNIQUE(PortalGroupId, DocumentId)
);
CREATE INDEX IF NOT EXISTS IX_PortalDocuments_PortalGroupId ON PortalDocuments(PortalGroupId);
CREATE INDEX IF NOT EXISTS IX_PortalDocuments_DocumentId ON PortalDocuments(DocumentId);

CREATE TABLE IF NOT EXISTS PortalUsers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PortalGroupId INTEGER NOT NULL,
    Email TEXT NOT NULL,
    Name TEXT NOT NULL,
    AccessToken TEXT NOT NULL UNIQUE,
    LastAccess TEXT NULL,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (PortalGroupId) REFERENCES PortalGroups(Id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS IX_PortalUsers_PortalGroupId ON PortalUsers(PortalGroupId);
CREATE INDEX IF NOT EXISTS IX_PortalUsers_AccessToken ON PortalUsers(AccessToken);

CREATE TABLE IF NOT EXISTS PortalAccessLogs (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PortalUserId INTEGER NULL,
    DocumentId INTEGER NOT NULL,
    Action TEXT NOT NULL,
    AccessedAt TEXT NOT NULL,
    FOREIGN KEY (PortalUserId) REFERENCES PortalUsers(Id) ON DELETE SET NULL,
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_PortalUserId ON PortalAccessLogs(PortalUserId);
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_DocumentId ON PortalAccessLogs(DocumentId);
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_AccessedAt ON PortalAccessLogs(AccessedAt DESC);

CREATE TABLE IF NOT EXISTS PortalFeedbacks (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PortalGroupId INTEGER NOT NULL,
    Email TEXT NOT NULL,
    DocumentId INTEGER NULL,
    Message TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    FOREIGN KEY (PortalGroupId) REFERENCES PortalGroups(Id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS IX_PortalFeedbacks_PortalGroupId ON PortalFeedbacks(PortalGroupId);
CREATE INDEX IF NOT EXISTS IX_PortalFeedbacks_CreatedAt ON PortalFeedbacks(CreatedAt DESC);
");

            // Check and fix PortalAccessLogs PortalUserId column to be nullable if it's not already
            try
            {
                var connection = context.Database.GetDbConnection();
                await connection.OpenAsync();
                var existingPortalAccessCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var portalUserIdNotNull = false;
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(PortalAccessLogs)";
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var colName = reader.GetString(1);
                            var notNull = reader.GetBoolean(3);
                            existingPortalAccessCols.Add(colName);
                            if (colName.Equals("PortalUserId", StringComparison.OrdinalIgnoreCase) && notNull)
                            {
                                portalUserIdNotNull = true;
                            }
                        }
                    }
                }

                if (portalUserIdNotNull)
                {
                    Console.WriteLine("🔧 Fixing PortalAccessLogs.PortalUserId to be nullable...");
                    // SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
                    await context.Database.ExecuteSqlRawAsync(@"
-- 1. Create a new table with correct schema
CREATE TABLE IF NOT EXISTS PortalAccessLogs_New (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PortalUserId INTEGER NULL,
    DocumentId INTEGER NOT NULL,
    Action TEXT NOT NULL,
    AccessedAt TEXT NOT NULL,
    FOREIGN KEY (PortalUserId) REFERENCES PortalUsers(Id) ON DELETE SET NULL,
    FOREIGN KEY (DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE
);
-- 2. Copy data from old table to new table
INSERT INTO PortalAccessLogs_New (Id, PortalUserId, DocumentId, Action, AccessedAt)
SELECT Id, PortalUserId, DocumentId, Action, AccessedAt FROM PortalAccessLogs;
-- 3. Drop old table
DROP TABLE PortalAccessLogs;
-- 4. Rename new table to original name
ALTER TABLE PortalAccessLogs_New RENAME TO PortalAccessLogs;
-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_PortalUserId ON PortalAccessLogs(PortalUserId);
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_DocumentId ON PortalAccessLogs(DocumentId);
CREATE INDEX IF NOT EXISTS IX_PortalAccessLogs_AccessedAt ON PortalAccessLogs(AccessedAt DESC);
");
                    Console.WriteLine("✅ PortalAccessLogs fixed successfully!");
                }
                await connection.CloseAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Could not fix PortalAccessLogs table: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not ensure Portal tables: {ex.Message}");
        }


        // FORCE UPDATE ALL completion dates - even if already set!
        try
        {
            var allCapas = await context.CapaActions.ToListAsync();
            
            foreach (var capa in allCapas)
            {
                var hasChanges = false;
                var actualDays = (capa.UpdatedAt - capa.CreatedAt).TotalDays;
                
                if (capa.Status == "closed")
                {
                    // ALWAYS update ClosedDate - force it!
                    if (!capa.ClosedDate.HasValue)
                    {
                        capa.ClosedDate = capa.CreatedAt.AddDays(actualDays);
                        hasChanges = true;
                    }
                }
                
                if (capa.Status == "verified")
                {
                    // ALWAYS update VerificationDate - force it!
                    if (!capa.VerificationDate.HasValue)
                    {
                        capa.VerificationDate = capa.CreatedAt.AddDays(actualDays);
                        hasChanges = true;
                    }
                }
                
                if (hasChanges)
                {
                    context.Update(capa);
                }
            }
            
            await context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not update CAPA completion dates: {ex.Message}");
        }
        
        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var portalDistPath = Path.Combine(app.Environment.WebRootPath, "portal", "dist");
var checklistDistPath = Path.Combine(app.Environment.WebRootPath, "checklist", "dist");

app.UseCors("AllowAll");

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
            ctx.Context.Response.Headers.Append("Pragma", "no-cache");
            ctx.Context.Response.Headers.Append("Expires", "0");
        }
    }
});

// app.UseHttpsRedirection();

app.UseRouting();

app.MapWhen(
    context => context.Request.Path.StartsWithSegments("/portal") &&
               !context.Request.Path.StartsWithSegments("/api"),
    portalApp =>
    {
        portalApp.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(portalDistPath),
            RequestPath = "/portal",
            OnPrepareResponse = ctx =>
            {
                if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
                    ctx.Context.Response.Headers.Append("Pragma", "no-cache");
                    ctx.Context.Response.Headers.Append("Expires", "0");
                }
            }
        });

        portalApp.Run(async context =>
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(Path.Combine(portalDistPath, "index.html"));
        });
    });

app.MapWhen(
    context => context.Request.Path.StartsWithSegments("/checklist") &&
               !context.Request.Path.StartsWithSegments("/api"),
    checklistApp =>
    {
        checklistApp.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(checklistDistPath),
            RequestPath = "/checklist",
            OnPrepareResponse = ctx =>
            {
                if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
                    ctx.Context.Response.Headers.Append("Pragma", "no-cache");
                    ctx.Context.Response.Headers.Append("Expires", "0");
                }
            }
        });

        checklistApp.Run(async context =>
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(Path.Combine(checklistDistPath, "index.html"));
        });
    });

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Fallback for main app
app.MapFallbackToFile("index.html");

app.Run();
