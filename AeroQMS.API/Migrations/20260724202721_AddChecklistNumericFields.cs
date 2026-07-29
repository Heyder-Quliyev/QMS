using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AeroQMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddChecklistNumericFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CapaHistories_Timestamp",
                table: "CapaHistories");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "ForcePasswordChange",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLogin",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChangeReason",
                table: "CapaHistories",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "CapaHistories",
                type: "TEXT",
                maxLength: 45,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Metadata",
                table: "CapaHistories",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserAgent",
                table: "CapaHistories",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContributingFactors",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NCRDescription",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NCRReference",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NCRTitle",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OccurrenceDate",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReportedByEmail",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReportedByName",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RootCause",
                table: "CapaActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ChecklistTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Category = table.Column<string>(type: "TEXT", nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ApprovedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentAccessLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    VersionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: true),
                    Source = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    DeviceInfo = table.Column<string>(type: "TEXT", nullable: true),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: true),
                    AccessedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentAccessLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentAcknowledgmentRequirements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    RequiredRole = table.Column<string>(type: "TEXT", maxLength: 60, nullable: true),
                    IndividualUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    DueDays = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentAcknowledgmentRequirements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentAcknowledgments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    VersionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    DocumentRevision = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    AcknowledgedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: true),
                    DeviceInfo = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentAcknowledgments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentApprovalWorkflows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    StepNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    StepName = table.Column<string>(type: "TEXT", nullable: false),
                    RequiredRole = table.Column<string>(type: "TEXT", nullable: true),
                    RequiredUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: true),
                    Comment = table.Column<string>(type: "TEXT", nullable: true),
                    ActionedById = table.Column<int>(type: "INTEGER", nullable: true),
                    ActionedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentApprovalWorkflows", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentRelationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SourceDocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    TargetDocumentId = table.Column<int>(type: "INTEGER", nullable: true),
                    TargetNcrId = table.Column<int>(type: "INTEGER", nullable: true),
                    TargetCapaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    RelationshipType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Note = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedById = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentRelationships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    DocumentNumber = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Category = table.Column<string>(type: "TEXT", nullable: false),
                    Department = table.Column<string>(type: "TEXT", nullable: false),
                    Revision = table.Column<string>(type: "TEXT", nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ReviewDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Owner = table.Column<string>(type: "TEXT", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", nullable: true),
                    ExtractedText = table.Column<string>(type: "TEXT", nullable: true),
                    ChangeSummary = table.Column<string>(type: "TEXT", nullable: true),
                    ApprovalSnapshot = table.Column<string>(type: "TEXT", nullable: true),
                    SnapshotAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentVersions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NCRHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    NCRId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserName = table.Column<string>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    OldValue = table.Column<string>(type: "TEXT", nullable: true),
                    NewValue = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IpAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "TEXT", nullable: true),
                    ChangeReason = table.Column<string>(type: "TEXT", nullable: true),
                    Metadata = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NCRHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NCRHistories_NonConformances_NCRId",
                        column: x => x.NCRId,
                        principalTable: "NonConformances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PortalFeedbacks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PortalGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: true),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PortalFeedbacks_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PortalGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    CompanyId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReviewAutomationSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CategoryRulesJson = table.Column<string>(type: "TEXT", nullable: false),
                    NotificationRulesJson = table.Column<string>(type: "TEXT", nullable: false),
                    EscalationRulesJson = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewAutomationSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistInstances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ChecklistTemplateId = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    AssignedTo = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedBy = table.Column<string>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DueDate = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistInstances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistInstances_ChecklistTemplates_ChecklistTemplateId",
                        column: x => x.ChecklistTemplateId,
                        principalTable: "ChecklistTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistTemplateItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ChecklistTemplateId = table.Column<int>(type: "INTEGER", nullable: false),
                    Text = table.Column<string>(type: "TEXT", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemType = table.Column<int>(type: "INTEGER", nullable: false),
                    MinThreshold = table.Column<decimal>(type: "TEXT", nullable: true),
                    MaxThreshold = table.Column<decimal>(type: "TEXT", nullable: true),
                    IsRequired = table.Column<bool>(type: "INTEGER", nullable: false),
                    AllowNA = table.Column<bool>(type: "INTEGER", nullable: false),
                    RequiresNoteOnFail = table.Column<bool>(type: "INTEGER", nullable: false),
                    RequiresPhotoOnFail = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistTemplateItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistTemplateItems_ChecklistTemplates_ChecklistTemplateId",
                        column: x => x.ChecklistTemplateId,
                        principalTable: "ChecklistTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PortalDocuments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PortalGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PortalDocuments_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PortalDocuments_PortalGroups_PortalGroupId",
                        column: x => x.PortalGroupId,
                        principalTable: "PortalGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PortalUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PortalGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    AccessToken = table.Column<string>(type: "TEXT", nullable: false),
                    LastAccess = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PortalUsers_PortalGroups_PortalGroupId",
                        column: x => x.PortalGroupId,
                        principalTable: "PortalGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistAuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ChecklistInstanceId = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemId = table.Column<int>(type: "INTEGER", nullable: true),
                    Action = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    OldValue = table.Column<string>(type: "TEXT", nullable: true),
                    NewValue = table.Column<string>(type: "TEXT", nullable: true),
                    ChangedBy = table.Column<string>(type: "TEXT", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IPAddress = table.Column<string>(type: "TEXT", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistAuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistAuditLogs_ChecklistInstances_ChecklistInstanceId",
                        column: x => x.ChecklistInstanceId,
                        principalTable: "ChecklistInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistInstanceItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ChecklistInstanceId = table.Column<int>(type: "INTEGER", nullable: false),
                    ChecklistTemplateItemId = table.Column<int>(type: "INTEGER", nullable: false),
                    Text = table.Column<string>(type: "TEXT", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    Result = table.Column<int>(type: "INTEGER", nullable: false),
                    NumericValue = table.Column<decimal>(type: "TEXT", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    PhotoPath = table.Column<string>(type: "TEXT", nullable: true),
                    CompletedBy = table.Column<string>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistInstanceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistInstanceItems_ChecklistInstances_ChecklistInstanceId",
                        column: x => x.ChecklistInstanceId,
                        principalTable: "ChecklistInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChecklistInstanceItems_ChecklistTemplateItems_ChecklistTemplateItemId",
                        column: x => x.ChecklistTemplateItemId,
                        principalTable: "ChecklistTemplateItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PortalAccessLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PortalUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    DocumentId = table.Column<int>(type: "INTEGER", nullable: false),
                    Action = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    AccessedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortalAccessLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PortalAccessLogs_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PortalAccessLogs_PortalUsers_PortalUserId",
                        column: x => x.PortalUserId,
                        principalTable: "PortalUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CapaHistories_Action",
                table: "CapaHistories",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_CapaHistories_Timestamp",
                table: "CapaHistories",
                column: "Timestamp",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_CapaHistories_UserId",
                table: "CapaHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CapaActions_NCRId_Status",
                table: "CapaActions",
                columns: new[] { "NCRId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapaActions_ResponsiblePersonId_Status",
                table: "CapaActions",
                columns: new[] { "ResponsiblePersonId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CapaActions_Status_DueDate",
                table: "CapaActions",
                columns: new[] { "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditLogs_ChangedAt",
                table: "ChecklistAuditLogs",
                column: "ChangedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditLogs_ChecklistInstanceId",
                table: "ChecklistAuditLogs",
                column: "ChecklistInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstanceItems_ChecklistInstanceId",
                table: "ChecklistInstanceItems",
                column: "ChecklistInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstanceItems_ChecklistTemplateItemId",
                table: "ChecklistInstanceItems",
                column: "ChecklistTemplateItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstanceItems_Result",
                table: "ChecklistInstanceItems",
                column: "Result");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_AssignedTo",
                table: "ChecklistInstances",
                column: "AssignedTo");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_ChecklistTemplateId",
                table: "ChecklistInstances",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_CreatedAt",
                table: "ChecklistInstances",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_DueDate",
                table: "ChecklistInstances",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_Status",
                table: "ChecklistInstances",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplateItems_ChecklistTemplateId",
                table: "ChecklistTemplateItems",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_Category",
                table: "ChecklistTemplates",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_IsActive",
                table: "ChecklistTemplates",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAccessLogs_AccessedAt",
                table: "DocumentAccessLogs",
                column: "AccessedAt");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAccessLogs_DocumentId",
                table: "DocumentAccessLogs",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAccessLogs_UserId",
                table: "DocumentAccessLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgmentRequirements_DocumentId",
                table: "DocumentAcknowledgmentRequirements",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgmentRequirements_IndividualUserId",
                table: "DocumentAcknowledgmentRequirements",
                column: "IndividualUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgmentRequirements_RequiredRole",
                table: "DocumentAcknowledgmentRequirements",
                column: "RequiredRole");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgments_DocumentId",
                table: "DocumentAcknowledgments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgments_DocumentId_UserId_DocumentRevision",
                table: "DocumentAcknowledgments",
                columns: new[] { "DocumentId", "UserId", "DocumentRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAcknowledgments_UserId",
                table: "DocumentAcknowledgments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentApprovalWorkflows_DocumentId",
                table: "DocumentApprovalWorkflows",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentApprovalWorkflows_DocumentId_StepNumber",
                table: "DocumentApprovalWorkflows",
                columns: new[] { "DocumentId", "StepNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentApprovalWorkflows_Status",
                table: "DocumentApprovalWorkflows",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_CreatedAt",
                table: "DocumentRelationships",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_CreatedById",
                table: "DocumentRelationships",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_SourceDocumentId",
                table: "DocumentRelationships",
                column: "SourceDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_TargetCapaId",
                table: "DocumentRelationships",
                column: "TargetCapaId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_TargetDocumentId",
                table: "DocumentRelationships",
                column: "TargetDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentRelationships_TargetNcrId",
                table: "DocumentRelationships",
                column: "TargetNcrId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentVersions_DocumentId",
                table: "DocumentVersions",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentVersions_DocumentNumber",
                table: "DocumentVersions",
                column: "DocumentNumber");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentVersions_SnapshotAt",
                table: "DocumentVersions",
                column: "SnapshotAt");

            migrationBuilder.CreateIndex(
                name: "IX_NCRHistories_Action",
                table: "NCRHistories",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_NCRHistories_NCRId",
                table: "NCRHistories",
                column: "NCRId");

            migrationBuilder.CreateIndex(
                name: "IX_NCRHistories_Timestamp",
                table: "NCRHistories",
                column: "Timestamp",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_NCRHistories_UserId",
                table: "NCRHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalAccessLogs_AccessedAt",
                table: "PortalAccessLogs",
                column: "AccessedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_PortalAccessLogs_DocumentId",
                table: "PortalAccessLogs",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalAccessLogs_PortalUserId",
                table: "PortalAccessLogs",
                column: "PortalUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalDocuments_DocumentId",
                table: "PortalDocuments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalDocuments_PortalGroupId",
                table: "PortalDocuments",
                column: "PortalGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalDocuments_PortalGroupId_DocumentId",
                table: "PortalDocuments",
                columns: new[] { "PortalGroupId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PortalFeedbacks_CreatedAt",
                table: "PortalFeedbacks",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_PortalFeedbacks_DocumentId",
                table: "PortalFeedbacks",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalFeedbacks_PortalGroupId",
                table: "PortalFeedbacks",
                column: "PortalGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalGroups_CompanyId",
                table: "PortalGroups",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_PortalGroups_Slug",
                table: "PortalGroups",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PortalUsers_AccessToken",
                table: "PortalUsers",
                column: "AccessToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PortalUsers_PortalGroupId",
                table: "PortalUsers",
                column: "PortalGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewAutomationSettings_UpdatedAt",
                table: "ReviewAutomationSettings",
                column: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChecklistAuditLogs");

            migrationBuilder.DropTable(
                name: "ChecklistInstanceItems");

            migrationBuilder.DropTable(
                name: "DocumentAccessLogs");

            migrationBuilder.DropTable(
                name: "DocumentAcknowledgmentRequirements");

            migrationBuilder.DropTable(
                name: "DocumentAcknowledgments");

            migrationBuilder.DropTable(
                name: "DocumentApprovalWorkflows");

            migrationBuilder.DropTable(
                name: "DocumentRelationships");

            migrationBuilder.DropTable(
                name: "DocumentVersions");

            migrationBuilder.DropTable(
                name: "NCRHistories");

            migrationBuilder.DropTable(
                name: "PortalAccessLogs");

            migrationBuilder.DropTable(
                name: "PortalDocuments");

            migrationBuilder.DropTable(
                name: "PortalFeedbacks");

            migrationBuilder.DropTable(
                name: "ReviewAutomationSettings");

            migrationBuilder.DropTable(
                name: "ChecklistInstances");

            migrationBuilder.DropTable(
                name: "ChecklistTemplateItems");

            migrationBuilder.DropTable(
                name: "PortalUsers");

            migrationBuilder.DropTable(
                name: "ChecklistTemplates");

            migrationBuilder.DropTable(
                name: "PortalGroups");

            migrationBuilder.DropIndex(
                name: "IX_CapaHistories_Action",
                table: "CapaHistories");

            migrationBuilder.DropIndex(
                name: "IX_CapaHistories_Timestamp",
                table: "CapaHistories");

            migrationBuilder.DropIndex(
                name: "IX_CapaHistories_UserId",
                table: "CapaHistories");

            migrationBuilder.DropIndex(
                name: "IX_CapaActions_NCRId_Status",
                table: "CapaActions");

            migrationBuilder.DropIndex(
                name: "IX_CapaActions_ResponsiblePersonId_Status",
                table: "CapaActions");

            migrationBuilder.DropIndex(
                name: "IX_CapaActions_Status_DueDate",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ForcePasswordChange",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLogin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ChangeReason",
                table: "CapaHistories");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "CapaHistories");

            migrationBuilder.DropColumn(
                name: "Metadata",
                table: "CapaHistories");

            migrationBuilder.DropColumn(
                name: "UserAgent",
                table: "CapaHistories");

            migrationBuilder.DropColumn(
                name: "ContributingFactors",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "NCRDescription",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "NCRReference",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "NCRTitle",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "OccurrenceDate",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "ReportedByEmail",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "ReportedByName",
                table: "CapaActions");

            migrationBuilder.DropColumn(
                name: "RootCause",
                table: "CapaActions");

            migrationBuilder.CreateIndex(
                name: "IX_CapaHistories_Timestamp",
                table: "CapaHistories",
                column: "Timestamp");
        }
    }
}
