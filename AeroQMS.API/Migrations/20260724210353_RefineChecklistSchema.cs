using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AeroQMS.API.Migrations
{
    /// <inheritdoc />
    public partial class RefineChecklistSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReferenceDocument",
                table: "ChecklistTemplateItems",
                type: "TEXT",
                nullable: true);

            // Step 1: Convert existing Pending (value = 0) rows to NULL to represent "not yet marked"
            // This is data-safe — only rows that were explicitly Pending (= 0) are affected;
            // Pass (= 1), Fail (= 2), and NA (= 3) remain unchanged (note: old enum had Pending=0, Pass=1, Fail=2, NA=3;
            // new enum starts at Pass=0, so we also need to remap values 1→0, 2→1, 3→2).
            migrationBuilder.Sql(
                @"UPDATE ChecklistInstanceItems SET Result = NULL WHERE Result = 0;" +
                @"UPDATE ChecklistInstanceItems SET Result = Result - 1 WHERE Result IS NOT NULL;");

            migrationBuilder.AlterColumn<int>(
                name: "Result",
                table: "ChecklistInstanceItems",
                type: "INTEGER",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "INTEGER");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReferenceDocument",
                table: "ChecklistTemplateItems");

            // Reverse the value remap: new Pass=0→old Pass=1, Fail=1→2, NA=2→3
            migrationBuilder.Sql(
                @"UPDATE ChecklistInstanceItems SET Result = Result + 1 WHERE Result IS NOT NULL;");
            // NULLs go back to Pending (0)
            migrationBuilder.Sql(
                @"UPDATE ChecklistInstanceItems SET Result = 0 WHERE Result IS NULL;");

            migrationBuilder.AlterColumn<int>(
                name: "Result",
                table: "ChecklistInstanceItems",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "INTEGER",
                oldNullable: true);
        }
    }
}
