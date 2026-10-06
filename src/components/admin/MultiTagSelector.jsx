import { useEffect, useState } from "react";
import { Tag as TagIcon, Plus, X } from "lucide-react";
import { tagService } from "../../services/tagService";

export default function MultiTagSelector({ selectedTagIds = [], onChange }) {
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchTags() {
      setLoading(true);
      try {
        const res = await tagService.getTags();
        setAllTags(Array.isArray(res) ? res : res?.items || []);
      } catch (err) {
        console.error("Lỗi lấy danh sách tags:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, []);

  const handleToggleTag = (tagId) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <TagIcon className="w-3.5 h-3.5 text-primary" />
        <span>Thẻ phân loại (Tags)</span>
      </label>

      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl min-h-[48px]">
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleToggleTag(tag.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition ${
                isSelected
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span>{tag.name}</span>
              {isSelected ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3 text-gray-400" />}
            </button>
          );
        })}

        {allTags.length === 0 && !loading && (
          <span className="text-xs text-gray-400">Không có tag sẵn có</span>
        )}
      </div>
    </div>
  );
}
