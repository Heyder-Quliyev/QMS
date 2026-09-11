using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AeroQMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddChecklistTemplateAdHocAndQuestionTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "ChecklistTemplates",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAdHoc",
                table: "ChecklistTemplates",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_CreatedByUserId",
                table: "ChecklistTemplates",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistTemplates_IsAdHoc",
                table: "ChecklistTemplates",
                column: "IsAdHoc");

            // Legacy ItemType: Text=0 (now PassFail), Numeric=1 -> Number=3
            migrationBuilder.Sql(
                @"UPDATE ChecklistTemplateItems SET ItemType = 3 WHERE ItemType = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ChecklistTemplates_CreatedByUserId",
                table: "ChecklistTemplates");

            migrationBuilder.DropIndex(
                name: "IX_ChecklistTemplates_IsAdHoc",
                table: "ChecklistTemplates");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "ChecklistTemplates");

            migrationBuilder.DropColumn(
                name: "IsAdHoc",
                table: "ChecklistTemplates");
        }
    }
}
