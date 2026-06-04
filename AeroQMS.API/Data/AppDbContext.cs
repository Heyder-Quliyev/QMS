using Microsoft.EntityFrameworkCore;
using AeroQMS.API.Models;

namespace AeroQMS.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Audit> Audits { get; set; }
        public DbSet<Document> Documents { get; set; }
        public DbSet<DocumentVersion> DocumentVersions { get; set; }
        public DbSet<DocumentApprovalWorkflow> DocumentApprovalWorkflows { get; set; }
        public DbSet<DocumentAcknowledgment> DocumentAcknowledgments { get; set; }
        public DbSet<DocumentAcknowledgmentRequirement> DocumentAcknowledgmentRequirements { get; set; }
        public DbSet<ReviewAutomationSetting> ReviewAutomationSettings { get; set; }
        public DbSet<DocumentAccessLog> DocumentAccessLogs { get; set; }
        public DbSet<NonConformance> NonConformances { get; set; }
        public DbSet<Checklist> Checklists { get; set; }
        public DbSet<ChecklistItem> ChecklistItems { get; set; }
        public DbSet<TrainingRecord> TrainingRecords { get; set; }
        public DbSet<Risk> Risks { get; set; }
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<OrganizationSetting> OrganizationSettings { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<CapaAction> CapaActions { get; set; }
        public DbSet<CapaComment> CapaComments { get; set; }
        public DbSet<CapaAttachment> CapaAttachments { get; set; }
        public DbSet<CapaHistory> CapaHistories { get; set; }
        public DbSet<NCRHistory> NCRHistories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Configure CapaAction
            modelBuilder.Entity<CapaAction>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Description).IsRequired();
                entity.Property(e => e.Status).HasDefaultValue("not_started");
                entity.Property(e => e.Priority).HasDefaultValue("medium");
                
                // Indexes
                entity.HasIndex(e => e.NCRId);
                entity.HasIndex(e => e.ResponsiblePersonId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.DueDate);
                
                // Composite indexes for common queries
                entity.HasIndex(e => new { e.Status, e.DueDate });
                entity.HasIndex(e => new { e.ResponsiblePersonId, e.Status });
                entity.HasIndex(e => new { e.NCRId, e.Status });
            });

            // Configure CapaComment
            modelBuilder.Entity<CapaComment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Comment).IsRequired().HasMaxLength(2000);
                entity.HasIndex(e => e.CapaId);
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.DeletedAt);

                // Global filter for soft delete
                entity.HasQueryFilter(e => e.DeletedAt == null);

                // Relationship
                entity.HasOne<CapaAction>()
                      .WithMany()
                      .HasForeignKey(e => e.CapaId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure CapaAttachment
            modelBuilder.Entity<CapaAttachment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.FileName).IsRequired();
                entity.Property(e => e.FileUrl).IsRequired();
                entity.HasIndex(e => e.CapaId);
                entity.HasIndex(e => e.UploadedAt);

                entity.HasOne<CapaAction>()
                      .WithMany()
                      .HasForeignKey(e => e.CapaId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure CapaHistory
            modelBuilder.Entity<CapaHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Action).IsRequired();
                entity.Property(e => e.IpAddress).HasMaxLength(45);
                entity.HasIndex(e => e.CapaId);
                entity.HasIndex(e => e.Timestamp).IsDescending();
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Action);

                entity.HasOne<CapaAction>()
                      .WithMany()
                      .HasForeignKey(e => e.CapaId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<DocumentVersion>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DocumentId);
                entity.HasIndex(e => e.DocumentNumber);
                entity.HasIndex(e => e.SnapshotAt);
            });

            modelBuilder.Entity<DocumentApprovalWorkflow>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DocumentId);
                entity.HasIndex(e => new { e.DocumentId, e.StepNumber });
                entity.HasIndex(e => e.Status);
            });

            modelBuilder.Entity<DocumentAcknowledgment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.DocumentId, e.UserId, e.DocumentRevision }).IsUnique();
                entity.HasIndex(e => e.DocumentId);
                entity.HasIndex(e => e.UserId);
                entity.Property(e => e.IpAddress).HasMaxLength(45);
                entity.Property(e => e.DocumentRevision).IsRequired().HasMaxLength(50);
            });

            modelBuilder.Entity<DocumentAcknowledgmentRequirement>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DocumentId);
                entity.HasIndex(e => e.IndividualUserId);
                entity.HasIndex(e => e.RequiredRole);
                entity.Property(e => e.RequiredRole).HasMaxLength(60);
            });

            modelBuilder.Entity<ReviewAutomationSetting>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.CategoryRulesJson).IsRequired();
                entity.Property(e => e.NotificationRulesJson).IsRequired();
                entity.Property(e => e.EscalationRulesJson).IsRequired();
                entity.HasIndex(e => e.UpdatedAt);
            });

            modelBuilder.Entity<DocumentAccessLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.DocumentId);
                entity.HasIndex(e => e.AccessedAt);
                entity.HasIndex(e => e.UserId);
                entity.Property(e => e.Source).HasMaxLength(50);
                entity.Property(e => e.IpAddress).HasMaxLength(45);
            });

            // Configure NCRHistory
            modelBuilder.Entity<NCRHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Action).IsRequired();
                entity.Property(e => e.IpAddress).HasMaxLength(45);
                entity.HasIndex(e => e.NCRId);
                entity.HasIndex(e => e.Timestamp).IsDescending();
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Action);

                entity.HasOne<NonConformance>()
                      .WithMany()
                      .HasForeignKey(e => e.NCRId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
