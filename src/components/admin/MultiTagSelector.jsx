import { useEffect, useState } from "react";
import { LoadingState } from "./ui";
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
    <div role="group" aria-label="Thẻ phân loại" className="flex flex-wrap gap-2">
      {allTags.map((tag) => {
        const selected = selectedTagIds.includes(tag.id);
        return <button key={tag.id} type="button" aria-pressed={selected} onClick={() => handleToggleTag(tag.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] ${selected ? "border-[#2C56A8] bg-blue-50 text-[#1D3E82]" : "border-[#DCE2EE] bg-white text-[#5C6B8A] hover:bg-[#F8FAFC]"}`}><span>{tag.name}</span><span aria-hidden="true" className="material-symbols-outlined text-[18px]">{selected ? "check" : "add"}</span></button>;
      })}
      {loading && <LoadingState variant="inline" label="Đang tải thẻ..." />}
      {allTags.length === 0 && !loading && <span className="text-sm text-[#5C6B8A]">Không có tag sẵn có</span>}
    </div>
  );
}
