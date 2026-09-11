namespace AeroQMS.API.Models
{
    /// <summary>
    /// Canonical checklist question type strings — keep in sync with frontend questionTypes.ts
    /// </summary>
    public static class ChecklistQuestionTypes
    {
        public const string PassFail = "PassFail";
        public const string YesNo = "YesNo";
        public const string Text = "Text";
        public const string Number = "Number";
        public const string PhotoRequired = "PhotoRequired";

        public static readonly string[] All =
        {
            PassFail,
            YesNo,
            Text,
            Number,
            PhotoRequired,
        };

        public static bool IsValid(string? value) =>
            !string.IsNullOrWhiteSpace(value) &&
            All.Contains(value, StringComparer.OrdinalIgnoreCase);

        public static ChecklistItemType ToItemType(string type)
        {
            return type?.Trim() switch
            {
                var t when t.Equals(PassFail, StringComparison.OrdinalIgnoreCase) => ChecklistItemType.PassFail,
                var t when t.Equals(YesNo, StringComparison.OrdinalIgnoreCase) => ChecklistItemType.YesNo,
                var t when t.Equals(Text, StringComparison.OrdinalIgnoreCase) => ChecklistItemType.Text,
                var t when t.Equals(Number, StringComparison.OrdinalIgnoreCase) => ChecklistItemType.Number,
                var t when t.Equals(PhotoRequired, StringComparison.OrdinalIgnoreCase) => ChecklistItemType.PhotoRequired,
                _ => throw new ArgumentException($"Unsupported question type: {type}"),
            };
        }

        public static string FromItemType(ChecklistItemType itemType) =>
            itemType switch
            {
                ChecklistItemType.PassFail => PassFail,
                ChecklistItemType.YesNo => YesNo,
                ChecklistItemType.Text => Text,
                ChecklistItemType.Number => Number,
                ChecklistItemType.PhotoRequired => PhotoRequired,
                _ => PassFail,
            };

        public static void ApplyTypeDefaults(ChecklistTemplateItem item, ChecklistItemType itemType)
        {
            item.ItemType = itemType;
            switch (itemType)
            {
                case ChecklistItemType.YesNo:
                    item.AllowNA = false;
                    item.RequiresPhotoOnFail = false;
                    break;
                case ChecklistItemType.PhotoRequired:
                    item.AllowNA = true;
                    item.RequiresPhotoOnFail = true;
                    break;
                case ChecklistItemType.Number:
                    item.AllowNA = true;
                    item.RequiresPhotoOnFail = false;
                    break;
                case ChecklistItemType.Text:
                    item.AllowNA = false;
                    item.RequiresPhotoOnFail = false;
                    break;
                default:
                    item.AllowNA = true;
                    item.RequiresPhotoOnFail = false;
                    break;
            }
        }
    }
}
