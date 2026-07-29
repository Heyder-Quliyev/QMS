using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AeroQMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingChecklistTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChecklistTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Category = table.Column<string>(type: "TEXT", nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValue: new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc)),
                    ApprovedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistTemplates", x => x.Id);
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
                    ItemType = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0), // 0 = Text
                    MinThreshold = table.Column<decimal>(type: "TEXT", nullable: true),
                    MaxThreshold = table.Column<decimal>(type: "TEXT", nullable: true),
                    IsRequired = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    AllowNA = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
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
                name: "ChecklistInstances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ChecklistTemplateId = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0), // 0 = Draft
                    AssignedTo = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValue: new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc)),
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
                    ChangedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValue: new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc)),
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
                    Result = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0), // 0 = Pending
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

            // Indexes
            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_IsActive",
                table: "ChecklistTemplates",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_Category",
                table: "ChecklistTemplates",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplateItems_ChecklistTemplateId",
                table: "ChecklistTemplateItems",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_Status",
                table: "ChecklistInstances",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_AssignedTo",
                table: "ChecklistInstances",
                column: "AssignedTo");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_DueDate",
                table: "ChecklistInstances",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_CreatedAt",
                table: "ChecklistInstances",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistInstances_ChecklistTemplateId",
                table: "ChecklistInstances",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditLogs_ChecklistInstanceId",
                table: "ChecklistAuditLogs",
                column: "ChecklistInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditLogs_ChangedAt",
                table: "ChecklistAuditLogs",
                column: "ChangedAt",
                descending: new bool[0]);

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChecklistAuditLogs");

            migrationBuilder.DropTable(
                name: "ChecklistInstanceItems");

            migrationBuilder.DropTable(
                name: "ChecklistInstances");

            migrationBuilder.DropTable(
                name: "ChecklistTemplateItems");

            migrationBuilder.DropTable(
                name: "ChecklistTemplates");
        }
    }
}
